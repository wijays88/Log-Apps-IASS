import {
  calculateNewBalanceState,
  calculateUnreservedAvailableStock,
  getPendingGoodsIssueReservedQty,
  countDuplicateInventoryBalances,
  generateIdempotencyKey,
  getCanonicalBalanceId,
  reconcileBaselineLedger,
  runBaselineMigrationDryRun,
  buildControlledBaselineReconciliationPlan,
  parseJakartaTimestampMs,
} from '../services/inventoryEngine';
import {
  GoodsIssue,
  InventoryBalance,
  InventoryBaseline,
  InventoryMovement,
  StockOpname,
} from '../types';

function makeMovement(params: {
  sourceType: string;
  sourceId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  locationId: string;
  locationName: string;
  movementType: InventoryMovement['movementType'];
  quantity: number;
  delta: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
  seq: number;
}): InventoryMovement {
  const idempotencyKey = generateIdempotencyKey(
    params.sourceType,
    params.sourceId,
    params.materialId,
    params.locationId,
    params.movementType
  );
  const movementId = `mov-${idempotencyKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  return {
    id: movementId,
    movementId,
    materialId: params.materialId,
    materialCode: params.materialCode,
    materialName: params.materialName,
    locationId: params.locationId,
    locationName: params.locationName,
    unit: 'Pack',
    movementType: params.movementType,
    quantity: params.quantity,
    delta: params.delta,
    balanceBefore: params.balanceBefore,
    balanceAfter: params.balanceAfter,
    sourceDocumentId: params.sourceId,
    sourceDocumentType: params.sourceType === 'GR' ? 'goodsReceipts' : 'goodsIssues',
    status: 'POSTED',
    idempotencyKey,
    createdAt: params.createdAt,
    createdTimestampMs: parseJakartaTimestampMs(params.createdAt),
    postingSequence: params.seq,
  };
}

function assert(cond: boolean, label: string, details: string) {
  if (!cond) {
    console.error(`[FAIL] ${label}: ${details}`);
    process.exitCode = 1;
  } else {
    console.log(`[PASS] ${label}: ${details}`);
  }
}

function runFinalValidation() {
  console.log('==================================================================================');
  console.log('FINAL VALIDATION HARNESS — SCENARIOS 1 TO 5 (ISOLATED IN-MEMORY)');
  console.log('==================================================================================');

  // ------------------------------------------------------------------
  // SCENARIO 1: Repeated Goods Issue (100 -> -20 -> -15 -> -10 = 55)
  // ------------------------------------------------------------------
  const matId = 'mat-tissue-ht';
  const matCode = 'MAT-TIS-HT';
  const matName = 'Tissue Hand Towel';
  const locT1B = 'loc-t1b';
  const locT1BName = 'Gudang Terminal 1B';

  let s1State = {
    openingStock: 100,
    qtyIn: 0,
    qtyOut: 0,
    totalAdjustments: 0,
    availableStock: 100,
    version: 1,
  };
  const s1Movements: InventoryMovement[] = [];
  const s1Issues = [
    { id: 'gi-001', qty: 20, ts: '2026-11-12 09:00:00' },
    { id: 'gi-002', qty: 15, ts: '2026-11-12 09:05:00' },
    { id: 'gi-003', qty: 10, ts: '2026-11-12 09:10:00' },
  ];

  s1Issues.forEach((gi, idx) => {
    const calc = calculateNewBalanceState(s1State, 'GOODS_ISSUE', gi.qty, -gi.qty);
    const mov = makeMovement({
      sourceType: 'GI',
      sourceId: gi.id,
      materialId: matId,
      materialCode: matCode,
      materialName: matName,
      locationId: locT1B,
      locationName: locT1BName,
      movementType: 'GOODS_ISSUE',
      quantity: gi.qty,
      delta: -gi.qty,
      balanceBefore: calc.balanceBefore,
      balanceAfter: calc.balanceAfter,
      createdAt: gi.ts,
      seq: idx + 1,
    });
    s1Movements.push(mov);
    s1State = {
      ...s1State,
      qtyIn: calc.newQtyIn,
      qtyOut: calc.newQtyOut,
      totalAdjustments: calc.newTotalAdjustments,
      availableStock: calc.balanceAfter,
      version: calc.newVersion,
    };
  });

  console.log('\n--- Scenario 1 Ledger ---');
  s1Movements.forEach((m) =>
    console.log(
      `  ${m.sourceDocumentId} -> ${m.movementId} | ${m.movementType} | delta=${m.delta} | ${m.balanceBefore} -> ${m.balanceAfter}`
    )
  );
  assert(
    s1State.availableStock === 55 && s1State.qtyOut === 45 && s1State.version === 4,
    'Scenario 1 (Repeated Goods Issue)',
    `Expected=55, Actual=${s1State.availableStock}, qtyOut=${s1State.qtyOut}, version=${s1State.version}`
  );

  // ------------------------------------------------------------------
  // SCENARIO 2: Repeated Goods Receipt (55 -> +30 -> +15 = 100)
  // ------------------------------------------------------------------
  let s2State = { ...s1State };
  const s2Movements: InventoryMovement[] = [];
  const s2Receipts = [
    { id: 'gr-001', qty: 30, ts: '2026-11-12 10:00:00' },
    { id: 'gr-002', qty: 15, ts: '2026-11-12 10:05:00' },
  ];

  s2Receipts.forEach((gr, idx) => {
    const calc = calculateNewBalanceState(s2State, 'GOODS_RECEIPT', gr.qty, gr.qty);
    const mov = makeMovement({
      sourceType: 'GR',
      sourceId: gr.id,
      materialId: matId,
      materialCode: matCode,
      materialName: matName,
      locationId: locT1B,
      locationName: locT1BName,
      movementType: 'GOODS_RECEIPT',
      quantity: gr.qty,
      delta: gr.qty,
      balanceBefore: calc.balanceBefore,
      balanceAfter: calc.balanceAfter,
      createdAt: gr.ts,
      seq: idx + 10,
    });
    s2Movements.push(mov);
    s2State = {
      ...s2State,
      qtyIn: calc.newQtyIn,
      qtyOut: calc.newQtyOut,
      totalAdjustments: calc.newTotalAdjustments,
      availableStock: calc.balanceAfter,
      version: calc.newVersion,
    };
  });

  console.log('\n--- Scenario 2 Ledger ---');
  s2Movements.forEach((m) =>
    console.log(
      `  ${m.sourceDocumentId} -> ${m.movementId} | ${m.movementType} | delta=+${m.delta} | ${m.balanceBefore} -> ${m.balanceAfter}`
    )
  );
  assert(
    s2State.availableStock === 100 && s2State.qtyIn === 45 && s2State.version === 6,
    'Scenario 2 (Repeated Goods Receipt)',
    `Expected=100, Actual=${s2State.availableStock}, qtyIn=${s2State.qtyIn}, version=${s2State.version}`
  );

  // ------------------------------------------------------------------
  // SCENARIO 3: Pending Goods Issue Reservation & Single Deduction on Approval
  // ------------------------------------------------------------------
  const pendingPool: Partial<GoodsIssue>[] = [
    {
      id: 'gi-res-001',
      issueNumber: 'GI-2026-901',
      itemId: matId,
      itemCode: matCode,
      locationId: locT1B,
      requestedQuantity: 70,
      status: 'PENDING_APPROVAL',
    },
  ];
  const pendingQty = getPendingGoodsIssueReservedQty(pendingPool, matId, locT1B, matCode);
  const unreserved = calculateUnreservedAvailableStock(s2State.availableStock, pendingQty);
  const gi002Requested = 50;
  const gi002Blocked = unreserved < gi002Requested;

  // Approve GI-001 (70): status moves to APPROVED, stock deducted ONCE (100 -> 30)
  const calcApproveGi001 = calculateNewBalanceState(s2State, 'GOODS_ISSUE', 70, -70);
  const approveMov = makeMovement({
    sourceType: 'GI',
    sourceId: 'gi-res-001',
    materialId: matId,
    materialCode: matCode,
    materialName: matName,
    locationId: locT1B,
    locationName: locT1BName,
    movementType: 'GOODS_ISSUE',
    quantity: 70,
    delta: -70,
    balanceBefore: calcApproveGi001.balanceBefore,
    balanceAfter: calcApproveGi001.balanceAfter,
    createdAt: '2026-11-12 11:00:00',
    seq: 20,
  });
  pendingPool[0].status = 'APPROVED';
  const postApprovalPendingQty = getPendingGoodsIssueReservedQty(pendingPool, matId, locT1B, matCode);
  const postApprovalUnreserved = calculateUnreservedAvailableStock(
    calcApproveGi001.balanceAfter,
    postApprovalPendingQty
  );

  console.log('\n--- Scenario 3 Ledger & Reservation ---');
  console.log(`  Authoritative=100, Pending GI-001=70, Unreserved=${unreserved}, Requested GI-002=50 -> Blocked=${gi002Blocked}`);
  console.log(
    `  Approve GI-001 -> ${approveMov.movementId} | delta=${approveMov.delta} | ${approveMov.balanceBefore} -> ${approveMov.balanceAfter} | Post-Approval Pending=${postApprovalPendingQty} | Post-Approval Unreserved=${postApprovalUnreserved}`
  );
  assert(
    pendingQty === 70 &&
      unreserved === 30 &&
      gi002Blocked &&
      calcApproveGi001.balanceAfter === 30 &&
      postApprovalPendingQty === 0 &&
      postApprovalUnreserved === 30,
    'Scenario 3 (Pending Goods Issue Reservation & No Double Deduction)',
    `Blocked=${gi002Blocked}, PostApprovalBalance=${calcApproveGi001.balanceAfter}, UnreservedAfterApproval=${postApprovalUnreserved}`
  );

  // ------------------------------------------------------------------
  // SCENARIO 4: Multi-Location Isolation (Terminal 1B vs Terminal 1C)
  // ------------------------------------------------------------------
  const locT1C = 'loc-t1c';
  const locT1CName = 'Gudang Terminal 1C';
  const t1bKey = getCanonicalBalanceId(matId, locT1B);
  const t1cKey = getCanonicalBalanceId(matId, locT1C);
  const t1cState = { openingStock: 60, qtyIn: 0, qtyOut: 0, totalAdjustments: 0, availableStock: 60, version: 1 };
  const t1bPostIssue = calculateNewBalanceState(
    { openingStock: 100, qtyIn: 0, qtyOut: 0, totalAdjustments: 0, availableStock: 100, version: 1 },
    'GOODS_ISSUE',
    25,
    -25
  );
  const t1bMov = makeMovement({
    sourceType: 'GI',
    sourceId: 'gi-iso-001',
    materialId: matId,
    materialCode: matCode,
    materialName: matName,
    locationId: locT1B,
    locationName: locT1BName,
    movementType: 'GOODS_ISSUE',
    quantity: 25,
    delta: -25,
    balanceBefore: t1bPostIssue.balanceBefore,
    balanceAfter: t1bPostIssue.balanceAfter,
    createdAt: '2026-11-12 12:00:00',
    seq: 30,
  });
  const t1cSummary = reconcileBaselineLedger(matId, locT1C, null, [t1bMov], t1cState.availableStock, {
    materialCode: matCode,
  });

  console.log('\n--- Scenario 4 Multi-Location Isolation ---');
  console.log(`  T1B Key=${t1bKey}: 100 -> ${t1bPostIssue.balanceAfter} (mov=${t1bMov.movementId})`);
  console.log(`  T1C Key=${t1cKey}: unchanged=${t1cState.availableStock}, T1C qtyOut=${t1cSummary.qtyOut}`);
  assert(
    t1bKey !== t1cKey &&
      t1bPostIssue.balanceAfter === 75 &&
      t1cState.availableStock === 60 &&
      t1cSummary.qtyOut === 0,
    'Scenario 4 (Multi-Location Isolation T1B vs T1C)',
    `T1B=${t1bPostIssue.balanceAfter}, T1C=${t1cState.availableStock}`
  );

  // ------------------------------------------------------------------
  // SCENARIO 5: Baseline Reconciliation (ADJUSTED opname, active baseline, duplicate /inventory, legacy itemId/materialCode)
  // ------------------------------------------------------------------
  const existingBaseline: InventoryBaseline = {
    id: 'base-mat-a-loc-t3-v1',
    baselineId: 'base-mat-a-loc-t3-v1',
    materialId: 'mat-a',
    materialCode: 'CODE-A',
    materialName: 'Material A',
    locationId: 'loc-t3',
    locationName: 'Gudang Terminal 3',
    baselineQuantity: 40,
    unit: 'Pcs',
    stockOpnameId: 'so-existing-1',
    stockOpnameNumber: 'SO-2026-001',
    sourceMovementId: '',
    countCompletedAt: '2026-10-01 08:00:00',
    countCompletedTimestampMs: parseJakartaTimestampMs('2026-10-01 08:00:00'),
    approvedAt: '2026-10-01 08:10:00',
    approvedBy: 'Admin',
    baselineVersion: 1,
    status: 'ACTIVE',
    createdAt: '2026-10-01 08:10:00',
    createdBy: 'Staff',
  };

  const legacyInventory: InventoryBalance[] = [
    // Case A: Already has active baseline -> must NOT be overwritten
    {
      id: 'bal-mat-a-loc-t3',
      materialId: 'mat-a',
      materialCode: 'CODE-A',
      materialName: 'Material A',
      categoryId: 'cat-1',
      categoryName: 'Cat 1',
      unit: 'Pcs',
      locationId: 'loc-t3',
      locationName: 'Gudang Terminal 3',
      openingStock: 40,
      qtyIn: 0,
      qtyOut: 0,
      availableStock: 40,
      minimumStock: 5,
      reorderPoint: 10,
      lastTransactionDate: '2026-10-01',
    },
    // Case B: Legacy itemId-only + itemCode candidate ready for v1 baseline
    {
      id: 'legacy-bal-b-t1b',
      materialId: '',
      itemId: 'mat-b',
      materialCode: '',
      itemCode: 'CODE-B',
      materialName: 'Material B',
      itemName: 'Material B',
      categoryId: 'cat-1',
      categoryName: 'Cat 1',
      unit: 'Pcs',
      locationId: locT1B,
      locationName: locT1BName,
      openingStock: 0,
      qtyIn: 0,
      qtyOut: 0,
      availableStock: 25,
      minimumStock: 5,
      reorderPoint: 10,
      lastTransactionDate: '2026-10-10',
    },
    // Case C: Duplicate /inventory docs sharing materialCode='CODE-DUP' (one legacy itemId, one canonical materialId)
    {
      id: 'legacy-dup-1',
      materialId: 'OLD-ID-99',
      itemId: 'OLD-ID-99',
      materialCode: 'CODE-DUP',
      itemCode: 'CODE-DUP',
      materialName: 'Material Dup',
      categoryId: 'cat-1',
      categoryName: 'Cat 1',
      unit: 'Pcs',
      locationId: locT1B,
      locationName: locT1BName,
      openingStock: 0,
      qtyIn: 0,
      qtyOut: 0,
      availableStock: 10,
      minimumStock: 2,
      reorderPoint: 5,
      lastTransactionDate: '2026-10-10',
    },
    {
      id: 'bal-mat-dup-loc-t1b',
      materialId: 'mat-dup',
      itemId: 'mat-dup',
      materialCode: 'CODE-DUP',
      itemCode: 'CODE-DUP',
      materialName: 'Material Dup',
      categoryId: 'cat-1',
      categoryName: 'Cat 1',
      unit: 'Pcs',
      locationId: locT1B,
      locationName: locT1BName,
      openingStock: 0,
      qtyIn: 0,
      qtyOut: 0,
      availableStock: 12,
      minimumStock: 2,
      reorderPoint: 5,
      lastTransactionDate: '2026-10-10',
    },
  ];

  const opnames: StockOpname[] = [
    {
      id: 'so-existing-1',
      opnameNumber: 'SO-2026-001',
      opnameDate: '2026-10-01',
      locationId: 'loc-t3',
      locationName: 'Gudang Terminal 3',
      itemId: 'mat-a',
      itemCode: 'CODE-A',
      itemName: 'Material A',
      unit: 'Pcs',
      systemQuantity: 35,
      physicalQuantity: 40,
      variance: 5,
      varianceReason: 'Initial',
      verificationStatus: 'ADJUSTED',
      conductedBy: 'Staff',
      verifiedBy: 'Admin',
      adjustedAt: '2026-10-01 08:10:00',
      countCompletedAt: '2026-10-01 08:00:00',
      notes: '',
      createdAt: '2026-10-01 08:00:00',
    },
    {
      id: 'so-b-1',
      opnameNumber: 'SO-2026-002',
      opnameDate: '2026-10-10',
      locationId: locT1B,
      locationName: locT1BName,
      itemId: 'mat-b',
      itemCode: 'CODE-B',
      itemName: 'Material B',
      unit: 'Pcs',
      systemQuantity: 20,
      physicalQuantity: 25,
      variance: 5,
      varianceReason: 'Found',
      verificationStatus: 'ADJUSTED',
      conductedBy: 'Staff',
      verifiedBy: 'Admin',
      adjustedAt: '2026-10-10 09:00:00',
      countCompletedAt: '2026-10-10 08:50:00',
      notes: '',
      createdAt: '2026-10-10 08:50:00',
    },
    {
      id: 'so-dup-1',
      opnameNumber: 'SO-2026-003',
      opnameDate: '2026-10-10',
      locationId: locT1B,
      locationName: locT1BName,
      itemId: 'mat-dup',
      itemCode: 'CODE-DUP',
      itemName: 'Material Dup',
      unit: 'Pcs',
      systemQuantity: 10,
      physicalQuantity: 12,
      variance: 2,
      varianceReason: 'Dup check',
      verificationStatus: 'ADJUSTED',
      conductedBy: 'Staff',
      verifiedBy: 'Admin',
      adjustedAt: '2026-10-10 10:00:00',
      countCompletedAt: '2026-10-10 09:50:00',
      notes: '',
      createdAt: '2026-10-10 09:50:00',
    },
  ];

  const dupCounts = countDuplicateInventoryBalances(legacyInventory);
  const dryRun = runBaselineMigrationDryRun({
    inventory: legacyInventory,
    stockOpnames: opnames,
    inventoryMovements: [],
    existingBaselines: [existingBaseline],
  });
  const plan = buildControlledBaselineReconciliationPlan({
    inventory: legacyInventory,
    stockOpnames: opnames,
    existingBaselines: [existingBaseline],
    actorName: 'Admin',
  });

  const dupRowA = dryRun.rows.find((r) => r.balanceId === 'legacy-dup-1');
  const dupRowB = dryRun.rows.find((r) => r.balanceId === 'bal-mat-dup-loc-t1b');
  const legacyBRow = dryRun.rows.find((r) => r.balanceId === 'legacy-bal-b-t1b');
  const existingARow = dryRun.rows.find((r) => r.balanceId === 'bal-mat-a-loc-t3');

  console.log('\n--- Scenario 5 Baseline Reconciliation ---');
  console.log(`  Existing Active Baseline Row: hasExisting=${existingARow?.hasExistingActiveBaseline}, canApply=${existingARow?.canApplyReconciliation}`);
  console.log(`  Legacy itemId/itemCode Row: status=${legacyBRow?.auditStatus}, proposed=${legacyBRow?.proposedBaselineQty}, canApply=${legacyBRow?.canApplyReconciliation}`);
  console.log(`  Duplicate Rows (legacy vs canonical): counts=${dupCounts.get('legacy-dup-1')},${dupCounts.get('bal-mat-dup-loc-t1b')}, statuses=${dupRowA?.auditStatus},${dupRowB?.auditStatus}, canApply=${dupRowA?.canApplyReconciliation},${dupRowB?.canApplyReconciliation}`);
  console.log(`  Controlled Plan Created=${plan.items.length} (${plan.items.map((i) => i.balanceId).join(',')}), Skipped=${plan.skipped.length}`);

  assert(
    dupCounts.get('legacy-dup-1') === 2 &&
      dupCounts.get('bal-mat-dup-loc-t1b') === 2 &&
      dupRowA?.auditStatus === 'RECONCILIATION_EXCEPTION' &&
      dupRowB?.auditStatus === 'RECONCILIATION_EXCEPTION' &&
      !dupRowA?.canApplyReconciliation &&
      !dupRowB?.canApplyReconciliation &&
      existingARow?.hasExistingActiveBaseline === true &&
      !existingARow?.canApplyReconciliation &&
      legacyBRow?.auditStatus === 'PASS' &&
      legacyBRow?.proposedBaselineQty === 25 &&
      plan.items.length === 1 &&
      plan.items[0].balanceId === 'legacy-bal-b-t1b' &&
      plan.skipped.length === 3,
    'Scenario 5 (Baseline Reconciliation + Duplicate & Legacy Key Safety)',
    `PlanItems=${plan.items.length}, Skipped=${plan.skipped.length}, DupDetected=${dupCounts.get('legacy-dup-1')}`
  );
}

runFinalValidation();
