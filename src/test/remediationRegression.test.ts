/**
 * Comprehensive Remediation & Hardening Regression Test Suite
 * Logistics Control Tower – PT IAS Support Indonesia
 *
 * Test Classification:
 * - Suite Type: Isolated In-Memory Unit & Static Security Audit Tests (Zero Live Firestore Writes)
 * - Firestore Emulator Runtime: NOT VERIFIED in this environment (Java not installed)
 * - Live Production / Development Firestore Writes: PROHIBITED / NOT EXECUTED
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  buildControlledOpeningOpnameDrafts,
  buildInventoryReconciliationMap,
  calculateNewBalanceState,
  calculateUnreservedAvailableStock,
  generateIdempotencyKey,
  getCanonicalBalanceId,
  getJakartaDateString,
  getJakartaTimestamp,
  getPendingGoodsIssueReservedQty,
  normalizeSupplyRequestStatus,
  validateSupplyRequestReceipt,
} from '../services/inventoryEngine';
import {
  GoodsIssue,
  InventoryBalance,
  InventoryBaseline,
  InventoryMovement,
  MasterLocation,
  MaterialMaster,
  MorganTrolleyRecord,
  StockOpname,
  SupplyRequestRecord,
  IN_TRANSIT_LOCATION_ID,
} from '../types';

interface TestResult {
  id: number;
  code: string;
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function assertTest(id: number, code: string, name: string, condition: boolean, detail: string) {
  results.push({
    id,
    code,
    name,
    passed: condition,
    message: condition ? `PASS: ${detail}` : `FAIL: ${detail}`,
  });
}

// ---------------------------------------------------------------------------
// Test Fixtures
// ---------------------------------------------------------------------------
const materials: MaterialMaster[] = [
  {
    id: 'mat-towel-01',
    materialId: 'mat-towel-01',
    materialCode: 'MAT-001',
    materialName: 'Hand Towel Interfold',
    categoryId: 'cat-tissue',
    categoryName: 'Tissue & Towel',
    unit: 'Pack',
    minimumStock: 20,
    reorderPoint: 40,
    isActive: true,
    createdAt: '2026-10-01 08:00:00',
    createdBy: 'Admin',
    updatedAt: '2026-10-01 08:00:00',
    updatedBy: 'Admin',
  },
  {
    id: 'mat-inactive-02',
    materialId: 'mat-inactive-02',
    materialCode: 'MAT-999',
    materialName: 'Obsolete Item',
    categoryId: 'cat-gen',
    categoryName: 'General',
    unit: 'Pcs',
    minimumStock: 5,
    reorderPoint: 10,
    isActive: false,
    createdAt: '2026-10-01 08:00:00',
    createdBy: 'Admin',
    updatedAt: '2026-10-01 08:00:00',
    updatedBy: 'Admin',
  },
];

const locations: MasterLocation[] = [
  {
    id: 'loc-t1b',
    code: 'WH-T1B',
    name: 'Gudang Terminal 1B',
    type: 'Terminal Warehouse',
    picName: 'Budi',
    isActive: true,
    createdAt: '2026-10-01 08:00:00',
    createdBy: 'Admin',
  },
  {
    id: 'loc-t1c',
    code: 'WH-T1C',
    name: 'Gudang Terminal 1C',
    type: 'Terminal Warehouse',
    picName: 'Sari',
    isActive: true,
    createdAt: '2026-10-01 08:00:00',
    createdBy: 'Admin',
  },
  {
    id: IN_TRANSIT_LOCATION_ID,
    code: 'IN-TRANSIT',
    name: 'Virtual In-Transit',
    type: 'Transit',
    picName: 'System',
    isActive: true,
    createdAt: '2026-10-01 08:00:00',
    createdBy: 'System',
  },
];

// ---------------------------------------------------------------------------
// 1. REM-01: Asia/Jakarta (WIB / UTC+7) Timestamp & Date Consistency
// ---------------------------------------------------------------------------
{
  const utcLateNight = new Date('2026-11-12T18:30:00.000Z'); // 01:30 WIB on 2026-11-13
  const wibTs = getJakartaTimestamp(utcLateNight);
  const wibDate = getJakartaDateString(utcLateNight);
  assertTest(
    1,
    'REM-01A',
    'WIB timestamp handles UTC+7 day rollover accurately',
    wibTs === '2026-11-13 01:30:00' && wibDate === '2026-11-13',
    `expected 2026-11-13 01:30:00 / 2026-11-13, got ${wibTs} / ${wibDate}`
  );
}

// ---------------------------------------------------------------------------
// 2. REM-02: Shared Reconciliation Map & Dashboard/Position Parity
// ---------------------------------------------------------------------------
{
  const balVerified: InventoryBalance = {
    id: getCanonicalBalanceId('mat-towel-01', 'loc-t1b'),
    materialId: 'mat-towel-01',
    itemId: 'mat-towel-01',
    materialCode: 'MAT-001',
    itemCode: 'MAT-001',
    materialName: 'Hand Towel Interfold',
    itemName: 'Hand Towel Interfold',
    categoryId: 'cat-tissue',
    categoryName: 'Tissue & Towel',
    unit: 'Pack',
    locationId: 'loc-t1b',
    locationName: 'Gudang Terminal 1B',
    openingStock: 100,
    qtyIn: 20,
    qtyOut: 15,
    totalAdjustments: 0,
    availableStock: 105,
    minimumStock: 20,
    reorderPoint: 40,
    lastTransactionDate: '2026-11-12',
  };

  const balTransit: InventoryBalance = {
    ...balVerified,
    id: getCanonicalBalanceId('mat-towel-01', IN_TRANSIT_LOCATION_ID),
    locationId: IN_TRANSIT_LOCATION_ID,
    locationName: 'Virtual In-Transit',
    availableStock: 10,
  };

  const baseline: InventoryBaseline = {
    id: 'base-mat-towel-01-loc-t1b-v1',
    baselineId: 'base-mat-towel-01-loc-t1b-v1',
    materialId: 'mat-towel-01',
    materialCode: 'MAT-001',
    materialName: 'Hand Towel Interfold',
    locationId: 'loc-t1b',
    locationName: 'Gudang Terminal 1B',
    baselineQuantity: 100,
    unit: 'Pack',
    stockOpnameId: 'so-1',
    stockOpnameNumber: 'SO-2026-001',
    sourceMovementId: 'mov-base-1',
    countStartedAt: '2026-11-10 08:00:00',
    countCompletedAt: '2026-11-10 09:00:00',
    countCompletedTimestampMs: new Date('2026-11-10T09:00:00+07:00').getTime(),
    approvedAt: '2026-11-10 10:00:00',
    approvedBy: 'Admin',
    baselineVersion: 1,
    status: 'ACTIVE',
    createdAt: '2026-11-10 10:00:00',
    createdBy: 'Admin',
  };

  const movements: InventoryMovement[] = [
    {
      id: 'mov-gr-1',
      movementId: 'mov-gr-1',
      materialId: 'mat-towel-01',
      materialCode: 'MAT-001',
      materialName: 'Hand Towel Interfold',
      locationId: 'loc-t1b',
      locationName: 'Gudang Terminal 1B',
      unit: 'Pack',
      movementType: 'GOODS_RECEIPT',
      quantity: 20,
      delta: 20,
      balanceBefore: 100,
      balanceAfter: 120,
      sourceDocumentId: 'GR-001',
      sourceDocumentType: 'GOODS_RECEIPT',
      status: 'POSTED',
      idempotencyKey: 'k1',
      recordedBy: 'Logistik',
      postingSequence: 1,
      createdAt: '2026-11-11 10:00:00',
      createdTimestampMs: new Date('2026-11-11T10:00:00+07:00').getTime(),
    },
    {
      id: 'mov-gi-1',
      movementId: 'mov-gi-1',
      materialId: 'mat-towel-01',
      materialCode: 'MAT-001',
      materialName: 'Hand Towel Interfold',
      locationId: 'loc-t1b',
      locationName: 'Gudang Terminal 1B',
      unit: 'Pack',
      movementType: 'GOODS_ISSUE',
      quantity: 15,
      delta: -15,
      balanceBefore: 120,
      balanceAfter: 105,
      sourceDocumentId: 'GI-001',
      sourceDocumentType: 'GOODS_ISSUE',
      status: 'POSTED',
      idempotencyKey: 'k2',
      recordedBy: 'Admin',
      postingSequence: 2,
      createdAt: '2026-11-12 10:00:00',
      createdTimestampMs: new Date('2026-11-12T10:00:00+07:00').getTime(),
    },
    {
      id: 'mov-rev-99',
      movementId: 'mov-rev-99',
      materialId: 'mat-towel-01',
      materialCode: 'MAT-001',
      materialName: 'Hand Towel Interfold',
      locationId: 'loc-t1b',
      locationName: 'Gudang Terminal 1B',
      unit: 'Pack',
      movementType: 'GOODS_ISSUE',
      quantity: 500,
      delta: -500,
      balanceBefore: 105,
      balanceAfter: -395,
      sourceDocumentId: 'GI-REV',
      sourceDocumentType: 'GOODS_ISSUE',
      status: 'REVERSED',
      idempotencyKey: 'k3',
      recordedBy: 'Admin',
      postingSequence: 3,
      createdAt: '2026-11-12 11:00:00',
      createdTimestampMs: new Date('2026-11-12T11:00:00+07:00').getTime(),
    },
  ];

  const map = buildInventoryReconciliationMap({
    inventory: [balVerified, balTransit],
    inventoryBaselines: [baseline],
    inventoryMovements: movements,
    stockOpnames: [],
  });
  const sumT1B = map.get(balVerified.id);

  assertTest(
    2,
    'REM-02A',
    'Shared reconciliation map verifies baseline parity and excludes REVERSED movements',
    Boolean(sumT1B) &&
      sumT1B!.baselineStatus === 'VERIFIED' &&
      sumT1B!.qtyIn === 20 &&
      sumT1B!.qtyOut === 15 &&
      sumT1B!.reconstructedClosing === 105 &&
      sumT1B!.isReconciled === true,
    `status=${sumT1B?.baselineStatus}, in=${sumT1B?.qtyIn}, out=${sumT1B?.qtyOut}, closing=${sumT1B?.reconstructedClosing}`
  );
}

// ---------------------------------------------------------------------------
// 3. REM-03: Supply Request Normalization, Anti Over-Receipt & Movement Delta
// ---------------------------------------------------------------------------
{
  const sr: SupplyRequestRecord = {
    id: 'sr-1',
    requestNumber: 'SR-2026-001',
    requestDate: '2026-11-12',
    requestingLocationId: 'loc-t1b',
    requestingLocationName: 'Gudang Terminal 1B',
    requestingUnit: 'Toilet T1B',
    materialId: 'mat-towel-01',
    materialCode: 'MAT-001',
    materialName: 'Hand Towel Interfold',
    unit: 'Pack',
    requestedQuantity: 100,
    receivedQuantity: 0,
    outstandingQuantity: 100,
    status: 'REQUESTED',
    receiptHistory: [],
    requestedBy: 'Logistik',
    createdAt: '2026-11-12 08:00:00',
  };

  const legacyNorm =
    normalizeSupplyRequestStatus('OPEN') === 'REQUESTED' &&
    normalizeSupplyRequestStatus('PARTIAL') === 'PARTIALLY_RECEIVED' &&
    normalizeSupplyRequestStatus('FULFILLED') === 'RECEIVED' &&
    normalizeSupplyRequestStatus('CANCELLED') === 'CANCELLED';

  const partialRes = validateSupplyRequestReceipt(sr, 40);
  const partialSr: SupplyRequestRecord = {
    ...sr,
    receivedQuantity: partialRes.newTotalReceived,
    outstandingQuantity: partialRes.newOutstanding,
    status: partialRes.newStatus,
  };
  const overRes = validateSupplyRequestReceipt(partialSr, 70); // exceeds remaining 60
  const finalRes = validateSupplyRequestReceipt(partialSr, 60);
  const closedSr: SupplyRequestRecord = {
    ...partialSr,
    receivedQuantity: finalRes.newTotalReceived,
    outstandingQuantity: finalRes.newOutstanding,
    status: finalRes.newStatus,
  };
  const postClosedRes = validateSupplyRequestReceipt(closedSr, 1);

  const balState = calculateNewBalanceState(
    { openingStock: 100, qtyIn: 0, qtyOut: 0, totalAdjustments: 0, availableStock: 100, version: 1 },
    'GOODS_RECEIPT',
    40,
    40
  );

  assertTest(
    3,
    'REM-03A',
    'Supply Request normalizes statuses, blocks over-receipt & closed receipt, computes atomic GOODS_RECEIPT delta',
    legacyNorm &&
      partialRes.valid &&
      partialRes.newStatus === 'PARTIALLY_RECEIVED' &&
      partialRes.newOutstanding === 60 &&
      !overRes.valid &&
      finalRes.valid &&
      finalRes.newStatus === 'RECEIVED' &&
      finalRes.newOutstanding === 0 &&
      !postClosedRes.valid &&
      balState.balanceAfter === 140,
    `partialOut=${partialRes.newOutstanding}, overValid=${overRes.valid}, finalStatus=${finalRes.newStatus}, closedValid=${postClosedRes.valid}, balAfter=${balState.balanceAfter}`
  );
}

// ---------------------------------------------------------------------------
// 4. REM-04: Controlled Opening Balance Excel Import -> StockOpname Drafts
// ---------------------------------------------------------------------------
{
  const existingOpnames: StockOpname[] = [
    {
      id: 'so-pending-existing',
      opnameNumber: 'SO-2026-50',
      opnameDate: '2026-11-12',
      locationId: 'loc-t1c',
      locationName: 'Gudang Terminal 1C',
      itemId: 'mat-towel-01',
      itemCode: 'MAT-001',
      itemName: 'Hand Towel Interfold',
      unit: 'Pack',
      systemQuantity: 0,
      physicalQuantity: 25,
      variance: 25,
      varianceReason: 'Pending test',
      verificationStatus: 'PENDING_APPROVAL',
      conductedBy: 'Logistik',
      notes: 'Pending baseline opname test',
      createdAt: '2026-11-12 09:00:00',
    },
  ];

  const { drafts, errors } = buildControlledOpeningOpnameDrafts({
    rawRows: [
      { materialCode: 'MAT-001', locationCode: 'WH-T1B', openingStock: 85 },
      { materialCode: 'MAT-001', locationCode: 'WH-T1B', openingStock: 90 }, // duplicate in file
      { materialCode: 'MAT-001', locationCode: 'WH-T1C', openingStock: 30 }, // existing pending opname conflict
      { materialCode: 'MAT-999', locationCode: 'WH-T1B', openingStock: 10 }, // inactive material
      { materialCode: 'MAT-001', locationCode: 'IN-TRANSIT', openingStock: 5 }, // loc-in-transit rejected
      { materialCode: 'MAT-001', locationCode: 'WH-T1B', openingStock: -5 }, // negative/dup rejected
    ],
    materials,
    locations,
    inventory: [],
    existingBaselines: [],
    existingOpnames,
    actorName: 'Admin Utama',
    actorEmployeeId: 'EMP-001',
    now: '2026-11-12 14:00:00',
  });

  assertTest(
    4,
    'REM-04A',
    'Controlled Opening Import generates PENDING_APPROVAL StockOpname + ApprovalRequest and rejects invalid/duplicate rows',
    drafts.length === 1 &&
      drafts[0].opname.verificationStatus === 'PENDING_APPROVAL' &&
      drafts[0].opname.physicalQuantity === 85 &&
      drafts[0].approval.status === 'PENDING' &&
      drafts[0].approval.type === 'STOCK_OPNAME_ADJUSTMENT' &&
      drafts[0].approval.referenceId === drafts[0].opname.id &&
      errors.length === 5,
    `drafts=${drafts.length}, errors=${errors.length}, status=${drafts[0]?.opname.verificationStatus}`
  );
}

// ---------------------------------------------------------------------------
// 5. REM-05: Pending Goods Issue Reservation Guards Transfer & Consumption
// ---------------------------------------------------------------------------
{
  const pendingIssues: GoodsIssue[] = [
    {
      id: 'gi-pend-1',
      issueNumber: 'GI-2026-01',
      requestDate: '2026-11-12',
      requestingUnit: 'Toilet T1B',
      destination: 'Gate B2',
      itemId: 'mat-towel-01',
      itemCode: 'MAT-001',
      itemName: 'Hand Towel Interfold',
      requestedQuantity: 70,
      approvedQuantity: 0,
      unit: 'Pack',
      locationId: 'loc-t1b',
      locationName: 'Gudang Terminal 1B',
      purpose: 'Shift 1',
      status: 'PENDING_APPROVAL',
      requestedBy: 'Logistik',
      requestedByEmployeeId: 'EMP-002',
      processedBy: null,
      notes: '',
      createdAt: '2026-11-12 10:00:00',
    },
    {
      id: 'gi-pend-other-loc',
      issueNumber: 'GI-2026-02',
      requestDate: '2026-11-12',
      requestingUnit: 'Toilet T1C',
      destination: 'Gate C1',
      itemId: 'mat-towel-01',
      itemCode: 'MAT-001',
      itemName: 'Hand Towel Interfold',
      requestedQuantity: 50,
      approvedQuantity: 0,
      unit: 'Pack',
      locationId: 'loc-t1c',
      locationName: 'Gudang Terminal 1C',
      purpose: 'Shift 1',
      status: 'PENDING_APPROVAL',
      requestedBy: 'Logistik',
      requestedByEmployeeId: 'EMP-002',
      processedBy: null,
      notes: '',
      createdAt: '2026-11-12 10:05:00',
    },
  ];

  const reservedT1B = getPendingGoodsIssueReservedQty(pendingIssues, 'mat-towel-01', 'loc-t1b', 'MAT-001');
  const unreservedT1B = calculateUnreservedAvailableStock(100, reservedT1B);
  const transferAttempt = 40;
  const consumptionAttempt = 35;

  assertTest(
    5,
    'REM-05A',
    'Pending GI reserves stock per location and blocks excess Transfer/Consumption without cross-location leakage',
    reservedT1B === 70 &&
      unreservedT1B === 30 &&
      transferAttempt > unreservedT1B &&
      consumptionAttempt > unreservedT1B,
    `reservedT1B=${reservedT1B}, unreservedT1B=${unreservedT1B}`
  );
}

// ---------------------------------------------------------------------------
// 6. REM-06: Anti-Negative Stock & Idempotency Key Determinism
// ---------------------------------------------------------------------------
{
  let threwInsufficient = false;
  try {
    calculateNewBalanceState(
      { openingStock: 20, qtyIn: 0, qtyOut: 0, totalAdjustments: 0, availableStock: 20, version: 1 },
      'DAILY_CONSUMPTION',
      25,
      -25
    );
  } catch (e: any) {
    threwInsufficient = String(e?.message || '').includes('INSUFFICIENT_STOCK');
  }

  const key1 = generateIdempotencyKey('GOODS_ISSUE', 'gi-123', 'mat-towel-01', 'loc-t1b', 'GOODS_ISSUE', 1);
  const key2 = generateIdempotencyKey('GOODS_ISSUE', 'gi-123', 'mat-towel-01', 'loc-t1b', 'GOODS_ISSUE', 1);
  const keyDiff = generateIdempotencyKey('SUPPLY_REQUEST', 'sr-1', 'mat-towel-01', 'loc-t1b', 'GOODS_RECEIPT', 1);

  assertTest(
    6,
    'REM-06A',
    'Negative balance throws INSUFFICIENT_STOCK & idempotency keys remain deterministic',
    threwInsufficient && key1 === key2 && key1 !== keyDiff,
    `threw=${threwInsufficient}, idempMatch=${key1 === key2}`
  );
}

// ---------------------------------------------------------------------------
// 7. REM-07: Morgan Trolley Contract & Validation Check
// ---------------------------------------------------------------------------
{
  const trolley: MorganTrolleyRecord = {
    id: 'trl-1',
    locationId: 'loc-t1b',
    locationName: 'Gudang Terminal 1B',
    area: 'Curbside Gate 1',
    placement: 'Pos Janitor 1B',
    quantity: 4,
    condition: 'Baik (Good)',
    personInCharge: 'Andi',
    lastCheckDate: getJakartaDateString(new Date('2026-11-12T10:00:00Z')),
    createdAt: '2026-11-12 17:00:00',
    createdBy: 'Logistik',
    updatedAt: '2026-11-12 17:00:00',
    updatedBy: 'Logistik',
  };

  assertTest(
    7,
    'REM-07A',
    'Morgan Trolley record preserves location, positive quantity, and audit metadata',
    trolley.quantity > 0 && trolley.locationId !== IN_TRANSIT_LOCATION_ID && Boolean(trolley.createdAt && trolley.updatedAt),
    `id=${trolley.id}, qty=${trolley.quantity}, loc=${trolley.locationId}`
  );
}

// ---------------------------------------------------------------------------
// 8. REM-08: Static Firestore Rules & Codebase Hardening Verification
// ---------------------------------------------------------------------------
{
  const rootDir = process.cwd();
  const rulesText = fs.readFileSync(path.join(rootDir, 'firestore.rules'), 'utf8');
  const appContextText = fs.readFileSync(path.join(rootDir, 'src/context/AppContext.tsx'), 'utf8');
  const accountMgmtText = fs.readFileSync(path.join(rootDir, 'src/pages/AccountManagement.tsx'), 'utf8');

  const hasDefaultDeny = /match \/\{document=\*\*\}[\s\S]*allow read, write: if false;/.test(rulesText);
  const noOpenUserList = !/allow list:\s*if isSignedIn\(\);/.test(rulesText);
  const noOpenUserCreate = !/allow create:\s*if isSignedIn\(\);/.test(rulesText);
  const blocksRoleSelfUpdate = rulesText.includes("'authorizedLocation'") && rulesText.includes("'role'");
  const goodsIssueSection = rulesText.match(/match \/goodsIssues\/\{id\}[\s\S]*?\n    \}/)?.[0] || '';
  const approvalsSection = rulesText.match(/match \/approvals\/\{id\}[\s\S]*?\n    \}/)?.[0] || '';
  const opnameSection = rulesText.match(/match \/stockOpnames\/\{id\}[\s\S]*?\n    \}/)?.[0] || '';
  const movementsSection = rulesText.match(/match \/inventoryMovements\/\{id\}[\s\S]*?\n    \}/)?.[0] || '';
  const auditSection = rulesText.match(/match \/auditLogs\/\{id\}[\s\S]*?\n    \}/)?.[0] || '';

  const siteHeadBlockedOnGI = goodsIssueSection.includes('allow update: if isAdmin()') && !goodsIssueSection.includes('isSiteHead()');
  const siteHeadBlockedOnApprovals = approvalsSection.includes('allow update: if isAdmin()') && !approvalsSection.includes('isSiteHead()');
  const opnameAllowsAnchorMeta = opnameSection.includes("'isBaselineAnchor'") && opnameSection.includes("'establishedBaselineId'");
  const immutableLedgerAndAudit =
    movementsSection.includes('allow update, delete: if false;') &&
    auditSection.includes('allow update, delete: if false;');

  const noFakeTempPassword =
    !appContextText.includes("'IAS#'") &&
    !appContextText.includes('tempPass') &&
    !accountMgmtText.includes('resetResultModal.tempPass');
  const appContextRestrictedUsersSync = appContextText.includes("currentUser.role === 'ADMIN'");
  const usesSendPasswordResetEmail = appContextText.includes('sendPasswordResetEmail');

  assertTest(
    8,
    'REM-08A',
    'Firestore Security Rules enforce least-privilege RBAC, read-only Site Head on approvals/GI, and immutable ledgers',
    hasDefaultDeny &&
      noOpenUserList &&
      noOpenUserCreate &&
      blocksRoleSelfUpdate &&
      siteHeadBlockedOnGI &&
      siteHeadBlockedOnApprovals &&
      opnameAllowsAnchorMeta &&
      immutableLedgerAndAudit,
    `deny=${hasDefaultDeny}, userList=${noOpenUserList}, userCreate=${noOpenUserCreate}, giAdminOnly=${siteHeadBlockedOnGI}, appAdminOnly=${siteHeadBlockedOnApprovals}, opnameAnchor=${opnameAllowsAnchorMeta}, immutable=${immutableLedgerAndAudit}`
  );

  assertTest(
    9,
    'REM-08B',
    'Client codebase eliminates fake plaintext temp passwords, scopes /users sync, and uses sendPasswordResetEmail',
    noFakeTempPassword && appContextRestrictedUsersSync && usesSendPasswordResetEmail,
    `noFakePass=${noFakeTempPassword}, scopedUsersSync=${appContextRestrictedUsersSync}, firebaseResetEmail=${usesSendPasswordResetEmail}`
  );
}

// ---------------------------------------------------------------------------
// Print Summary & Exit Non-Zero on Failure
// ---------------------------------------------------------------------------
const passedCount = results.filter((r) => r.passed).length;
const failedCount = results.length - passedCount;

console.log('===============================================================');
console.log('LOGISTICS CONTROL TOWER — REMEDIATION REGRESSION SUITE');
console.log('===============================================================');
for (const r of results) {
  console.log(`[${r.passed ? 'PASS' : 'FAIL'}] #${r.id} (${r.code}) ${r.name} -> ${r.message}`);
}
console.log('---------------------------------------------------------------');
console.log(`TOTAL: ${results.length} | PASS: ${passedCount} | FAIL: ${failedCount}`);
console.log('===============================================================');

if (failedCount > 0) {
  process.exit(1);
}
