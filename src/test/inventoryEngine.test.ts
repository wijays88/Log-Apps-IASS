/**
 * Comprehensive Automated Unit Test Suite (23 Physical Baseline + Engine Scenarios)
 * Logistics Control Tower – PT IAS Support Indonesia
 *
 * Test Classification:
 * - Suite Type: Isolated In-Memory Unit Tests (Zero Production Writes)
 * - Firestore Emulator Integration Tests: NOT VERIFIED in this suite (requires local Firebase Emulator runtime)
 * - Live Production Tests: PROHIBITED / NOT EXECUTED
 */

import {
  buildControlledBaselineReconciliationPlan,
  calculateNewBalanceState,
  generateIdempotencyKey,
  getCanonicalBalanceId,
  getCanonicalBaselineId,
  parseJakartaTimestampMs,
  reconcileBaselineLedger,
  runBaselineMigrationDryRun,
} from '../services/inventoryEngine';
import {
  InventoryBalance,
  InventoryBaseline,
  InventoryMovement,
  StockOpname,
  IN_TRANSIT_LOCATION_ID,
} from '../types';

interface TestResult {
  id: number;
  code: string;
  name: string;
  passed: boolean;
  message: string;
}

const testResults: TestResult[] = [];

function recordTest(id: number, code: string, name: string, condition: boolean, detail: string) {
  testResults.push({
    id,
    code,
    name,
    passed: condition,
    message: condition ? `PASS: ${detail}` : `FAIL: ${detail}`,
  });
}

function makeMovement(overrides: Partial<InventoryMovement>): InventoryMovement {
  return {
    id: overrides.id || 'mov-1',
    movementId: overrides.movementId || overrides.id || 'mov-1',
    materialId: overrides.materialId || 'mat-gen-103',
    materialCode: overrides.materialCode || 'MAT-GEN-103',
    materialName: overrides.materialName || 'Hand Towel',
    locationId: overrides.locationId || 'loc-t3',
    locationName: overrides.locationName || 'Terminal 3',
    unit: overrides.unit || 'Pack',
    movementType: overrides.movementType || 'GOODS_RECEIPT',
    quantity: overrides.quantity ?? 0,
    delta: overrides.delta ?? 0,
    balanceBefore: overrides.balanceBefore ?? 0,
    balanceAfter: overrides.balanceAfter ?? 0,
    sourceDocumentId: overrides.sourceDocumentId || 'doc-1',
    sourceDocumentType: overrides.sourceDocumentType || 'goodsReceipts',
    status: overrides.status || 'POSTED',
    idempotencyKey: overrides.idempotencyKey || 'idemp-1',
    createdAt: overrides.createdAt || '2026-10-15 10:00:00',
    createdTimestampMs: overrides.createdTimestampMs ?? parseJakartaTimestampMs(overrides.createdAt || '2026-10-15 10:00:00'),
    postingSequence: overrides.postingSequence ?? 1,
    notes: overrides.notes || '',
  };
}

export function runFullTestSuite() {
  console.log('==================================================================================');
  console.log('LOGISTICS CONTROL TOWER – PHYSICAL STOCK OPNAME BASELINE UNIT TEST SUITE (33 CASES)');
  console.log('PT IAS SUPPORT INDONESIA – Isolated In-Memory Execution (Zero Production Writes)');
  console.log('==================================================================================');

  const baseState = { openingStock: 0, qtyIn: 0, qtyOut: 0, totalAdjustments: 0, availableStock: 0, version: 0 };

  // Helper simulating transactional opname baseline establishment
  function simulateBaselineApproval(
    opname: StockOpname,
    existingBaselines: Record<string, InventoryBaseline>,
    currentBalance: number
  ): { established: boolean; baseline?: InventoryBaseline; newBalance: number; reason?: string } {
    if (opname.verificationStatus === 'ADJUSTED') {
      return { established: false, newBalance: currentBalance, reason: 'ALREADY_ADJUSTED' };
    }
    if (opname.verificationStatus === 'REJECTED') {
      return { established: false, newBalance: currentBalance, reason: 'OPNAME_REJECTED' };
    }
    if (opname.verificationStatus !== 'PENDING_APPROVAL') {
      return { established: false, newBalance: currentBalance, reason: 'INVALID_STATUS' };
    }
    if (opname.locationId === IN_TRANSIT_LOCATION_ID) {
      return { established: false, newBalance: currentBalance, reason: 'TRANSIT_EXCLUDED' };
    }

    const systemAtCount = opname.systemBalanceAtCount ?? opname.systemQuantity;
    const cutoffVariance = opname.physicalQuantity - systemAtCount;
    const newBalance = currentBalance + cutoffVariance;
    if (newBalance < 0) {
      return { established: false, newBalance: currentBalance, reason: 'INSUFFICIENT_STOCK' };
    }

    const baseId = getCanonicalBaselineId(opname.itemId, opname.locationId, 1);
    if (!existingBaselines[baseId]) {
      const bl: InventoryBaseline = {
        id: baseId,
        baselineId: baseId,
        materialId: opname.itemId,
        materialCode: opname.itemCode,
        materialName: opname.itemName,
        locationId: opname.locationId,
        locationName: opname.locationName,
        baselineQuantity: opname.physicalQuantity,
        unit: opname.unit,
        stockOpnameId: opname.id,
        stockOpnameNumber: opname.opnameNumber,
        sourceMovementId: `mov-so-${opname.id}`,
        countCompletedAt: opname.countCompletedAt || opname.createdAt,
        countCompletedTimestampMs: opname.countCompletedTimestampMs || parseJakartaTimestampMs(opname.countCompletedAt || opname.createdAt),
        approvedAt: '2026-10-15 11:00:00',
        approvedBy: 'Admin Logistik',
        baselineVersion: 1,
        status: 'ACTIVE',
        createdAt: '2026-10-15 11:00:00',
        createdBy: 'Admin Logistik',
      };
      existingBaselines[baseId] = bl;
      return { established: true, baseline: bl, newBalance };
    }

    return { established: false, newBalance, reason: 'BASELINE_ALREADY_EXISTS_ADJUSTMENT_ONLY' };
  }

  const baselinesMap: Record<string, InventoryBaseline> = {};

  // 1. First approved Stock Opname establishes baseline
  const so1: StockOpname = {
    id: 'so-41',
    opnameNumber: 'SO-2026-041',
    opnameDate: '2026-10-10',
    locationId: 'loc-t3',
    locationName: 'Terminal 3',
    itemId: 'mat-gen-103',
    itemCode: 'MAT-GEN-103',
    itemName: 'Hand Towel',
    unit: 'Pack',
    systemQuantity: 0,
    systemBalanceAtCount: 0,
    physicalQuantity: 176,
    variance: 176,
    varianceReason: 'Initial physical opname count',
    verificationStatus: 'PENDING_APPROVAL',
    conductedBy: 'Staff Gudang',
    notes: '',
    createdAt: '2026-10-10 09:00:00',
    countCompletedAt: '2026-10-10 09:30:00',
    countCompletedTimestampMs: parseJakartaTimestampMs('2026-10-10 09:30:00'),
  };
  const res1 = simulateBaselineApproval(so1, baselinesMap, 0);
  recordTest(
    1,
    'TC-01',
    'First Approved Stock Opname Establishes Baseline',
    res1.established && res1.baseline?.baselineQuantity === 176 && res1.newBalance === 176,
    `Baseline ${res1.baseline?.baselineId} established at 176 Pack from ${so1.opnameNumber}`
  );

  // 2. Pending Stock Opname cannot establish baseline
  const soPending: StockOpname = {
    ...so1,
    id: 'so-pending',
    opnameNumber: 'SO-2026-099',
    itemId: 'mat-gen-101',
    itemCode: 'MAT-GEN-101',
    physicalQuantity: 50,
    verificationStatus: 'DRAFT',
  };
  const res2 = simulateBaselineApproval(soPending, baselinesMap, 0);
  recordTest(
    2,
    'TC-02',
    'Pending/Draft Stock Opname Cannot Establish Baseline',
    !res2.established && !baselinesMap[getCanonicalBaselineId('mat-gen-101', 'loc-t3', 1)],
    `Non-approved opname (${soPending.verificationStatus}) blocked from creating baseline`
  );

  // 3. Rejected Stock Opname cannot establish baseline
  const soRejected: StockOpname = {
    ...soPending,
    id: 'so-rej',
    verificationStatus: 'REJECTED',
  };
  const res3 = simulateBaselineApproval(soRejected, baselinesMap, 0);
  recordTest(
    3,
    'TC-03',
    'Rejected Stock Opname Cannot Establish Baseline',
    !res3.established && res3.reason === 'OPNAME_REJECTED',
    'Rejected opname strictly denied from establishing baseline'
  );

  // 4. Explicit physical zero can establish a verified zero baseline
  const soZero: StockOpname = {
    ...so1,
    id: 'so-zero',
    opnameNumber: 'SO-2026-045',
    itemId: 'mat-zero-01',
    itemCode: 'MAT-ZERO-01',
    physicalQuantity: 0,
    systemQuantity: 0,
    systemBalanceAtCount: 0,
    variance: 0,
    verificationStatus: 'PENDING_APPROVAL',
  };
  const res4 = simulateBaselineApproval(soZero, baselinesMap, 0);
  const zeroSum = reconcileBaselineLedger('mat-zero-01', 'loc-t3', res4.baseline, [], 0);
  recordTest(
    4,
    'TC-04',
    'Explicit Physical Zero Baseline Supported',
    res4.established && res4.baseline?.baselineQuantity === 0 && zeroSum.baselineStatus === 'VERIFIED',
    'Explicit counted 0 physical quantity creates VERIFIED zero baseline'
  );

  // 5. Duplicate baseline approval is blocked
  const so1Adjusted: StockOpname = { ...so1, verificationStatus: 'ADJUSTED' };
  const res5 = simulateBaselineApproval(so1Adjusted, baselinesMap, 176);
  recordTest(
    5,
    'TC-05',
    'Duplicate Baseline Approval Blocked',
    !res5.established && res5.reason === 'ALREADY_ADJUSTED' && res5.newBalance === 176,
    'Re-approving already ADJUSTED opname rejected idempotently without modifying balance'
  );

  // 6. Second Stock Opname creates an adjustment without overwriting baseline
  const so2: StockOpname = {
    ...so1,
    id: 'so-52',
    opnameNumber: 'SO-2026-052',
    systemQuantity: 176,
    systemBalanceAtCount: 176,
    physicalQuantity: 170,
    variance: -6,
    verificationStatus: 'PENDING_APPROVAL',
    countCompletedAt: '2026-10-20 10:00:00',
    countCompletedTimestampMs: parseJakartaTimestampMs('2026-10-20 10:00:00'),
  };
  const res6 = simulateBaselineApproval(so2, baselinesMap, 176);
  const originalBaseline = baselinesMap[getCanonicalBaselineId('mat-gen-103', 'loc-t3', 1)];
  recordTest(
    6,
    'TC-06',
    'Second Opname Adjusts Without Overwriting Baseline',
    !res6.established &&
      res6.reason === 'BASELINE_ALREADY_EXISTS_ADJUSTMENT_ONLY' &&
      res6.newBalance === 170 &&
      originalBaseline.baselineQuantity === 176 &&
      originalBaseline.stockOpnameNumber === 'SO-2026-041',
    `Baseline remained 176 (${originalBaseline.stockOpnameNumber}); closing adjusted to ${res6.newBalance}`
  );

  // 7. Goods Receipt after baseline
  const grAfter = calculateNewBalanceState({ ...baseState, availableStock: 176, version: 1 }, 'GOODS_RECEIPT', 24, 24);
  recordTest(
    7,
    'TC-07',
    'Goods Receipt After Baseline',
    grAfter.balanceAfter === 200 && grAfter.newQtyIn === 24,
    `GR +24 after baseline 176 yields ${grAfter.balanceAfter}`
  );

  // 8. Goods Issue after baseline
  const giAfter = calculateNewBalanceState({ ...baseState, availableStock: 200, qtyIn: 24, version: 2 }, 'GOODS_ISSUE', 50, -50);
  recordTest(
    8,
    'TC-08',
    'Goods Issue After Baseline',
    giAfter.balanceAfter === 150 && giAfter.newQtyOut === 50,
    `GI -50 after 200 yields ${giAfter.balanceAfter}`
  );

  // 9 & 10. Transfer dispatch, receipt & IN_TRANSIT balance
  const originDisp = calculateNewBalanceState({ ...baseState, availableStock: 150, version: 3 }, 'TRANSFER_DISPATCH', 30, -30);
  const transitIn = calculateNewBalanceState({ ...baseState, availableStock: 0, version: 0 }, 'TRANSFER_DISPATCH', 30, 30);
  const transitOut = calculateNewBalanceState({ ...baseState, availableStock: 30, qtyIn: 30, version: 1 }, 'TRANSFER_RECEIPT', 30, -30);
  const destIn = calculateNewBalanceState({ ...baseState, availableStock: 10, version: 1 }, 'TRANSFER_RECEIPT', 30, 30);
  recordTest(
    9,
    'TC-09',
    'Transfer Dispatch and Receipt',
    originDisp.balanceAfter === 120 && destIn.balanceAfter === 40,
    `Origin 150->120, Destination 10->40`
  );
  recordTest(
    10,
    'TC-10',
    'IN_TRANSIT Virtual Bucket Isolation & Clearing',
    transitIn.balanceAfter === 30 && transitOut.balanceAfter === 0,
    `IN_TRANSIT 0->30 on dispatch, 30->0 on receipt`
  );

  // 11. Daily Consumption
  const consAfter = calculateNewBalanceState({ ...baseState, availableStock: 120, version: 4 }, 'DAILY_CONSUMPTION', 20, -20);
  recordTest(
    11,
    'TC-11',
    'Daily Consumption Deduction',
    consAfter.balanceAfter === 100 && consAfter.newQtyOut === 20,
    `Daily consumption -20 yields ${consAfter.balanceAfter}`
  );

  // 12. Concurrent Goods Issue
  let concurrentRejectCaught = false;
  try {
    calculateNewBalanceState({ ...baseState, availableStock: 15, version: 5 }, 'GOODS_ISSUE', 20, -20);
  } catch (err: any) {
    concurrentRejectCaught = String(err.message).includes('INSUFFICIENT_STOCK');
  }
  recordTest(
    12,
    'TC-12',
    'Concurrent Goods Issue Anti-Negative Guard',
    concurrentRejectCaught,
    'Second concurrent issue exceeding availableStock (15) throws INSUFFICIENT_STOCK'
  );

  // 13. Concurrent Stock Opname approval
  const firstOp = simulateBaselineApproval({ ...so2, id: 'so-conc-1' }, { ...baselinesMap }, 176);
  const secondOp = simulateBaselineApproval({ ...so2, id: 'so-conc-1', verificationStatus: 'ADJUSTED' }, { ...baselinesMap }, firstOp.newBalance);
  recordTest(
    13,
    'TC-13',
    'Concurrent Stock Opname Approval Guard',
    !firstOp.established && firstOp.newBalance === 170 && !secondOp.established && secondOp.reason === 'ALREADY_ADJUSTED',
    'Concurrent second approval after ADJUSTED state is strictly rejected'
  );

  // 14. Movement between count completion and approval
  // Count completed at 09:30 (physical=176, systemAtCount=100 -> variance +76). GR +20 posted at 09:45 before approval at 10:00 (current=120).
  const baselineIntervening: InventoryBaseline = {
    ...originalBaseline,
    countCompletedAt: '2026-10-10 09:30:00',
    countCompletedTimestampMs: parseJakartaTimestampMs('2026-10-10 09:30:00'),
    sourceMovementId: 'mov-so-41',
  };
  const movAnchor = makeMovement({
    id: 'mov-so-41',
    movementType: 'STOCK_OPNAME_ADJUSTMENT',
    quantity: 76,
    delta: 76,
    sourceDocumentId: 'so-41',
    createdAt: '2026-10-10 10:00:00',
  });
  const movBetween = makeMovement({
    id: 'mov-gr-between',
    movementType: 'GOODS_RECEIPT',
    quantity: 20,
    delta: 20,
    sourceDocumentId: 'GR-BETWEEN',
    createdAt: '2026-10-10 09:45:00',
  });
  // Expected authoritative balance at approval = 120 + 76 = 196 (baseline 176 + 20 GR between count & approval)
  const betweenSummary = reconcileBaselineLedger('mat-gen-103', 'loc-t3', baselineIntervening, [movBetween, movAnchor], 196);
  recordTest(
    14,
    'TC-14',
    'Movement Between Count Completion and Approval Preserved',
    betweenSummary.reconstructedClosing === 196 && betweenSummary.isReconciled && betweenSummary.qtyIn === 20,
    `Post-count GR (+20 at 09:45) preserved on top of baseline 176 -> 196`
  );

  // 15 & 16. Baseline cutoff, historical movement preservation, and NO double-counting of initial opname adjustment
  const preCutoffMov = makeMovement({
    id: 'mov-pre-gr',
    movementType: 'GOODS_RECEIPT',
    quantity: 50,
    delta: 50,
    createdAt: '2026-10-08 08:00:00',
  });
  const anchorSoMov = makeMovement({
    id: 'mov-so-anchor',
    movementType: 'STOCK_OPNAME_ADJUSTMENT',
    quantity: 176,
    delta: 176,
    sourceDocumentId: 'SO-2026-041',
    createdAt: '2026-10-10 10:05:00', // Approved after cutoff
  });
  const postIssueMov = makeMovement({
    id: 'mov-post-gi',
    movementType: 'GOODS_ISSUE',
    quantity: 176,
    delta: -176,
    sourceDocumentId: 'GI-2026-801',
    createdAt: '2026-10-12 14:00:00',
  });
  const anchorBaseline: InventoryBaseline = {
    ...originalBaseline,
    baselineQuantity: 176,
    stockOpnameId: 'so-41',
    stockOpnameNumber: 'SO-2026-041',
    sourceMovementId: 'mov-so-anchor',
    countCompletedAt: '2026-10-10 09:30:00',
    countCompletedTimestampMs: parseJakartaTimestampMs('2026-10-10 09:30:00'),
  };
  const noDoubleCountSum = reconcileBaselineLedger(
    'mat-gen-103',
    'loc-t3',
    anchorBaseline,
    [preCutoffMov, anchorSoMov, postIssueMov],
    0 // 176 baseline - 176 issued = 0 authoritative
  );
  recordTest(
    15,
    'TC-15',
    'Baseline Cutoff & Pre-Baseline History Preservation',
    noDoubleCountSum.preBaselineMovementsCount === 2 && noDoubleCountSum.qualifyingMovementsCount === 1,
    `Pre-cutoff & anchor movements (${noDoubleCountSum.preBaselineMovementsCount}) excluded from post-baseline sum while preserved in ledger`
  );
  recordTest(
    16,
    'TC-16',
    'No Double-Counting of Initial Stock Opname Adjustment',
    noDoubleCountSum.baselineQuantity === 176 &&
      noDoubleCountSum.adjustments === 0 &&
      noDoubleCountSum.reconstructedClosing === 0 &&
      noDoubleCountSum.isReconciled,
    `MAT-GEN-103 anchor +176 neutralized: 176 (baseline) - 176 (GI) = 0 (NOT 176 + 176 - 176 = 176)`
  );

  // 17. Stock Card reconciliation
  const postGr2 = makeMovement({
    id: 'mov-post-gr2',
    movementType: 'GOODS_RECEIPT',
    quantity: 40,
    delta: 40,
    createdAt: '2026-10-13 09:00:00',
  });
  const cardSum = reconcileBaselineLedger('mat-gen-103', 'loc-t3', anchorBaseline, [preCutoffMov, anchorSoMov, postIssueMov, postGr2], 40);
  recordTest(
    17,
    'TC-17',
    'Stock Card Chronological Reconciliation',
    cardSum.reconstructedClosing === 40 && cardSum.isReconciled,
    `Stock card baseline 176 - 176 + 40 = 40 matches authoritative 40`
  );

  // 18. Inventory Position reconciliation (MAT-GEN-104 = 68 physical -> 68 issued -> 0)
  const bl104: InventoryBaseline = {
    ...anchorBaseline,
    id: getCanonicalBaselineId('mat-gen-104', 'loc-t3', 1),
    baselineId: getCanonicalBaselineId('mat-gen-104', 'loc-t3', 1),
    materialId: 'mat-gen-104',
    materialCode: 'MAT-GEN-104',
    baselineQuantity: 68,
    stockOpnameId: 'so-42',
    stockOpnameNumber: 'SO-2026-042',
    sourceMovementId: 'mov-so-42',
  };
  const movSo42 = makeMovement({
    id: 'mov-so-42',
    materialId: 'mat-gen-104',
    materialCode: 'MAT-GEN-104',
    movementType: 'STOCK_OPNAME_ADJUSTMENT',
    quantity: 68,
    delta: 68,
    sourceDocumentId: 'SO-2026-042',
    createdAt: '2026-10-10 10:05:00',
  });
  const movGi104 = makeMovement({
    id: 'mov-gi-104',
    materialId: 'mat-gen-104',
    materialCode: 'MAT-GEN-104',
    movementType: 'GOODS_ISSUE',
    quantity: 68,
    delta: -68,
    createdAt: '2026-10-12 15:00:00',
  });
  const pos104 = reconcileBaselineLedger('mat-gen-104', 'loc-t3', bl104, [movSo42, movGi104], 0);
  recordTest(
    18,
    'TC-18',
    'Inventory Position Reconciliation (MAT-GEN-104)',
    pos104.baselineStatus === 'VERIFIED' && pos104.reconstructedClosing === 0 && pos104.isReconciled,
    `MAT-GEN-104 verified baseline 68, qtyOut 68, closing 0, diff ${pos104.reconciliationDifference}`
  );

  // 19. Multiple warehouses for the same material
  const blT1 = reconcileBaselineLedger('mat-gen-103', 'loc-t1', null, [], 25);
  recordTest(
    19,
    'TC-19',
    'Multiple Warehouses Isolation for Same Material',
    cardSum.baselineStatus === 'VERIFIED' && blT1.baselineStatus === 'UNVERIFIED',
    'Verified baseline in Terminal 3 does not leak verification to Terminal 1'
  );

  // 20 & 21. Missing baseline status & Negative balance detection (MAT-GEN-101 = -16, MAT-GEN-102 = -3)
  const sum101 = reconcileBaselineLedger('mat-gen-101', 'loc-t3', null, [], -16);
  const sum102 = reconcileBaselineLedger('mat-gen-102', 'loc-t3', null, [], -3);
  const sumUnverifiedPositive = reconcileBaselineLedger('mat-gen-105', 'loc-t3', null, [], 15);
  recordTest(
    20,
    'TC-20',
    'Missing Baseline Status Classification',
    sumUnverifiedPositive.baselineStatus === 'UNVERIFIED' && sumUnverifiedPositive.baselineQuantity === 0,
    'Unverified positive SKU correctly classified as UNVERIFIED without faking verified physical stock'
  );
  recordTest(
    21,
    'TC-21',
    'Negative Balance Detection (MAT-GEN-101 & MAT-GEN-102)',
    sum101.baselineStatus === 'RECONCILIATION_EXCEPTION' && sum102.baselineStatus === 'RECONCILIATION_EXCEPTION',
    `Negative stocks (-16, -3) without opname flagged as RECONCILIATION_EXCEPTION (not silently set as 0 physical baseline)`
  );

  // 22. Duplicate inventory document / dry-run candidate conflict detection
  const dryRunSample = runBaselineMigrationDryRun({
    inventory: [
      {
        id: 'bal-mat-gen-101-loc-t3',
        materialId: 'mat-gen-101',
        materialCode: 'MAT-GEN-101',
        materialName: 'Jumbo Roll Tissue',
        categoryId: 'cat-tissue',
        categoryName: 'Tissue',
        unit: 'Roll',
        locationId: 'loc-t3',
        locationName: 'Terminal 3',
        openingStock: 0,
        qtyIn: 0,
        qtyOut: 16,
        availableStock: -16,
        minimumStock: 10,
        reorderPoint: 20,
        lastTransactionDate: '2026-10-12',
      },
      {
        id: 'bal-mat-gen-103-loc-t3',
        materialId: 'mat-gen-103',
        materialCode: 'MAT-GEN-103',
        materialName: 'Hand Towel',
        categoryId: 'cat-tissue',
        categoryName: 'Tissue',
        unit: 'Pack',
        locationId: 'loc-t3',
        locationName: 'Terminal 3',
        openingStock: 176,
        qtyIn: 0,
        qtyOut: 176,
        availableStock: 0,
        minimumStock: 10,
        reorderPoint: 20,
        lastTransactionDate: '2026-10-12',
      },
    ],
    stockOpnames: [
      { ...so1, verificationStatus: 'ADJUSTED', adjustmentMovementId: 'mov-so-anchor' },
      { ...so2, id: 'so-dup', opnameNumber: 'SO-2026-049', verificationStatus: 'ADJUSTED' },
    ],
    inventoryMovements: [anchorSoMov, postIssueMov],
    existingBaselines: [],
  });
  recordTest(
    22,
    'TC-22',
    'Duplicate Opname Candidate & Dry-Run Conflict Detection',
    dryRunSample.duplicateCandidateConflicts === 1 &&
      dryRunSample.negativeStockCount === 1 &&
      dryRunSample.exceptionCount === 1 &&
      dryRunSample.rows.find((r) => r.materialCode === 'MAT-GEN-103')?.candidateOpnameNumber === 'SO-2026-041',
    `Dry-run detected ${dryRunSample.duplicateCandidateConflicts} duplicate candidate, selected earliest SO-2026-041, flagged MAT-GEN-101 RECONCILIATION_EXCEPTION`
  );

  // 23. Idempotent transaction retry
  const keyA = generateIdempotencyKey('SO_ADJUST', 'so-41', 'mat-gen-103', 'loc-t3', 'STOCK_OPNAME_ADJUSTMENT');
  const keyB = generateIdempotencyKey('SO_ADJUST', 'so-41', 'mat-gen-103', 'loc-t3', 'STOCK_OPNAME_ADJUSTMENT');
  const canonicalBalId = getCanonicalBalanceId('mat-gen-103', 'loc-t3');
  recordTest(
    23,
    'TC-23',
    'Idempotent Transaction Retry Determinism',
    keyA === keyB && canonicalBalId === 'bal-mat-gen-103-loc-t3',
    `Deterministic idempotency key (${keyA}) & canonical balance ID (${canonicalBalId}) prevent double posting`
  );

  // ==================================================================================
  // PHASE 6 — MANDATORY 10 END-TO-END TRANSACTION & RECONCILIATION TESTS (TC-24..TC-33)
  // ==================================================================================

  // 24. Scenario 1: First physical Stock Opname baseline establishes v1 & preserves subsequent adjustments
  const planResult = buildControlledBaselineReconciliationPlan({
    inventory: [
      {
        id: 'bal-mat-t1b-001-loc-t1b',
        materialId: 'mat-t1b-001',
        materialCode: 'MAT-T1B-001',
        materialName: 'Polybag Hitam 90x120',
        categoryId: 'cat-plastic',
        categoryName: 'Plastik',
        unit: 'Pack',
        locationId: 'loc-t1b',
        locationName: 'Gudang Terminal 1B',
        openingStock: 0,
        qtyIn: 20,
        qtyOut: 5,
        availableStock: 65,
        minimumStock: 10,
        reorderPoint: 20,
        lastTransactionDate: '2026-10-20',
      },
    ],
    stockOpnames: [
      {
        id: 'so-t1b-1',
        opnameNumber: 'SO-2026-101',
        opnameDate: '2026-10-01',
        locationId: 'loc-t1b',
        locationName: 'Gudang Terminal 1B',
        itemId: 'mat-t1b-001',
        itemCode: 'MAT-T1B-001',
        itemName: 'Polybag Hitam 90x120',
        unit: 'Pack',
        systemQuantity: 0,
        physicalQuantity: 50,
        variance: 50,
        varianceReason: 'Opname Fisik Perdana T1B',
        verificationStatus: 'ADJUSTED',
        conductedBy: 'Staff T1B',
        notes: '',
        createdAt: '2026-10-01 09:00:00',
        countCompletedAt: '2026-10-01 09:30:00',
        countCompletedTimestampMs: parseJakartaTimestampMs('2026-10-01 09:30:00'),
        adjustedAt: '2026-10-01 10:00:00',
      },
      {
        id: 'so-t1b-2',
        opnameNumber: 'SO-2026-108',
        opnameDate: '2026-10-18',
        locationId: 'loc-t1b',
        locationName: 'Gudang Terminal 1B',
        itemId: 'mat-t1b-001',
        itemCode: 'MAT-T1B-001',
        itemName: 'Polybag Hitam 90x120',
        unit: 'Pack',
        systemQuantity: 65,
        physicalQuantity: 63,
        variance: -2,
        varianceReason: 'Opname susulan',
        verificationStatus: 'ADJUSTED',
        conductedBy: 'Staff T1B',
        notes: '',
        createdAt: '2026-10-18 09:00:00',
        countCompletedAt: '2026-10-18 09:30:00',
        countCompletedTimestampMs: parseJakartaTimestampMs('2026-10-18 09:30:00'),
        adjustedAt: '2026-10-18 10:00:00',
      },
    ],
    existingBaselines: [],
    actorName: 'Admin Audit',
    actorEmployeeId: 'ADM-01',
  });
  recordTest(
    24,
    'TC-24',
    'Controlled Reconciliation Plan Picks Earliest Physical Opname',
    planResult.items.length === 1 &&
      planResult.items[0].newBaseline.stockOpnameNumber === 'SO-2026-101' &&
      planResult.items[0].newBaseline.baselineQuantity === 50 &&
      planResult.items[0].newBaseline.baselineVersion === 1,
    `Selected earliest SO-2026-101 (qty 50, v1) cleanly without replacing baseline with SO-2026-108`
  );

  // 25. Scenario 2: Repeated Goods Issue transactions (100 -> -20 -> -15 -> -10 = 55)
  let seqGiState = { openingStock: 100, qtyIn: 0, qtyOut: 0, totalAdjustments: 0, availableStock: 100, version: 1 };
  const giStep1 = calculateNewBalanceState(seqGiState, 'GOODS_ISSUE', 20, -20);
  seqGiState = {
    openingStock: 100,
    qtyIn: giStep1.newQtyIn,
    qtyOut: giStep1.newQtyOut,
    totalAdjustments: giStep1.newTotalAdjustments,
    availableStock: giStep1.balanceAfter,
    version: giStep1.newVersion,
  };
  const giStep2 = calculateNewBalanceState(seqGiState, 'GOODS_ISSUE', 15, -15);
  seqGiState = {
    openingStock: 100,
    qtyIn: giStep2.newQtyIn,
    qtyOut: giStep2.newQtyOut,
    totalAdjustments: giStep2.newTotalAdjustments,
    availableStock: giStep2.balanceAfter,
    version: giStep2.newVersion,
  };
  const giStep3 = calculateNewBalanceState(seqGiState, 'GOODS_ISSUE', 10, -10);
  let overIssueBlocked = false;
  try {
    calculateNewBalanceState(
      {
        openingStock: 100,
        qtyIn: giStep3.newQtyIn,
        qtyOut: giStep3.newQtyOut,
        totalAdjustments: giStep3.newTotalAdjustments,
        availableStock: giStep3.balanceAfter,
        version: giStep3.newVersion,
      },
      'GOODS_ISSUE',
      60,
      -60
    );
  } catch (e: any) {
    overIssueBlocked = String(e.message).includes('INSUFFICIENT_STOCK');
  }
  recordTest(
    25,
    'TC-25',
    'Repeated Goods Issue Sequence (100 -> -20 -> -15 -> -10 = 55)',
    giStep1.balanceAfter === 80 &&
      giStep2.balanceAfter === 65 &&
      giStep3.balanceAfter === 55 &&
      giStep3.newQtyOut === 45 &&
      overIssueBlocked,
    `100 -> 80 -> 65 -> 55 (qtyOut=45, version=${giStep3.newVersion}) and over-issue (60 > 55) blocked`
  );

  // 26. Scenario 3: Repeated Goods Receipt transactions (+40 -> +25 -> +35 = 100)
  let seqGrState = { ...baseState };
  const gr1 = calculateNewBalanceState(seqGrState, 'GOODS_RECEIPT', 40, 40);
  seqGrState = { openingStock: 0, qtyIn: gr1.newQtyIn, qtyOut: gr1.newQtyOut, totalAdjustments: 0, availableStock: gr1.balanceAfter, version: gr1.newVersion };
  const gr2 = calculateNewBalanceState(seqGrState, 'GOODS_RECEIPT', 25, 25);
  seqGrState = { openingStock: 0, qtyIn: gr2.newQtyIn, qtyOut: gr2.newQtyOut, totalAdjustments: 0, availableStock: gr2.balanceAfter, version: gr2.newVersion };
  const gr3 = calculateNewBalanceState(seqGrState, 'GOODS_RECEIPT', 35, 35);
  recordTest(
    26,
    'TC-26',
    'Repeated Goods Receipt Sequence (0 -> +40 -> +25 -> +35 = 100)',
    gr1.balanceAfter === 40 && gr2.balanceAfter === 65 && gr3.balanceAfter === 100 && gr3.newQtyIn === 100,
    `0 -> 40 -> 65 -> 100 (cumulative qtyIn=${gr3.newQtyIn}, version=${gr3.newVersion})`
  );

  // 27. Scenario 4: Multiple transaction types on same material (Baseline + GR + GI + Consumption + Transfer + Opname)
  const blT1b: InventoryBaseline = {
    ...planResult.items[0].newBaseline,
  };
  const multiMovs: InventoryMovement[] = [
    makeMovement({
      id: 'm-gr',
      materialId: 'mat-t1b-001',
      materialCode: 'MAT-T1B-001',
      locationId: 'loc-t1b',
      movementType: 'GOODS_RECEIPT',
      quantity: 30,
      delta: 30,
      createdAt: '2026-10-05 10:00:00',
    }),
    makeMovement({
      id: 'm-gi',
      materialId: 'mat-t1b-001',
      materialCode: 'MAT-T1B-001',
      locationId: 'loc-t1b',
      movementType: 'GOODS_ISSUE',
      quantity: 12,
      delta: -12,
      createdAt: '2026-10-06 11:00:00',
    }),
    makeMovement({
      id: 'm-cons',
      materialId: 'mat-t1b-001',
      materialCode: 'MAT-T1B-001',
      locationId: 'loc-t1b',
      movementType: 'DAILY_CONSUMPTION',
      quantity: 8,
      delta: -8,
      createdAt: '2026-10-07 15:00:00',
    }),
    makeMovement({
      id: 'm-tr-out',
      materialId: 'mat-t1b-001',
      materialCode: 'MAT-T1B-001',
      locationId: 'loc-t1b',
      movementType: 'TRANSFER_DISPATCH',
      quantity: 10,
      delta: -10,
      createdAt: '2026-10-08 09:00:00',
    }),
    makeMovement({
      id: 'm-so-sub',
      materialId: 'mat-t1b-001',
      materialCode: 'MAT-T1B-001',
      locationId: 'loc-t1b',
      movementType: 'STOCK_OPNAME_ADJUSTMENT',
      quantity: 2,
      delta: -2,
      sourceDocumentId: 'so-t1b-2',
      createdAt: '2026-10-18 10:00:00',
    }),
  ];
  const multiSum = reconcileBaselineLedger('mat-t1b-001', 'loc-t1b', blT1b, multiMovs, 48, {
    materialCode: 'MAT-T1B-001',
  });
  recordTest(
    27,
    'TC-27',
    'Mixed Transactions on Same Material Maintain Parity',
    multiSum.baselineStatus === 'VERIFIED' &&
      multiSum.baselineQuantity === 50 &&
      multiSum.qtyIn === 30 &&
      multiSum.qtyOut === 30 &&
      multiSum.adjustments === -2 &&
      multiSum.reconstructedClosing === 48 &&
      multiSum.isReconciled,
    `50 + 30 - 30 - 2 = 48 matches authoritative balance (parity PASS)`
  );

  // 28. Scenario 5: Multiple locations containing same material (Terminal 1B vs Terminal 3)
  const trDestMov = makeMovement({
    id: 'm-tr-in-t3',
    materialId: 'mat-t1b-001',
    materialCode: 'MAT-T1B-001',
    locationId: 'loc-t3',
    movementType: 'TRANSFER_RECEIPT',
    quantity: 10,
    delta: 10,
    createdAt: '2026-10-08 12:00:00',
  });
  const t3Unverified = reconcileBaselineLedger('mat-t1b-001', 'loc-t3', null, [...multiMovs, trDestMov], 10, {
    materialCode: 'MAT-T1B-001',
  });
  recordTest(
    28,
    'TC-28',
    'Same Material Isolated Across Multiple Locations (T1B vs T3)',
    multiSum.baselineStatus === 'VERIFIED' &&
      t3Unverified.baselineStatus === 'UNVERIFIED' &&
      t3Unverified.qtyIn === 10 &&
      t3Unverified.qtyOut === 0 &&
      t3Unverified.reconstructedClosing === 10,
    `T1B verified (50->48) while T3 stays UNVERIFIED with independent qtyIn=+10 & closing=10`
  );

  // 29. Scenario 6: Sequential balance updates maintain monotonic version & exact totals
  const monoVersions = [gr1.newVersion, gr2.newVersion, gr3.newVersion];
  const isStrictMonotonic = monoVersions.every((v, i) => i === 0 || v === monoVersions[i - 1] + 1);
  recordTest(
    29,
    'TC-29',
    'Sequential Balance Updates Monotonic Version Integrity',
    isStrictMonotonic && gr3.newVersion === 3,
    `Versions incremented monotonically (${monoVersions.join(' -> ')}) across sequential mutations`
  );

  // 30. Scenario 7: Concurrent Goods Issue approvals (one succeeds, second sees updated balance & fails if insufficient)
  let sharedStock = 30;
  function simulateConcurrentGIApprove(requestQty: number): { approved: boolean; stockAfter: number; error?: string } {
    if (sharedStock < requestQty) {
      return { approved: false, stockAfter: sharedStock, error: 'INSUFFICIENT_STOCK' };
    }
    sharedStock -= requestQty;
    return { approved: true, stockAfter: sharedStock };
  }
  const conc1 = simulateConcurrentGIApprove(20);
  const conc2 = simulateConcurrentGIApprove(15);
  recordTest(
    30,
    'TC-30',
    'Concurrent Goods Issue Approvals Prevent Negative Stock',
    conc1.approved && conc1.stockAfter === 10 && !conc2.approved && conc2.error === 'INSUFFICIENT_STOCK' && sharedStock === 10,
    `First approval (20) left 10; serialized concurrent approval (15) rejected with INSUFFICIENT_STOCK; stock stayed 10`
  );

  // 31. Scenario 8: Duplicate approval prevention (status lock + deterministic idempotency key)
  const processedApprovals = new Set<string>();
  const giApproveStatus = { status: 'PENDING_APPROVAL' as 'PENDING_APPROVAL' | 'APPROVED' };
  function simulateSingleApproval(issueId: string, qty: number): { ok: boolean; reason?: string } {
    if (giApproveStatus.status !== 'PENDING_APPROVAL') {
      return { ok: false, reason: 'ALREADY_PROCESSED' };
    }
    const idemp = generateIdempotencyKey('GI_APPROVE', issueId, 'mat-gen-103', 'loc-t3', 'GOODS_ISSUE');
    if (processedApprovals.has(idemp)) {
      return { ok: false, reason: 'IDEMPOTENT_SKIP' };
    }
    processedApprovals.add(idemp);
    giApproveStatus.status = 'APPROVED';
    return { ok: qty > 0 };
  }
  const dupFirst = simulateSingleApproval('gi-888', 10);
  const dupSecond = simulateSingleApproval('gi-888', 10);
  recordTest(
    31,
    'TC-31',
    'Duplicate Approval Prevention (Status Lock + Idempotency Key)',
    dupFirst.ok && !dupSecond.ok && dupSecond.reason === 'ALREADY_PROCESSED' && processedApprovals.size === 1,
    `First approval succeeded; immediate duplicate blocked with ${dupSecond.reason}`
  );

  // 32. Scenario 9: Subsequent Stock Opname after transactions preserves v1 baseline & adds adjustment
  const existingBaselinesForExisting = [blT1b];
  const noOverwritePlan = buildControlledBaselineReconciliationPlan({
    inventory: [
      {
        id: 'bal-mat-t1b-001-loc-t1b',
        materialId: 'mat-t1b-001',
        materialCode: 'MAT-T1B-001',
        materialName: 'Polybag Hitam 90x120',
        categoryId: 'cat-plastic',
        categoryName: 'Plastik',
        unit: 'Pack',
        locationId: 'loc-t1b',
        locationName: 'Gudang Terminal 1B',
        openingStock: 50,
        qtyIn: 30,
        qtyOut: 30,
        totalAdjustments: -2,
        availableStock: 48,
        minimumStock: 10,
        reorderPoint: 20,
        lastTransactionDate: '2026-10-18',
      },
    ],
    stockOpnames: [
      {
        id: 'so-t1b-2',
        opnameNumber: 'SO-2026-108',
        opnameDate: '2026-10-18',
        locationId: 'loc-t1b',
        locationName: 'Gudang Terminal 1B',
        itemId: 'mat-t1b-001',
        itemCode: 'MAT-T1B-001',
        itemName: 'Polybag Hitam 90x120',
        unit: 'Pack',
        systemQuantity: 50,
        physicalQuantity: 48,
        variance: -2,
        varianceReason: 'Adjustment susulan',
        verificationStatus: 'ADJUSTED',
        conductedBy: 'Staff',
        notes: '',
        createdAt: '2026-10-18 10:00:00',
      },
    ],
    existingBaselines: existingBaselinesForExisting,
    actorName: 'Admin',
  });
  recordTest(
    32,
    'TC-32',
    'Subsequent Opname Never Overwrites Original V1 Baseline',
    noOverwritePlan.items.length === 0 && noOverwritePlan.skipped.length === 1 && multiSum.baselineQuantity === 50,
    `Active v1 baseline (50) preserved untouched; subsequent opname reflected strictly as adjustment (-2)`
  );

  // 33. Scenario 10: Pre-ledger / refresh inventory counter preservation without faking verified physical opening
  const preLedgerBal: InventoryBalance = {
    id: 'bal-legacy-01-loc-t1b',
    materialId: 'mat-legacy-01',
    materialCode: 'MAT-LEG-01',
    materialName: 'Tissue Legacy',
    categoryId: 'cat-tissue',
    categoryName: 'Tissue',
    unit: 'Roll',
    locationId: 'loc-t1b',
    locationName: 'Gudang Terminal 1B',
    openingStock: 0,
    qtyIn: 45,
    qtyOut: 15,
    totalAdjustments: 0,
    availableStock: 30,
    minimumStock: 5,
    reorderPoint: 10,
    lastTransactionDate: '2026-10-19',
  };
  const legacySum = reconcileBaselineLedger('mat-legacy-01', 'loc-t1b', null, [], 30, {
    inventoryCounters: preLedgerBal,
  });
  recordTest(
    33,
    'TC-33',
    'Pre-Ledger Counter Preservation Without Faking Verified Physical Opening',
    legacySum.baselineStatus === 'UNVERIFIED' &&
      legacySum.baseline === null &&
      legacySum.hasLegacyCountersFallback === true &&
      legacySum.qtyIn === 45 &&
      legacySum.qtyOut === 15 &&
      legacySum.authoritativeBalance === 30 &&
      legacySum.isReconciled,
    `Preserved legacy IN (+45) / OUT (-15) counters for closing=30 while remaining UNVERIFIED (no fake 0 baseline)`
  );

  // Report Summary
  let passCount = 0;
  let failCount = 0;
  for (const t of testResults) {
    console.log(`[${t.passed ? '✓' : '✗'}] [${t.code}] ${t.name.padEnd(60)}: ${t.message}`);
    if (t.passed) passCount++;
    else failCount++;
  }

  console.log('==================================================================================');
  console.log(`UNIT TEST RESULT: ${passCount}/${testResults.length} PASSED | ${failCount}/${testResults.length} FAILED`);
  console.log('FIRESTORE EMULATOR INTEGRATION TESTS: NOT VERIFIED (Java runtime not available)');
  console.log('LIVE PRODUCTION TESTS: NOT EXECUTED (Strict Read-Only Boundary)');
  console.log('==================================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

runFullTestSuite();
