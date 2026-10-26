import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  UserAccount,
  UserRole,
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
  ExcelImportValidationError,
} from '../types';
import {
  INITIAL_USERS,
  INITIAL_CATEGORIES,
  INITIAL_UNITS,
  INITIAL_LOCATIONS,
  INITIAL_MATERIALS,
  INITIAL_INVENTORY,
  INITIAL_CONSUMPTION_RECORDS,
  INITIAL_MORGAN_TROLLEYS,
  INITIAL_SUPPLY_REQUESTS,
  INITIAL_GOODS_RECEIPTS,
  INITIAL_GOODS_ISSUES,
  INITIAL_STOCK_TRANSFERS,
  INITIAL_STOCK_OPNAMES,
  INITIAL_APPROVALS,
  INITIAL_AUDIT_LOGS,
  INITIAL_REQUESTING_UNITS,
  INITIAL_SUPPLIERS,
  INITIAL_SETTINGS,
} from '../data/initialData';
import { ImportModuleType } from '../utils/excelUtils';

export type PermissionAction =
  | 'MANAGE_ACCOUNTS'
  | 'ASSIGN_ROLES'
  | 'MANAGE_MASTER_DATA'
  | 'CREATE_TRANSACTION'
  | 'APPROVE_TRANSACTIONS'
  | 'ADJUST_STOCK'
  | 'EXPORT_REPORTS'
  | 'CHANGE_SETTINGS'
  | 'IMPORT_EXCEL';

interface NotificationToast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
}

interface AppContextType {
  currentUser: UserAccount | null;
  setCurrentUser: (user: UserAccount | null) => void;
  switchRole: (role: UserRole) => void;
  // Core Collections
  users: UserAccount[];
  materials: MaterialMaster[];
  activeMaterials: MaterialMaster[]; // filtered for active dropdowns
  locations: MasterLocation[];
  activeLocations: MasterLocation[]; // filtered for active dropdowns
  categories: MasterCategory[];
  activeCategories: MasterCategory[];
  units: MasterUnit[];
  activeUnits: MasterUnit[];
  inventory: InventoryBalance[];
  items: InventoryBalance[]; // alias for compatibility
  consumptions: ConsumptionRecord[];
  morganTrolleys: MorganTrolleyRecord[];
  supplyRequests: SupplyRequestRecord[];
  goodsReceipts: GoodsReceipt[];
  goodsIssues: GoodsIssue[];
  stockTransfers: StockTransfer[];
  stockOpnames: StockOpname[];
  approvals: ApprovalRequest[];
  auditLogs: AuditLog[];
  requestingUnits: MasterRequestingUnit[];
  suppliers: MasterSupplier[];
  settings: SystemSettings;
  activeNav: string;
  setActiveNav: (nav: string) => void;
  toasts: NotificationToast[];
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
  removeToast: (id: string) => void;
  can: (action: PermissionAction) => { allowed: boolean; reason?: string };

  // Dynamic Material Master Actions
  addMaterial: (material: Omit<MaterialMaster, 'id' | 'materialId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => { success: boolean; message?: string; material?: MaterialMaster };
  updateMaterial: (id: string, updates: Partial<MaterialMaster>) => { success: boolean; message?: string };
  toggleMaterialStatus: (id: string) => boolean;

  // Dynamic Location Master Actions
  addLocation: (location: Omit<MasterLocation, 'id' | 'createdAt' | 'createdBy'>) => { success: boolean; message?: string; location?: MasterLocation };
  updateLocation: (id: string, updates: Partial<MasterLocation>) => { success: boolean; message?: string };
  toggleLocationStatus: (id: string) => boolean;

  // Categories & Units
  saveCategory: (cat: Partial<MasterCategory>) => boolean;
  toggleCategoryStatus: (id: string) => boolean;
  saveUnit: (unit: Partial<MasterUnit>) => boolean;
  toggleUnitStatus: (id: string) => boolean;

  // Operational Inventory Actions
  addGoodsReceipt: (receipt: {
    receiptDate: string;
    sourceSupplier: string;
    referenceDocument: string;
    materialId?: string;
    itemId?: string;
    itemCode?: string;
    itemName?: string;
    quantity: number;
    unit?: string;
    destinationLocationId: string;
    destinationLocationName?: string;
    notes?: string;
  }) => boolean;

  createGoodsIssue: (issue: {
    requestingUnit: string;
    destination: string;
    materialId?: string;
    itemId?: string;
    locationId: string;
    requestedQuantity: number;
    purpose: string;
    notes?: string;
  }) => boolean;

  approveGoodsIssue: (issueId: string, approvedQty: number) => boolean;
  rejectGoodsIssue: (issueId: string, reason: string) => boolean;

  createStockTransfer: (transfer: {
    originLocationId: string;
    destinationLocationId: string;
    materialId?: string;
    itemId?: string;
    quantity: number;
    notes?: string;
  }) => boolean;
  receiveStockTransfer: (transferId: string) => boolean;

  createStockOpname: (opname: {
    locationId: string;
    materialId?: string;
    itemId?: string;
    physicalQuantity: number;
    varianceReason: string;
    notes?: string;
  }) => boolean;
  approveOpnameAdjustment: (opnameId: string) => boolean;
  rejectOpnameAdjustment: (opnameId: string, reason: string) => boolean;

  // Consumption (Tissue, Plastik, Chemical)
  recordConsumption: (record: Omit<ConsumptionRecord, 'id' | 'createdAt'>) => boolean;

  // Morgan Trolley
  saveMorganTrolley: (data: Partial<MorganTrolleyRecord>) => boolean;
  deleteMorganTrolley: (id: string) => boolean;

  // Supply Requests (Outstanding Tracker)
  createSupplyRequest: (data: {
    requestingLocationId: string;
    requestingUnit: string;
    materialId: string;
    requestedQuantity: number;
    notes?: string;
  }) => boolean;
  receiveSupplyRequest: (requestId: string, quantity: number, refNumber: string) => boolean;

  // Excel Bulk Import Engine
  executeExcelImport: (
    moduleType: ImportModuleType,
    records: Record<string, any>[],
    mode: 'INSERT_ONLY' | 'UPDATE_EXISTING' | 'INSERT_OR_UPDATE' | 'HISTORICAL_TRANSACTION' | 'OPENING_BALANCE'
  ) => { successCount: number; errorCount: number; errors: ExcelImportValidationError[] };

  // Account Management
  createUserAccount: (account: Omit<UserAccount, 'id' | 'createdDate' | 'lastLogin'>) => boolean;
  updateUserAccount: (id: string, updates: Partial<UserAccount>) => boolean;
  toggleUserStatus: (id: string) => boolean;
  resetUserPassword: (id: string) => string;

  // Settings & Reset
  updateSettings: (newSettings: Partial<SystemSettings>) => void;
  resetToInitialData: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY_PREFIX = 'pt_ias_control_tower_v3_';

// Automatically clean up obsolete mock data caches from prior versions
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const obsoleteKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('pt_ias_control_tower_v1_') ||
          k.startsWith('pt_ias_control_tower_v2_') ||
          k.startsWith('ias_logistics_'))
      ) {
        obsoleteKeys.push(k);
      }
    }
    obsoleteKeys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignore storage access restrictions
  }
}

function getJakartaTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loadState = <T,>(key: string, defaultVal: T): T => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      return stored ? JSON.parse(stored) : defaultVal;
    } catch {
      return defaultVal;
    }
  };

  const [users, setUsers] = useState<UserAccount[]>(() => loadState('users', INITIAL_USERS));
  const [materials, setMaterials] = useState<MaterialMaster[]>(() => loadState('materials', INITIAL_MATERIALS));
  const [locations, setLocations] = useState<MasterLocation[]>(() => loadState('locations', INITIAL_LOCATIONS));
  const [categories, setCategories] = useState<MasterCategory[]>(() => loadState('categories', INITIAL_CATEGORIES));
  const [units, setUnits] = useState<MasterUnit[]>(() => loadState('units', INITIAL_UNITS));
  const [inventory, setInventory] = useState<InventoryBalance[]>(() => loadState('inventory', INITIAL_INVENTORY));
  const [consumptions, setConsumptions] = useState<ConsumptionRecord[]>(() => loadState('consumptions', INITIAL_CONSUMPTION_RECORDS));
  const [morganTrolleys, setMorganTrolleys] = useState<MorganTrolleyRecord[]>(() => loadState('trolleys', INITIAL_MORGAN_TROLLEYS));
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequestRecord[]>(() => loadState('supply_requests', INITIAL_SUPPLY_REQUESTS));
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>(() => loadState('receipts', INITIAL_GOODS_RECEIPTS));
  const [goodsIssues, setGoodsIssues] = useState<GoodsIssue[]>(() => loadState('issues', INITIAL_GOODS_ISSUES));
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(() => loadState('transfers', INITIAL_STOCK_TRANSFERS));
  const [stockOpnames, setStockOpnames] = useState<StockOpname[]>(() => loadState('opnames', INITIAL_STOCK_OPNAMES));
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(() => loadState('approvals', INITIAL_APPROVALS));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadState('audit_logs', INITIAL_AUDIT_LOGS));
  const [requestingUnits, setRequestingUnits] = useState<MasterRequestingUnit[]>(() => loadState('req_units', INITIAL_REQUESTING_UNITS));
  const [suppliers, setSuppliers] = useState<MasterSupplier[]>(() => loadState('suppliers', INITIAL_SUPPLIERS));
  const [settings, setSettings] = useState<SystemSettings>(() => loadState('settings', INITIAL_SETTINGS));

  const [currentUser, setCurrentUser] = useState<UserAccount | null>(() => {
    const savedUserId = localStorage.getItem(STORAGE_KEY_PREFIX + 'current_user_id');
    const found = users.find((u) => u.id === savedUserId);
    return found || users[0] || null;
  });

  const [activeNav, setActiveNav] = useState<string>('Dashboard');
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  // Derived active dropdown lists (Rule: Inactive materials and locations cannot be selected in new transactions)
  const activeMaterials = useMemo(() => materials.filter((m) => m.isActive), [materials]);
  const activeLocations = useMemo(() => locations.filter((l) => l.isActive), [locations]);
  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  const activeUnits = useMemo(() => units.filter((u) => u.isActive), [units]);

  // Sync to local storage
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'materials', JSON.stringify(materials)); }, [materials]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'locations', JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'units', JSON.stringify(units)); }, [units]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'inventory', JSON.stringify(inventory)); }, [inventory]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'consumptions', JSON.stringify(consumptions)); }, [consumptions]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'trolleys', JSON.stringify(morganTrolleys)); }, [morganTrolleys]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'supply_requests', JSON.stringify(supplyRequests)); }, [supplyRequests]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'receipts', JSON.stringify(goodsReceipts)); }, [goodsReceipts]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'issues', JSON.stringify(goodsIssues)); }, [goodsIssues]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'transfers', JSON.stringify(stockTransfers)); }, [stockTransfers]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'opnames', JSON.stringify(stockOpnames)); }, [stockOpnames]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'approvals', JSON.stringify(approvals)); }, [approvals]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'audit_logs', JSON.stringify(auditLogs)); }, [auditLogs]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'settings', JSON.stringify(settings)); }, [settings]);
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(STORAGE_KEY_PREFIX + 'current_user_id', currentUser.id);
    }
  }, [currentUser]);

  const showToast = (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 5);
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const logAudit = (action: string, module: string, details: string) => {
    if (!currentUser) return;
    const newLog: AuditLog = {
      id: 'audit-' + Date.now(),
      timestamp: getJakartaTimestamp(),
      employeeId: currentUser.employeeId,
      userName: currentUser.fullName,
      role: currentUser.role,
      action,
      module,
      details,
      ipAddress: '192.168.10.' + (Math.floor(Math.random() * 50) + 10),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const can = (action: PermissionAction): { allowed: boolean; reason?: string } => {
    if (!currentUser) return { allowed: false, reason: 'Silakan login terlebih dahulu.' };
    if (currentUser.status !== 'Active') return { allowed: false, reason: 'Akun Anda telah dinonaktifkan.' };

    const role = currentUser.role;

    if (role === 'ADMIN') return { allowed: true };

    if (role === 'SITE HEAD') {
      if (action === 'EXPORT_REPORTS') return { allowed: true };
      return {
        allowed: false,
        reason: 'Peran Site Head bersifat Read-Only untuk monitoring operasional.',
      };
    }

    if (role === 'LOGISTIK') {
      if (action === 'CREATE_TRANSACTION' || action === 'EXPORT_REPORTS') return { allowed: true };
      if (action === 'MANAGE_MASTER_DATA' || action === 'IMPORT_EXCEL') return { allowed: true };
      if (action === 'MANAGE_ACCOUNTS' || action === 'ASSIGN_ROLES') {
        return { allowed: false, reason: 'Hanya Admin yang berwenang mengelola akun personil.' };
      }
      if (action === 'APPROVE_TRANSACTIONS') {
        return { allowed: false, reason: 'Persetujuan transaksi memerlukan wewenang independen Admin.' };
      }
      if (action === 'ADJUST_STOCK') {
        return { allowed: false, reason: 'Penyesuaian saldo memerlukan otorisasi resmi Admin.' };
      }
      if (action === 'CHANGE_SETTINGS') {
        return { allowed: false, reason: 'Hanya Admin yang dapat memodifikasi konfigurasi sistem.' };
      }
    }

    return { allowed: false, reason: 'Izin tidak mencukupi.' };
  };

  const switchRole = (role: UserRole) => {
    const targetUser = users.find((u) => u.role === role && u.status === 'Active');
    if (targetUser) {
      setCurrentUser(targetUser);
      showToast('info', 'Beralih Peran Pengguna', `Sekarang bertindak sebagai ${targetUser.fullName} (${role})`);
      logAudit('ROLE_SWITCH', 'Autentikasi', `Beralih peran aktif ke ${role} (${targetUser.fullName})`);
    } else {
      showToast('error', 'Gagal Beralih Peran', `Tidak ditemukan akun aktif untuk peran ${role}`);
    }
  };

  // ----------------------------------------------------
  // DYNAMIC MATERIAL MASTER
  // ----------------------------------------------------
  const addMaterial = (
    data: Omit<MaterialMaster, 'id' | 'materialId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>
  ) => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return { success: false, message: perm.reason };
    }

    // Check code uniqueness
    let finalCode = data.materialCode?.trim().toUpperCase();
    if (!finalCode) {
      if (settings.autoGenerateMaterialCode) {
        finalCode = `${settings.materialCodePrefix}-${settings.materialCodeSequence + materials.length + 1}`;
      } else {
        showToast('error', 'Validasi Gagal', 'Kode material wajib diisi.');
        return { success: false, message: 'Kode material wajib diisi.' };
      }
    }

    const duplicate = materials.find((m) => m.materialCode.toUpperCase() === finalCode);
    if (duplicate) {
      const msg = `Kode material "${finalCode}" sudah digunakan oleh "${duplicate.materialName}". Kode harus unik.`;
      showToast('error', 'Kode Material Duplikat', msg);
      return { success: false, message: msg };
    }

    const category = categories.find((c) => c.id === data.categoryId);
    const unit = units.find((u) => u.id === data.unitId);
    const location = locations.find((l) => l.id === data.defaultLocationId);

    const now = getJakartaTimestamp();
    const id = 'mat-' + Date.now();

    const newMaterial: MaterialMaster = {
      ...data,
      id,
      materialId: id,
      materialCode: finalCode,
      categoryName: category ? category.name : data.categoryName || 'General',
      unit: unit ? unit.symbol : data.unit || 'Pcs',
      defaultLocationName: location ? location.name : undefined,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: now,
      createdBy: currentUser ? currentUser.employeeId : 'SYSTEM',
      updatedAt: now,
      updatedBy: currentUser ? currentUser.employeeId : 'SYSTEM',
    };

    setMaterials((prev) => [newMaterial, ...prev]);

    // If default location is set, register zero or initial inventory balance if not present
    if (newMaterial.defaultLocationId) {
      setInventory((prev) => {
        const exists = prev.find(
          (inv) => inv.materialId === newMaterial.id && inv.locationId === newMaterial.defaultLocationId
        );
        if (!exists) {
          const newBal: InventoryBalance = {
            id: 'bal-' + Date.now(),
            materialId: newMaterial.id,
            materialCode: newMaterial.materialCode,
            materialName: newMaterial.materialName,
            categoryId: newMaterial.categoryId,
            categoryName: newMaterial.categoryName,
            unit: newMaterial.unit,
            locationId: newMaterial.defaultLocationId!,
            locationName: newMaterial.defaultLocationName || 'Gudang Default',
            variantValue: newMaterial.variantValue,
            openingStock: 0,
            qtyIn: 0,
            qtyOut: 0,
            availableStock: 0,
            minimumStock: newMaterial.minimumStock,
            reorderPoint: newMaterial.reorderPoint,
            lastTransactionDate: now.split(' ')[0],
            unitCost: newMaterial.unitCost,
          };
          return [newBal, ...prev];
        }
        return prev;
      });
    }

    logAudit('MATERIAL_CREATED', 'Master Data', `Menambah material baru: ${newMaterial.materialName} (${newMaterial.materialCode})`);
    showToast('success', 'Material Berhasil Ditambahkan', `Material ${newMaterial.materialName} (${newMaterial.materialCode}) telah aktif di sistem.`);
    return { success: true, material: newMaterial };
  };

  const updateMaterial = (id: string, updates: Partial<MaterialMaster>) => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return { success: false, message: perm.reason };
    }

    // If materialCode is being updated, check uniqueness
    if (updates.materialCode) {
      const codeUpper = updates.materialCode.trim().toUpperCase();
      const duplicate = materials.find((m) => m.id !== id && m.materialCode.toUpperCase() === codeUpper);
      if (duplicate) {
        showToast('error', 'Kode Duplikat', `Kode material "${codeUpper}" sudah digunakan.`);
        return { success: false, message: 'Kode material sudah digunakan.' };
      }
      updates.materialCode = codeUpper;
    }

    const now = getJakartaTimestamp();
    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id === id) {
          return {
            ...m,
            ...updates,
            updatedAt: now,
            updatedBy: currentUser?.employeeId || 'SYSTEM',
          };
        }
        return m;
      })
    );

    // Sync display info into inventory balances
    setInventory((prev) =>
      prev.map((inv) => {
        if (inv.materialId === id) {
          return {
            ...inv,
            materialCode: updates.materialCode || inv.materialCode,
            materialName: updates.materialName || inv.materialName,
            categoryName: updates.categoryName || inv.categoryName,
            unit: updates.unit || inv.unit,
            minimumStock: updates.minimumStock !== undefined ? updates.minimumStock : inv.minimumStock,
            reorderPoint: updates.reorderPoint !== undefined ? updates.reorderPoint : inv.reorderPoint,
            unitCost: updates.unitCost !== undefined ? updates.unitCost : inv.unitCost,
          };
        }
        return inv;
      })
    );

    logAudit('MATERIAL_UPDATED', 'Master Data', `Memperbarui material ID: ${id}`);
    showToast('success', 'Material Diperbarui', 'Data material berhasil disimpan.');
    return { success: true };
  };

  const toggleMaterialStatus = (id: string) => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const target = materials.find((m) => m.id === id);
    if (!target) return false;

    const nextStatus = !target.isActive;
    const now = getJakartaTimestamp();

    setMaterials((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isActive: nextStatus, updatedAt: now, updatedBy: currentUser?.employeeId || 'SYSTEM' } : m))
    );

    logAudit('MATERIAL_STATUS_TOGGLED', 'Master Data', `Material ${target.materialCode} diubah status menjadi ${nextStatus ? 'Aktif' : 'Non-Aktif'}`);
    showToast('info', 'Status Material Diubah', `${target.materialName} sekarang ${nextStatus ? 'Aktif (tersedia di transaksi)' : 'Non-Aktif (hanya arsip)'}.`);
    return true;
  };

  // ----------------------------------------------------
  // DYNAMIC LOCATION MASTER
  // ----------------------------------------------------
  const addLocation = (
    data: Omit<MasterLocation, 'id' | 'createdAt' | 'createdBy'>
  ) => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return { success: false, message: perm.reason };
    }

    const codeUpper = data.code?.trim().toUpperCase();
    if (!codeUpper) {
      showToast('error', 'Validasi Gagal', 'Kode lokasi wajib diisi.');
      return { success: false, message: 'Kode lokasi wajib diisi.' };
    }

    const duplicate = locations.find((l) => l.code.toUpperCase() === codeUpper);
    if (duplicate) {
      showToast('error', 'Kode Lokasi Duplikat', `Kode lokasi "${codeUpper}" sudah digunakan.`);
      return { success: false, message: 'Kode lokasi sudah digunakan.' };
    }

    const now = getJakartaTimestamp();
    const id = 'loc-' + Date.now();
    const parentLoc = locations.find((l) => l.id === data.parentLocationId);

    const newLocation: MasterLocation = {
      ...data,
      id,
      locationId: id,
      code: codeUpper,
      locationCode: codeUpper,
      locationName: data.name,
      parentLocationName: parentLoc ? parentLoc.name : undefined,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: now,
      createdBy: currentUser ? currentUser.employeeId : 'SYSTEM',
      updatedAt: now,
    };

    setLocations((prev) => [...prev, newLocation]);
    logAudit('LOCATION_CREATED', 'Master Data', `Menambah lokasi/gudang baru: ${newLocation.name} (${newLocation.code})`);
    showToast('success', 'Lokasi Berhasil Didaftarkan', `Gudang/Area ${newLocation.name} siap digunakan di seluruh transaksi.`);
    return { success: true, location: newLocation };
  };

  const updateLocation = (id: string, updates: Partial<MasterLocation>) => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return { success: false, message: perm.reason };
    }

    if (updates.code) {
      const codeUpper = updates.code.trim().toUpperCase();
      const duplicate = locations.find((l) => l.id !== id && l.code.toUpperCase() === codeUpper);
      if (duplicate) {
        showToast('error', 'Kode Duplikat', `Kode lokasi "${codeUpper}" sudah digunakan.`);
        return { success: false, message: 'Kode lokasi sudah digunakan.' };
      }
      updates.code = codeUpper;
      updates.locationCode = codeUpper;
    }

    const now = getJakartaTimestamp();
    setLocations((prev) =>
      prev.map((loc) => {
        if (loc.id === id) {
          const parentLoc = updates.parentLocationId ? prev.find((l) => l.id === updates.parentLocationId) : undefined;
          return {
            ...loc,
            ...updates,
            parentLocationName: parentLoc ? parentLoc.name : loc.parentLocationName,
            updatedAt: now,
          };
        }
        return loc;
      })
    );

    // Sync display locationName into inventory balances
    if (updates.name) {
      setInventory((prev) =>
        prev.map((inv) => (inv.locationId === id ? { ...inv, locationName: updates.name! } : inv))
      );
    }

    logAudit('LOCATION_UPDATED', 'Master Data', `Memperbarui lokasi ID: ${id}`);
    showToast('success', 'Lokasi Diperbarui', 'Data lokasi berhasil disimpan.');
    return { success: true };
  };

  const toggleLocationStatus = (id: string) => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const target = locations.find((l) => l.id === id);
    if (!target) return false;

    const nextStatus = !target.isActive;
    const now = getJakartaTimestamp();

    setLocations((prev) =>
      prev.map((l) => (l.id === id ? { ...l, isActive: nextStatus, updatedAt: now } : l))
    );

    logAudit('LOCATION_STATUS_TOGGLED', 'Master Data', `Lokasi ${target.name} diubah status menjadi ${nextStatus ? 'Aktif' : 'Non-Aktif'}`);
    showToast('info', 'Status Lokasi Diubah', `${target.name} sekarang ${nextStatus ? 'Aktif' : 'Non-Aktif'}.`);
    return true;
  };

  // Categories & Units
  const saveCategory = (catData: Partial<MasterCategory>) => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    if (catData.id) {
      setCategories((prev) => prev.map((c) => (c.id === catData.id ? ({ ...c, ...catData } as MasterCategory) : c)));
      showToast('success', 'Kategori Disimpan', `Kategori ${catData.name} diperbarui.`);
    } else {
      const newCat: MasterCategory = {
        id: 'cat-' + Date.now(),
        code: catData.code?.toUpperCase() || 'CAT-' + (categories.length + 1),
        name: catData.name || 'Kategori Baru',
        description: catData.description || '',
        isActive: true,
      };
      setCategories((prev) => [...prev, newCat]);
      showToast('success', 'Kategori Ditambahkan', `Kategori ${newCat.name} berhasil dibuat.`);
    }
    return true;
  };

  const toggleCategoryStatus = (id: string) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c)));
    showToast('info', 'Status Kategori Diubah', 'Status kategori berhasil diperbarui.');
    return true;
  };

  const saveUnit = (unitData: Partial<MasterUnit>) => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    if (unitData.id) {
      setUnits((prev) => prev.map((u) => (u.id === unitData.id ? ({ ...u, ...unitData } as MasterUnit) : u)));
      showToast('success', 'Satuan Disimpan', `Satuan ${unitData.name} diperbarui.`);
    } else {
      const newU: MasterUnit = {
        id: 'unit-' + Date.now(),
        code: unitData.code?.toUpperCase() || unitData.symbol?.toUpperCase() || 'U',
        name: unitData.name || 'Satuan Baru',
        symbol: unitData.symbol || 'U',
        description: unitData.description || '',
        isActive: true,
      };
      setUnits((prev) => [...prev, newU]);
      showToast('success', 'Satuan Ditambahkan', `Satuan ${newU.name} (${newU.symbol}) berhasil dibuat.`);
    }
    return true;
  };

  const toggleUnitStatus = (id: string) => {
    setUnits((prev) => prev.map((u) => (u.id === id ? { ...u, isActive: !u.isActive } : u)));
    showToast('info', 'Status Satuan Diubah', 'Status satuan berhasil diperbarui.');
    return true;
  };

  // ----------------------------------------------------
  // GOODS RECEIPT (IN)
  // ----------------------------------------------------
  const addGoodsReceipt = (data: {
    receiptDate: string;
    sourceSupplier: string;
    referenceDocument: string;
    materialId?: string;
    itemId?: string;
    itemCode?: string;
    itemName?: string;
    quantity: number;
    unit?: string;
    destinationLocationId: string;
    destinationLocationName?: string;
    notes?: string;
  }): boolean => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    if (data.quantity <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas barang masuk harus lebih dari 0.');
      return false;
    }

    const targetMatId = data.materialId || data.itemId;
    const material = materials.find((m) => m.id === targetMatId || (data.itemCode && m.materialCode === data.itemCode));
    if (!material) {
      showToast('error', 'Validasi Gagal', 'Material tidak ditemukan.');
      return false;
    }

    if (!material.isActive) {
      showToast('error', 'Material Non-Aktif', 'Material dalam status non-aktif dan tidak dapat digunakan untuk transaksi baru.');
      return false;
    }

    const location = locations.find((l) => l.id === data.destinationLocationId);
    if (!location || !location.isActive) {
      showToast('error', 'Lokasi Tidak Valid', 'Lokasi tujuan non-aktif atau tidak ditemukan.');
      return false;
    }

    const nextNumber = 'GR-2026-' + (1000 + goodsReceipts.length + 1);
    const now = getJakartaTimestamp();

    const newReceipt: GoodsReceipt = {
      id: 'gr-' + Date.now(),
      receiptNumber: nextNumber,
      receiptDate: data.receiptDate || now.split(' ')[0],
      sourceSupplier: data.sourceSupplier,
      referenceDocument: data.referenceDocument,
      itemId: material.id,
      itemCode: material.materialCode,
      itemName: material.materialName,
      variantValue: material.variantValue,
      quantity: data.quantity,
      unit: material.unit,
      destinationLocationId: location.id,
      destinationLocationName: location.name,
      recordedBy: currentUser!.fullName,
      recordedByEmployeeId: currentUser!.employeeId,
      notes: data.notes || '',
      status: 'POSTED',
      createdAt: now,
    };

    // Update inventory balance atomically (Rule 7: Closing Stock = Opening + In - Out + Adj)
    setInventory((prev) => {
      const existing = prev.find(
        (b) => b.materialId === material.id && b.locationId === location.id
      );

      if (existing) {
        return prev.map((b) => {
          if (b.id === existing.id) {
            const newIn = b.qtyIn + data.quantity;
            return {
              ...b,
              qtyIn: newIn,
              availableStock: b.openingStock + newIn - b.qtyOut,
              lastTransactionDate: data.receiptDate || now.split(' ')[0],
            };
          }
          return b;
        });
      } else {
        const newBalance: InventoryBalance = {
          id: 'bal-' + Date.now(),
          materialId: material.id,
          materialCode: material.materialCode,
          materialName: material.materialName,
          categoryId: material.categoryId,
          categoryName: material.categoryName,
          unit: material.unit,
          locationId: location.id,
          locationName: location.name,
          variantValue: material.variantValue,
          openingStock: 0,
          qtyIn: data.quantity,
          qtyOut: 0,
          availableStock: data.quantity,
          minimumStock: material.minimumStock,
          reorderPoint: material.reorderPoint,
          lastTransactionDate: data.receiptDate || now.split(' ')[0],
          unitCost: material.unitCost,
        };
        return [newBalance, ...prev];
      }
    });

    setGoodsReceipts((prev) => [newReceipt, ...prev]);
    logAudit('GOODS_RECEIPT_POSTED', 'Barang Masuk', `Penerimaan ${data.quantity} ${material.unit} ${material.materialName} (${nextNumber}) dari ${data.sourceSupplier}`);
    showToast('success', 'Barang Masuk Berhasil', `Nomor Transaksi: ${nextNumber}. Stok barang telah ditambahkan.`);
    return true;
  };

  // ----------------------------------------------------
  // GOODS ISSUE (OUT)
  // ----------------------------------------------------
  const createGoodsIssue = (data: {
    requestingUnit: string;
    destination: string;
    materialId?: string;
    itemId?: string;
    locationId: string;
    requestedQuantity: number;
    purpose: string;
    notes?: string;
  }): boolean => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    if (data.requestedQuantity <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas harus lebih dari 0.');
      return false;
    }

    const targetMatId = data.materialId || data.itemId;
    const material = materials.find((m) => m.id === targetMatId);
    if (!material || !material.isActive) {
      showToast('error', 'Material Tidak Valid', 'Material tidak aktif atau tidak ditemukan.');
      return false;
    }

    const balance = inventory.find(
      (b) => b.materialId === material.id && b.locationId === data.locationId
    );
    const available = balance ? balance.availableStock : 0;

    // Rule 1: Stock must never become negative
    if (available < data.requestedQuantity) {
      showToast('error', 'Stok Tidak Mencukupi', `Stok di lokasi hanya ${available} ${material.unit}. Tidak dapat mengeluarkan ${data.requestedQuantity} ${material.unit}.`);
      return false;
    }

    const location = locations.find((l) => l.id === data.locationId);
    const nextNumber = 'GI-2026-' + (800 + goodsIssues.length + 1);
    const now = getJakartaTimestamp();

    const newIssue: GoodsIssue = {
      id: 'gi-' + Date.now(),
      issueNumber: nextNumber,
      requestDate: now.split(' ')[0],
      requestingUnit: data.requestingUnit,
      destination: data.destination,
      itemId: material.id,
      itemCode: material.materialCode,
      itemName: material.materialName,
      variantValue: material.variantValue,
      requestedQuantity: data.requestedQuantity,
      approvedQuantity: 0,
      unit: material.unit,
      locationId: data.locationId,
      locationName: location ? location.name : 'Gudang',
      purpose: data.purpose,
      requestedBy: currentUser!.fullName,
      requestedByEmployeeId: currentUser!.employeeId,
      processedBy: null,
      status: 'PENDING_APPROVAL',
      notes: data.notes || '',
      createdAt: now,
    };

    const newApproval: ApprovalRequest = {
      id: 'app-' + Date.now(),
      type: 'BARANG_KELUAR',
      referenceId: newIssue.id,
      referenceNumber: nextNumber,
      title: `Pengeluaran ${material.materialName} (${data.requestedQuantity} ${material.unit})`,
      requestingUser: currentUser!.fullName,
      requestingEmployeeId: currentUser!.employeeId,
      location: location ? location.name : 'Gudang',
      submissionDate: now,
      details: {
        itemCode: material.materialCode,
        itemName: material.materialName,
        quantity: data.requestedQuantity,
        unit: material.unit,
        reasonOrPurpose: data.purpose,
        destination: data.destination,
      },
      status: 'PENDING',
    };

    setGoodsIssues((prev) => [newIssue, ...prev]);
    setApprovals((prev) => [newApproval, ...prev]);

    logAudit('ISSUE_REQUEST_CREATED', 'Barang Keluar', `Permintaan pengeluaran ${data.requestedQuantity} ${material.unit} ${material.materialName} (${nextNumber}) diteruskan ke Approval Center.`);
    showToast('success', 'Permintaan Terkirim', `Nomor Dokumen: ${nextNumber}. Menunggu otorisasi Administrator.`);
    return true;
  };

  const approveGoodsIssue = (issueId: string, approvedQty: number): boolean => {
    const perm = can('APPROVE_TRANSACTIONS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Admin yang dapat mengotorisasi pengeluaran.');
      return false;
    }

    const issue = goodsIssues.find((i) => i.id === issueId);
    if (!issue) return false;

    const balance = inventory.find(
      (b) => b.materialId === issue.itemId && b.locationId === issue.locationId
    );

    if (!balance || balance.availableStock < approvedQty) {
      showToast('error', 'Stok Kurang', `Saldo persediaan saat ini tidak mencukupi untuk mengeluarkan ${approvedQty} ${issue.unit}.`);
      return false;
    }

    const now = getJakartaTimestamp();

    // Deduct inventory atomically
    setInventory((prev) =>
      prev.map((b) => {
        if (b.materialId === issue.itemId && b.locationId === issue.locationId) {
          const newOut = b.qtyOut + approvedQty;
          return {
            ...b,
            qtyOut: newOut,
            availableStock: b.openingStock + b.qtyIn - newOut,
            lastTransactionDate: now.split(' ')[0],
          };
        }
        return b;
      })
    );

    setGoodsIssues((prev) =>
      prev.map((gi) => (gi.id === issueId ? { ...gi, status: 'APPROVED', approvedQuantity: approvedQty, processedBy: currentUser!.fullName, approvedAt: now } : gi))
    );

    setApprovals((prev) =>
      prev.map((app) => (app.referenceId === issueId && app.type === 'BARANG_KELUAR' ? { ...app, status: 'APPROVED', actionBy: currentUser!.fullName, actionDate: now } : app))
    );

    logAudit('ISSUE_APPROVED', 'Approval Center', `Menyetujui pengeluaran ${approvedQty} ${issue.unit} ${issue.itemName} (${issue.issueNumber})`);
    showToast('success', 'Pengeluaran Disetujui', `Dokumen ${issue.issueNumber} disetujui. Saldo terpotong.`);
    return true;
  };

  const rejectGoodsIssue = (issueId: string, reason: string): boolean => {
    const perm = can('APPROVE_TRANSACTIONS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const now = getJakartaTimestamp();
    setGoodsIssues((prev) =>
      prev.map((gi) => (gi.id === issueId ? { ...gi, status: 'REJECTED', rejectionReason: reason, processedBy: currentUser!.fullName } : gi))
    );

    setApprovals((prev) =>
      prev.map((app) => (app.referenceId === issueId && app.type === 'BARANG_KELUAR' ? { ...app, status: 'REJECTED', rejectionReason: reason, actionBy: currentUser!.fullName, actionDate: now } : app))
    );

    logAudit('ISSUE_REJECTED', 'Approval Center', `Menolak pengeluaran ID: ${issueId}. Alasan: ${reason}`);
    showToast('warning', 'Pengeluaran Ditolak', `Permintaan pengeluaran ditolak.`);
    return true;
  };

  // ----------------------------------------------------
  // STOCK TRANSFER
  // ----------------------------------------------------
  const createStockTransfer = (data: {
    originLocationId: string;
    destinationLocationId: string;
    materialId?: string;
    itemId?: string;
    quantity: number;
    notes?: string;
  }): boolean => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    if (data.originLocationId === data.destinationLocationId) {
      showToast('error', 'Validasi Gagal', 'Lokasi asal dan tujuan tidak boleh sama.');
      return false;
    }

    const targetMatId = data.materialId || data.itemId;
    const material = materials.find((m) => m.id === targetMatId);
    if (!material || !material.isActive) {
      showToast('error', 'Material Tidak Valid', 'Material tidak aktif.');
      return false;
    }

    const originBalance = inventory.find(
      (b) => b.materialId === material.id && b.locationId === data.originLocationId
    );

    if (!originBalance || originBalance.availableStock < data.quantity) {
      showToast('error', 'Stok Asal Tidak Cukup', `Stok di lokasi asal hanya ${originBalance ? originBalance.availableStock : 0} ${material.unit}.`);
      return false;
    }

    const originLoc = locations.find((l) => l.id === data.originLocationId);
    const destLoc = locations.find((l) => l.id === data.destinationLocationId);
    const nextNumber = 'TR-2026-' + (200 + stockTransfers.length + 1);
    const now = getJakartaTimestamp();

    // Deduct stock from origin location (In-Transit)
    setInventory((prev) =>
      prev.map((b) => {
        if (b.materialId === material.id && b.locationId === data.originLocationId) {
          const newOut = b.qtyOut + data.quantity;
          return {
            ...b,
            qtyOut: newOut,
            availableStock: b.openingStock + b.qtyIn - newOut,
            lastTransactionDate: now.split(' ')[0],
          };
        }
        return b;
      })
    );

    const newTransfer: StockTransfer = {
      id: 'tr-' + Date.now(),
      transferNumber: nextNumber,
      requestDate: now.split(' ')[0],
      originLocationId: data.originLocationId,
      originLocationName: originLoc ? originLoc.name : 'Gudang Asal',
      destinationLocationId: data.destinationLocationId,
      destinationLocationName: destLoc ? destLoc.name : 'Gudang Tujuan',
      itemId: material.id,
      itemCode: material.materialCode,
      itemName: material.materialName,
      variantValue: material.variantValue,
      quantity: data.quantity,
      unit: material.unit,
      requestingUser: `${currentUser!.fullName} (${currentUser!.employeeId})`,
      sendingUser: `${currentUser!.fullName} (${currentUser!.employeeId})`,
      receivingUser: null,
      status: 'IN_TRANSIT',
      notes: data.notes || '',
      createdAt: now,
      dispatchedAt: now,
    };

    setStockTransfers((prev) => [newTransfer, ...prev]);
    logAudit('TRANSFER_CREATED', 'Transfer Stok', `Membuat transfer ${data.quantity} ${material.unit} ${material.materialName} (${nextNumber}) dari ${newTransfer.originLocationName} ke ${newTransfer.destinationLocationName}`);
    showToast('success', 'Transfer Diberangkatkan', `Nomor Transfer: ${nextNumber}. Status: In-Transit.`);
    return true;
  };

  const receiveStockTransfer = (transferId: string): boolean => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const transfer = stockTransfers.find((t) => t.id === transferId);
    if (!transfer || transfer.status !== 'IN_TRANSIT') {
      showToast('error', 'Status Tidak Valid', 'Hanya transfer berstatus In-Transit yang dapat diterima.');
      return false;
    }

    const now = getJakartaTimestamp();

    // Increase stock at destination location
    setInventory((prev) => {
      const existing = prev.find(
        (b) => b.materialId === transfer.itemId && b.locationId === transfer.destinationLocationId
      );

      if (existing) {
        return prev.map((b) => {
          if (b.id === existing.id) {
            const newIn = b.qtyIn + transfer.quantity;
            return {
              ...b,
              qtyIn: newIn,
              availableStock: b.openingStock + newIn - b.qtyOut,
              lastTransactionDate: now.split(' ')[0],
            };
          }
          return b;
        });
      } else {
        const material = materials.find((m) => m.id === transfer.itemId);
        const newBal: InventoryBalance = {
          id: 'bal-' + Date.now(),
          materialId: transfer.itemId,
          materialCode: transfer.itemCode,
          materialName: transfer.itemName,
          categoryId: material?.categoryId || 'cat-tissue',
          categoryName: material?.categoryName || 'General',
          unit: transfer.unit,
          locationId: transfer.destinationLocationId,
          locationName: transfer.destinationLocationName,
          variantValue: transfer.variantValue,
          openingStock: 0,
          qtyIn: transfer.quantity,
          qtyOut: 0,
          availableStock: transfer.quantity,
          minimumStock: material?.minimumStock || 10,
          reorderPoint: material?.reorderPoint || 20,
          lastTransactionDate: now.split(' ')[0],
          unitCost: material?.unitCost,
        };
        return [newBal, ...prev];
      }
    });

    setStockTransfers((prev) =>
      prev.map((t) => (t.id === transferId ? { ...t, status: 'COMPLETED', receivingUser: `${currentUser!.fullName} (${currentUser!.employeeId})`, receivedAt: now } : t))
    );

    logAudit('TRANSFER_RECEIVED', 'Transfer Stok', `Konfirmasi terima transfer ${transfer.transferNumber} di ${transfer.destinationLocationName}`);
    showToast('success', 'Transfer Selesai', `Stok barang telah ditambahkan ke ${transfer.destinationLocationName}.`);
    return true;
  };

  // ----------------------------------------------------
  // STOCK OPNAME
  // ----------------------------------------------------
  const createStockOpname = (data: {
    locationId: string;
    materialId?: string;
    itemId?: string;
    physicalQuantity: number;
    varianceReason: string;
    notes?: string;
  }): boolean => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const targetMatId = data.materialId || data.itemId;
    const material = materials.find((m) => m.id === targetMatId);
    if (!material) return false;

    const balance = inventory.find(
      (b) => b.materialId === material.id && b.locationId === data.locationId
    );
    const systemQty = balance ? balance.availableStock : 0;
    const variance = data.physicalQuantity - systemQty;
    const requiresApproval = variance !== 0;

    const nextNumber = 'SO-2026-' + (40 + stockOpnames.length + 1);
    const now = getJakartaTimestamp();

    const newOpname: StockOpname = {
      id: 'so-' + Date.now(),
      opnameNumber: nextNumber,
      opnameDate: now.split(' ')[0],
      locationId: data.locationId,
      locationName: balance ? balance.locationName : 'Gudang',
      itemId: material.id,
      itemCode: material.materialCode,
      itemName: material.materialName,
      variantValue: material.variantValue,
      unit: material.unit,
      systemQuantity: systemQty,
      physicalQuantity: data.physicalQuantity,
      variance,
      varianceReason: data.varianceReason || 'Hasil pemeriksaan fisik',
      verificationStatus: requiresApproval ? 'PENDING_APPROVAL' : 'ADJUSTED',
      conductedBy: `${currentUser!.fullName} (${currentUser!.employeeId})`,
      notes: data.notes || '',
      createdAt: now,
    };

    if (requiresApproval) {
      const newApproval: ApprovalRequest = {
        id: 'app-' + Date.now(),
        type: 'STOCK_OPNAME_ADJUSTMENT',
        referenceId: newOpname.id,
        referenceNumber: nextNumber,
        title: `Penyesuaian Opname ${material.materialName} (${variance > 0 ? '+' : ''}${variance} ${material.unit})`,
        requestingUser: currentUser!.fullName,
        requestingEmployeeId: currentUser!.employeeId,
        location: newOpname.locationName,
        submissionDate: now,
        details: {
          itemCode: material.materialCode,
          itemName: material.materialName,
          quantity: Math.abs(variance),
          unit: material.unit,
          reasonOrPurpose: data.varianceReason,
          systemQuantity: systemQty,
          physicalQuantity: data.physicalQuantity,
          variance,
        },
        status: 'PENDING',
      };
      setApprovals((prev) => [newApproval, ...prev]);
    }

    setStockOpnames((prev) => [newOpname, ...prev]);
    logAudit('OPNAME_RECORDED', 'Stock Opname', `Pencatatan opname ${nextNumber}: Sistem ${systemQty}, Fisik ${data.physicalQuantity}, Selisih ${variance} ${material.unit}.`);
    showToast(
      requiresApproval ? 'warning' : 'success',
      requiresApproval ? 'Opname Ada Selisih' : 'Opname Sesuai',
      requiresApproval ? `Ditemukan selisih ${variance} ${material.unit}. Diteruskan ke Approval Center.` : 'Fisik dan sistem cocok.'
    );
    return true;
  };

  const approveOpnameAdjustment = (opnameId: string): boolean => {
    const perm = can('ADJUST_STOCK');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Admin yang dapat memposting adjustment.');
      return false;
    }

    const opname = stockOpnames.find((o) => o.id === opnameId);
    if (!opname) return false;

    const now = getJakartaTimestamp();

    // Adjust system stock to physical count
    setInventory((prev) =>
      prev.map((b) => {
        if (b.materialId === opname.itemId && b.locationId === opname.locationId) {
          return {
            ...b,
            availableStock: opname.physicalQuantity,
            lastTransactionDate: now.split(' ')[0],
          };
        }
        return b;
      })
    );

    setStockOpnames((prev) =>
      prev.map((o) => (o.id === opnameId ? { ...o, verificationStatus: 'ADJUSTED', verifiedBy: `${currentUser!.fullName} (${currentUser!.employeeId})`, adjustedAt: now } : o))
    );

    setApprovals((prev) =>
      prev.map((app) => (app.referenceId === opnameId && app.type === 'STOCK_OPNAME_ADJUSTMENT' ? { ...app, status: 'APPROVED', actionBy: currentUser!.fullName, actionDate: now } : app))
    );

    logAudit('OPNAME_ADJUSTMENT_POSTED', 'Approval Center', `Menyetujui adjustment opname ${opname.opnameNumber}. Saldo baru: ${opname.physicalQuantity} ${opname.unit}.`);
    showToast('success', 'Penyesuaian Berhasil', `Saldo sistem telah disesuaikan dengan fisik (${opname.physicalQuantity} ${opname.unit}).`);
    return true;
  };

  const rejectOpnameAdjustment = (opnameId: string, reason: string): boolean => {
    const perm = can('ADJUST_STOCK');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const opname = stockOpnames.find((o) => o.id === opnameId);
    if (!opname) return false;

    const now = getJakartaTimestamp();
    setStockOpnames((prev) =>
      prev.map((o) => (o.id === opnameId ? { ...o, verificationStatus: 'REJECTED', notes: (o.notes ? o.notes + ' | ' : '') + `Ditolak Admin: ${reason}` } : o))
    );

    setApprovals((prev) =>
      prev.map((app) => (app.referenceId === opnameId && app.type === 'STOCK_OPNAME_ADJUSTMENT' ? { ...app, status: 'REJECTED', rejectionReason: reason, actionBy: currentUser!.fullName, actionDate: now } : app))
    );

    logAudit('OPNAME_ADJUSTMENT_REJECTED', 'Approval Center', `Menolak adjustment opname ${opname.opnameNumber}. Alasan: ${reason}`);
    showToast('warning', 'Adjustment Ditolak', 'Penolakan adjustment opname tercatat.');
    return true;
  };

  // ----------------------------------------------------
  // CONSUMPTION (TISSUE & PLASTIK PEMAKAIAN HARIAN/SHIFT)
  // ----------------------------------------------------
  const recordConsumption = (recordData: Omit<ConsumptionRecord, 'id' | 'createdAt'>): boolean => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    if (recordData.quantityUsed <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas pemakaian harus lebih dari 0.');
      return false;
    }

    const material = materials.find((m) => m.id === recordData.materialId);
    if (!material || !material.isActive) {
      showToast('error', 'Material Tidak Valid', 'Material tidak aktif.');
      return false;
    }

    const balance = inventory.find(
      (b) => b.materialId === material.id && b.locationId === recordData.locationId
    );
    const available = balance ? balance.availableStock : 0;

    if (available < recordData.quantityUsed) {
      showToast('error', 'Stok Tidak Mencukupi', `Sisa stok di ${recordData.locationName} hanya ${available} ${material.unit}. Tidak dapat mencatat pemakaian ${recordData.quantityUsed} ${material.unit}.`);
      return false;
    }

    const now = getJakartaTimestamp();
    const newRecord: ConsumptionRecord = {
      ...recordData,
      id: 'cons-' + Date.now(),
      createdAt: now,
    };

    // Deduct stock from location balance
    setInventory((prev) =>
      prev.map((b) => {
        if (b.materialId === material.id && b.locationId === recordData.locationId) {
          const newOut = b.qtyOut + recordData.quantityUsed;
          return {
            ...b,
            qtyOut: newOut,
            availableStock: b.openingStock + b.qtyIn - newOut,
            lastTransactionDate: recordData.date,
          };
        }
        return b;
      })
    );

    setConsumptions((prev) => [newRecord, ...prev]);
    logAudit('CONSUMPTION_RECORDED', 'Pemakaian Tissue & Plastik', `Pemakaian ${recordData.quantityUsed} ${material.unit} ${material.materialName} di ${recordData.areaOrToilet} (${recordData.shift})`);
    showToast('success', 'Pemakaian Tercatat', `Pemakaian ${material.materialName} telah dicatat dan stok dipotong.`);
    return true;
  };

  // ----------------------------------------------------
  // MORGAN TROLLEY
  // ----------------------------------------------------
  const saveMorganTrolley = (data: Partial<MorganTrolleyRecord>): boolean => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    if (data.id) {
      setMorganTrolleys((prev) => prev.map((t) => (t.id === data.id ? ({ ...t, ...data } as MorganTrolleyRecord) : t)));
      showToast('success', 'Data Trolley Disimpan', 'Pembaruan troli berhasil disimpan.');
    } else {
      const loc = locations.find((l) => l.id === data.locationId);
      const newT: MorganTrolleyRecord = {
        id: 'mtr-' + Date.now(),
        quantity: Number(data.quantity) || 1,
        locationId: data.locationId || locations[0].id,
        locationName: loc ? loc.name : 'Terminal 1B CGK',
        area: data.area || 'Curbside Area',
        placement: data.placement || 'Pos Janitor',
        condition: data.condition || 'Baik (Good)',
        personInCharge: data.personInCharge || currentUser?.fullName || 'Petugas',
        lastCheckDate: data.lastCheckDate || getJakartaTimestamp().split(' ')[0],
        notes: data.notes || '',
      };
      setMorganTrolleys((prev) => [newT, ...prev]);
      showToast('success', 'Trolley Ditambahkan', 'Data Morgan Trolley berhasil didaftarkan.');
    }
    return true;
  };

  const deleteMorganTrolley = (id: string): boolean => {
    setMorganTrolleys((prev) => prev.filter((t) => t.id !== id));
    showToast('info', 'Data Dihapus', 'Catatan troli telah dihapus.');
    return true;
  };

  // ----------------------------------------------------
  // SUPPLY REQUESTS & RECEIPTS (OUTSTANDING TRACKER)
  // ----------------------------------------------------
  const createSupplyRequest = (data: {
    requestingLocationId: string;
    requestingUnit: string;
    materialId: string;
    requestedQuantity: number;
    notes?: string;
  }): boolean => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const material = materials.find((m) => m.id === data.materialId);
    if (!material) return false;

    const loc = locations.find((l) => l.id === data.requestingLocationId);
    const nextNumber = 'REQ-2026-' + (1000 + supplyRequests.length + 1);
    const now = getJakartaTimestamp();

    const newReq: SupplyRequestRecord = {
      id: 'req-' + Date.now(),
      requestNumber: nextNumber,
      requestDate: now.split(' ')[0],
      requestingLocationId: data.requestingLocationId,
      requestingLocationName: loc ? loc.name : 'Gudang',
      requestingUnit: data.requestingUnit,
      materialId: material.id,
      materialCode: material.materialCode,
      materialName: material.materialName,
      variantValue: material.variantValue,
      requestedQuantity: data.requestedQuantity,
      receivedQuantity: 0,
      outstandingQuantity: data.requestedQuantity, // Outstanding = Requested - Received
      unit: material.unit,
      status: 'OPEN',
      requestedBy: currentUser!.fullName,
      notes: data.notes || '',
      createdAt: now,
      receiptHistory: [],
    };

    setSupplyRequests((prev) => [newReq, ...prev]);
    logAudit('SUPPLY_REQUEST_CREATED', 'Permintaan & Penerimaan', `Permintaan suplai ${nextNumber}: ${data.requestedQuantity} ${material.unit} ${material.materialName}`);
    showToast('success', 'Permintaan Terkirim', `Nomor Permintaan: ${nextNumber}.`);
    return true;
  };

  const receiveSupplyRequest = (requestId: string, quantity: number, refNumber: string): boolean => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const req = supplyRequests.find((r) => r.id === requestId);
    if (!req) return false;

    if (quantity <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas penerimaan harus lebih dari 0.');
      return false;
    }

    const now = getJakartaTimestamp();
    const newTotalReceived = req.receivedQuantity + quantity;
    const newOutstanding = Math.max(0, req.requestedQuantity - newTotalReceived);
    const newStatus = newOutstanding === 0 ? 'FULFILLED' : 'PARTIAL';

    const newHistoryItem = {
      date: now,
      quantity,
      receivedBy: currentUser!.fullName,
      refNumber: refNumber || `REC-${Date.now().toString().slice(-4)}`,
    };

    // Increase stock in requesting location atomically
    setInventory((prev) => {
      const existing = prev.find(
        (b) => b.materialId === req.materialId && b.locationId === req.requestingLocationId
      );

      if (existing) {
        return prev.map((b) => {
          if (b.id === existing.id) {
            const newIn = b.qtyIn + quantity;
            return {
              ...b,
              qtyIn: newIn,
              availableStock: b.openingStock + newIn - b.qtyOut,
              lastTransactionDate: now.split(' ')[0],
            };
          }
          return b;
        });
      } else {
        const material = materials.find((m) => m.id === req.materialId);
        const newBal: InventoryBalance = {
          id: 'bal-' + Date.now(),
          materialId: req.materialId,
          materialCode: req.materialCode,
          materialName: req.materialName,
          categoryId: material?.categoryId || 'cat-tissue',
          categoryName: material?.categoryName || 'General',
          unit: req.unit,
          locationId: req.requestingLocationId,
          locationName: req.requestingLocationName,
          variantValue: req.variantValue,
          openingStock: 0,
          qtyIn: quantity,
          qtyOut: 0,
          availableStock: quantity,
          minimumStock: material?.minimumStock || 10,
          reorderPoint: material?.reorderPoint || 20,
          lastTransactionDate: now.split(' ')[0],
          unitCost: material?.unitCost,
        };
        return [newBal, ...prev];
      }
    });

    setSupplyRequests((prev) =>
      prev.map((r) => {
        if (r.id === requestId) {
          return {
            ...r,
            receivedQuantity: newTotalReceived,
            outstandingQuantity: newOutstanding,
            status: newStatus,
            receiptHistory: [newHistoryItem, ...r.receiptHistory],
          };
        }
        return r;
      })
    );

    logAudit('SUPPLY_RECEIVED', 'Permintaan & Penerimaan', `Penerimaan ${quantity} ${req.unit} ${req.materialName} untuk permintaan ${req.requestNumber}`);
    showToast('success', 'Penerimaan Berhasil', `Diterima ${quantity} ${req.unit}. Sisa outstanding: ${newOutstanding} ${req.unit}.`);
    return true;
  };

  // ----------------------------------------------------
  // BULK EXCEL IMPORT ENGINE
  // ----------------------------------------------------
  const executeExcelImport = (
    moduleType: ImportModuleType,
    rawRows: Record<string, any>[],
    mode: 'INSERT_ONLY' | 'UPDATE_EXISTING' | 'INSERT_OR_UPDATE' | 'HISTORICAL_TRANSACTION' | 'OPENING_BALANCE'
  ): { successCount: number; errorCount: number; errors: ExcelImportValidationError[] } => {
    const perm = can('IMPORT_EXCEL');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return { successCount: 0, errorCount: rawRows.length, errors: [{ rowNumber: 1, field: 'Role', value: currentUser?.role, message: perm.reason || 'Akses ditolak.' }] };
    }

    const errors: ExcelImportValidationError[] = [];
    let successCount = 0;
    const now = getJakartaTimestamp();

    if (moduleType === 'MATERIAL_MASTER') {
      const newMaterials: MaterialMaster[] = [];
      const updatedMaterials: MaterialMaster[] = [...materials];

      rawRows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const code = String(row.materialCode || '').trim().toUpperCase();
        const name = String(row.materialName || '').trim();

        if (!code) {
          errors.push({ rowNumber: rowNum, field: 'materialCode', value: code, message: 'Kode material wajib diisi.' });
          return;
        }
        if (!name) {
          errors.push({ rowNumber: rowNum, field: 'materialName', value: name, message: 'Nama material wajib diisi.' });
          return;
        }

        const existingIdx = updatedMaterials.findIndex((m) => m.materialCode.toUpperCase() === code);

        if (existingIdx >= 0) {
          if (mode === 'INSERT_ONLY') {
            errors.push({ rowNumber: rowNum, field: 'materialCode', value: code, message: `Material ${code} sudah ada. Mode Insert Only menolak duplikat.` });
            return;
          }
          // Update existing
          updatedMaterials[existingIdx] = {
            ...updatedMaterials[existingIdx],
            materialName: name,
            subcategoryId: row.subcategory || row.subcategoryId || updatedMaterials[existingIdx].subcategoryId,
            description: row.description || updatedMaterials[existingIdx].description,
            minimumStock: row.minimumStock ? Number(row.minimumStock) : updatedMaterials[existingIdx].minimumStock,
            reorderPoint: row.reorderPoint ? Number(row.reorderPoint) : updatedMaterials[existingIdx].reorderPoint,
            unitCost: row.unitCost ? Number(row.unitCost) : updatedMaterials[existingIdx].unitCost,
            variantAttributes: row.variantAttributes || updatedMaterials[existingIdx].variantAttributes,
            updatedAt: now,
            updatedBy: currentUser?.employeeId || 'IMPORT',
          };
          successCount++;
        } else {
          if (mode === 'UPDATE_EXISTING') {
            errors.push({ rowNumber: rowNum, field: 'materialCode', value: code, message: `Material ${code} tidak ditemukan untuk diupdate.` });
            return;
          }
          // Resolve category
          const cat = categories.find(
            (c) => c.name.toLowerCase() === String(row.categoryCode || '').toLowerCase() || c.code.toLowerCase() === String(row.categoryCode || '').toLowerCase()
          ) || categories[0];

          // Resolve unit
          const un = units.find(
            (u) => u.symbol.toLowerCase() === String(row.unitSymbol || '').toLowerCase() || u.name.toLowerCase() === String(row.unitSymbol || '').toLowerCase()
          ) || units[0];

          // Resolve default location
          const loc = locations.find(
            (l) => l.code.toLowerCase() === String(row.defaultLocationCode || '').toLowerCase() || l.name.toLowerCase() === String(row.defaultLocationCode || '').toLowerCase()
          );

          const newM: MaterialMaster = {
            id: 'mat-' + Date.now() + '-' + idx,
            materialId: 'mat-' + Date.now() + '-' + idx,
            materialCode: code,
            materialName: name,
            categoryId: cat ? cat.id : 'cat-tissue',
            categoryName: cat ? cat.name : 'Tissue',
            subcategoryId: row.subcategory || row.subcategoryId || undefined,
            unitId: un ? un.id : 'unit-pack',
            unit: un ? un.symbol : 'Pack',
            description: row.description || '',
            minimumStock: row.minimumStock ? Number(row.minimumStock) : 50,
            reorderPoint: row.reorderPoint ? Number(row.reorderPoint) : 100,
            defaultLocationId: loc ? loc.id : undefined,
            defaultLocationName: loc ? loc.name : undefined,
            variantAttributes: row.variantAttributes || undefined,
            unitCost: row.unitCost ? Number(row.unitCost) : 0,
            isActive: true,
            createdAt: now,
            createdBy: currentUser?.employeeId || 'IMPORT',
            updatedAt: now,
            updatedBy: currentUser?.employeeId || 'IMPORT',
          };

          newMaterials.push(newM);
          updatedMaterials.push(newM);
          successCount++;
        }
      });

      setMaterials(updatedMaterials);
    } else if (moduleType === 'LOCATION_MASTER') {
      const updatedLocations = [...locations];

      rawRows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const code = String(row.locationCode || '').trim().toUpperCase();
        const name = String(row.locationName || '').trim();

        if (!code || !name) {
          errors.push({ rowNumber: rowNum, field: 'locationCode', value: code, message: 'Kode dan Nama lokasi wajib diisi.' });
          return;
        }

        const existingIdx = updatedLocations.findIndex((l) => l.code.toUpperCase() === code);
        if (existingIdx >= 0) {
          if (mode === 'INSERT_ONLY') {
            errors.push({ rowNumber: rowNum, field: 'locationCode', value: code, message: `Lokasi ${code} sudah ada.` });
            return;
          }
          updatedLocations[existingIdx] = {
            ...updatedLocations[existingIdx],
            name,
            locationName: name,
            type: row.locationType || updatedLocations[existingIdx].type,
            personInCharge: row.personInCharge || updatedLocations[existingIdx].picName,
            picName: row.personInCharge || updatedLocations[existingIdx].picName,
            address: row.address || updatedLocations[existingIdx].address,
            updatedAt: now,
          };
          successCount++;
        } else {
          if (mode === 'UPDATE_EXISTING') {
            errors.push({ rowNumber: rowNum, field: 'locationCode', value: code, message: `Lokasi ${code} tidak ditemukan.` });
            return;
          }
          const parentLoc = locations.find((l) => l.code.toUpperCase() === String(row.parentLocationCode || '').trim().toUpperCase());
          const newLoc: MasterLocation = {
            id: 'loc-' + Date.now() + '-' + idx,
            locationId: 'loc-' + Date.now() + '-' + idx,
            code,
            locationCode: code,
            name,
            locationName: name,
            type: row.locationType || 'Terminal',
            parentLocationId: parentLoc ? parentLoc.id : null,
            parentLocationName: parentLoc ? parentLoc.name : undefined,
            picName: row.personInCharge || 'Petugas',
            personInCharge: row.personInCharge || 'Petugas',
            capacityM2: row.capacityM2 ? Number(row.capacityM2) : 100,
            address: row.address || '',
            description: row.description || '',
            isActive: true,
            createdAt: now,
            createdBy: currentUser?.employeeId || 'IMPORT',
            updatedAt: now,
          };
          updatedLocations.push(newLoc);
          successCount++;
        }
      });

      setLocations(updatedLocations);
    } else if (moduleType === 'INVENTORY_OPENING') {
      // Opening balance import workflow (Rule 5.2)
      rawRows.forEach((row, idx) => {
        const rowNum = idx + 2;
        const matCode = String(row.materialCode || '').trim().toUpperCase();
        const locCode = String(row.locationCode || '').trim().toUpperCase();
        const openingStock = Number(row.openingStock);

        const material = materials.find((m) => m.materialCode.toUpperCase() === matCode);
        if (!material) {
          errors.push({ rowNumber: rowNum, field: 'materialCode', value: matCode, message: `Material ${matCode} belum terdaftar di Master Material.` });
          return;
        }

        const location = locations.find((l) => l.code.toUpperCase() === locCode);
        if (!location) {
          errors.push({ rowNumber: rowNum, field: 'locationCode', value: locCode, message: `Lokasi ${locCode} belum terdaftar di Master Lokasi.` });
          return;
        }

        if (isNaN(openingStock) || openingStock < 0) {
          errors.push({ rowNumber: rowNum, field: 'openingStock', value: row.openingStock, message: 'Saldo awal harus berupa angka non-negatif.' });
          return;
        }

        setInventory((prev) => {
          const existing = prev.find(
            (b) => b.materialId === material.id && b.locationId === location.id
          );
          if (existing) {
            return prev.map((b) => {
              if (b.id === existing.id) {
                return {
                  ...b,
                  openingStock,
                  availableStock: openingStock + b.qtyIn - b.qtyOut,
                  minimumStock: row.minimumStock ? Number(row.minimumStock) : b.minimumStock,
                  reorderPoint: row.reorderPoint ? Number(row.reorderPoint) : b.reorderPoint,
                  lastTransactionDate: now.split(' ')[0],
                };
              }
              return b;
            });
          } else {
            const newBal: InventoryBalance = {
              id: 'bal-' + Date.now() + '-' + idx,
              materialId: material.id,
              materialCode: material.materialCode,
              materialName: material.materialName,
              categoryId: material.categoryId,
              categoryName: material.categoryName,
              unit: material.unit,
              locationId: location.id,
              locationName: location.name,
              variantValue: row.variantValue || material.variantValue,
              openingStock,
              qtyIn: 0,
              qtyOut: 0,
              availableStock: openingStock,
              minimumStock: row.minimumStock ? Number(row.minimumStock) : material.minimumStock,
              reorderPoint: row.reorderPoint ? Number(row.reorderPoint) : material.reorderPoint,
              lastTransactionDate: now.split(' ')[0],
              unitCost: material.unitCost,
            };
            return [newBal, ...prev];
          }
        });

        successCount++;
      });
    }

    logAudit('EXCEL_IMPORTED', moduleType, `Import Excel selesai: ${successCount} berhasil, ${errors.length} gagal.`);
    if (successCount > 0) {
      showToast('success', 'Import Excel Berhasil', `${successCount} data berhasil diproses ke database.`);
    }
    if (errors.length > 0) {
      showToast('warning', 'Peringatan Validasi Import', `${errors.length} baris ditolak karena kesalahan validasi.`);
    }

    return { successCount, errorCount: errors.length, errors };
  };

  // Account Management
  const createUserAccount = (data: Omit<UserAccount, 'id' | 'createdDate' | 'lastLogin'>): boolean => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    if (users.some((u) => u.employeeId.toLowerCase() === data.employeeId.toLowerCase())) {
      showToast('error', 'Duplikasi Data', `Employee ID "${data.employeeId}" sudah digunakan.`);
      return false;
    }

    if (users.some((u) => u.email.toLowerCase() === data.email.toLowerCase())) {
      showToast('error', 'Duplikasi Data', `Email "${data.email}" sudah terdaftar.`);
      return false;
    }

    const now = getJakartaTimestamp();
    const newUser: UserAccount = {
      ...data,
      id: 'user-' + Date.now(),
      createdDate: now,
      lastLogin: null,
    };

    setUsers((prev) => [...prev, newUser]);
    logAudit('ACCOUNT_CREATED', 'Account Management', `Admin membuat akun baru: ${newUser.fullName} (${newUser.employeeId}), Peran: ${newUser.role}`);
    showToast('success', 'Akun Berhasil Dibuat', `Pengguna ${newUser.fullName} telah terdaftar.`);
    return true;
  };

  const updateUserAccount = (id: string, updates: Partial<UserAccount>): boolean => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
    if (currentUser?.id === id) {
      setCurrentUser((prev) => (prev ? { ...prev, ...updates } : null));
    }

    logAudit('ACCOUNT_UPDATED', 'Account Management', `Memperbarui akun ID: ${id}`);
    showToast('success', 'Akun Diperbarui', 'Data akun pengguna berhasil disimpan.');
    return true;
  };

  const toggleUserStatus = (id: string): boolean => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const target = users.find((u) => u.id === id);
    if (!target) return false;

    if (currentUser?.id === id) {
      showToast('error', 'Operasi Ditolak', 'Anda tidak dapat menonaktifkan akun sendiri.');
      return false;
    }

    const nextStatus = target.status === 'Active' ? 'Inactive' : 'Active';
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)));
    logAudit('ACCOUNT_STATUS_TOGGLED', 'Account Management', `Status akun ${target.fullName} diubah ke ${nextStatus}`);
    showToast('info', 'Status Akun Diubah', `Akun ${target.fullName} sekarang ${nextStatus}.`);
    return true;
  };

  const resetUserPassword = (id: string): string => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return '';
    }

    const target = users.find((u) => u.id === id);
    if (!target) return '';

    const tempPassword = 'IAS-' + Math.random().toString(36).substring(2, 8).toUpperCase() + '!';
    logAudit('PASSWORD_RESET', 'Account Management', `Reset kata sandi untuk akun ${target.fullName} (${target.employeeId})`);
    showToast('success', 'Reset Password Berhasil', `Kredensial sementara telah dibuat untuk ${target.fullName}.`);
    return tempPassword;
  };

  const updateSettings = (newSettings: Partial<SystemSettings>) => {
    const perm = can('CHANGE_SETTINGS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return;
    }
    setSettings((prev) => ({ ...prev, ...newSettings }));
    logAudit('SETTINGS_UPDATED', 'Pengaturan', 'Administrator memperbarui konfigurasi sistem');
    showToast('success', 'Pengaturan Disimpan', 'Konfigurasi sistem berhasil diperbarui.');
  };

  const resetToInitialData = () => {
    localStorage.clear();
    setUsers(INITIAL_USERS);
    setMaterials(INITIAL_MATERIALS);
    setLocations(INITIAL_LOCATIONS);
    setCategories(INITIAL_CATEGORIES);
    setUnits(INITIAL_UNITS);
    setInventory(INITIAL_INVENTORY);
    setConsumptions(INITIAL_CONSUMPTION_RECORDS);
    setMorganTrolleys(INITIAL_MORGAN_TROLLEYS);
    setSupplyRequests(INITIAL_SUPPLY_REQUESTS);
    setGoodsReceipts(INITIAL_GOODS_RECEIPTS);
    setGoodsIssues(INITIAL_GOODS_ISSUES);
    setStockTransfers(INITIAL_STOCK_TRANSFERS);
    setStockOpnames(INITIAL_STOCK_OPNAMES);
    setApprovals(INITIAL_APPROVALS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setRequestingUnits(INITIAL_REQUESTING_UNITS);
    setSuppliers(INITIAL_SUPPLIERS);
    setSettings(INITIAL_SETTINGS);
    setCurrentUser(INITIAL_USERS[0]);
    showToast('info', 'Reset Berhasil', 'Data sistem telah dikembalikan ke kondisi awal PT IAS Support.');
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        switchRole,
        users,
        materials,
        activeMaterials,
        locations,
        activeLocations,
        categories,
        activeCategories,
        units,
        activeUnits,
        inventory,
        items: inventory, // backward compatible
        consumptions,
        morganTrolleys,
        supplyRequests,
        goodsReceipts,
        goodsIssues,
        stockTransfers,
        stockOpnames,
        approvals,
        auditLogs,
        requestingUnits,
        suppliers,
        settings,
        activeNav,
        setActiveNav,
        toasts,
        showToast,
        removeToast,
        can,
        addMaterial,
        updateMaterial,
        toggleMaterialStatus,
        addLocation,
        updateLocation,
        toggleLocationStatus,
        saveCategory,
        toggleCategoryStatus,
        saveUnit,
        toggleUnitStatus,
        addGoodsReceipt,
        createGoodsIssue,
        approveGoodsIssue,
        rejectGoodsIssue,
        createStockTransfer,
        receiveStockTransfer,
        createStockOpname,
        approveOpnameAdjustment,
        rejectOpnameAdjustment,
        recordConsumption,
        saveMorganTrolley,
        deleteMorganTrolley,
        createSupplyRequest,
        receiveSupplyRequest,
        executeExcelImport,
        createUserAccount,
        updateUserAccount,
        toggleUserStatus,
        resetUserPassword,
        updateSettings,
        resetToInitialData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
