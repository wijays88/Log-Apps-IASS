import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  query,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, testFirestoreConnection } from '../firebase';
import {
  UserAccount,
  UserRole,
  AccountStatus,
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
  authLoading: boolean;
  firebaseUser: FirebaseUser | null;

  // Firebase Authentication operations
  loginWithEmail: (email: string, pass: string) => Promise<{ success: boolean; message?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; message?: string }>;
  registerWithEmail: (
    email: string,
    pass: string,
    fullName: string,
    employeeId: string,
    location: string
  ) => Promise<{ success: boolean; message?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;

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
  activeRequestingUnits: MasterRequestingUnit[];
  suppliers: MasterSupplier[];
  activeSuppliers: MasterSupplier[];
  settings: SystemSettings;
  activeNav: string;
  setActiveNav: (nav: string) => void;
  toasts: NotificationToast[];
  showToast: (type: 'success' | 'error' | 'warning' | 'info', title: string, message: string) => void;
  removeToast: (id: string) => void;
  can: (action: PermissionAction) => { allowed: boolean; reason?: string };

  syncLoading: boolean;
  syncErrors: Record<string, string>;
  seedDemoData: () => Promise<{ success: boolean; message?: string }>;
  clearLocalCache: () => void;

  // Dynamic Material Master Actions
  addMaterial: (material: Omit<MaterialMaster, 'id' | 'materialId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<{ success: boolean; message?: string; material?: MaterialMaster }>;
  updateMaterial: (id: string, updates: Partial<MaterialMaster>) => Promise<{ success: boolean; message?: string }>;
  toggleMaterialStatus: (id: string) => Promise<boolean>;
  deleteMaterial: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Dynamic Location Master Actions
  addLocation: (location: Omit<MasterLocation, 'id' | 'createdAt' | 'createdBy'>) => Promise<{ success: boolean; message?: string; location?: MasterLocation }>;
  updateLocation: (id: string, updates: Partial<MasterLocation>) => Promise<{ success: boolean; message?: string }>;
  toggleLocationStatus: (id: string) => Promise<boolean>;
  deleteLocation: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Categories & Units
  saveCategory: (cat: Partial<MasterCategory>) => Promise<boolean>;
  toggleCategoryStatus: (id: string) => Promise<boolean>;
  saveUnit: (unit: Partial<MasterUnit>) => Promise<boolean>;
  toggleUnitStatus: (id: string) => Promise<boolean>;

  // Unit Pemohon (Requester Units) Actions
  addRequestingUnit: (data: Omit<MasterRequestingUnit, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>) => Promise<{ success: boolean; message?: string; unit?: MasterRequestingUnit }>;
  updateRequestingUnit: (id: string, updates: Partial<MasterRequestingUnit>) => Promise<{ success: boolean; message?: string }>;
  toggleRequestingUnitStatus: (id: string) => Promise<boolean>;
  deleteRequestingUnit: (id: string) => Promise<{ success: boolean; message?: string }>;

  // Suppliers Actions
  saveSupplier: (sup: Partial<MasterSupplier>) => Promise<boolean>;
  deleteSupplier: (id: string) => Promise<{ success: boolean; message?: string }>;

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
  }) => Promise<boolean>;

  createGoodsIssue: (issue: {
    requestingUnit: string;
    requesterUnitId?: string;
    destination: string;
    materialId?: string;
    itemId?: string;
    locationId: string;
    requestedQuantity: number;
    purpose: string;
    notes?: string;
  }) => Promise<boolean>;

  approveGoodsIssue: (issueId: string, approvedQty: number) => Promise<boolean>;
  rejectGoodsIssue: (issueId: string, reason: string) => Promise<boolean>;

  createStockTransfer: (transfer: {
    originLocationId: string;
    destinationLocationId: string;
    materialId?: string;
    itemId?: string;
    quantity: number;
    requestingUnit?: string;
    requesterUnitId?: string;
    notes?: string;
  }) => Promise<boolean>;
  receiveStockTransfer: (transferId: string) => Promise<boolean>;

  createStockOpname: (opname: {
    locationId: string;
    materialId?: string;
    itemId?: string;
    physicalQuantity: number;
    varianceReason: string;
    notes?: string;
  }) => Promise<boolean>;
  approveOpnameAdjustment: (opnameId: string) => Promise<boolean>;
  rejectOpnameAdjustment: (opnameId: string, reason: string) => Promise<boolean>;

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

/**
 * Recursively sanitizes data payloads for Firestore by omitting any keys with undefined values.
 * This guarantees WriteBatch.set/update never fails with "Unsupported field value: undefined".
 */
export function sanitizeFirestoreDoc<T extends Record<string, any>>(data: T): T {
  const clean: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
        clean[key] = sanitizeFirestoreDoc(val);
      } else {
        clean[key] = val;
      }
    }
  }
  return clean as T;
}

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const loadState = <T,>(key: string, defaultVal: T): T => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PREFIX + key);
      if (!stored) return defaultVal;
      const parsed = JSON.parse(stored);
      // Purge any stale mock/demo artifacts (e.g. Tissue Hand Towel demo IDs)
      if (Array.isArray(parsed) && parsed.some((item: any) => item?.id === 'mat-tissue-ht-01' || item?.id === 'mat-tis-001')) {
        localStorage.removeItem(STORAGE_KEY_PREFIX + key);
        return defaultVal;
      }
      return parsed;
    } catch {
      return defaultVal;
    }
  };

  // Operational collections initialize empty; Cloud Firestore is the single source of truth
  const [users, setUsers] = useState<UserAccount[]>(() => loadState('users', []));
  const [materials, setMaterials] = useState<MaterialMaster[]>(() => loadState('materials', []));
  const [locations, setLocations] = useState<MasterLocation[]>(() => loadState('locations', []));
  const [categories, setCategories] = useState<MasterCategory[]>(() => loadState('categories', []));
  const [units, setUnits] = useState<MasterUnit[]>(() => loadState('units', []));
  const [inventory, setInventory] = useState<InventoryBalance[]>(() => loadState('inventory', []));
  const [consumptions, setConsumptions] = useState<ConsumptionRecord[]>(() => loadState('consumptions', []));
  const [morganTrolleys, setMorganTrolleys] = useState<MorganTrolleyRecord[]>(() => loadState('trolleys', []));
  const [supplyRequests, setSupplyRequests] = useState<SupplyRequestRecord[]>(() => loadState('supply_requests', []));
  const [goodsReceipts, setGoodsReceipts] = useState<GoodsReceipt[]>(() => loadState('receipts', []));
  const [goodsIssues, setGoodsIssues] = useState<GoodsIssue[]>(() => loadState('issues', []));
  const [stockTransfers, setStockTransfers] = useState<StockTransfer[]>(() => loadState('transfers', []));
  const [stockOpnames, setStockOpnames] = useState<StockOpname[]>(() => loadState('opnames', []));
  const [approvals, setApprovals] = useState<ApprovalRequest[]>(() => loadState('approvals', []));
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadState('audit_logs', []));
  const [requestingUnits, setRequestingUnits] = useState<MasterRequestingUnit[]>(() => loadState('req_units', []));
  const [suppliers, setSuppliers] = useState<MasterSupplier[]>(() => loadState('suppliers', []));
  const [settings, setSettings] = useState<SystemSettings>(() => loadState('settings', INITIAL_SETTINGS));

  // Strictly start unauthenticated without falling back to users[0] or default Admin
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [syncLoading, setSyncLoading] = useState<boolean>(true);
  const [syncErrors, setSyncErrors] = useState<Record<string, string>>({});
  const [isSeedingDemo, setIsSeedingDemo] = useState<boolean>(false);

  const [activeNav, setActiveNav] = useState<string>('Dashboard');
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  // Monitor Firebase Authentication state securely
  useEffect(() => {
    testFirestoreConnection();

    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser) {
        try {
          const userDocRef = doc(db, 'users', fbUser.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data() as UserAccount;
            setCurrentUser(data);
            const now = getJakartaTimestamp();
            updateDoc(userDocRef, { lastLogin: now }).catch(() => {});
          } else {
            // Check if user is the authorized bootstrapped admin
            const isOwnerAdmin =
              fbUser.email === 'wijaya.ihsan@gmail.com' ||
              fbUser.email === 'admin@pt-iassupport.co.id';

            const newProfile: UserAccount = {
              id: fbUser.uid,
              employeeId: isOwnerAdmin ? 'EMP-001' : 'EMP-' + fbUser.uid.slice(0, 4).toUpperCase(),
              fullName:
                fbUser.displayName ||
                (isOwnerAdmin ? 'Administrator PT IAS Support' : fbUser.email?.split('@')[0] || 'Personil Logistik'),
              email: fbUser.email || '',
              role: isOwnerAdmin ? 'ADMIN' : 'LOGISTIK',
              authorizedLocation: 'Semua Lokasi Gudang',
              status: 'Active',
              createdDate: getJakartaTimestamp(),
              lastLogin: getJakartaTimestamp(),
            };

            await setDoc(userDocRef, newProfile);
            setCurrentUser(newProfile);
          }
        } catch (err: any) {
          console.error('Error fetching user profile from Firestore:', err);
          const isOwnerAdmin =
            fbUser.email === 'wijaya.ihsan@gmail.com' ||
            fbUser.email === 'admin@pt-iassupport.co.id';
          setCurrentUser({
            id: fbUser.uid,
            employeeId: isOwnerAdmin ? 'EMP-001' : 'EMP-STAFF',
            fullName: fbUser.displayName || fbUser.email || 'Personil Logistik',
            email: fbUser.email || '',
            role: isOwnerAdmin ? 'ADMIN' : 'LOGISTIK',
            authorizedLocation: 'Semua Lokasi Gudang',
            status: 'Active',
            createdDate: getJakartaTimestamp(),
            lastLogin: getJakartaTimestamp(),
          });
        }
      } else {
        setCurrentUser(null);
        localStorage.removeItem(STORAGE_KEY_PREFIX + 'current_user_id');
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Synchronize Firestore collections in real-time as authoritative source when authenticated
  useEffect(() => {
    if (!currentUser) {
      setSyncLoading(false);
      return;
    }

    setSyncLoading(true);

    const bindSync = <T extends { id?: string }>(
      colName: string,
      setter: React.Dispatch<React.SetStateAction<T[]>>,
      onLoaded?: () => void
    ) => {
      const q = collection(db, colName);
      return onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const items = snap.docs.map((d) => {
              const data = d.data();
              return {
                id: d.id,
                ...(colName === 'materials' ? { materialId: d.id, isActive: data.isActive !== false } : {}),
                ...data,
              } as T;
            });
            setter(items);
            try {
              localStorage.setItem(STORAGE_KEY_PREFIX + colName, JSON.stringify(items));
            } catch {}
          } else {
            // Firestore collection is empty: authoritative state is empty array
            setter([]);
            try {
              localStorage.setItem(STORAGE_KEY_PREFIX + colName, JSON.stringify([]));
            } catch {}
          }
          setSyncErrors((prev) => {
            if (!prev[colName]) return prev;
            const copy = { ...prev };
            delete copy[colName];
            return copy;
          });
          onLoaded?.();
        },
        (error) => {
          console.error(`[Firestore Sync: ${colName}]`, error.message);
          setSyncErrors((prev) => ({ ...prev, [colName]: error.message }));
          onLoaded?.();
        }
      );
    };

    let pendingLoads = 17;
    const markLoaded = () => {
      pendingLoads--;
      if (pendingLoads <= 0) {
        setSyncLoading(false);
      }
    };

    const unsubMaterials = bindSync('materials', setMaterials, markLoaded);
    const unsubLocations = bindSync('locations', setLocations, markLoaded);
    const unsubCategories = bindSync('categories', setCategories, markLoaded);
    const unsubUnits = bindSync('units', setUnits, markLoaded);
    const unsubReqUnits = bindSync('requestingUnits', setRequestingUnits, markLoaded);
    const unsubSuppliers = bindSync('suppliers', setSuppliers, markLoaded);
    const unsubInventory = bindSync('inventory', setInventory, markLoaded);
    const unsubReceipts = bindSync('goodsReceipts', setGoodsReceipts, markLoaded);
    const unsubIssues = bindSync('goodsIssues', setGoodsIssues, markLoaded);
    const unsubTransfers = bindSync('stockTransfers', setStockTransfers, markLoaded);
    const unsubOpnames = bindSync('stockOpnames', setStockOpnames, markLoaded);
    const unsubConsumptions = bindSync('consumptions', setConsumptions, markLoaded);
    const unsubTrolleys = bindSync('morganTrolleys', setMorganTrolleys, markLoaded);
    const unsubRequests = bindSync('supplyRequests', setSupplyRequests, markLoaded);
    const unsubApprovals = bindSync('approvals', setApprovals, markLoaded);
    const unsubAudit = bindSync('auditLogs', setAuditLogs, markLoaded);
    const unsubUsers = bindSync('users', setUsers, markLoaded);

    // Sync global system settings
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'global'),
      (docSnap) => {
        if (docSnap.exists()) {
          setSettings(docSnap.data() as SystemSettings);
        }
      },
      (err) => console.warn('Settings sync warning:', err.message)
    );

    return () => {
      unsubMaterials();
      unsubLocations();
      unsubCategories();
      unsubUnits();
      unsubReqUnits();
      unsubSuppliers();
      unsubInventory();
      unsubReceipts();
      unsubIssues();
      unsubTransfers();
      unsubOpnames();
      unsubConsumptions();
      unsubTrolleys();
      unsubRequests();
      unsubApprovals();
      unsubAudit();
      unsubUsers();
      unsubSettings();
    };
  }, [currentUser?.id]);

  // Derived active dropdown lists (Rule: Inactive master entities cannot be selected in new transactions)
  const activeMaterials = useMemo(() => materials.filter((m) => m.isActive), [materials]);
  const activeLocations = useMemo(() => locations.filter((l) => l.isActive), [locations]);
  const activeCategories = useMemo(() => categories.filter((c) => c.isActive), [categories]);
  const activeUnits = useMemo(() => units.filter((u) => u.isActive), [units]);
  const activeRequestingUnits = useMemo(() => requestingUnits.filter((u) => u.isActive !== false), [requestingUnits]);
  const activeSuppliers = useMemo(() => suppliers.filter((s) => s.isActive !== false), [suppliers]);

  // Sync to local storage for offline resilience
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'users', JSON.stringify(users)); }, [users]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'materials', JSON.stringify(materials)); }, [materials]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'locations', JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'units', JSON.stringify(units)); }, [units]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'req_units', JSON.stringify(requestingUnits)); }, [requestingUnits]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'suppliers', JSON.stringify(suppliers)); }, [suppliers]);
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
    } else {
      localStorage.removeItem(STORAGE_KEY_PREFIX + 'current_user_id');
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

  const logAudit = async (action: string, module: string, details: string) => {
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
    try {
      await setDoc(doc(db, 'auditLogs', newLog.id), newLog);
    } catch (err: any) {
      console.warn('[Firestore LogAudit Warning]:', err.message);
    }
  };

  // Firebase Authentication Methods
  const loginWithEmail = async (
    emailOrEmployeeId: string,
    pass: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      let targetEmail = emailOrEmployeeId.trim();

      if (!targetEmail.includes('@')) {
        const foundUser = users.find(
          (u) => u.employeeId.toLowerCase() === targetEmail.toLowerCase()
        );
        if (foundUser?.email) {
          targetEmail = foundUser.email;
        } else {
          return {
            success: false,
            message: `Employee ID "${emailOrEmployeeId}" tidak ditemukan atau belum memiliki email terdaftar.`,
          };
        }
      }

      await signInWithEmailAndPassword(auth, targetEmail, pass);
      showToast('success', 'Autentikasi Berhasil', 'Selamat datang di PT IAS Support — Logistics Control Tower.');
      return { success: true };
    } catch (err: any) {
      console.error('Firebase sign-in error:', err);
      let msg = 'Gagal masuk. Periksa kembali email dan kata sandi Anda.';
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = 'Kredensial tidak valid. Email atau kata sandi tidak cocok.';
      } else if (err.code === 'auth/wrong-password') {
        msg = 'Kata sandi yang Anda masukkan salah.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Format alamat email tidak valid.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Terlalu banyak percobaan gagal. Silakan coba beberapa saat lagi.';
      }
      return { success: false, message: msg };
    }
  };

  const loginWithGoogle = async (): Promise<{ success: boolean; message?: string }> => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      showToast('success', 'Login Google Berhasil', 'Autentikasi SSO berhasil diverifikasi.');
      return { success: true };
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      return {
        success: false,
        message: err.message || 'Gagal masuk dengan akun Google.',
      };
    }
  };

  const registerWithEmail = async (
    email: string,
    pass: string,
    fullName: string,
    employeeId: string,
    location: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
      const isOwnerAdmin =
        email.trim() === 'wijaya.ihsan@gmail.com' ||
        email.trim() === 'admin@pt-iassupport.co.id';

      const newProfile: UserAccount = {
        id: cred.user.uid,
        employeeId: employeeId || 'EMP-' + cred.user.uid.slice(0, 4).toUpperCase(),
        fullName: fullName || email.split('@')[0],
        email: email.trim(),
        role: isOwnerAdmin ? 'ADMIN' : 'LOGISTIK',
        authorizedLocation: location || 'Gudang Utama CGK',
        status: 'Active',
        createdDate: getJakartaTimestamp(),
        lastLogin: getJakartaTimestamp(),
      };

      await setDoc(doc(db, 'users', cred.user.uid), newProfile);
      setCurrentUser(newProfile);
      showToast('success', 'Registrasi Berhasil', `Akun ${newProfile.fullName} berhasil dibuat.`);
      return { success: true };
    } catch (err: any) {
      console.error('Firebase register error:', err);
      let msg = err.message || 'Pendaftaran gagal.';
      if (err.code === 'auth/email-already-in-use') {
        msg = 'Alamat email ini sudah terdaftar dalam sistem.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Kata sandi terlalu lemah. Minimal 6 karakter.';
      }
      return { success: false, message: msg };
    }
  };

  const resetPassword = async (
    email: string
  ): Promise<{ success: boolean; message?: string }> => {
    try {
      await sendPasswordResetEmail(auth, email.trim());
      return { success: true };
    } catch (err: any) {
      console.error('Password reset email error:', err);
      return {
        success: false,
        message: err.message || 'Gagal mengirim email penyetelan ulang sandi.',
      };
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error('Logout error:', err);
    }
    setCurrentUser(null);
    setFirebaseUser(null);
    localStorage.removeItem(STORAGE_KEY_PREFIX + 'current_user_id');
    showToast('info', 'Sesi Berakhir', 'Anda telah keluar dari sistem.');
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
    if (!currentUser) return;
    // Security check: Only an authentic Administrator in Firestore can switch preview roles
    if (currentUser.role !== 'ADMIN') {
      showToast('error', 'Akses Terbatas', 'Hanya Administrator yang memiliki wewenang menguji peran antarmuka.');
      return;
    }
    setCurrentUser((prev) => (prev ? { ...prev, role } : null));
    showToast('info', 'Mode Pengujian Peran', `Antarmuka dialihkan ke tampilan peran: ${role}`);
  };

  // ----------------------------------------------------
  // DYNAMIC MATERIAL MASTER (Cloud Firestore Authoritative)
  // ----------------------------------------------------
  const addMaterial = async (
    data: Omit<MaterialMaster, 'id' | 'materialId' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>
  ): Promise<{ success: boolean; message?: string; material?: MaterialMaster }> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return { success: false, message: perm.reason };
    }

    // 1. Mandatory field validations
    let finalCode = data.materialCode?.trim().toUpperCase();
    if (!finalCode) {
      if (settings.autoGenerateMaterialCode) {
        finalCode = `${settings.materialCodePrefix}-${settings.materialCodeSequence + materials.length + 1}`;
      } else {
        showToast('error', 'Validasi Gagal', 'Kode material wajib diisi.');
        return { success: false, message: 'Kode material wajib diisi.' };
      }
    }

    const finalName = data.materialName?.trim();
    if (!finalName) {
      showToast('error', 'Validasi Gagal', 'Nama material wajib diisi.');
      return { success: false, message: 'Nama material wajib diisi.' };
    }

    if (!data.categoryId) {
      showToast('error', 'Validasi Gagal', 'Kategori material wajib dipilih.');
      return { success: false, message: 'Kategori material wajib dipilih.' };
    }

    if (!data.unitId && !data.unit) {
      showToast('error', 'Validasi Gagal', 'Satuan ukur material wajib dipilih.');
      return { success: false, message: 'Satuan ukur material wajib dipilih.' };
    }

    // 2. Uniqueness checks for materialCode and materialName
    const duplicateCode = materials.find((m) => m.materialCode.toUpperCase() === finalCode);
    if (duplicateCode) {
      const msg = `Kode material "${finalCode}" sudah digunakan oleh "${duplicateCode.materialName}". Kode harus unik.`;
      showToast('error', 'Kode Material Duplikat', msg);
      return { success: false, message: msg };
    }

    const duplicateName = materials.find((m) => m.materialName.trim().toLowerCase() === finalName.toLowerCase());
    if (duplicateName) {
      const msg = `Nama material "${finalName}" sudah terdaftar (${duplicateName.materialCode}). Gunakan nama yang berbeda.`;
      showToast('error', 'Nama Material Duplikat', msg);
      return { success: false, message: msg };
    }

    const category = categories.find((c) => c.id === data.categoryId);
    const unit = units.find((u) => u.id === data.unitId);
    const location = locations.find((l) => l.id === data.defaultLocationId);

    const now = getJakartaTimestamp();
    const cleanCode = finalCode.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const id = 'mat-' + cleanCode;

    const newMaterial: MaterialMaster = {
      ...data,
      id,
      materialId: id,
      materialCode: finalCode,
      materialName: finalName,
      categoryName: category ? category.name : data.categoryName || 'General',
      unit: unit ? unit.symbol : data.unit || 'Pcs',
      defaultLocationName: location ? location.name : undefined,
      isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      createdAt: now,
      createdBy: currentUser ? currentUser.employeeId : 'SYSTEM',
      updatedAt: now,
      updatedBy: currentUser ? currentUser.employeeId : 'SYSTEM',
    };

    try {
      // 3. Atomic commit using Firestore writeBatch to prevent partial writes
      const batch = writeBatch(db);
      const matDocRef = doc(db, 'materials', id);
      batch.set(matDocRef, sanitizeFirestoreDoc(newMaterial));

      // If default location is set, atomically register initial balance in inventory
      if (newMaterial.defaultLocationId) {
        const balId = `bal-${id}-${newMaterial.defaultLocationId}`;
        const newBal: InventoryBalance = {
          id: balId,
          materialId: newMaterial.id,
          materialCode: newMaterial.materialCode,
          materialName: newMaterial.materialName,
          categoryId: newMaterial.categoryId,
          categoryName: newMaterial.categoryName,
          unit: newMaterial.unit,
          locationId: newMaterial.defaultLocationId,
          locationName: newMaterial.defaultLocationName || 'Gudang Default',
          variantValue: newMaterial.variantValue || '',
          openingStock: 0,
          qtyIn: 0,
          qtyOut: 0,
          availableStock: 0,
          minimumStock: newMaterial.minimumStock,
          reorderPoint: newMaterial.reorderPoint,
          lastTransactionDate: now.split(' ')[0],
          unitCost: newMaterial.unitCost,
        };
        const balDocRef = doc(db, 'inventory', balId);
        batch.set(balDocRef, sanitizeFirestoreDoc(newBal), { merge: true });
      }

      await batch.commit();

      await logAudit(
        'MATERIAL_CREATED',
        'Master Data',
        `Menambah material baru di Firestore: ${newMaterial.materialName} (${newMaterial.materialCode})`
      );

      showToast(
        'success',
        'Material Tersimpan di Cloud Firestore',
        `Material ${newMaterial.materialName} (${newMaterial.materialCode}) berhasil disimpan dan langsung tersedia di sistem.`
      );
      return { success: true, material: newMaterial };
    } catch (err: any) {
      console.error('[Firestore Error: addMaterial]', err);
      const errMsg = err.message || 'Gagal menyimpan material ke Cloud Firestore.';
      showToast('error', 'Gagal Menyimpan ke Cloud Firestore', errMsg);
      return { success: false, message: errMsg };
    }
  };

  const updateMaterial = async (
    id: string,
    updates: Partial<MaterialMaster>
  ): Promise<{ success: boolean; message?: string }> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return { success: false, message: perm.reason };
    }

    if (updates.materialCode) {
      const codeUpper = updates.materialCode.trim().toUpperCase();
      const duplicate = materials.find((m) => m.id !== id && m.materialCode.toUpperCase() === codeUpper);
      if (duplicate) {
        showToast('error', 'Kode Duplikat', `Kode material "${codeUpper}" sudah digunakan.`);
        return { success: false, message: 'Kode material sudah digunakan.' };
      }
      updates.materialCode = codeUpper;
    }

    const currentMat = materials.find((m) => m.id === id);
    if (!currentMat) {
      showToast('error', 'Material Tidak Ditemukan', `Material ID ${id} tidak ada.`);
      return { success: false, message: 'Material tidak ditemukan.' };
    }

    const now = getJakartaTimestamp();
    const updatedMaterial: MaterialMaster = {
      ...currentMat,
      ...updates,
      updatedAt: now,
      updatedBy: currentUser?.employeeId || 'SYSTEM',
    };

    try {
      await setDoc(doc(db, 'materials', id), sanitizeFirestoreDoc(updatedMaterial), { merge: true });

      // Sync display info into related inventory balances in Firestore
      const relatedBalances = inventory.filter((inv) => inv.materialId === id);
      for (const bal of relatedBalances) {
        await updateDoc(doc(db, 'inventory', bal.id), {
          materialCode: updatedMaterial.materialCode,
          materialName: updatedMaterial.materialName,
          categoryName: updatedMaterial.categoryName,
          unit: updatedMaterial.unit,
          minimumStock: updatedMaterial.minimumStock,
          reorderPoint: updatedMaterial.reorderPoint,
          unitCost: updatedMaterial.unitCost,
        }).catch(() => {});
      }

      await logAudit('MATERIAL_UPDATED', 'Master Data', `Memperbarui material di Firestore ID: ${id}`);
      showToast('success', 'Material Diperbarui', 'Data material berhasil disimpan ke Cloud Firestore.');
      return { success: true };
    } catch (err: any) {
      console.error('[Firestore Error: updateMaterial]', err);
      const errMsg = err.message || 'Gagal memperbarui material di Cloud Firestore.';
      showToast('error', 'Gagal Memperbarui di Cloud Firestore', errMsg);
      return { success: false, message: errMsg };
    }
  };

  const toggleMaterialStatus = async (id: string): Promise<boolean> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const target = materials.find((m) => m.id === id);
    if (!target) return false;

    const nextStatus = !target.isActive;
    const now = getJakartaTimestamp();

    try {
      await updateDoc(doc(db, 'materials', id), {
        isActive: nextStatus,
        updatedAt: now,
        updatedBy: currentUser?.employeeId || 'SYSTEM',
      });
      await logAudit(
        'MATERIAL_STATUS_TOGGLED',
        'Master Data',
        `Material ${target.materialCode} diubah status menjadi ${nextStatus ? 'Aktif' : 'Non-Aktif'}`
      );
      showToast(
        'info',
        'Status Material Diubah',
        `${target.materialName} sekarang ${nextStatus ? 'Aktif (tersedia di transaksi)' : 'Non-Aktif (hanya arsip)'}.`
      );
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: toggleMaterialStatus]', err);
      showToast('error', 'Gagal Mengubah Status', err.message);
      return false;
    }
  };

  const deleteMaterial = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return { success: false, message: perm.reason };
    }

    const target = materials.find((m) => m.id === id);
    if (!target) {
      return { success: false, message: 'Material tidak ditemukan.' };
    }

    // Check if material is used in transactions or has non-zero stock
    const hasReceipts = goodsReceipts.some((r) => r.itemId === id || r.itemCode === target.materialCode);
    const hasIssues = goodsIssues.some((i) => i.itemId === id || i.itemCode === target.materialCode);
    const hasTransfers = stockTransfers.some((t) => t.itemId === id || t.itemCode === target.materialCode);
    const hasActiveStock = inventory.some((b) => b.materialId === id && b.availableStock > 0);

    if (hasReceipts || hasIssues || hasTransfers || hasActiveStock) {
      const msg = `Material "${target.materialName}" tidak dapat dihapus karena sudah memiliki riwayat transaksi atau saldo stok aktif. Anda dapat menonaktifkan statusnya agar tidak muncul di transaksi baru.`;
      showToast('warning', 'Hapus Ditolak', msg);
      return { success: false, message: msg };
    }

    try {
      await deleteDoc(doc(db, 'materials', id));

      // Clean up any zero balances in inventory for this material
      const zeroBalances = inventory.filter((b) => b.materialId === id);
      for (const b of zeroBalances) {
        await deleteDoc(doc(db, 'inventory', b.id)).catch(() => {});
      }

      await logAudit(
        'MATERIAL_DELETED',
        'Master Data',
        `Menghapus material dari Firestore: ${target.materialName} (${target.materialCode})`
      );
      showToast('success', 'Material Dihapus', `Material ${target.materialName} telah dihapus dari Cloud Firestore.`);
      return { success: true };
    } catch (err: any) {
      console.error('[Firestore Error: deleteMaterial]', err);
      const errMsg = err.message || 'Gagal menghapus material dari Cloud Firestore.';
      showToast('error', 'Gagal Menghapus Material', errMsg);
      return { success: false, message: errMsg };
    }
  };

  // ----------------------------------------------------
  // DYNAMIC LOCATION MASTER (Cloud Firestore Authoritative)
  // ----------------------------------------------------
  const addLocation = async (
    data: Omit<MasterLocation, 'id' | 'createdAt' | 'createdBy'>
  ): Promise<{ success: boolean; message?: string; location?: MasterLocation }> => {
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
    const id = 'loc-' + codeUpper.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
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

    try {
      await setDoc(doc(db, 'locations', id), newLocation);
      await logAudit(
        'LOCATION_CREATED',
        'Master Data',
        `Menambah lokasi/gudang baru di Firestore: ${newLocation.name} (${newLocation.code})`
      );
      showToast('success', 'Lokasi Berhasil Didaftarkan', `Gudang/Area ${newLocation.name} siap digunakan di seluruh transaksi.`);
      return { success: true, location: newLocation };
    } catch (err: any) {
      console.error('[Firestore Error: addLocation]', err);
      const errMsg = err.message || 'Gagal menyimpan lokasi ke Cloud Firestore.';
      showToast('error', 'Gagal Menyimpan Lokasi', errMsg);
      return { success: false, message: errMsg };
    }
  };

  const updateLocation = async (
    id: string,
    updates: Partial<MasterLocation>
  ): Promise<{ success: boolean; message?: string }> => {
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

    const currentLoc = locations.find((l) => l.id === id);
    if (!currentLoc) {
      showToast('error', 'Lokasi Tidak Ditemukan', `Lokasi ID ${id} tidak ada.`);
      return { success: false, message: 'Lokasi tidak ditemukan.' };
    }

    const now = getJakartaTimestamp();
    const parentLoc = updates.parentLocationId ? locations.find((l) => l.id === updates.parentLocationId) : undefined;
    const updatedLocation: MasterLocation = {
      ...currentLoc,
      ...updates,
      parentLocationName: parentLoc ? parentLoc.name : currentLoc.parentLocationName,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'locations', id), updatedLocation, { merge: true });

      // Sync display locationName into inventory balances
      if (updates.name) {
        const relatedBalances = inventory.filter((inv) => inv.locationId === id);
        for (const bal of relatedBalances) {
          await updateDoc(doc(db, 'inventory', bal.id), { locationName: updates.name! }).catch(() => {});
        }
      }

      await logAudit('LOCATION_UPDATED', 'Master Data', `Memperbarui lokasi di Firestore ID: ${id}`);
      showToast('success', 'Lokasi Diperbarui', 'Data lokasi berhasil disimpan ke Cloud Firestore.');
      return { success: true };
    } catch (err: any) {
      console.error('[Firestore Error: updateLocation]', err);
      const errMsg = err.message || 'Gagal memperbarui lokasi di Cloud Firestore.';
      showToast('error', 'Gagal Memperbarui Lokasi', errMsg);
      return { success: false, message: errMsg };
    }
  };

  const toggleLocationStatus = async (id: string): Promise<boolean> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const target = locations.find((l) => l.id === id);
    if (!target) return false;

    const nextStatus = !target.isActive;
    const now = getJakartaTimestamp();

    try {
      await updateDoc(doc(db, 'locations', id), {
        isActive: nextStatus,
        updatedAt: now,
      });
      await logAudit(
        'LOCATION_STATUS_TOGGLED',
        'Master Data',
        `Lokasi ${target.name} diubah status menjadi ${nextStatus ? 'Aktif' : 'Non-Aktif'}`
      );
      showToast('info', 'Status Lokasi Diubah', `${target.name} sekarang ${nextStatus ? 'Aktif' : 'Non-Aktif'}.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: toggleLocationStatus]', err);
      showToast('error', 'Gagal Mengubah Status Lokasi', err.message);
      return false;
    }
  };

  const deleteLocation = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return { success: false, message: perm.reason };
    }

    const target = locations.find((l) => l.id === id);
    if (!target) {
      return { success: false, message: 'Lokasi tidak ditemukan.' };
    }

    const hasActiveStock = inventory.some((b) => b.locationId === id && b.availableStock > 0);
    const hasReceipts = goodsReceipts.some((r) => r.destinationLocationId === id);
    const hasIssues = goodsIssues.some((i) => i.locationId === id);

    if (hasActiveStock || hasReceipts || hasIssues) {
      const msg = `Lokasi "${target.name}" tidak dapat dihapus karena memiliki saldo stok aktif atau riwayat transaksi. Silakan gunakan fitur Non-aktifkan Status.`;
      showToast('warning', 'Hapus Ditolak', msg);
      return { success: false, message: msg };
    }

    try {
      await deleteDoc(doc(db, 'locations', id));
      await logAudit('LOCATION_DELETED', 'Master Data', `Menghapus lokasi dari Firestore: ${target.name} (${target.code})`);
      showToast('success', 'Lokasi Dihapus', `Lokasi ${target.name} telah dihapus dari Cloud Firestore.`);
      return { success: true };
    } catch (err: any) {
      console.error('[Firestore Error: deleteLocation]', err);
      const errMsg = err.message || 'Gagal menghapus lokasi dari Cloud Firestore.';
      showToast('error', 'Gagal Menghapus Lokasi', errMsg);
      return { success: false, message: errMsg };
    }
  };

  // Categories & Units (Cloud Firestore Authoritative)
  const saveCategory = async (catData: Partial<MasterCategory>): Promise<boolean> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    try {
      if (catData.id) {
        await updateDoc(doc(db, 'categories', catData.id), catData);
        showToast('success', 'Kategori Disimpan', `Kategori ${catData.name} diperbarui di Cloud Firestore.`);
      } else {
        const id = 'cat-' + (catData.code?.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || Date.now());
        const newCat: MasterCategory = {
          id,
          code: catData.code?.toUpperCase() || 'CAT-' + (categories.length + 1),
          name: catData.name || 'Kategori Baru',
          description: catData.description || '',
          isActive: true,
        };
        await setDoc(doc(db, 'categories', id), newCat);
        showToast('success', 'Kategori Ditambahkan', `Kategori ${newCat.name} berhasil dibuat di Cloud Firestore.`);
      }
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: saveCategory]', err);
      showToast('error', 'Gagal Menyimpan Kategori', err.message);
      return false;
    }
  };

  const toggleCategoryStatus = async (id: string): Promise<boolean> => {
    const target = categories.find((c) => c.id === id);
    if (!target) return false;
    try {
      await updateDoc(doc(db, 'categories', id), { isActive: !target.isActive });
      showToast('info', 'Status Kategori Diubah', 'Status kategori berhasil diperbarui.');
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: toggleCategoryStatus]', err);
      showToast('error', 'Gagal Mengubah Status Kategori', err.message);
      return false;
    }
  };

  const saveUnit = async (unitData: Partial<MasterUnit>): Promise<boolean> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    try {
      if (unitData.id) {
        await updateDoc(doc(db, 'units', unitData.id), unitData);
        showToast('success', 'Satuan Disimpan', `Satuan ${unitData.name} diperbarui di Cloud Firestore.`);
      } else {
        const id = 'unit-' + (unitData.code?.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || Date.now());
        const newU: MasterUnit = {
          id,
          code: unitData.code?.toUpperCase() || unitData.symbol?.toUpperCase() || 'U',
          name: unitData.name || 'Satuan Baru',
          symbol: unitData.symbol || 'U',
          description: unitData.description || '',
          isActive: true,
        };
        await setDoc(doc(db, 'units', id), newU);
        showToast('success', 'Satuan Ditambahkan', `Satuan ${newU.name} (${newU.symbol}) berhasil dibuat di Cloud Firestore.`);
      }
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: saveUnit]', err);
      showToast('error', 'Gagal Menyimpan Satuan', err.message);
      return false;
    }
  };

  const toggleUnitStatus = async (id: string): Promise<boolean> => {
    const target = units.find((u) => u.id === id);
    if (!target) return false;
    try {
      await updateDoc(doc(db, 'units', id), { isActive: !target.isActive });
      showToast('info', 'Status Satuan Diubah', 'Status satuan berhasil diperbarui.');
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: toggleUnitStatus]', err);
      showToast('error', 'Gagal Mengubah Status Satuan', err.message);
      return false;
    }
  };

  // ----------------------------------------------------
  // UNIT PEMOHON (REQUESTER UNITS) (Cloud Firestore Authoritative)
  // ----------------------------------------------------
  const addRequestingUnit = async (
    data: Omit<MasterRequestingUnit, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'>
  ): Promise<{ success: boolean; message?: string; unit?: MasterRequestingUnit }> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return { success: false, message: perm.reason || 'Akses ditolak.' };
    }

    const trimmedCode = (data.code || data.unitCode || '').trim().toUpperCase();
    const trimmedName = (data.name || data.unitName || '').trim();

    if (!trimmedCode) {
      return { success: false, message: 'Kode Unit Pemohon wajib diisi.' };
    }
    if (!trimmedName) {
      return { success: false, message: 'Nama Unit Pemohon wajib diisi.' };
    }

    // Duplicate check for code (case-insensitive)
    const duplicateCode = requestingUnits.some(
      (u) => (u.code?.toUpperCase() === trimmedCode || u.unitCode?.toUpperCase() === trimmedCode)
    );
    if (duplicateCode) {
      return {
        success: false,
        message: `Kode Unit Pemohon "${trimmedCode}" sudah terdaftar. Gunakan kode lain.`,
      };
    }

    // Duplicate check for name (case-insensitive)
    const duplicateName = requestingUnits.some(
      (u) => (u.name?.toLowerCase() === trimmedName.toLowerCase() || u.unitName?.toLowerCase() === trimmedName.toLowerCase())
    );
    if (duplicateName) {
      return {
        success: false,
        message: `Nama Unit Pemohon "${trimmedName}" sudah terdaftar. Gunakan nama yang berbeda.`,
      };
    }

    const cleanCode = trimmedCode.replace(/[^A-Z0-9_-]/g, '');
    const id = `UP-${cleanCode || Date.now()}`;
    const now = getJakartaTimestamp();
    const userLabel = currentUser ? `${currentUser.fullName} (${currentUser.employeeId})` : 'System';

    const newUnit: MasterRequestingUnit = {
      id,
      code: trimmedCode,
      unitCode: trimmedCode,
      name: trimmedName,
      unitName: trimmedName,
      division: (data.division || 'Umum').trim(),
      contactPerson: (data.contactPerson || '-').trim(),
      description: (data.description || '').trim(),
      isActive: data.isActive !== false,
      status: data.isActive !== false ? 'Active' : 'Inactive',
      createdAt: now,
      createdBy: userLabel,
      updatedAt: now,
      updatedBy: userLabel,
    };

    try {
      await setDoc(doc(db, 'requestingUnits', id), newUnit);
      await logAudit('REQUESTING_UNIT_CREATED', 'Master Data', `Mendaftarkan Unit Pemohon baru: ${trimmedName} (${trimmedCode})`);
      showToast('success', 'Unit Pemohon Tersimpan', `Unit Pemohon ${trimmedName} (${trimmedCode}) berhasil ditambahkan ke Cloud Firestore.`);
      return { success: true, unit: newUnit };
    } catch (err: any) {
      console.error('[Firestore Error: addRequestingUnit]', err);
      showToast('error', 'Gagal Menambahkan Unit Pemohon', err.message || 'Kesalahan saat menyimpan ke database.');
      return { success: false, message: err.message || 'Gagal menyimpan ke Firestore.' };
    }
  };

  const updateRequestingUnit = async (
    id: string,
    updates: Partial<MasterRequestingUnit>
  ): Promise<{ success: boolean; message?: string }> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return { success: false, message: perm.reason || 'Akses ditolak.' };
    }

    const current = requestingUnits.find((u) => u.id === id);
    if (!current) {
      return { success: false, message: 'Data Unit Pemohon tidak ditemukan.' };
    }

    const trimmedCode = updates.code ? updates.code.trim().toUpperCase() : current.code;
    const trimmedName = updates.name ? updates.name.trim() : current.name;

    // Check duplicate code against other records
    if (trimmedCode) {
      const duplicateCode = requestingUnits.some(
        (u) => u.id !== id && (u.code?.toUpperCase() === trimmedCode || u.unitCode?.toUpperCase() === trimmedCode)
      );
      if (duplicateCode) {
        return { success: false, message: `Kode Unit Pemohon "${trimmedCode}" sudah dipakai oleh unit lain.` };
      }
    }

    // Check duplicate name against other records
    if (trimmedName) {
      const duplicateName = requestingUnits.some(
        (u) => u.id !== id && (u.name?.toLowerCase() === trimmedName.toLowerCase() || u.unitName?.toLowerCase() === trimmedName.toLowerCase())
      );
      if (duplicateName) {
        return { success: false, message: `Nama Unit Pemohon "${trimmedName}" sudah dipakai oleh unit lain.` };
      }
    }

    const now = getJakartaTimestamp();
    const userLabel = currentUser ? `${currentUser.fullName} (${currentUser.employeeId})` : 'System';

    const merged: Partial<MasterRequestingUnit> = {
      ...updates,
      code: trimmedCode,
      unitCode: trimmedCode,
      name: trimmedName,
      unitName: trimmedName,
      updatedAt: now,
      updatedBy: userLabel,
    };
    if (typeof updates.isActive === 'boolean') {
      merged.status = updates.isActive ? 'Active' : 'Inactive';
    }

    try {
      await updateDoc(doc(db, 'requestingUnits', id), merged);
      await logAudit('REQUESTING_UNIT_UPDATED', 'Master Data', `Memperbarui Unit Pemohon: ${trimmedName} (${trimmedCode})`);
      showToast('success', 'Perubahan Tersimpan', `Unit Pemohon ${trimmedName} berhasil diperbarui di Cloud Firestore.`);
      return { success: true };
    } catch (err: any) {
      console.error('[Firestore Error: updateRequestingUnit]', err);
      showToast('error', 'Gagal Memperbarui Unit Pemohon', err.message || 'Kesalahan database.');
      return { success: false, message: err.message || 'Gagal memperbarui ke Firestore.' };
    }
  };

  const toggleRequestingUnitStatus = async (id: string): Promise<boolean> => {
    const target = requestingUnits.find((u) => u.id === id);
    if (!target) return false;
    const newActive = !target.isActive;
    const now = getJakartaTimestamp();
    const userLabel = currentUser ? `${currentUser.fullName} (${currentUser.employeeId})` : 'System';

    try {
      await updateDoc(doc(db, 'requestingUnits', id), {
        isActive: newActive,
        status: newActive ? 'Active' : 'Inactive',
        updatedAt: now,
        updatedBy: userLabel,
      });
      showToast('info', 'Status Unit Diubah', `Unit Pemohon ${target.name} kini ${newActive ? 'Aktif' : 'Non-Aktif'}.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: toggleRequestingUnitStatus]', err);
      showToast('error', 'Gagal Mengubah Status', err.message);
      return false;
    }
  };

  const deleteRequestingUnit = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed || currentUser?.role !== 'ADMIN') {
      showToast('error', 'Akses Ditolak', 'Hanya Administrator yang memiliki wewenang menghapus Unit Pemohon.');
      return { success: false, message: 'Wewenang tidak mencukupi.' };
    }

    const target = requestingUnits.find((u) => u.id === id);
    if (!target) {
      return { success: false, message: 'Data Unit Pemohon tidak ditemukan.' };
    }

    // Safeguard check: Verify no transactions reference this unit
    const referencedInIssues = goodsIssues.filter(
      (gi) => gi.requesterUnitId === id || (gi.requestingUnit && target.name && gi.requestingUnit.toLowerCase() === target.name.toLowerCase())
    );
    const referencedInTransfers = stockTransfers.filter(
      (st) => st.requesterUnitId === id || (st.requestingUnit && target.name && st.requestingUnit.toLowerCase() === target.name.toLowerCase())
    );
    const referencedInSupplyRequests = supplyRequests.filter(
      (sr) => sr.requesterUnitId === id || (sr.requestingUnit && target.name && sr.requestingUnit.toLowerCase() === target.name.toLowerCase())
    );

    const totalRefs = referencedInIssues.length + referencedInTransfers.length + referencedInSupplyRequests.length;
    if (totalRefs > 0) {
      const msg = `Unit Pemohon "${target.name}" (${target.code}) tidak dapat dihapus karena tercatat dalam ${totalRefs} transaksi operasional (${referencedInIssues.length} Pengeluaran Barang, ${referencedInTransfers.length} Transfer, ${referencedInSupplyRequests.length} Permohonan). Anda dapat menonaktifkannya sebagai alternatif.`;
      showToast('error', 'Hapus Ditolak (Data Berelasi)', msg);
      return { success: false, message: msg };
    }

    try {
      await deleteDoc(doc(db, 'requestingUnits', id));
      await logAudit('REQUESTING_UNIT_DELETED', 'Master Data', `Menghapus Unit Pemohon: ${target.name} (${target.code})`);
      showToast('success', 'Unit Pemohon Dihapus', `Unit Pemohon ${target.name} (${target.code}) berhasil dihapus.`);
      return { success: true };
    } catch (err: any) {
      console.error('[Firestore Error: deleteRequestingUnit]', err);
      showToast('error', 'Gagal Menghapus Unit Pemohon', err.message);
      return { success: false, message: err.message };
    }
  };

  // ----------------------------------------------------
  // SUPPLIER MASTER (Cloud Firestore Authoritative)
  // ----------------------------------------------------
  const saveSupplier = async (supData: Partial<MasterSupplier>): Promise<boolean> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    try {
      if (supData.id) {
        await updateDoc(doc(db, 'suppliers', supData.id), supData);
        showToast('success', 'Pemasok Disimpan', `Pemasok ${supData.name} berhasil diperbarui di Cloud Firestore.`);
      } else {
        const id = 'sup-' + (supData.code?.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || Date.now());
        const newSup: MasterSupplier = {
          id,
          code: supData.code?.toUpperCase() || `SUP-${suppliers.length + 1}`,
          name: supData.name || 'Pemasok Baru',
          contactPerson: supData.contactPerson || '-',
          phone: supData.phone || '-',
          email: supData.email || '-',
          address: supData.address || '-',
          isActive: true,
        };
        await setDoc(doc(db, 'suppliers', id), newSup);
        showToast('success', 'Pemasok Ditambahkan', `Pemasok ${newSup.name} berhasil didaftarkan di Cloud Firestore.`);
      }
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: saveSupplier]', err);
      showToast('error', 'Gagal Menyimpan Pemasok', err.message);
      return false;
    }
  };

  const deleteSupplier = async (id: string): Promise<{ success: boolean; message?: string }> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed || currentUser?.role !== 'ADMIN') {
      showToast('error', 'Akses Ditolak', 'Hanya Administrator yang dapat menghapus data pemasok.');
      return { success: false, message: 'Wewenang tidak mencukupi.' };
    }
    const target = suppliers.find((s) => s.id === id);
    if (!target) return { success: false, message: 'Pemasok tidak ditemukan.' };

    const refReceipts = goodsReceipts.filter(
      (gr) => gr.sourceSupplier?.toLowerCase() === target.name.toLowerCase()
    );
    if (refReceipts.length > 0) {
      const msg = `Pemasok "${target.name}" tidak dapat dihapus karena memiliki riwayat ${refReceipts.length} transaksi penerimaan barang.`;
      showToast('error', 'Hapus Ditolak', msg);
      return { success: false, message: msg };
    }

    try {
      await deleteDoc(doc(db, 'suppliers', id));
      await logAudit('SUPPLIER_DELETED', 'Master Data', `Menghapus pemasok: ${target.name}`);
      showToast('success', 'Pemasok Dihapus', `Data pemasok ${target.name} berhasil dihapus.`);
      return { success: true };
    } catch (err: any) {
      console.error('[Firestore Error: deleteSupplier]', err);
      showToast('error', 'Gagal Menghapus Pemasok', err.message);
      return { success: false, message: err.message };
    }
  };

  // ----------------------------------------------------
  // GOODS RECEIPT (IN) (Cloud Firestore Authoritative)
  // ----------------------------------------------------
  const addGoodsReceipt = async (data: {
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
  }): Promise<boolean> => {
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
      showToast('error', 'Validasi Gagal', 'Material tidak ditemukan dalam Master Data.');
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
    const id = 'gr-' + Date.now();

    const newReceipt: GoodsReceipt = {
      id,
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

    try {
      // 1. Atomic write using Firestore writeBatch to guarantee transaction and inventory consistency
      const batch = writeBatch(db);
      const receiptDocRef = doc(db, 'goodsReceipts', id);
      batch.set(receiptDocRef, sanitizeFirestoreDoc(newReceipt));

      // 2. Authoritative update of inventory balance in Firestore
      const balId = `bal-${material.id}-${location.id}`;
      const existingBal = inventory.find(
        (b) => b.materialId === material.id && b.locationId === location.id
      );

      if (existingBal) {
        const newQtyIn = existingBal.qtyIn + data.quantity;
        const newAvailable = existingBal.openingStock + newQtyIn - existingBal.qtyOut;
        const balDocRef = doc(db, 'inventory', existingBal.id);
        batch.update(balDocRef, {
          qtyIn: newQtyIn,
          availableStock: newAvailable,
          lastTransactionDate: data.receiptDate || now.split(' ')[0],
          unitCost: material.unitCost,
        });
      } else {
        const newBalance: InventoryBalance = {
          id: balId,
          materialId: material.id,
          materialCode: material.materialCode,
          materialName: material.materialName,
          categoryId: material.categoryId,
          categoryName: material.categoryName,
          unit: material.unit,
          locationId: location.id,
          locationName: location.name,
          variantValue: material.variantValue || '',
          openingStock: 0,
          qtyIn: data.quantity,
          qtyOut: 0,
          availableStock: data.quantity,
          minimumStock: material.minimumStock,
          reorderPoint: material.reorderPoint,
          lastTransactionDate: data.receiptDate || now.split(' ')[0],
          unitCost: material.unitCost,
        };
        const balDocRef = doc(db, 'inventory', balId);
        batch.set(balDocRef, sanitizeFirestoreDoc(newBalance));
      }

      await batch.commit();

      // 3. Write Audit Log
      await logAudit(
        'GOODS_RECEIPT_POSTED',
        'Barang Masuk',
        `Penerimaan ${data.quantity} ${material.unit} ${material.materialName} (${nextNumber}) dari ${data.sourceSupplier}`
      );

      showToast(
        'success',
        'Barang Masuk Berhasil Disimpan',
        `Nomor Transaksi: ${nextNumber}. Kuantitas +${data.quantity} ${material.unit} telah ditambahkan ke ${location.name}.`
      );
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: addGoodsReceipt]', err);
      const errMsg = err.message || 'Gagal menyimpan transaksi ke Cloud Firestore.';
      showToast('error', 'Gagal Mencatat Barang Masuk', errMsg);
      return false;
    }
  };

  // ----------------------------------------------------
  // GOODS ISSUE (OUT) (Cloud Firestore Authoritative)
  // ----------------------------------------------------
  const createGoodsIssue = async (data: {
    requestingUnit: string;
    requesterUnitId?: string;
    destination: string;
    materialId?: string;
    itemId?: string;
    locationId: string;
    requestedQuantity: number;
    purpose: string;
    notes?: string;
  }): Promise<boolean> => {
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

    // Resolve requesting unit snapshot
    let resolvedReqUnitId = data.requesterUnitId;
    let resolvedReqUnitName = data.requestingUnit;
    if (!resolvedReqUnitId && resolvedReqUnitName) {
      const match = requestingUnits.find(
        (u) => u.name.toLowerCase() === resolvedReqUnitName.toLowerCase() || u.code.toLowerCase() === resolvedReqUnitName.toLowerCase()
      );
      if (match) {
        resolvedReqUnitId = match.id;
        resolvedReqUnitName = match.name;
      }
    }

    const location = locations.find((l) => l.id === data.locationId);
    const nextNumber = 'GI-2026-' + (800 + goodsIssues.length + 1);
    const now = getJakartaTimestamp();
    const issueId = 'gi-' + Date.now();
    const approvalId = 'app-' + Date.now();

    const newIssue: GoodsIssue = {
      id: issueId,
      issueNumber: nextNumber,
      requestDate: now.split(' ')[0],
      requestingUnit: resolvedReqUnitName,
      requesterUnitId: resolvedReqUnitId,
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
      id: approvalId,
      type: 'BARANG_KELUAR',
      referenceId: newIssue.id,
      referenceNumber: nextNumber,
      title: `Pengeluaran ${material.materialName} (${data.requestedQuantity} ${material.unit}) - ${resolvedReqUnitName}`,
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

    try {
      await setDoc(doc(db, 'goodsIssues', issueId), newIssue);
      await setDoc(doc(db, 'approvals', approvalId), newApproval);
      await logAudit(
        'ISSUE_REQUEST_CREATED',
        'Barang Keluar',
        `Permintaan pengeluaran ${data.requestedQuantity} ${material.unit} ${material.materialName} (${nextNumber}) untuk ${resolvedReqUnitName} diteruskan ke Approval Center.`
      );
      showToast('success', 'Permintaan Terkirim', `Nomor Dokumen: ${nextNumber}. Menunggu otorisasi Administrator.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: createGoodsIssue]', err);
      showToast('error', 'Gagal Mengirim Permintaan', err.message || 'Kesalahan koneksi database.');
      return false;
    }
  };

  const approveGoodsIssue = async (issueId: string, approvedQty: number): Promise<boolean> => {
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

    try {
      // 1. Authoritative write to goodsIssues
      await updateDoc(doc(db, 'goodsIssues', issueId), {
        status: 'APPROVED',
        approvedQuantity: approvedQty,
        processedBy: currentUser!.fullName,
        approvedAt: now,
      });

      // 2. Authoritative update of approval request
      const app = approvals.find((a) => a.referenceId === issueId && a.type === 'BARANG_KELUAR');
      if (app) {
        await updateDoc(doc(db, 'approvals', app.id), {
          status: 'APPROVED',
          actionBy: currentUser!.fullName,
          actionDate: now,
        });
      }

      // 3. Deduct inventory balance in Firestore
      const newOut = balance.qtyOut + approvedQty;
      const newAvailable = balance.openingStock + balance.qtyIn - newOut;
      await updateDoc(doc(db, 'inventory', balance.id), {
        qtyOut: newOut,
        availableStock: newAvailable,
        lastTransactionDate: now.split(' ')[0],
      });

      await logAudit(
        'ISSUE_APPROVED',
        'Approval Center',
        `Menyetujui pengeluaran ${approvedQty} ${issue.unit} ${issue.itemName} (${issue.issueNumber}) untuk ${issue.requestingUnit}`
      );
      showToast('success', 'Pengeluaran Disetujui', `Dokumen ${issue.issueNumber} disetujui. Saldo terpotong.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: approveGoodsIssue]', err);
      showToast('error', 'Gagal Menyetujui Pengeluaran', err.message);
      return false;
    }
  };

  const rejectGoodsIssue = async (issueId: string, reason: string): Promise<boolean> => {
    const perm = can('APPROVE_TRANSACTIONS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const now = getJakartaTimestamp();
    try {
      await updateDoc(doc(db, 'goodsIssues', issueId), {
        status: 'REJECTED',
        rejectionReason: reason,
        processedBy: currentUser!.fullName,
      });

      const app = approvals.find((a) => a.referenceId === issueId && a.type === 'BARANG_KELUAR');
      if (app) {
        await updateDoc(doc(db, 'approvals', app.id), {
          status: 'REJECTED',
          rejectionReason: reason,
          actionBy: currentUser!.fullName,
          actionDate: now,
        });
      }

      await logAudit('ISSUE_REJECTED', 'Approval Center', `Menolak pengeluaran ID: ${issueId}. Alasan: ${reason}`);
      showToast('warning', 'Pengeluaran Ditolak', `Permintaan pengeluaran ditolak.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: rejectGoodsIssue]', err);
      showToast('error', 'Gagal Menolak Pengeluaran', err.message);
      return false;
    }
  };

  // ----------------------------------------------------
  // STOCK TRANSFER (Cloud Firestore Authoritative)
  // ----------------------------------------------------
  const createStockTransfer = async (data: {
    originLocationId: string;
    destinationLocationId: string;
    materialId?: string;
    itemId?: string;
    quantity: number;
    notes?: string;
    requestingUnit?: string;
    requesterUnitId?: string;
  }): Promise<boolean> => {
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
    const transferId = 'tr-' + Date.now();

    const newTransfer: StockTransfer = {
      id: transferId,
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
      requestingUnit: data.requestingUnit,
      requesterUnitId: data.requesterUnitId,
      sendingUser: `${currentUser!.fullName} (${currentUser!.employeeId})`,
      receivingUser: null,
      status: 'IN_TRANSIT',
      notes: data.notes || '',
      createdAt: now,
      dispatchedAt: now,
    };

    try {
      // 1. Authoritative write of stock transfer
      await setDoc(doc(db, 'stockTransfers', transferId), newTransfer);

      // 2. Deduct stock from origin location (In-Transit)
      const newOut = originBalance.qtyOut + data.quantity;
      const newAvailable = originBalance.openingStock + originBalance.qtyIn - newOut;
      await updateDoc(doc(db, 'inventory', originBalance.id), {
        qtyOut: newOut,
        availableStock: newAvailable,
        lastTransactionDate: now.split(' ')[0],
      });

      await logAudit(
        'TRANSFER_CREATED',
        'Transfer Stok',
        `Membuat transfer ${data.quantity} ${material.unit} ${material.materialName} (${nextNumber}) dari ${newTransfer.originLocationName} ke ${newTransfer.destinationLocationName}`
      );
      showToast('success', 'Transfer Diberangkatkan', `Nomor Transfer: ${nextNumber}. Status: In-Transit.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: createStockTransfer]', err);
      showToast('error', 'Gagal Membuat Transfer Stok', err.message);
      return false;
    }
  };

  const receiveStockTransfer = async (transferId: string): Promise<boolean> => {
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

    try {
      // 1. Mark transfer completed
      await updateDoc(doc(db, 'stockTransfers', transferId), {
        status: 'COMPLETED',
        receivingUser: `${currentUser!.fullName} (${currentUser!.employeeId})`,
        receivedAt: now,
      });

      // 2. Increase stock at destination location
      const existing = inventory.find(
        (b) => b.materialId === transfer.itemId && b.locationId === transfer.destinationLocationId
      );

      if (existing) {
        const newIn = existing.qtyIn + transfer.quantity;
        const newAvailable = existing.openingStock + newIn - existing.qtyOut;
        await updateDoc(doc(db, 'inventory', existing.id), {
          qtyIn: newIn,
          availableStock: newAvailable,
          lastTransactionDate: now.split(' ')[0],
        });
      } else {
        const material = materials.find((m) => m.id === transfer.itemId);
        const balId = `bal-${transfer.itemId}-${transfer.destinationLocationId}`;
        const newBal: InventoryBalance = {
          id: balId,
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
        await setDoc(doc(db, 'inventory', balId), newBal);
      }

      await logAudit(
        'TRANSFER_RECEIVED',
        'Transfer Stok',
        `Konfirmasi terima transfer ${transfer.transferNumber} di ${transfer.destinationLocationName}`
      );
      showToast('success', 'Transfer Selesai', `Stok barang telah ditambahkan ke ${transfer.destinationLocationName}.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: receiveStockTransfer]', err);
      showToast('error', 'Gagal Mengonfirmasi Penerimaan Transfer', err.message);
      return false;
    }
  };

  // ----------------------------------------------------
  // STOCK OPNAME (Cloud Firestore Authoritative)
  // ----------------------------------------------------
  const createStockOpname = async (data: {
    locationId: string;
    materialId?: string;
    itemId?: string;
    physicalQuantity: number;
    varianceReason: string;
    notes?: string;
  }): Promise<boolean> => {
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
    const opnameId = 'so-' + Date.now();
    const approvalId = 'app-' + Date.now();

    const newOpname: StockOpname = {
      id: opnameId,
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

    try {
      await setDoc(doc(db, 'stockOpnames', opnameId), newOpname);

      if (requiresApproval) {
        const newApproval: ApprovalRequest = {
          id: approvalId,
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
        await setDoc(doc(db, 'approvals', approvalId), newApproval);
      } else if (balance) {
        // If variance is 0, update lastTransactionDate
        await updateDoc(doc(db, 'inventory', balance.id), {
          lastTransactionDate: now.split(' ')[0],
        });
      }

      await logAudit(
        'OPNAME_RECORDED',
        'Stock Opname',
        `Pencatatan opname ${nextNumber}: Sistem ${systemQty}, Fisik ${data.physicalQuantity}, Selisih ${variance} ${material.unit}.`
      );
      showToast(
        requiresApproval ? 'warning' : 'success',
        requiresApproval ? 'Opname Ada Selisih' : 'Opname Sesuai',
        requiresApproval ? `Ditemukan selisih ${variance} ${material.unit}. Diteruskan ke Approval Center.` : 'Fisik dan sistem cocok.'
      );
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: createStockOpname]', err);
      showToast('error', 'Gagal Menyimpan Stock Opname', err.message);
      return false;
    }
  };

  const approveOpnameAdjustment = async (opnameId: string): Promise<boolean> => {
    const perm = can('ADJUST_STOCK');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Admin yang dapat memposting adjustment.');
      return false;
    }

    const opname = stockOpnames.find((o) => o.id === opnameId);
    if (!opname) return false;

    const now = getJakartaTimestamp();

    try {
      // 1. Authoritative update of stockOpnames
      await updateDoc(doc(db, 'stockOpnames', opnameId), {
        verificationStatus: 'ADJUSTED',
        verifiedBy: `${currentUser!.fullName} (${currentUser!.employeeId})`,
        adjustedAt: now,
      });

      // 2. Authoritative update of approvals
      const app = approvals.find((a) => a.referenceId === opnameId && a.type === 'STOCK_OPNAME_ADJUSTMENT');
      if (app) {
        await updateDoc(doc(db, 'approvals', app.id), {
          status: 'APPROVED',
          actionBy: currentUser!.fullName,
          actionDate: now,
        });
      }

      // 3. Authoritative adjustment of inventory balance
      const balance = inventory.find(
        (b) => b.materialId === opname.itemId && b.locationId === opname.locationId
      );
      if (balance) {
        await updateDoc(doc(db, 'inventory', balance.id), {
          availableStock: opname.physicalQuantity,
          lastTransactionDate: now.split(' ')[0],
        });
      }

      await logAudit(
        'OPNAME_ADJUSTMENT_POSTED',
        'Approval Center',
        `Menyetujui adjustment opname ${opname.opnameNumber}. Saldo baru: ${opname.physicalQuantity} ${opname.unit}.`
      );
      showToast('success', 'Penyesuaian Berhasil', `Saldo sistem telah disesuaikan dengan fisik (${opname.physicalQuantity} ${opname.unit}).`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: approveOpnameAdjustment]', err);
      showToast('error', 'Gagal Memproses Adjustment Opname', err.message);
      return false;
    }
  };

  const rejectOpnameAdjustment = async (opnameId: string, reason: string): Promise<boolean> => {
    const perm = can('ADJUST_STOCK');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const opname = stockOpnames.find((o) => o.id === opnameId);
    if (!opname) return false;

    const now = getJakartaTimestamp();
    try {
      await updateDoc(doc(db, 'stockOpnames', opnameId), {
        verificationStatus: 'REJECTED',
        notes: (opname.notes ? opname.notes + ' | ' : '') + `Ditolak Admin: ${reason}`,
      });

      const app = approvals.find((a) => a.referenceId === opnameId && a.type === 'STOCK_OPNAME_ADJUSTMENT');
      if (app) {
        await updateDoc(doc(db, 'approvals', app.id), {
          status: 'REJECTED',
          rejectionReason: reason,
          actionBy: currentUser!.fullName,
          actionDate: now,
        });
      }

      await logAudit('OPNAME_ADJUSTMENT_REJECTED', 'Approval Center', `Menolak adjustment opname ${opname.opnameNumber}. Alasan: ${reason}`);
      showToast('warning', 'Adjustment Ditolak', 'Penolakan adjustment opname tercatat.');
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: rejectOpnameAdjustment]', err);
      showToast('error', 'Gagal Menolak Adjustment Opname', err.message);
      return false;
    }
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
    setDoc(doc(db, 'users', newUser.id), newUser).catch((err) => {
      console.warn('Firestore user save warning:', err);
    });
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

    setUsers((prev) => {
      const updated = prev.map((u) => (u.id === id ? { ...u, ...updates } : u));
      const target = updated.find((u) => u.id === id);
      if (target) {
        setDoc(doc(db, 'users', id), target, { merge: true }).catch(() => {});
      }
      return updated;
    });

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

    const nextStatus: AccountStatus = target.status === 'Active' ? 'Inactive' : 'Active';
    setUsers((prev) => {
      const updated = prev.map((u) => (u.id === id ? { ...u, status: nextStatus } : u));
      const updatedTarget = updated.find((u) => u.id === id);
      if (updatedTarget) {
        setDoc(doc(db, 'users', id), updatedTarget, { merge: true }).catch(() => {});
      }
      return updated;
    });

    logAudit('ACCOUNT_STATUS_TOGGLED', 'Account Management', `Status akun ${target.fullName} diubah ke ${nextStatus}`);
    showToast('info', 'Status Akun Diperbarui', `Akun ${target.fullName} sekarang ${nextStatus}.`);
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
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      setDoc(doc(db, 'settings', 'global'), updated).catch(() => {});
      return updated;
    });
    logAudit('SETTINGS_UPDATED', 'Pengaturan', 'Administrator memperbarui konfigurasi sistem');
    showToast('success', 'Pengaturan Disimpan', 'Konfigurasi sistem berhasil diperbarui.');
  };

  const seedDemoData = async (): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser || currentUser.role !== 'ADMIN') {
      showToast('error', 'Akses Ditolak', 'Hanya Administrator yang dapat menginisialisasi data demo.');
      return { success: false, message: 'Wewenang tidak mencukupi.' };
    }

    setIsSeedingDemo(true);
    showToast('info', 'Memulai Inisialisasi', 'Sedang memuat data master & operasional awal ke Cloud Firestore...');

    try {
      // 1. Seed Categories
      for (const cat of INITIAL_CATEGORIES) {
        await setDoc(doc(db, 'categories', cat.id), cat, { merge: true });
      }

      // 2. Seed Units
      for (const un of INITIAL_UNITS) {
        await setDoc(doc(db, 'units', un.id), un, { merge: true });
      }

      // 3. Seed Base Locations (Gudang Utama CGK, Gudang Distribusi T3, Buffer Stock GSE)
      const demoLocations: MasterLocation[] = [
        {
          id: 'loc-cgk-wh1',
          code: 'LOC-CGK-01',
          name: 'Gudang Utama Soekarno-Hatta (CGK)',
          locationId: 'loc-cgk-wh1',
          locationCode: 'LOC-CGK-01',
          locationName: 'Gudang Utama Soekarno-Hatta (CGK)',
          type: 'Central Warehouse',
          picName: 'Budi Santoso',
          personInCharge: 'Budi Santoso',
          capacityM2: 1500,
          address: 'Kawasan Pergudangan Bandara Soekarno-Hatta Blok C-12, Tangerang',
          description: 'Pusat penerimaan, karantina, dan staging logistik utama PT IAS Support',
          isActive: true,
          createdAt: getJakartaTimestamp(),
          createdBy: currentUser.employeeId,
          updatedAt: getJakartaTimestamp(),
        },
        {
          id: 'loc-t3-terminal',
          code: 'LOC-CGK-T3',
          name: 'Staging Hub Terminal 3 Domestik',
          locationId: 'loc-t3-terminal',
          locationCode: 'LOC-CGK-T3',
          locationName: 'Staging Hub Terminal 3 Domestik',
          type: 'Hub Distribution',
          picName: 'Ahmad Fauzi',
          personInCharge: 'Ahmad Fauzi',
          capacityM2: 300,
          address: 'Basement Terminal 3 Bandara CGK, Area Servis Operasional',
          description: 'Gudang penyangga perlengkapan toilet, plastik sampah, dan chemical harian',
          isActive: true,
          createdAt: getJakartaTimestamp(),
          createdBy: currentUser.employeeId,
          updatedAt: getJakartaTimestamp(),
        },
        {
          id: 'loc-buffer-gse',
          code: 'LOC-GSE-BUF',
          name: 'Buffer Stock Apron GSE Support',
          locationId: 'loc-buffer-gse',
          locationCode: 'LOC-GSE-BUF',
          locationName: 'Buffer Stock Apron GSE Support',
          type: 'Transit',
          picName: 'Rudi Hartono',
          personInCharge: 'Rudi Hartono',
          capacityM2: 200,
          address: 'Apron Timur Airside CGK',
          description: 'Area penyiapan suku cadang, pelumas, dan APD operasional apron darat',
          isActive: true,
          createdAt: getJakartaTimestamp(),
          createdBy: currentUser.employeeId,
          updatedAt: getJakartaTimestamp(),
        },
      ];

      for (const loc of demoLocations) {
        await setDoc(doc(db, 'locations', loc.id), loc, { merge: true });
      }

      // 4. Seed Base Materials
      const demoMaterials: MaterialMaster[] = [
        {
          id: 'mat-tis-001',
          materialId: 'mat-tis-001',
          materialCode: 'MAT-TIS-001',
          materialName: 'Hand Towel Paper (HT) 150 Sheets Embossed',
          categoryId: 'cat-tissue',
          categoryName: 'Tissue',
          subcategoryId: 'Toilet Consumables',
          unitId: 'unit-pack',
          unit: 'Pack',
          minimumStock: 100,
          reorderPoint: 250,
          defaultLocationId: 'loc-cgk-wh1',
          defaultLocationName: 'Gudang Utama Soekarno-Hatta (CGK)',
          variantAttributes: '2-Ply Pure Cellulose',
          variantValue: 'Pack 150s',
          unitCost: 12500,
          description: 'Kertas pengering tangan higienis toilet bandara berstandar internasional',
          isActive: true,
          createdAt: getJakartaTimestamp(),
          createdBy: currentUser.employeeId,
          updatedAt: getJakartaTimestamp(),
          updatedBy: currentUser.employeeId,
        },
        {
          id: 'mat-tis-002',
          materialId: 'mat-tis-002',
          materialCode: 'MAT-TIS-002',
          materialName: 'Jumbo Roll Tissue (JRT) 2-Ply 300m',
          categoryId: 'cat-tissue',
          categoryName: 'Tissue',
          subcategoryId: 'Toilet Consumables',
          unitId: 'unit-roll',
          unit: 'Roll',
          minimumStock: 80,
          reorderPoint: 180,
          defaultLocationId: 'loc-cgk-wh1',
          defaultLocationName: 'Gudang Utama Soekarno-Hatta (CGK)',
          variantAttributes: 'Diameter 23cm, Core 7.5cm',
          variantValue: 'Roll 300m',
          unitCost: 28500,
          description: 'Gulungan tissue jumbo untuk dispenser toilet publik intensitas tinggi',
          isActive: true,
          createdAt: getJakartaTimestamp(),
          createdBy: currentUser.employeeId,
          updatedAt: getJakartaTimestamp(),
          updatedBy: currentUser.employeeId,
        },
        {
          id: 'mat-pls-001',
          materialId: 'mat-pls-001',
          materialCode: 'MAT-PLS-001',
          materialName: 'Kantong Plastik Sampah Hitam HD Heavy Duty 80x100cm',
          categoryId: 'cat-plastic',
          categoryName: 'Plastic',
          subcategoryId: 'Trash Bags',
          unitId: 'unit-pack',
          unit: 'Pack',
          minimumStock: 60,
          reorderPoint: 150,
          defaultLocationId: 'loc-cgk-wh1',
          defaultLocationName: 'Gudang Utama Soekarno-Hatta (CGK)',
          variantAttributes: 'Ketebalan 40 mikron',
          variantValue: 'Pack isi 20 lembar',
          unitCost: 19000,
          description: 'Plastik sampah kuat antibocor untuk tempat sampah stasiun dan terminal',
          isActive: true,
          createdAt: getJakartaTimestamp(),
          createdBy: currentUser.employeeId,
          updatedAt: getJakartaTimestamp(),
          updatedBy: currentUser.employeeId,
        },
        {
          id: 'mat-chm-001',
          materialId: 'mat-chm-001',
          materialCode: 'MAT-CHM-001',
          materialName: 'Neutral Floor Cleaner Lemon Fragrance (Jerigen 4L)',
          categoryId: 'cat-chemical',
          categoryName: 'Chemical',
          subcategoryId: 'Cleaning Agents',
          unitId: 'unit-bottle',
          unit: 'Btl',
          minimumStock: 30,
          reorderPoint: 70,
          defaultLocationId: 'loc-cgk-wh1',
          defaultLocationName: 'Gudang Utama Soekarno-Hatta (CGK)',
          variantAttributes: 'pH 7.0 Food Contact Safe',
          variantValue: 'Jerigen 4 Liter',
          unitCost: 65000,
          description: 'Konsentrat pembersih lantai marmer/granit ramah lingkungan dan wangi segar',
          isActive: true,
          createdAt: getJakartaTimestamp(),
          createdBy: currentUser.employeeId,
          updatedAt: getJakartaTimestamp(),
          updatedBy: currentUser.employeeId,
        },
        {
          id: 'mat-eqp-001',
          materialId: 'mat-eqp-001',
          materialCode: 'MAT-EQP-001',
          materialName: 'Morgan Janitorial Cleaning Trolley 3-Tier Multi-Tray',
          categoryId: 'cat-equipment',
          categoryName: 'Equipment',
          subcategoryId: 'Hardware Assets',
          unitId: 'unit-unit',
          unit: 'Unit',
          minimumStock: 5,
          reorderPoint: 12,
          defaultLocationId: 'loc-cgk-wh1',
          defaultLocationName: 'Gudang Utama Soekarno-Hatta (CGK)',
          variantAttributes: 'Frame Polypropylene Roda Silent',
          variantValue: 'Standard 3 Susun',
          unitCost: 1450000,
          description: 'Trolley kebersihan terpadu dengan kantong sampah kuning dan rak alat',
          isActive: true,
          createdAt: getJakartaTimestamp(),
          createdBy: currentUser.employeeId,
          updatedAt: getJakartaTimestamp(),
          updatedBy: currentUser.employeeId,
        },
      ];

      for (const mat of demoMaterials) {
        await setDoc(doc(db, 'materials', mat.id), mat, { merge: true });

        // Initialize zero inventory balance for each material
        const balId = `bal-${mat.id}-${mat.defaultLocationId}`;
        const bal: InventoryBalance = {
          id: balId,
          materialId: mat.id,
          materialCode: mat.materialCode,
          materialName: mat.materialName,
          categoryId: mat.categoryId,
          categoryName: mat.categoryName,
          unit: mat.unit,
          locationId: mat.defaultLocationId!,
          locationName: mat.defaultLocationName || 'Gudang Utama',
          variantValue: mat.variantValue,
          openingStock: 0,
          qtyIn: 0,
          qtyOut: 0,
          availableStock: 0,
          minimumStock: mat.minimumStock,
          reorderPoint: mat.reorderPoint,
          lastTransactionDate: getJakartaTimestamp().split(' ')[0],
          unitCost: mat.unitCost,
        };
        await setDoc(doc(db, 'inventory', balId), bal, { merge: true });
      }

      await logAudit(
        'DEMO_DATA_SEEDED',
        'Pengaturan',
        'Administrator menginisialisasi dataset sampel ke Cloud Firestore'
      );
      showToast(
        'success',
        'Inisialisasi Berhasil',
        'Dataset master material, kategori, satuan, dan lokasi telah tersimpan di Cloud Firestore.'
      );
      return { success: true };
    } catch (err: any) {
      console.error('[Firestore Error: seedDemoData]', err);
      const errMsg = err.message || 'Gagal memuat data demo ke Cloud Firestore.';
      showToast('error', 'Gagal Inisialisasi Data Demo', errMsg);
      return { success: false, message: errMsg };
    } finally {
      setIsSeedingDemo(false);
    }
  };

  const clearLocalCache = () => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
          if (key !== STORAGE_KEY_PREFIX + 'current_user_id') {
            keysToRemove.push(key);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      showToast(
        'info',
        'Cache Lokal Direset',
        'Cache peramban telah dikosongkan. Data sedang disinkronkan ulang langsung dari Cloud Firestore tanpa menghapus database.'
      );
    } catch (err: any) {
      console.error('Error clearing local cache:', err);
    }
  };

  const resetToInitialData = () => {
    clearLocalCache();
  };

  return (
    <AppContext.Provider
      value={{
        authLoading,
        firebaseUser,
        currentUser,
        setCurrentUser,
        loginWithEmail,
        loginWithGoogle,
        registerWithEmail,
        resetPassword,
        logout,
        switchRole,
        syncLoading,
        syncErrors,
        seedDemoData,
        clearLocalCache,
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
        activeRequestingUnits,
        addRequestingUnit,
        updateRequestingUnit,
        toggleRequestingUnitStatus,
        deleteRequestingUnit,
        suppliers,
        activeSuppliers,
        saveSupplier,
        deleteSupplier,
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
        deleteMaterial,
        addLocation,
        updateLocation,
        toggleLocationStatus,
        deleteLocation,
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
