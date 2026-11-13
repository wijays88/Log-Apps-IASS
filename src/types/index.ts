export type UserRole = 'LOGISTIK' | 'ADMIN' | 'SITE HEAD';

export type AccountStatus = 'Active' | 'Inactive';

export interface UserAccount {
  id: string;
  employeeId: string;
  fullName: string;
  email: string;
  role: UserRole;
  authorizedLocation: string; // e.g. 'Gudang Utama CGK' or 'Semua Lokasi'
  status: AccountStatus;
  createdDate: string;
  lastLogin: string | null;
  phone?: string;
  department?: string;
}

export type StockStatus = 'Normal' | 'Menipis' | 'Kritis';

export interface MasterCategory {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  itemCount?: number;
}

export interface MasterUnit {
  id: string;
  code: string;
  name: string;
  symbol: string;
  description: string;
  isActive: boolean;
}

export interface MasterLocation {
  id: string;
  locationId?: string; // alias
  code: string;
  locationCode?: string; // alias
  name: string;
  locationName?: string; // alias
  type: string; // 'Terminal' | 'Warehouse' | 'Transit Hub' | 'Toilet Area' | 'Gedung' | 'Workshop' | 'Depot' | 'Other'
  locationType?: string; // alias
  parentLocationId?: string;
  parentLocationName?: string;
  address?: string;
  capacityM2?: number;
  picName?: string;
  personInCharge?: string; // alias
  description?: string;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface MaterialMaster {
  id: string;
  materialId: string;
  materialCode: string;
  itemCode?: string; // backward-compatible alias
  materialName: string;
  name?: string; // backward-compatible alias
  itemName?: string; // backward-compatible alias
  categoryId: string;
  categoryName: string;
  subcategoryId?: string;
  unitId?: string;
  unit: string; // symbol e.g. 'Pcs', 'Roll', 'Box'
  description?: string;
  minimumStock: number;
  reorderPoint: number;
  defaultLocationId?: string;
  defaultLocationName?: string;
  variantAttributes?: string; // e.g. 'Size: L' or 'Ukuran: 60x100'
  variantType?: 'NONE' | 'SIZE' | 'SPECIFICATION';
  variantValue?: string; // 'S', 'M', 'L', 'XL', 'XXL' or '40x50', '60x100', '90x120'
  unitCost?: number;
  unitPrice?: number; // backward-compatible alias
  isActive: boolean;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

// Balance at a specific location & variant
export interface InventoryBalance {
  id: string;
  materialId: string;
  itemId?: string; // alias for materialId
  materialCode: string;
  itemCode?: string; // alias for materialCode
  materialName: string;
  itemName?: string; // alias for materialName
  categoryId: string;
  categoryName: string;
  unit: string;
  locationId: string;
  locationName: string;
  variantValue?: string;
  openingStock: number;
  qtyIn: number;
  qtyOut: number;
  totalAdjustments?: number; // Cumulative net physical adjustments from approved Stock Opname
  availableStock: number; // Authoritative running available stock
  minimumStock: number;
  reorderPoint: number;
  lastTransactionDate: string;
  unitCost?: number;
  version?: number; // Optimistic locking sequence
  lastMovementId?: string;
  lastOpnameDate?: string;
  lastOpnameNumber?: string;
  lastOpnameVariance?: number;
  // Official Physical Baseline Metadata
  baselineQuantity?: number;
  baselineStockOpnameId?: string;
  baselineStockOpnameNumber?: string;
  baselineCutoffAt?: string;
  baselineCutoffTimestampMs?: number;
  baselineApprovedAt?: string;
  baselineApprovedBy?: string;
  baselineStatus?: BaselineStatus;
  hasVerifiedBaseline?: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

// Baseline Status Classification
export type BaselineStatus = 'VERIFIED' | 'UNVERIFIED' | 'REVIEW_REQUIRED' | 'RECONCILIATION_EXCEPTION';

// Dedicated Official Physical Baseline Record
export interface InventoryBaseline {
  id: string; // base-{materialId}-{locationId}-v{version}
  baselineId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  locationId: string;
  locationName: string;
  baselineQuantity: number;
  unit: string;
  stockOpnameId: string;
  stockOpnameNumber: string;
  sourceMovementId: string;
  countStartedAt?: string;
  countCompletedAt: string;
  countCompletedTimestampMs: number;
  cutoffDate?: string;
  approvedAt: string;
  approvedBy: string;
  approvedByEmployeeId?: string;
  baselineVersion: number;
  status: 'ACTIVE' | 'SUPERSEDED';
  createdAt: string;
  createdBy: string;
  supersededAt?: string;
  supersededBy?: string;
  notes?: string;
}

// Backward-compatible alias for existing views
export type InventoryItem = InventoryBalance;

export type MovementType =
  | 'OPENING_BALANCE'
  | 'GOODS_RECEIPT'
  | 'GOODS_ISSUE'
  | 'TRANSFER_DISPATCH'
  | 'TRANSFER_RECEIPT'
  | 'TRANSFER_RETURN'
  | 'TRANSFER_LOSS'
  | 'TRANSFER_DAMAGE'
  | 'STOCK_OPNAME_ADJUSTMENT'
  | 'DAILY_CONSUMPTION'
  | 'ADMIN_CORRECTION';

export interface InventoryMovement {
  id: string; // movementId
  movementId: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  locationId: string;
  locationName: string;
  unit: string;
  variantValue?: string;
  movementType: MovementType;
  quantity: number; // Positive absolute quantity
  delta: number; // Signed delta (+ increases stock, - decreases stock)
  balanceBefore: number;
  balanceAfter: number;
  sourceDocumentId: string;
  sourceDocumentType: string; // 'goodsReceipts' | 'goodsIssues' | 'stockTransfers' | 'stockOpnames' | 'consumptions' | 'admin' | 'opening'
  sourceLineId?: string;
  status: 'POSTED' | 'REVERSED';
  idempotencyKey: string;
  createdAt: string; // Jakarta timestamp string (YYYY-MM-DD HH:mm:ss)
  createdTimestampMs: number; // UTC ms epoch for deterministic sorting
  createdByUid?: string;
  createdByName?: string;
  createdByEmployeeId?: string;
  recordedBy?: string; // alias for createdByName
  recordedByEmployeeId?: string; // alias for createdByEmployeeId
  postingSequence: number;
  referenceNumber?: string; // e.g. 'GR-2026-001', 'GI-2026-801', 'TR-2026-101', 'SO-2026-041'
  approvalReference?: string;
  reversalReference?: string;
  notes?: string;
}

export interface MasterRequestingUnit {
  id: string;
  code: string;
  unitCode?: string; // alias
  name: string;
  unitName?: string; // alias
  division: string;
  contactPerson: string;
  description?: string;
  isActive: boolean;
  status?: 'Active' | 'Inactive';
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface MasterSupplier {
  id: string;
  code: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  isActive?: boolean;
}

export interface GoodsReceipt {
  id: string;
  receiptNumber: string; // GR-2026-XXXX
  receiptDate: string;
  sourceSupplier: string;
  referenceDocument: string; // e.g. PO-8891 / DO-4412
  itemId: string;
  itemCode: string;
  itemName: string;
  variantValue?: string;
  quantity: number;
  unit: string;
  destinationLocationId: string;
  destinationLocationName: string;
  recordedBy: string;
  recordedByEmployeeId: string;
  notes: string;
  status: 'POSTED';
  createdAt: string;
}

export interface GoodsIssue {
  id: string;
  issueNumber: string; // GI-2026-XXXX
  requestDate: string;
  requestingUnit: string;
  requesterUnitId?: string;
  destination: string;
  itemId: string;
  materialId?: string; // legacy/alias compatibility
  itemCode: string;
  itemName: string;
  variantValue?: string;
  requestedQuantity: number;
  approvedQuantity: number;
  unit: string;
  locationId: string;
  locationName: string;
  purpose: string;
  requestedBy: string;
  requestedByEmployeeId: string;
  processedBy: string | null;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  notes: string;
  createdAt: string;
  approvedAt?: string;
}

export type TransferRejectionDisposition =
  | 'RETURNED_TO_ORIGIN'
  | 'DAMAGED_IN_TRANSIT'
  | 'LOST_IN_TRANSIT'
  | 'CANCELLED_BEFORE_DISPATCH';

export const IN_TRANSIT_LOCATION_ID = 'loc-in-transit';
export const IN_TRANSIT_LOCATION_NAME = 'Barang Dalam Perjalanan (In-Transit)';

export interface StockTransfer {
  id: string;
  transferNumber: string; // TR-2026-XXXX
  requestDate: string;
  originLocationId: string;
  originLocationName: string;
  destinationLocationId: string;
  destinationLocationName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  variantValue?: string;
  quantity: number;
  unit: string;
  requestingUser: string;
  requestingUnit?: string;
  requesterUnitId?: string;
  sendingUser: string | null;
  receivingUser: string | null;
  status: 'PENDING' | 'IN_TRANSIT' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  rejectionDisposition?: TransferRejectionDisposition;
  rejectionReason?: string;
  notes: string;
  createdAt: string;
  dispatchedAt?: string;
  receivedAt?: string;
}

export interface StockOpname {
  id: string;
  opnameNumber: string; // SO-2026-XXXX
  opnameDate: string;
  locationId: string;
  locationName: string;
  itemId: string;
  itemCode: string;
  itemName: string;
  variantValue?: string;
  unit: string;
  systemQuantity: number;
  physicalQuantity: number;
  variance: number; // physical - system
  varianceReason: string;
  verificationStatus: 'DRAFT' | 'PENDING_APPROVAL' | 'ADJUSTED' | 'REJECTED';
  conductedBy: string;
  verifiedBy?: string;
  adjustedAt?: string;
  notes: string;
  createdAt: string;
  // Concurrency & snapshot fields for physical count cutoff
  countStartedAt?: string;
  countCompletedAt?: string;
  countCompletedTimestampMs?: number;
  systemBalanceAtCount?: number;
  lastMovementAtCount?: string;
  countVersion?: number;
  adjustedBalance?: number;
  adjustmentDelta?: number;
  interveningMovementsCount?: number;
  adjustmentMovementId?: string;
  isBaselineAnchor?: boolean;
  establishedBaselineId?: string;
}

// Operational Module: Tissue & Plastic Consumption (Pemakaian Harian/Shift)
export interface ConsumptionRecord {
  id: string;
  date: string;
  locationId: string;
  locationName: string;
  areaOrToilet: string; // e.g. 'Toilet Gate 1B', 'Toilet Gate 1C', 'Area Gedung Lt 2'
  shift: 'Shift 1' | 'Shift 2' | 'Shift 3';
  materialId: string;
  materialCode: string;
  materialName: string; // e.g. 'Hand Towel (HT)', 'Jumbo Roll Tissue (JRT)', 'Polybag 60x100'
  variantValue?: string;
  quantityUsed: number;
  unit: string;
  operator: string;
  notes?: string;
  createdAt: string;
}

// Operational Module: Morgan Trolley Management
export interface MorganTrolleyRecord {
  id: string;
  quantity: number;
  locationId: string;
  locationName: string;
  area: string; // e.g. 'Curbside Terminal 1B', 'Baggage Claim 1C'
  placement: string; // e.g. 'Pintu Kedatangan Timur', 'Area Gate 3'
  condition: 'Baik (Good)' | 'Perbaikan Ringan (Minor)' | 'Rusak Berat (Damaged)';
  personInCharge: string;
  lastCheckDate: string;
  notes?: string;
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

// Operational Module: Requests and Receipts (Outstanding Tracker)
export interface SupplyRequestRecord {
  id: string;
  requestNumber: string; // REQ-2026-XXXX
  requestDate: string;
  requestingLocationId: string;
  requestingLocationName: string;
  requestingUnit: string;
  requesterUnitId?: string;
  materialId: string;
  materialCode: string;
  materialName: string;
  variantValue?: string;
  requestedQuantity: number;
  receivedQuantity: number;
  outstandingQuantity: number; // requested - received
  unit: string;
  status:
    | 'OPEN'
    | 'PARTIAL'
    | 'FULFILLED'
    | 'REQUESTED'
    | 'PARTIALLY_RECEIVED'
    | 'RECEIVED'
    | 'CANCELLED';
  requestedBy: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  updatedBy?: string;
  receiptHistory: Array<{
    receiptId?: string;
    date: string;
    quantity: number;
    receivedBy: string;
    refNumber: string;
    movementId?: string;
  }>;
}

export type ApprovalType = 'BARANG_KELUAR' | 'TRANSFER_STOK' | 'STOCK_OPNAME_ADJUSTMENT' | 'OPENING_BALANCE_ADJUSTMENT';

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  referenceId: string;
  referenceNumber: string;
  title: string;
  requestingUser: string;
  requestingEmployeeId: string;
  location: string;
  submissionDate: string;
  details: {
    itemCode: string;
    itemName: string;
    quantity: number;
    unit: string;
    reasonOrPurpose: string;
    origin?: string;
    destination?: string;
    systemQuantity?: number;
    physicalQuantity?: number;
    variance?: number;
    variantValue?: string;
  };
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
  actionBy?: string;
  actionDate?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  employeeId: string;
  userName: string;
  role: UserRole;
  action: string;
  module: string;
  details: string;
  ipAddress: string;
}

export interface SystemSettings {
  companyName: string;
  applicationName: string;
  timezone: string;
  autoApprovalThreshold: number;
  requireAdminOpnameAdjustment: boolean;
  lowStockAlertPercentage: number;
  defaultLocation: string;
  autoGenerateMaterialCode: boolean;
  materialCodePrefix: string;
  materialCodeSequence: number;
}

export interface ExcelImportValidationError {
  rowNumber: number;
  field: string;
  value: any;
  message: string;
}

export interface ExcelImportPreview {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  rowsToInsert: number;
  rowsToUpdate: number;
  errors: ExcelImportValidationError[];
  previewData: any[];
}
