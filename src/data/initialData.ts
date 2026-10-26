import {
  UserAccount,
  MaterialMaster,
  InventoryBalance,
  MasterCategory,
  MasterUnit,
  MasterLocation,
  MasterRequestingUnit,
  MasterSupplier,
  GoodsReceipt,
  GoodsIssue,
  StockTransfer,
  StockOpname,
  ConsumptionRecord,
  MorganTrolleyRecord,
  SupplyRequestRecord,
  ApprovalRequest,
  AuditLog,
  SystemSettings,
} from '../types';

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'user-admin-primary',
    employeeId: 'EMP-001',
    fullName: 'Administrator PT IAS Support',
    email: 'admin@pt-iassupport.co.id',
    role: 'ADMIN',
    authorizedLocation: 'Semua Lokasi',
    status: 'Active',
    createdDate: '2026-10-25 00:00:00',
    lastLogin: null,
    phone: '',
    department: 'Logistics Control Tower',
  },
  {
    id: 'user-admin-owner',
    employeeId: 'EMP-002',
    fullName: 'Ihsan Wijaya',
    email: 'wijaya.ihsan@gmail.com',
    role: 'ADMIN',
    authorizedLocation: 'Semua Lokasi',
    status: 'Active',
    createdDate: '2026-10-25 00:00:00',
    lastLogin: null,
    phone: '',
    department: 'Logistics Management',
  },
];

export const INITIAL_CATEGORIES: MasterCategory[] = [
  { id: 'cat-tissue', code: 'TISSUE', name: 'Tissue', description: 'Hand Towel (HT), Jumbo Roll Tissue (JRT), Facial Tissue toilet bandara', isActive: true },
  { id: 'cat-plastic', code: 'PLASTIC', name: 'Plastic', description: 'Kantong plastik sampah hitam, Polybag berbagai ukuran, stretch film', isActive: true },
  { id: 'cat-chemical', code: 'CHEMICAL', name: 'Chemical', description: 'Cairan pembersih lantai, bowl cleaner, glass cleaner, sabun cuci tangan, desinfektan', isActive: true },
  { id: 'cat-equipment', code: 'EQUIPMENT', name: 'Equipment', description: 'Morgan Trolley, janitor mop set, floor squeegee, wet floor sign caution', isActive: true },
  { id: 'cat-uniform', code: 'UNIFORM', name: 'Uniform', description: 'Seragam kerja personil PT IAS Support, safety vest apron, sepatu kerja', isActive: true },
  { id: 'cat-consumable', code: 'CONSUMABLE', name: 'Consumable', description: 'Bahan habis pakai, lap microfiber, spons, sarung tangan karet latex', isActive: true },
  { id: 'cat-spares', code: 'GSE-SP', name: 'Suku Cadang & Fluida', description: 'Komponen mekanik, oli hidrolik, filter armada operasional darat', isActive: true },
];

export const INITIAL_UNITS: MasterUnit[] = [
  { id: 'unit-roll', code: 'ROLL', name: 'Roll', symbol: 'Roll', description: 'Satuan gulungan tissue JRT, stretch film, lakban', isActive: true },
  { id: 'unit-pack', code: 'PACK', name: 'Pack', symbol: 'Pack', description: 'Paket isi kemasan kantong plastik polybag atau tissue HT', isActive: true },
  { id: 'unit-pcs', code: 'PCS', name: 'Pieces', symbol: 'Pcs', description: 'Satuan barang tunggal perlengkapan dan seragam', isActive: true },
  { id: 'unit-box', code: 'BOX', name: 'Box', symbol: 'Box', description: 'Kotak kardus isi kemasan master karton', isActive: true },
  { id: 'unit-bottle', code: 'BOTTLE', name: 'Bottle', symbol: 'Btl', description: 'Botol cairan kimia pembersih 500ml - 1000ml', isActive: true },
  { id: 'unit-liter', code: 'LITER', name: 'Liter', symbol: 'Ltr', description: 'Satuan volume cairan kimia dan pelumas', isActive: true },
  { id: 'unit-kg', code: 'KG', name: 'Kilogram', symbol: 'Kg', description: 'Satuan berat bahan kimia padat atau bubuk', isActive: true },
  { id: 'unit-set', code: 'SET', name: 'Set', symbol: 'Set', description: 'Kelengkapan paket peralatan terpadu', isActive: true },
  { id: 'unit-unit', code: 'UNIT', name: 'Unit', symbol: 'Unit', description: 'Peralatan operasional mandiri seperti Morgan Trolley', isActive: true },
];

// Clean empty operational datasets - dynamic and user-created via Master Data & Excel Import
export const INITIAL_LOCATIONS: MasterLocation[] = [];
export const INITIAL_MATERIALS: MaterialMaster[] = [];
export const INITIAL_INVENTORY: InventoryBalance[] = [];
export const INITIAL_CONSUMPTION_RECORDS: ConsumptionRecord[] = [];
export const INITIAL_MORGAN_TROLLEYS: MorganTrolleyRecord[] = [];
export const INITIAL_SUPPLY_REQUESTS: SupplyRequestRecord[] = [];
export const INITIAL_GOODS_RECEIPTS: GoodsReceipt[] = [];
export const INITIAL_GOODS_ISSUES: GoodsIssue[] = [];
export const INITIAL_STOCK_TRANSFERS: StockTransfer[] = [];
export const INITIAL_STOCK_OPNAMES: StockOpname[] = [];
export const INITIAL_APPROVALS: ApprovalRequest[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];
export const INITIAL_REQUESTING_UNITS: MasterRequestingUnit[] = [];
export const INITIAL_SUPPLIERS: MasterSupplier[] = [];

export const INITIAL_SETTINGS: SystemSettings = {
  companyName: 'PT IAS Support',
  applicationName: 'PT IAS SUPPORT — LOGISTICS CONTROL TOWER',
  timezone: 'Asia/Jakarta (WIB)',
  autoApprovalThreshold: 0,
  requireAdminOpnameAdjustment: true,
  lowStockAlertPercentage: 20,
  defaultLocation: '',
  autoGenerateMaterialCode: true,
  materialCodePrefix: 'MAT-GEN',
  materialCodeSequence: 100,
};
