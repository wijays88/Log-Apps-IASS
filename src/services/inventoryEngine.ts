import {
  doc,
  collection,
  getDoc,
  getDocs,
  query,
  where,
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
  InventoryBaseline,
  BaselineStatus,
  MovementType,
  MaterialMaster,
  MasterLocation,
  StockOpname,
  SupplyRequestRecord,
  ApprovalRequest,
  ExcelImportValidationError,
  IN_TRANSIT_LOCATION_ID,
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
 * 7. Physical Stock Opname Official Baseline Anchor & Double-Counting Neutralization
 * 8. Non-Destructive Development Baseline Migration Dry-Run Evaluator
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
 * Format Date strictly in Asia/Jakarta (WIB / UTC+7) regardless of client OS timezone.
 * Returns "YYYY-MM-DD HH:mm:ss".
 */
export function getJakartaTimestamp(date: Date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value || '00';
    const hour = get('hour') === '24' ? '00' : get('hour');
    return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`;
  } catch {
    const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const y = wib.getUTCFullYear();
    const m = String(wib.getUTCMonth() + 1).padStart(2, '0');
    const d = String(wib.getUTCDate()).padStart(2, '0');
    const h = String(wib.getUTCHours()).padStart(2, '0');
    const min = String(wib.getUTCMinutes()).padStart(2, '0');
    const s = String(wib.getUTCSeconds()).padStart(2, '0');
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }
}

/**
 * Format Date strictly in Asia/Jakarta (WIB / UTC+7) date-only string "YYYY-MM-DD".
 */
export function getJakartaDateString(date: Date = new Date()): string {
  return getJakartaTimestamp(date).slice(0, 10);
}

/**
 * Parse Jakarta timestamp string ("YYYY-MM-DD HH:mm:ss" or ISO) into UTC epoch milliseconds accurately.
 */
export function parseJakartaTimestampMs(ts?: string): number {
  if (!ts) return 0;
  const trimmed = ts.trim();
  if (!trimmed) return 0;
  // Already has timezone Z or +HH:MM / -HH:MM
  if (/([zZ]|[+-]\d{2}:\d{2})$/.test(trimmed)) {
    const parsed = new Date(trimmed).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  // Date-only "YYYY-MM-DD"
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const parsed = new Date(`${trimmed}T00:00:00+07:00`).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  // Standard "YYYY-MM-DD HH:mm:ss" or "YYYY-MM-DDTHH:mm:ss"
  const normalized = trimmed.replace(' ', 'T') + '+07:00';
  const parsed = new Date(normalized).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Generate standard canonical inventory balance document ID: bal-{materialId}-{locationId}
 */
export function getCanonicalBalanceId(materialId: string, locationId: string): string {
  return `bal-${materialId}-${locationId}`;
}

/**
 * Generate standard canonical inventory baseline document ID: base-{materialId}-{locationId}-v{version}
 */
export function getCanonicalBaselineId(materialId: string, locationId: string, version: number = 1): string {
  return `base-${materialId}-${locationId}-v${version}`;
}

export interface BaselineLedgerSummary {
  materialId: string;
  locationId: string;
  baseline: InventoryBaseline | null;
  baselineStatus: BaselineStatus;
  baselineQuantity: number;
  qtyIn: number;
  qtyOut: number;
  adjustments: number;
  reconstructedClosing: number;
  authoritativeBalance: number;
  reconciliationDifference: number;
  isReconciled: boolean;
  qualifyingMovementsCount: number;
  preBaselineMovementsCount: number;
  hasLegacyCountersFallback?: boolean;
  exceptionReason?: string;
}

export interface ReconcileLedgerOptions {
  itemId?: string;
  materialCode?: string;
  inventoryCounters?: {
    openingStock?: number;
    qtyIn?: number;
    qtyOut?: number;
    totalAdjustments?: number;
  };
  duplicateBalanceCount?: number;
  hasApprovedOpnameWithoutBaseline?: boolean;
}

export function normalizeBaselineStatus(status?: string): BaselineStatus {
  if (status === 'VERIFIED') return 'VERIFIED';
  if (status === 'REVIEW_REQUIRED') return 'REVIEW_REQUIRED';
  if (status === 'RECONCILIATION_EXCEPTION') return 'RECONCILIATION_EXCEPTION';
  return 'UNVERIFIED';
}

function matchesSkuIdOrCode(
  candidate: { materialId?: string; itemId?: string; materialCode?: string; itemCode?: string },
  materialId: string,
  options?: ReconcileLedgerOptions,
  baseline?: InventoryBaseline | null
): boolean {
  const matIds = new Set(
    [materialId, options?.itemId, baseline?.materialId].filter((v): v is string => Boolean(v && v.trim()))
  );
  const matCodes = new Set(
    [materialId, options?.materialCode, baseline?.materialCode].filter((v): v is string => Boolean(v && v.trim()))
  );

  if (candidate.materialId && matIds.has(candidate.materialId)) return true;
  if (candidate.itemId && matIds.has(candidate.itemId)) return true;
  if (candidate.materialCode && matCodes.has(candidate.materialCode)) return true;
  if (candidate.itemCode && matCodes.has(candidate.itemCode)) return true;
  return false;
}

/**
 * Computes net unreserved available stock after deducting aggregate PENDING_APPROVAL Goods Issues.
 */
export function calculateUnreservedAvailableStock(
  authoritativeAvailable: number,
  pendingReservedQty: number
): number {
  const safeAvailable = Number(authoritativeAvailable) || 0;
  const safePending = Math.max(0, Number(pendingReservedQty) || 0);
  return Math.max(0, safeAvailable - safePending);
}

/**
 * Sums requestedQuantity of all PENDING_APPROVAL Goods Issues matching material (by id or code) and location.
 */
export function getPendingGoodsIssueReservedQty(
  goodsIssues: Array<{
    status?: string;
    locationId?: string;
    materialId?: string;
    itemId?: string;
    itemCode?: string;
    requestedQuantity?: number;
  }>,
  materialId: string,
  locationId: string,
  materialCode?: string
): number {
  let reserved = 0;
  for (const gi of goodsIssues || []) {
    if (gi.status !== 'PENDING_APPROVAL') continue;
    if (gi.locationId !== locationId) continue;
    const isMatch =
      gi.materialId === materialId ||
      gi.itemId === materialId ||
      (Boolean(materialCode) && gi.itemCode === materialCode);
    if (isMatch) {
      reserved += Math.max(0, Number(gi.requestedQuantity) || 0);
    }
  }
  return reserved;
}

/**
 * Counts duplicate /inventory balance documents per row ID across any shared SKU identifier
 * (materialId, itemId, materialCode, itemCode) within the same warehouse location.
 */
export function countDuplicateInventoryBalances(
  inventory: InventoryBalance[]
): Map<string, number> {
  const result = new Map<string, number>();
  const byLocation = new Map<string, InventoryBalance[]>();

  for (const row of inventory || []) {
    if (!row || row.locationId === 'loc-in-transit') continue;
    const list = byLocation.get(row.locationId) || [];
    list.push(row);
    byLocation.set(row.locationId, list);
  }

  for (const [, locRows] of byLocation.entries()) {
    const tokenToRowKeys = new Map<string, Set<string>>();
    const rowTokens = new Map<string, string[]>();

    locRows.forEach((row, idx) => {
      const rowKey = row.id || `__idx_${idx}`;
      const tokens = Array.from(
        new Set(
          [row.materialId, row.itemId, row.materialCode, row.itemCode]
            .filter((t): t is string => Boolean(t && String(t).trim()))
            .map((t) => String(t).trim())
        )
      );
      rowTokens.set(rowKey, tokens);
      for (const token of tokens) {
        const set = tokenToRowKeys.get(token) || new Set<string>();
        set.add(rowKey);
        tokenToRowKeys.set(token, set);
      }
    });

    locRows.forEach((row, idx) => {
      const rowKey = row.id || `__idx_${idx}`;
      const tokens = rowTokens.get(rowKey) || [];
      const matchedRows = new Set<string>([rowKey]);
      for (const token of tokens) {
        const peers = tokenToRowKeys.get(token);
        if (peers) {
          for (const peer of peers) matchedRows.add(peer);
        }
      }
      if (row.id) {
        result.set(row.id, matchedRows.size);
      }
    });
  }

  return result;
}

/**
 * Shared authoritative reconciliation map across Dashboard, Laporan, and Posisi Persediaan
 * so VERIFIED / UNVERIFIED / REVIEW_REQUIRED / RECONCILIATION_EXCEPTION counts always match.
 */
export function buildInventoryReconciliationMap(params: {
  inventory: InventoryBalance[];
  inventoryBaselines: InventoryBaseline[];
  inventoryMovements: InventoryMovement[];
  stockOpnames: StockOpname[];
}): Map<string, BaselineLedgerSummary> {
  const { inventory, inventoryBaselines, inventoryMovements, stockOpnames } = params;
  const dupCountsById = countDuplicateInventoryBalances(inventory || []);
  const map = new Map<string, BaselineLedgerSummary>();

  for (const item of inventory || []) {
    const matId = item.materialId || item.itemId || '';
    const matCode = item.materialCode || item.itemCode || '';
    const duplicateBalanceCount = (item.id ? dupCountsById.get(item.id) : 1) || 1;

    const activeBaseline = (inventoryBaselines || []).find(
      (b) =>
        (b.materialId === matId ||
          (item.itemId && b.materialId === item.itemId) ||
          (matCode && b.materialCode === matCode)) &&
        b.locationId === item.locationId &&
        b.status === 'ACTIVE'
    );

    const hasApprovedOpnameWithoutBaseline =
      !activeBaseline &&
      (stockOpnames || []).some(
        (so) =>
          so.verificationStatus === 'ADJUSTED' &&
          so.locationId === item.locationId &&
          (so.itemId === matId ||
            (item.itemId && so.itemId === item.itemId) ||
            (matCode && so.itemCode === matCode))
      );

    const summary = reconcileBaselineLedger(
      matId,
      item.locationId,
      activeBaseline,
      inventoryMovements || [],
      Number(item.availableStock) || 0,
      {
        itemId: item.itemId,
        materialCode: matCode,
        inventoryCounters: item,
        duplicateBalanceCount,
        hasApprovedOpnameWithoutBaseline,
      }
    );
    if (item.id) {
      map.set(item.id, summary);
    }
  }

  return map;
}

/**
 * Normalize legacy & hardened Supply Request status values to canonical labels.
 */
export function normalizeSupplyRequestStatus(
  status?: SupplyRequestRecord['status']
): 'REQUESTED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED' {
  if (status === 'CANCELLED') return 'CANCELLED';
  if (status === 'FULFILLED' || status === 'RECEIVED') return 'RECEIVED';
  if (status === 'PARTIAL' || status === 'PARTIALLY_RECEIVED') return 'PARTIALLY_RECEIVED';
  return 'REQUESTED';
}

/**
 * Pure validator & state calculator for Supply Request receipts (anti over-receipt & closed-doc guard).
 */
export function validateSupplyRequestReceipt(
  req: Pick<SupplyRequestRecord, 'requestedQuantity' | 'receivedQuantity' | 'status'>,
  receiveQty: number
): {
  valid: boolean;
  reason?: string;
  newTotalReceived: number;
  newOutstanding: number;
  newStatus: 'PARTIALLY_RECEIVED' | 'RECEIVED';
} {
  const canonicalStatus = normalizeSupplyRequestStatus(req.status);
  if (canonicalStatus === 'CANCELLED') {
    return {
      valid: false,
      reason: 'Permintaan suplai sudah dibatalkan (CANCELLED).',
      newTotalReceived: req.receivedQuantity,
      newOutstanding: Math.max(0, req.requestedQuantity - req.receivedQuantity),
      newStatus: 'PARTIALLY_RECEIVED',
    };
  }
  if (canonicalStatus === 'RECEIVED') {
    return {
      valid: false,
      reason: 'Permintaan suplai sudah terpenuhi penuh (RECEIVED).',
      newTotalReceived: req.receivedQuantity,
      newOutstanding: 0,
      newStatus: 'RECEIVED',
    };
  }

  const qty = Number(receiveQty);
  if (!Number.isFinite(qty) || qty <= 0) {
    return {
      valid: false,
      reason: 'Kuantitas penerimaan harus lebih dari 0.',
      newTotalReceived: req.receivedQuantity,
      newOutstanding: Math.max(0, req.requestedQuantity - req.receivedQuantity),
      newStatus: 'PARTIALLY_RECEIVED',
    };
  }

  const currentReceived = Number(req.receivedQuantity) || 0;
  const requested = Number(req.requestedQuantity) || 0;
  const remaining = Math.max(0, requested - currentReceived);
  if (qty > remaining) {
    return {
      valid: false,
      reason: `Kuantitas penerimaan (${qty}) melebihi sisa outstanding (${remaining}).`,
      newTotalReceived: currentReceived,
      newOutstanding: remaining,
      newStatus: 'PARTIALLY_RECEIVED',
    };
  }

  const newTotalReceived = currentReceived + qty;
  const newOutstanding = Math.max(0, requested - newTotalReceived);
  const newStatus: 'PARTIALLY_RECEIVED' | 'RECEIVED' =
    newOutstanding === 0 ? 'RECEIVED' : 'PARTIALLY_RECEIVED';

  return {
    valid: true,
    newTotalReceived,
    newOutstanding,
    newStatus,
  };
}

/**
 * Pure builder for controlled Stock Opname drafts (PENDING_APPROVAL) when importing INVENTORY_OPENING Excel rows.
 * Never overwrites /inventory.availableStock directly; Admin approval establishes official Physical Baseline v1.
 */
export function buildControlledOpeningOpnameDrafts(params: {
  rawRows: Record<string, any>[];
  materials: MaterialMaster[];
  locations: MasterLocation[];
  inventory: InventoryBalance[];
  existingBaselines: InventoryBaseline[];
  existingOpnames: StockOpname[];
  actorName: string;
  actorEmployeeId: string;
  now?: string;
  startingSeq?: number;
}): {
  drafts: Array<{ opname: StockOpname; approval: ApprovalRequest }>;
  errors: ExcelImportValidationError[];
} {
  const {
    rawRows,
    materials,
    locations,
    inventory,
    existingBaselines,
    existingOpnames,
    actorName,
    actorEmployeeId,
  } = params;
  const now = params.now || getJakartaTimestamp();
  const errors: ExcelImportValidationError[] = [];
  const drafts: Array<{ opname: StockOpname; approval: ApprovalRequest }> = [];
  const seenPairs = new Set<string>();

  let maxSeq = params.startingSeq ?? 40 + existingOpnames.length;
  for (const o of existingOpnames) {
    if (o.opnameNumber?.startsWith('SO-2026-')) {
      const n = Number(o.opnameNumber.slice('SO-2026-'.length));
      if (!Number.isNaN(n) && n > maxSeq) maxSeq = n;
    }
  }

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const matCode = String(row.materialCode || '').trim().toUpperCase();
    const locCode = String(row.locationCode || '').trim().toUpperCase();
    const openingRaw = row.openingStock;
    const openingStock = Number(openingRaw);

    const material = materials.find(
      (m) => m.materialCode.toUpperCase() === matCode && m.isActive !== false
    );
    if (!material) {
      errors.push({
        rowNumber: rowNum,
        field: 'materialCode',
        value: matCode,
        message: `Material aktif ${matCode || '(kosong)'} tidak ditemukan di Master Material.`,
      });
      return;
    }

    const location = locations.find(
      (l) =>
        l.code.toUpperCase() === locCode &&
        l.isActive !== false &&
        l.id !== IN_TRANSIT_LOCATION_ID &&
        l.id !== 'loc-in-transit'
    );
    if (!location) {
      errors.push({
        rowNumber: rowNum,
        field: 'locationCode',
        value: locCode,
        message: `Lokasi aktif ${locCode || '(kosong)'} tidak valid atau tidak terdaftar di Master Lokasi.`,
      });
      return;
    }

    if (openingRaw === '' || openingRaw === undefined || openingRaw === null || Number.isNaN(openingStock) || openingStock < 0) {
      errors.push({
        rowNumber: rowNum,
        field: 'openingStock',
        value: openingRaw,
        message: 'Jumlah fisik saldo awal harus berupa angka >= 0.',
      });
      return;
    }

    const pairKey = `${material.id}::${location.id}`;
    if (seenPairs.has(pairKey)) {
      errors.push({
        rowNumber: rowNum,
        field: 'materialCode',
        value: `${matCode}@${locCode}`,
        message: `Duplikasi pasangan ${matCode} di ${locCode} dalam file import.`,
      });
      return;
    }
    seenPairs.add(pairKey);

    const hasPending = existingOpnames.some(
      (o) =>
        o.verificationStatus === 'PENDING_APPROVAL' &&
        o.locationId === location.id &&
        (o.itemId === material.id || o.itemCode === material.materialCode)
    );
    if (hasPending) {
      errors.push({
        rowNumber: rowNum,
        field: 'materialCode',
        value: `${matCode}@${locCode}`,
        message: `Sudah terdapat Stock Opname PENDING_APPROVAL untuk ${matCode} di ${locCode}. Setujui/tolak terlebih dahulu.`,
      });
      return;
    }

    const existingBal = inventory.find(
      (b) =>
        b.locationId === location.id &&
        (b.materialId === material.id || b.itemId === material.id || b.materialCode === material.materialCode)
    );
    const hasActiveBaseline = existingBaselines.some(
      (b) =>
        b.status === 'ACTIVE' &&
        b.locationId === location.id &&
        (b.materialId === material.id || b.materialCode === material.materialCode)
    );
    const systemQty = existingBal ? Number(existingBal.availableStock) || 0 : 0;
    const variance = openingStock - systemQty;

    maxSeq += 1;
    const opnameNumber = `SO-2026-${maxSeq}`;
    const safeMat = material.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const safeLoc = location.id.replace(/[^a-zA-Z0-9_-]/g, '');
    const tsSeed = Date.now();
    const opnameId = `so-imp-${safeMat}-${safeLoc}-${tsSeed}-${idx}`;
    const approvalId = `app-imp-${safeMat}-${safeLoc}-${tsSeed}-${idx}`;

    const reasonText = hasActiveBaseline
      ? `Import Penyesuaian Opname Excel (${actorEmployeeId})`
      : `Import Draft Saldo Awal Fisik Excel (Menunggu Approval Admin untuk Baseline v1)`;

    const opname: StockOpname = {
      id: opnameId,
      opnameNumber,
      opnameDate: now.slice(0, 10),
      locationId: location.id,
      locationName: location.name,
      itemId: material.id,
      itemCode: material.materialCode,
      itemName: material.materialName,
      variantValue: String(row.variantValue || material.variantValue || ''),
      unit: material.unit,
      systemQuantity: systemQty,
      physicalQuantity: openingStock,
      variance,
      varianceReason: reasonText,
      verificationStatus: 'PENDING_APPROVAL',
      conductedBy: `${actorName} (${actorEmployeeId})`,
      notes: `Draft Stock Opname dari Import Excel (${matCode} @ ${locCode})`,
      createdAt: now,
      countStartedAt: now,
      countCompletedAt: now,
      countCompletedTimestampMs: parseJakartaTimestampMs(now) || Date.now(),
      systemBalanceAtCount: systemQty,
      lastMovementAtCount: existingBal?.lastMovementId || '',
      countVersion: existingBal?.version || 1,
    };

    const approval: ApprovalRequest = {
      id: approvalId,
      type: 'STOCK_OPNAME_ADJUSTMENT',
      referenceId: opnameId,
      referenceNumber: opnameNumber,
      title: `${hasActiveBaseline ? 'Penyesuaian Opname' : 'Baseline Awal'} ${material.materialName} (${variance >= 0 ? '+' : ''}${variance} ${material.unit})`,
      requestingUser: actorName,
      requestingEmployeeId: actorEmployeeId,
      location: location.name,
      submissionDate: now,
      details: {
        itemCode: material.materialCode,
        itemName: material.materialName,
        quantity: Math.abs(variance),
        unit: material.unit,
        reasonOrPurpose: reasonText,
        systemQuantity: systemQty,
        physicalQuantity: openingStock,
        variance,
        variantValue: opname.variantValue,
      },
      status: 'PENDING',
    };

    drafts.push({ opname, approval });
  });

  return { drafts, errors };
}

/**
 * Pure non-mutating baseline cutoff and reconciliation calculator.
 * Strictly avoids double-counting the initial Stock Opname adjustment that established the baseline,
 * supports multi-key matching (materialId / itemId / materialCode), and preserves legacy counter
 * visibility without treating unverified opening values as verified physical stock.
 */
export function reconcileBaselineLedger(
  materialId: string,
  locationId: string,
  baseline: InventoryBaseline | null | undefined,
  movements: InventoryMovement[],
  currentAuthoritativeStock: number,
  options?: ReconcileLedgerOptions
): BaselineLedgerSummary {
  const duplicateCount = options?.duplicateBalanceCount ?? 1;
  const hasDuplicates = duplicateCount > 1;

  // Virtual IN_TRANSIT location is excluded from physical warehouse baselines
  if (locationId === 'loc-in-transit') {
    const skuTransitMovs = (movements || []).filter(
      (m) => matchesSkuIdOrCode(m, materialId, options, baseline) && m.locationId === locationId && m.status !== 'REVERSED'
    );
    const totalDelta = skuTransitMovs.reduce((acc, m) => acc + (Number(m.delta) || 0), 0);
    const qtyIn = skuTransitMovs.filter((m) => m.delta > 0).reduce((acc, m) => acc + m.quantity, 0);
    const qtyOut = skuTransitMovs.filter((m) => m.delta < 0).reduce((acc, m) => acc + Math.abs(m.delta), 0);
    const isReconciled = totalDelta === currentAuthoritativeStock;
    const hasAnomaly = currentAuthoritativeStock < 0 || !isReconciled || hasDuplicates;
    return {
      materialId,
      locationId,
      baseline: null,
      baselineStatus: hasAnomaly ? 'RECONCILIATION_EXCEPTION' : 'VERIFIED',
      baselineQuantity: 0,
      qtyIn,
      qtyOut,
      adjustments: 0,
      reconstructedClosing: totalDelta,
      authoritativeBalance: currentAuthoritativeStock,
      reconciliationDifference: totalDelta - currentAuthoritativeStock,
      isReconciled,
      qualifyingMovementsCount: skuTransitMovs.length,
      preBaselineMovementsCount: 0,
      exceptionReason: hasAnomaly
        ? `Anomali saldo In-Transit (rekonsiliasi ${totalDelta} vs otoritatif ${currentAuthoritativeStock})`
        : undefined,
    };
  }

  // Filter active movements for this SKU and location across id/code aliases
  const skuMovements = (movements || []).filter(
    (m) =>
      matchesSkuIdOrCode(m, materialId, options, baseline) &&
      m.locationId === locationId &&
      m.status !== 'REVERSED'
  );

  if (!baseline || baseline.status !== 'ACTIVE') {
    // No active approved physical baseline
    let qtyIn = 0;
    let qtyOut = 0;
    let adjustments = 0;
    let hasLegacyCountersFallback = false;

    for (const m of skuMovements) {
      if (m.movementType === 'GOODS_RECEIPT' || m.movementType === 'TRANSFER_RECEIPT') {
        qtyIn += m.quantity;
      } else if (
        m.movementType === 'GOODS_ISSUE' ||
        m.movementType === 'TRANSFER_DISPATCH' ||
        m.movementType === 'DAILY_CONSUMPTION'
      ) {
        qtyOut += m.quantity;
      } else if (m.movementType === 'STOCK_OPNAME_ADJUSTMENT' || m.movementType === 'ADMIN_CORRECTION') {
        adjustments += m.delta;
      } else if (m.movementType === 'OPENING_BALANCE') {
        adjustments += m.delta;
      }
    }

    // If no ledger movements exist (pre-ledger / legacy seeded records), reflect /inventory IN/OUT/Adj
    // counters instead of misleadingly showing +0 / -0, while NEVER faking a verified physical opening.
    const counters = options?.inventoryCounters;
    let legacyOpening = 0;
    if (skuMovements.length === 0 && counters) {
      const cIn = Number(counters.qtyIn) || 0;
      const cOut = Number(counters.qtyOut) || 0;
      const cAdj = Number(counters.totalAdjustments) || 0;
      legacyOpening = Number(counters.openingStock) || 0;
      if (cIn !== 0 || cOut !== 0 || cAdj !== 0 || legacyOpening !== 0) {
        qtyIn = cIn;
        qtyOut = cOut;
        adjustments = cAdj;
        hasLegacyCountersFallback = true;
      }
    }

    const reconstructedClosing = (hasLegacyCountersFallback ? legacyOpening : 0) + qtyIn - qtyOut + adjustments;
    const diff = reconstructedClosing - currentAuthoritativeStock;
    const isReconciled = diff === 0;

    let status: BaselineStatus = 'UNVERIFIED';
    let exceptionReason: string | undefined;

    if (currentAuthoritativeStock < 0) {
      status = 'RECONCILIATION_EXCEPTION';
      exceptionReason = `Saldo otoritatif negatif (${currentAuthoritativeStock}) tanpa baseline fisik resmi.`;
    } else if (hasDuplicates) {
      status = 'RECONCILIATION_EXCEPTION';
      exceptionReason = `Ditemukan ${duplicateCount} dokumen saldo /inventory duplikat untuk SKU dan lokasi ini.`;
    } else if (options?.hasApprovedOpnameWithoutBaseline) {
      status = 'REVIEW_REQUIRED';
      exceptionReason = 'Terdapat Stock Opname disetujui yang belum direkonsiliasi menjadi baseline resmi.';
    } else if (skuMovements.length > 0 && !isReconciled) {
      status = 'REVIEW_REQUIRED';
      exceptionReason = `Selisih mutasi tanpa baseline sebesar ${diff} (ledger ${reconstructedClosing} vs otoritatif ${currentAuthoritativeStock}).`;
    }

    return {
      materialId,
      locationId,
      baseline: null,
      baselineStatus: status,
      baselineQuantity: 0,
      qtyIn,
      qtyOut,
      adjustments,
      reconstructedClosing,
      authoritativeBalance: currentAuthoritativeStock,
      reconciliationDifference: diff,
      isReconciled,
      qualifyingMovementsCount: skuMovements.length,
      preBaselineMovementsCount: 0,
      hasLegacyCountersFallback,
      exceptionReason,
    };
  }

  // Active verified physical baseline exists
  const baselineQty = Number(baseline.baselineQuantity) || 0;
  const cutoffMs =
    baseline.countCompletedTimestampMs ||
    parseJakartaTimestampMs(baseline.countCompletedAt || baseline.approvedAt || baseline.createdAt);
  const baselineSourceMovId = baseline.sourceMovementId || '';

  let qtyIn = 0;
  let qtyOut = 0;
  let adjustments = 0;
  let qualifyingCount = 0;
  let preBaselineCount = 0;

  for (const m of skuMovements) {
    const movTime = m.createdTimestampMs || parseJakartaTimestampMs(m.createdAt);
    const isBaselineSourceMovement =
      (Boolean(baselineSourceMovId) && (m.id === baselineSourceMovId || m.movementId === baselineSourceMovId)) ||
      (m.movementType === 'STOCK_OPNAME_ADJUSTMENT' &&
        (m.sourceDocumentId === baseline.stockOpnameId || m.sourceDocumentId === baseline.stockOpnameNumber));

    // Rule: Exclude movements that occurred before/at count cutoff OR were the exact baseline source adjustment
    if ((cutoffMs > 0 && movTime <= cutoffMs) || isBaselineSourceMovement) {
      preBaselineCount++;
      continue;
    }

    // Qualifying movement post-cutoff
    qualifyingCount++;
    if (m.movementType === 'GOODS_RECEIPT' || m.movementType === 'TRANSFER_RECEIPT') {
      qtyIn += m.quantity;
    } else if (
      m.movementType === 'GOODS_ISSUE' ||
      m.movementType === 'TRANSFER_DISPATCH' ||
      m.movementType === 'DAILY_CONSUMPTION'
    ) {
      qtyOut += m.quantity;
    } else if (m.movementType === 'STOCK_OPNAME_ADJUSTMENT' || m.movementType === 'ADMIN_CORRECTION') {
      adjustments += m.delta;
    } else {
      if (m.delta > 0) qtyIn += m.delta;
      else qtyOut += Math.abs(m.delta);
    }
  }

  const reconstructedClosing = baselineQty + qtyIn - qtyOut + adjustments;
  const diff = reconstructedClosing - currentAuthoritativeStock;
  const isReconciled = diff === 0;

  let baselineStatus: BaselineStatus = 'VERIFIED';
  let exceptionReason: string | undefined;

  if (currentAuthoritativeStock < 0) {
    baselineStatus = 'RECONCILIATION_EXCEPTION';
    exceptionReason = `Saldo otoritatif negatif (${currentAuthoritativeStock}) meskipun terdapat baseline.`;
  } else if (hasDuplicates) {
    baselineStatus = 'RECONCILIATION_EXCEPTION';
    exceptionReason = `Ditemukan ${duplicateCount} dokumen saldo /inventory duplikat untuk SKU dan lokasi ini.`;
  } else if (!isReconciled) {
    baselineStatus = 'RECONCILIATION_EXCEPTION';
    exceptionReason = `Selisih rekonsiliasi sebesar ${diff} (rekonstruksi ${reconstructedClosing} vs otoritatif ${currentAuthoritativeStock}).`;
  }

  return {
    materialId,
    locationId,
    baseline,
    baselineStatus,
    baselineQuantity: baselineQty,
    qtyIn,
    qtyOut,
    adjustments,
    reconstructedClosing,
    authoritativeBalance: currentAuthoritativeStock,
    reconciliationDifference: diff,
    isReconciled,
    qualifyingMovementsCount: qualifyingCount,
    preBaselineMovementsCount: preBaselineCount,
    exceptionReason,
  };
}

export interface MigrationDryRunRow {
  balanceId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  locationId: string;
  locationName: string;
  unit: string;
  candidateOpnameId: string | null;
  candidateOpnameNumber: string | null;
  candidateCountAt: string | null;
  duplicateCandidatesCount: number;
  missingTimestampFlag: boolean;
  postCountMovementsCount: number;
  proposedBaselineQty: number | null;
  postCountQtyIn: number;
  postCountQtyOut: number;
  postCountAdjustments: number;
  reconstructedClosing: number;
  authoritativeClosing: number;
  discrepancy: number;
  hasExistingActiveBaseline: boolean;
  canApplyReconciliation: boolean;
  auditStatus: 'PASS' | 'UNVERIFIED' | 'REVIEW_REQUIRED' | 'RECONCILIATION_EXCEPTION';
  exceptions: string[];
  recommendation: string;
}

export interface MigrationDryRunReport {
  generatedAt: string;
  totalWarehouseBalances: number;
  verifiedCandidateCount: number;
  unverifiedCount: number;
  reviewRequiredCount: number;
  exceptionCount: number;
  duplicateCandidateConflicts: number;
  missingTimestampCount: number;
  negativeStockCount: number;
  rows: MigrationDryRunRow[];
  exceptionSummary: string[];
}

/**
 * Pure Non-Destructive Baseline Migration Dry-Run Evaluator.
 * Evaluates approved Stock Opname candidates against authoritative inventory balances
 * and immutable movement ledger without mutating any data.
 */
export function runBaselineMigrationDryRun(params: {
  inventory: InventoryBalance[];
  stockOpnames: StockOpname[];
  inventoryMovements: InventoryMovement[];
  existingBaselines?: InventoryBaseline[];
}): MigrationDryRunReport {
  const { inventory, stockOpnames, inventoryMovements, existingBaselines = [] } = params;
  const rows: MigrationDryRunRow[] = [];
  const exceptionSummary: string[] = [];

  const warehouseItems = (inventory || []).filter(
    (item) => item.locationId !== 'loc-in-transit'
  );

  // Detect duplicate /inventory documents for same SKU across materialId/itemId/materialCode at same locationId
  const dupCountsById = countDuplicateInventoryBalances(warehouseItems);

  let verifiedCandidateCount = 0;
  let unverifiedCount = 0;
  let reviewRequiredCount = 0;
  let exceptionCount = 0;
  let duplicateCandidateConflicts = 0;
  let missingTimestampCount = 0;
  let negativeStockCount = 0;

  for (const item of warehouseItems) {
    const matId = item.materialId || item.itemId || '';
    const matCode = item.materialCode || item.itemCode || '';
    const matName = item.materialName || item.itemName || '';
    const locId = item.locationId;
    const authoritativeClosing = Number(item.availableStock) || 0;
    const duplicateBalanceCount = (item.id ? dupCountsById.get(item.id) : 1) || 1;
    const exceptions: string[] = [];

    if (authoritativeClosing < 0) {
      negativeStockCount++;
      exceptions.push(`Defisit saldo negatif otoritatif (${authoritativeClosing} ${item.unit})`);
    }
    if (duplicateBalanceCount > 1) {
      exceptions.push(`Ditemukan ${duplicateBalanceCount} dokumen saldo /inventory duplikat di lokasi ini.`);
    }

    // 1. Check active existing baseline first, otherwise evaluate APPROVED/ADJUSTED Stock Opnames
    const matchingActiveBaselines = existingBaselines.filter(
      (b) =>
        (b.materialId === matId ||
          (item.itemId && b.materialId === item.itemId) ||
          (matCode && b.materialCode === matCode)) &&
        b.locationId === locId &&
        b.status === 'ACTIVE'
    );
    if (matchingActiveBaselines.length > 1) {
      exceptions.push(`Konflik ${matchingActiveBaselines.length} baseline ACTIVE simultan.`);
    }
    const activeBaseline = matchingActiveBaselines[0];

    const approvedCandidates = (stockOpnames || [])
      .filter(
        (so) =>
          (so.itemId === matId ||
            (item.itemId && so.itemId === item.itemId) ||
            (matCode && so.itemCode === matCode)) &&
          so.locationId === locId &&
          so.verificationStatus === 'ADJUSTED'
      )
      .sort((a, b) => {
        const tsA = a.countCompletedTimestampMs || parseJakartaTimestampMs(a.countCompletedAt || a.adjustedAt || a.createdAt);
        const tsB = b.countCompletedTimestampMs || parseJakartaTimestampMs(b.countCompletedAt || b.adjustedAt || b.createdAt);
        return tsA - tsB;
      });

    if (approvedCandidates.length > 1) {
      duplicateCandidateConflicts++;
      exceptions.push(
        `Ditemukan ${approvedCandidates.length} kandidat opname ADJUSTED (${approvedCandidates.map((c) => c.opnameNumber).join(', ')}); kandidat paling awal dipilih.`
      );
    }

    const earliestCandidate = approvedCandidates[0] || null;

    if (!activeBaseline && !earliestCandidate) {
      const noBaselineSummary = reconcileBaselineLedger(
        matId,
        locId,
        null,
        inventoryMovements,
        authoritativeClosing,
        {
          itemId: item.itemId,
          materialCode: matCode,
          inventoryCounters: item,
          duplicateBalanceCount,
        }
      );

      let auditStatus: MigrationDryRunRow['auditStatus'] = 'UNVERIFIED';
      if (authoritativeClosing < 0 || duplicateBalanceCount > 1) {
        auditStatus = 'RECONCILIATION_EXCEPTION';
        exceptionCount++;
      } else if (noBaselineSummary.baselineStatus === 'REVIEW_REQUIRED') {
        auditStatus = 'REVIEW_REQUIRED';
        reviewRequiredCount++;
      } else {
        unverifiedCount++;
      }

      rows.push({
        balanceId: item.id,
        materialId: matId,
        materialCode: matCode,
        materialName: matName,
        locationId: locId,
        locationName: item.locationName,
        unit: item.unit,
        candidateOpnameId: null,
        candidateOpnameNumber: null,
        candidateCountAt: null,
        duplicateCandidatesCount: 0,
        missingTimestampFlag: false,
        postCountMovementsCount: noBaselineSummary.qualifyingMovementsCount,
        proposedBaselineQty: null,
        postCountQtyIn: noBaselineSummary.qtyIn,
        postCountQtyOut: noBaselineSummary.qtyOut,
        postCountAdjustments: noBaselineSummary.adjustments,
        reconstructedClosing: noBaselineSummary.reconstructedClosing,
        authoritativeClosing,
        discrepancy: noBaselineSummary.reconciliationDifference,
        hasExistingActiveBaseline: false,
        canApplyReconciliation: false,
        auditStatus,
        exceptions,
        recommendation:
          authoritativeClosing < 0
            ? 'Defisit negatif tanpa Stock Opname resmi. Laksanakan opname fisik resmi sebelum menetapkan baseline.'
            : 'Belum ada Stock Opname fisik yang disetujui. Tetap berstatus UNVERIFIED.',
      });

      if (exceptions.length > 0) {
        exceptionSummary.push(`[${matCode} @ ${item.locationName}] ${exceptions.join('; ')}`);
      }
      continue;
    }

    // Build proposed or active baseline object for reconciliation simulation
    const missingTs =
      !activeBaseline &&
      earliestCandidate !== null &&
      !earliestCandidate.countCompletedAt &&
      !earliestCandidate.countCompletedTimestampMs &&
      !earliestCandidate.adjustedAt;

    if (missingTs) {
      missingTimestampCount++;
      exceptions.push(`Kandidat ${earliestCandidate?.opnameNumber} tidak memiliki timestamp countCompletedAt eksplisit.`);
    }

    const simulatedBaseline: InventoryBaseline = activeBaseline || {
      id: getCanonicalBaselineId(matId, locId, 1),
      baselineId: getCanonicalBaselineId(matId, locId, 1),
      materialId: matId,
      materialCode: matCode,
      materialName: matName,
      locationId: locId,
      locationName: item.locationName,
      baselineQuantity: Number(earliestCandidate!.physicalQuantity) || 0,
      unit: item.unit,
      stockOpnameId: earliestCandidate!.id,
      stockOpnameNumber: earliestCandidate!.opnameNumber,
      sourceMovementId: earliestCandidate!.adjustmentMovementId || '',
      countStartedAt: earliestCandidate!.countStartedAt || earliestCandidate!.createdAt,
      countCompletedAt: earliestCandidate!.countCompletedAt || earliestCandidate!.adjustedAt || earliestCandidate!.createdAt,
      countCompletedTimestampMs:
        earliestCandidate!.countCompletedTimestampMs ||
        parseJakartaTimestampMs(earliestCandidate!.countCompletedAt || earliestCandidate!.adjustedAt || earliestCandidate!.createdAt),
      approvedAt: earliestCandidate!.adjustedAt || earliestCandidate!.createdAt,
      approvedBy: earliestCandidate!.verifiedBy || 'Admin',
      baselineVersion: 1,
      status: 'ACTIVE',
      createdAt: earliestCandidate!.createdAt,
      createdBy: earliestCandidate!.conductedBy,
    };

    const summary = reconcileBaselineLedger(
      matId,
      locId,
      simulatedBaseline,
      inventoryMovements,
      authoritativeClosing,
      {
        itemId: item.itemId,
        materialCode: matCode,
        inventoryCounters: item,
        duplicateBalanceCount,
      }
    );

    if (!summary.isReconciled) {
      exceptions.push(
        `Selisih rekonsiliasi sebesar ${summary.reconciliationDifference} (Rekonstruksi ${summary.reconstructedClosing} vs Otoritatif ${authoritativeClosing})`
      );
    }

    let auditStatus: MigrationDryRunRow['auditStatus'] = 'PASS';
    if (authoritativeClosing < 0 || !summary.isReconciled || duplicateBalanceCount > 1 || matchingActiveBaselines.length > 1) {
      auditStatus = 'RECONCILIATION_EXCEPTION';
      exceptionCount++;
    } else if (missingTs) {
      auditStatus = 'REVIEW_REQUIRED';
      reviewRequiredCount++;
    } else {
      verifiedCandidateCount++;
    }

    if (exceptions.length > 0) {
      exceptionSummary.push(`[${matCode} @ ${item.locationName}] ${exceptions.join('; ')}`);
    }

    rows.push({
      balanceId: item.id,
      materialId: matId,
      materialCode: matCode,
      materialName: matName,
      locationId: locId,
      locationName: item.locationName,
      unit: item.unit,
      candidateOpnameId: simulatedBaseline.stockOpnameId,
      candidateOpnameNumber: simulatedBaseline.stockOpnameNumber,
      candidateCountAt: simulatedBaseline.countCompletedAt,
      duplicateCandidatesCount: Math.max(0, approvedCandidates.length - 1),
      missingTimestampFlag: missingTs,
      postCountMovementsCount: summary.qualifyingMovementsCount,
      proposedBaselineQty: simulatedBaseline.baselineQuantity,
      postCountQtyIn: summary.qtyIn,
      postCountQtyOut: summary.qtyOut,
      postCountAdjustments: summary.adjustments,
      reconstructedClosing: summary.reconstructedClosing,
      authoritativeClosing,
      discrepancy: summary.reconciliationDifference,
      hasExistingActiveBaseline: Boolean(activeBaseline),
      canApplyReconciliation: !activeBaseline && Boolean(earliestCandidate) && duplicateBalanceCount === 1,
      auditStatus,
      exceptions,
      recommendation:
        auditStatus === 'PASS'
          ? activeBaseline
            ? 'Baseline fisik aktif & paritas 100% cocok.'
            : 'Paritas 100% cocok (tanpa double-count). Siap direkonsiliasi sebagai baseline fisik v1 resmi.'
          : 'Terdapat catatan audit/discrepancy. Tinjau sebelum eksekusi rekonsiliasi.',
    });
  }

  return {
    generatedAt: getJakartaIsoString(),
    totalWarehouseBalances: warehouseItems.length,
    verifiedCandidateCount,
    unverifiedCount,
    reviewRequiredCount,
    exceptionCount,
    duplicateCandidateConflicts,
    missingTimestampCount,
    negativeStockCount,
    rows,
    exceptionSummary,
  };
}

export interface ControlledBaselinePlanItem {
  balanceId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  locationId: string;
  locationName: string;
  unit: string;
  newBaseline: InventoryBaseline;
  supersededBaselineId?: string;
}

/**
 * Builds a deterministic, controlled Physical Stock Opname Baseline reconciliation plan.
 * - First approved (ADJUSTED) Stock Opname establishes v1 ACTIVE baseline.
 * - Existing ACTIVE baselines are NEVER overwritten without explicit superseding.
 * - Never alters raw Stock Opname quantities or ledger movement history.
 */
export function buildControlledBaselineReconciliationPlan(params: {
  inventory: InventoryBalance[];
  stockOpnames: StockOpname[];
  existingBaselines: InventoryBaseline[];
  actorName: string;
  actorEmployeeId?: string;
  targetBalanceIds?: string[];
}): {
  items: ControlledBaselinePlanItem[];
  skipped: Array<{ balanceId: string; reason: string }>;
} {
  const { inventory, stockOpnames, existingBaselines, actorName, actorEmployeeId, targetBalanceIds } = params;
  const now = getJakartaIsoString();
  const targetSet = targetBalanceIds && targetBalanceIds.length > 0 ? new Set(targetBalanceIds) : null;

  const items: ControlledBaselinePlanItem[] = [];
  const skipped: Array<{ balanceId: string; reason: string }> = [];
  const dupCountsById = countDuplicateInventoryBalances(inventory || []);

  for (const bal of inventory || []) {
    if (bal.locationId === 'loc-in-transit') continue;
    if (targetSet && !targetSet.has(bal.id)) continue;

    const dupCount = (bal.id ? dupCountsById.get(bal.id) : 1) || 1;
    if (dupCount > 1) {
      skipped.push({
        balanceId: bal.id,
        reason: `Ditemukan ${dupCount} dokumen saldo /inventory duplikat pada lokasi ini. Selesaikan duplikasi terlebih dahulu.`,
      });
      continue;
    }

    const matId = bal.materialId || bal.itemId || '';
    const matCode = bal.materialCode || bal.itemCode || '';
    const matName = bal.materialName || bal.itemName || '';
    const locId = bal.locationId;

    const activeBaseline = (existingBaselines || []).find(
      (b) =>
        (b.materialId === matId || (bal.itemId && b.materialId === bal.itemId) || (matCode && b.materialCode === matCode)) &&
        b.locationId === locId &&
        b.status === 'ACTIVE'
    );

    if (activeBaseline) {
      skipped.push({
        balanceId: bal.id,
        reason: `Sudah memiliki baseline aktif ${activeBaseline.baselineId} (${activeBaseline.stockOpnameNumber}).`,
      });
      continue;
    }

    const approvedOpnames = (stockOpnames || [])
      .filter(
        (so) =>
          (so.itemId === matId || (bal.itemId && so.itemId === bal.itemId) || (matCode && so.itemCode === matCode)) &&
          so.locationId === locId &&
          so.verificationStatus === 'ADJUSTED'
      )
      .sort((a, b) => {
        const tsA = a.countCompletedTimestampMs || parseJakartaTimestampMs(a.countCompletedAt || a.adjustedAt || a.createdAt);
        const tsB = b.countCompletedTimestampMs || parseJakartaTimestampMs(b.countCompletedAt || b.adjustedAt || b.createdAt);
        return tsA - tsB;
      });

    const earliest = approvedOpnames[0];
    if (!earliest) {
      skipped.push({
        balanceId: bal.id,
        reason: 'Belum ada Stock Opname berstatus ADJUSTED.',
      });
      continue;
    }

    const existingVersions = (existingBaselines || [])
      .filter((b) => b.materialId === matId && b.locationId === locId)
      .map((b) => b.baselineVersion || 1);
    const nextVersion = existingVersions.length > 0 ? Math.max(...existingVersions) + 1 : 1;
    const baseId = getCanonicalBaselineId(matId, locId, nextVersion);
    const cutoffAt = earliest.countCompletedAt || earliest.adjustedAt || earliest.createdAt || now;
    const cutoffMs = earliest.countCompletedTimestampMs || parseJakartaTimestampMs(cutoffAt) || Date.now();

    items.push({
      balanceId: bal.id,
      materialId: matId,
      materialCode: matCode,
      materialName: matName,
      locationId: locId,
      locationName: bal.locationName,
      unit: bal.unit || earliest.unit || 'Pcs',
      newBaseline: {
        id: baseId,
        baselineId: baseId,
        materialId: matId,
        materialCode: matCode,
        materialName: matName,
        locationId: locId,
        locationName: bal.locationName,
        baselineQuantity: Number(earliest.physicalQuantity) || 0,
        unit: bal.unit || earliest.unit || 'Pcs',
        stockOpnameId: earliest.id,
        stockOpnameNumber: earliest.opnameNumber,
        sourceMovementId: earliest.adjustmentMovementId || '',
        countStartedAt: earliest.countStartedAt || earliest.createdAt,
        countCompletedAt: cutoffAt,
        countCompletedTimestampMs: cutoffMs,
        cutoffDate: cutoffAt.slice(0, 10),
        approvedAt: earliest.adjustedAt || now,
        approvedBy: earliest.verifiedBy || actorName,
        approvedByEmployeeId: actorEmployeeId || '',
        baselineVersion: nextVersion,
        status: 'ACTIVE',
        createdAt: now,
        createdBy: actorName,
        notes: `Rekonsiliasi baseline terkontrol v${nextVersion} dari Stock Opname resmi ${earliest.opnameNumber}`,
      },
    });
  }

  return { items, skipped };
}

/**
 * Resolves the latest authoritative /inventory document directly from Firestore.
 * Prevents stale React state or materialId vs itemId vs materialCode mismatches
 * from reading 0 or writing split balance documents.
 */
export async function resolveAuthoritativeBalanceDoc(
  firestoreInstance: Firestore,
  materialId: string,
  locationId: string,
  materialCode?: string
): Promise<{
  balanceId: string;
  exists: boolean;
  availableStock: number;
  data: InventoryBalance | null;
  duplicateIds: string[];
}> {
  const canonicalId = getCanonicalBalanceId(materialId, locationId);
  const canonicalRef = doc(firestoreInstance, 'inventory', canonicalId);

  const [canonicalSnap, locSnap] = await Promise.all([
    getDoc(canonicalRef),
    getDocs(query(collection(firestoreInstance, 'inventory'), where('locationId', '==', locationId))),
  ]);

  const matchingDocs: Array<{ id: string; data: InventoryBalance }> = [];
  locSnap.forEach((docSnap) => {
    const d = docSnap.data() as InventoryBalance;
    const isMatch =
      d.materialId === materialId ||
      d.itemId === materialId ||
      (Boolean(materialCode) && (d.materialCode === materialCode || d.itemCode === materialCode));
    if (isMatch) {
      matchingDocs.push({ id: docSnap.id, data: { ...d, id: docSnap.id } });
    }
  });

  if (canonicalSnap.exists()) {
    const d = { ...(canonicalSnap.data() as InventoryBalance), id: canonicalSnap.id };
    const dupIds = matchingDocs.map((m) => m.id);
    if (!dupIds.includes(canonicalSnap.id)) dupIds.unshift(canonicalSnap.id);
    return {
      balanceId: canonicalSnap.id,
      exists: true,
      availableStock: Number(d.availableStock) || 0,
      data: d,
      duplicateIds: dupIds.length > 1 ? dupIds : [],
    };
  }

  if (matchingDocs.length > 0) {
    const sorted = [...matchingDocs].sort((a, b) => (Number(b.data.version) || 0) - (Number(a.data.version) || 0));
    const chosen = sorted[0];
    return {
      balanceId: chosen.id,
      exists: true,
      availableStock: Number(chosen.data.availableStock) || 0,
      data: chosen.data,
      duplicateIds: matchingDocs.length > 1 ? matchingDocs.map((m) => m.id) : [],
    };
  }

  return {
    balanceId: canonicalId,
    exists: false,
    availableStock: 0,
    data: null,
    duplicateIds: [],
  };
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
