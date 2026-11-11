import {
  doc,
  runTransaction,
  writeBatch,
  Transaction,
  WriteBatch,
  Firestore,
  DocumentReference,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  InventoryBalance,
  InventoryMovement,
  MovementType,
  MaterialMaster,
  MasterLocation,
} from '../types';

/**
 * Enterprise Inventory Engine for Logistics Control Tower – PT IAS Support Indonesia
 *
 * Implements:
 * 1. Authoritative Running Inventory Balance + Immutable Movement Ledger
 * 2. Pure Delta Formula: newBalance = previousAuthoritativeBalance + delta
 * 3. Strict Read-Before-Write within Firestore runTransaction
 * 4. Transaction Idempotency & Concurrency Locking
 * 5. Anti-Negative Stock Enforcement
 * 6. Spark Tier Read/Write Quota Optimization (Batched & Chunked <= 400 ops)
 */

export interface PostMovementParams {
  materialId: string;
  materialCode: string;
  materialName: string;
  locationId: string;
  locationName: string;
  unit: string;
  variantValue?: string;
  movementType: MovementType;
  quantity: number; // Absolute quantity (always >= 0)
  delta: number; // Signed delta (+ increases, - decreases, 0 for write-offs)
  sourceDocumentId: string;
  sourceDocumentType: string;
  sourceLineId?: string;
  idempotencyKey: string;
  actorName: string;
  actorEmployeeId?: string;
  notes?: string;
  unitCost?: number;
  timestamp?: string; // ISO / Jakarta string
  materialFallback?: Partial<MaterialMaster>;
}

export interface PostMovementResult {
  movementId: string;
  balanceId: string;
  balanceBefore: number;
  balanceAfter: number;
  delta: number;
  version: number;
  alreadyProcessed?: boolean;
}

/**
 * Generate standard canonical inventory balance document ID: bal-{materialId}-{locationId}
 */
export function getCanonicalBalanceId(materialId: string, locationId: string): string {
  return `bal-${materialId}-${locationId}`;
}

/**
 * Generate deterministic idempotency key for transactions
 */
export function generateIdempotencyKey(
  sourceType: string,
  sourceId: string,
  materialId: string,
  locationId: string,
  movementType: MovementType,
  sequence: number = 1
): string {
  return `idemp-${sourceType}-${sourceId}-${materialId}-${locationId}-${movementType}-${sequence}`;
}

/**
 * Generates Jakarta timestamp string YYYY-MM-DD HH:mm:ss
 */
export function getJakartaIsoString(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const jakartaDate = new Date(utcMs + 7 * 3600000);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const Y = jakartaDate.getFullYear();
  const M = pad(jakartaDate.getMonth() + 1);
  const D = pad(jakartaDate.getDate());
  const h = pad(jakartaDate.getHours());
  const m = pad(jakartaDate.getMinutes());
  const s = pad(jakartaDate.getSeconds());
  return `${Y}-${M}-${D} ${h}:${m}:${s}`;
}

/**
 * Strips undefined properties to ensure Firestore compatibility
 */
export function sanitizeDoc<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = sanitizeDoc(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
}

/**
 * Pure calculation function: computes balanceAfter, cumulative qtyIn, qtyOut, totalAdjustments
 */
export function calculateNewBalanceState(
  current: {
    openingStock: number;
    qtyIn: number;
    qtyOut: number;
    totalAdjustments: number;
    availableStock: number;
    version: number;
  },
  movementType: MovementType,
  quantity: number,
  delta: number
): {
  balanceBefore: number;
  balanceAfter: number;
  newQtyIn: number;
  newQtyOut: number;
  newTotalAdjustments: number;
  newVersion: number;
} {
  const balanceBefore = Number(current.availableStock) || 0;
  const balanceAfter = balanceBefore + delta;

  if (balanceAfter < 0) {
    throw new Error(
      `INSUFFICIENT_STOCK: Saldo persediaan (${balanceBefore}) tidak mencukupi untuk pengurangan sebesar ${Math.abs(delta)}. Saldo akhir tidak boleh negatif.`
    );
  }

  let newQtyIn = Number(current.qtyIn) || 0;
  let newQtyOut = Number(current.qtyOut) || 0;
  let newTotalAdjustments = Number(current.totalAdjustments) || 0;

  switch (movementType) {
    case 'OPENING_BALANCE':
      // Opening balance initialization or restatement
      break;
    case 'GOODS_RECEIPT':
      newQtyIn += quantity;
      break;
    case 'GOODS_ISSUE':
    case 'DAILY_CONSUMPTION':
      newQtyOut += quantity;
      break;
    case 'TRANSFER_DISPATCH':
      if (delta >= 0) {
        // Inbound to IN_TRANSIT bucket
        newQtyIn += quantity;
      } else {
        // Outbound from source warehouse
        newQtyOut += quantity;
      }
      break;
    case 'TRANSFER_RECEIPT':
      if (delta >= 0) {
        // Inbound to destination warehouse
        newQtyIn += quantity;
      } else {
        // Outbound from IN_TRANSIT bucket
        newQtyOut += quantity;
      }
      break;
    case 'TRANSFER_RETURN':
      if (delta >= 0) {
        // Restored to origin warehouse
        newQtyOut = Math.max(0, newQtyOut - quantity);
      } else {
        // Cleared from IN_TRANSIT bucket
        newQtyOut += quantity;
      }
      break;
    case 'STOCK_OPNAME_ADJUSTMENT':
      // Opname adjustment contributes directly to net adjustments
      newTotalAdjustments += delta;
      break;
    case 'TRANSFER_LOSS':
    case 'TRANSFER_DAMAGE':
      // Compensating deduction from IN_TRANSIT bucket
      if (delta < 0) {
        newQtyOut += quantity;
      }
      break;
    case 'ADMIN_CORRECTION':
      if (delta >= 0) {
        newQtyIn += delta;
      } else {
        newQtyOut += Math.abs(delta);
      }
      break;
  }

  return {
    balanceBefore,
    balanceAfter,
    newQtyIn,
    newQtyOut,
    newTotalAdjustments,
    newVersion: (current.version || 0) + 1,
  };
}

/**
 * Read-before-write transaction core:
 * Reads existing balance doc (or creates in-memory placeholder if not existing),
 * reads movement doc to guarantee idempotency,
 * applies delta formula, writes immutable movement and updates authoritative balance.
 */
export async function executeInventoryMovementInTransaction(
  transaction: Transaction,
  firestoreInstance: Firestore,
  params: PostMovementParams,
  options?: {
    customBalanceDocId?: string; // In case existing production uses a legacy ID
  }
): Promise<PostMovementResult> {
  const now = params.timestamp || getJakartaIsoString();
  const balanceId = options?.customBalanceDocId || getCanonicalBalanceId(params.materialId, params.locationId);
  const balRef = doc(firestoreInstance, 'inventory', balanceId);

  // Determine movement ID deterministically from idempotencyKey or timestamp
  const movementDocId = `mov-${params.idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const movRef = doc(firestoreInstance, 'inventoryMovements', movementDocId);

  // 1. STRICT READS FIRST
  const [balSnap, movSnap] = await Promise.all([
    transaction.get(balRef),
    transaction.get(movRef),
  ]);

  // Idempotency check
  if (movSnap.exists()) {
    const existingMovement = movSnap.data() as InventoryMovement;
    return {
      movementId: movementDocId,
      balanceId,
      balanceBefore: existingMovement.balanceBefore,
      balanceAfter: existingMovement.balanceAfter,
      delta: existingMovement.delta,
      version: 0,
      alreadyProcessed: true,
    };
  }

  // 2. COMPUTE STATE
  let currentBalanceState: {
    openingStock: number;
    qtyIn: number;
    qtyOut: number;
    totalAdjustments: number;
    availableStock: number;
    version: number;
  };

  let isNewBalance = false;
  let existingData: Partial<InventoryBalance> = {};

  if (balSnap.exists()) {
    existingData = balSnap.data() as InventoryBalance;
    currentBalanceState = {
      openingStock: Number(existingData.openingStock) || 0,
      qtyIn: Number(existingData.qtyIn) || 0,
      qtyOut: Number(existingData.qtyOut) || 0,
      totalAdjustments: Number(existingData.totalAdjustments) || 0,
      availableStock: Number(existingData.availableStock) || 0,
      version: Number(existingData.version) || 0,
    };
  } else {
    isNewBalance = true;
    currentBalanceState = {
      openingStock: params.movementType === 'OPENING_BALANCE' ? params.quantity : 0,
      qtyIn: 0,
      qtyOut: 0,
      totalAdjustments: 0,
      availableStock: 0,
      version: 0,
    };
  }

  // Calculate new balance
  const calc = calculateNewBalanceState(
    currentBalanceState,
    params.movementType,
    params.quantity,
    params.delta
  );

  // 3. STRICT WRITES AFTER READS
  const movementRecord: InventoryMovement = {
    id: movementDocId,
    movementId: movementDocId,
    materialId: params.materialId,
    materialCode: params.materialCode,
    materialName: params.materialName,
    locationId: params.locationId,
    locationName: params.locationName,
    unit: params.unit,
    variantValue: params.variantValue || '',
    movementType: params.movementType,
    quantity: params.quantity,
    delta: params.delta,
    balanceBefore: calc.balanceBefore,
    balanceAfter: calc.balanceAfter,
    sourceDocumentId: params.sourceDocumentId,
    sourceDocumentType: params.sourceDocumentType,
    sourceLineId: params.sourceLineId || '',
    status: 'POSTED',
    idempotencyKey: params.idempotencyKey,
    createdTimestampMs: Date.now(),
    postingSequence: Date.now(),
    notes: params.notes || '',
    recordedBy: params.actorName,
    recordedByEmployeeId: params.actorEmployeeId || '',
    createdAt: now,
  };

  transaction.set(movRef, sanitizeDoc(movementRecord));

  if (isNewBalance) {
    const newBalDoc: InventoryBalance = {
      id: balanceId,
      materialId: params.materialId,
      itemId: params.materialId,
      materialCode: params.materialCode,
      itemCode: params.materialCode,
      materialName: params.materialName,
      itemName: params.materialName,
      categoryId: params.materialFallback?.categoryId || 'cat-gen',
      categoryName: params.materialFallback?.categoryName || 'General',
      unit: params.unit,
      locationId: params.locationId,
      locationName: params.locationName,
      variantValue: params.variantValue || '',
      openingStock: currentBalanceState.openingStock,
      qtyIn: calc.newQtyIn,
      qtyOut: calc.newQtyOut,
      totalAdjustments: calc.newTotalAdjustments,
      availableStock: calc.balanceAfter,
      minimumStock: params.materialFallback?.minimumStock || 0,
      reorderPoint: params.materialFallback?.reorderPoint || 0,
      lastTransactionDate: now.split(' ')[0],
      unitCost: params.unitCost ?? params.materialFallback?.unitCost ?? 0,
      version: calc.newVersion,
      lastMovementId: movementDocId,
      updatedAt: now,
      updatedBy: params.actorName,
    };
    transaction.set(balRef, sanitizeDoc(newBalDoc));
  } else {
    const updateData: Partial<InventoryBalance> = {
      qtyIn: calc.newQtyIn,
      qtyOut: calc.newQtyOut,
      totalAdjustments: calc.newTotalAdjustments,
      availableStock: calc.balanceAfter,
      version: calc.newVersion,
      lastMovementId: movementDocId,
      lastTransactionDate: now.split(' ')[0],
      updatedAt: now,
      updatedBy: params.actorName,
    };
    if (params.unitCost !== undefined) {
      updateData.unitCost = params.unitCost;
    }
    transaction.update(balRef, sanitizeDoc(updateData));
  }

  return {
    movementId: movementDocId,
    balanceId,
    balanceBefore: calc.balanceBefore,
    balanceAfter: calc.balanceAfter,
    delta: params.delta,
    version: calc.newVersion,
    alreadyProcessed: false,
  };
}

/**
 * Execute movement within an isolated runTransaction call
 */
export async function postInventoryMovement(
  params: PostMovementParams,
  options?: {
    customBalanceDocId?: string;
  }
): Promise<PostMovementResult> {
  return runTransaction(db, async (transaction) => {
    return executeInventoryMovementInTransaction(transaction, db, params, options);
  });
}

/**
 * Batch chunker for bulk operations (e.g. Excel Import), respecting Firestore max operations limit (<= 400 safe threshold)
 */
export async function commitInChunks<T>(
  items: T[],
  chunkSize: number = 400,
  batchHandler: (chunk: T[], batch: WriteBatch) => void
): Promise<number> {
  let committed = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    batchHandler(chunk, batch);
    await batch.commit();
    committed += chunk.length;
  }
  return committed;
}
