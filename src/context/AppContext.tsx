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
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction,
  onSnapshot,
  query,
  where,
  DocumentReference,
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
  TransferRejectionDisposition,
  InventoryMovement,
  InventoryBaseline,
  BaselineStatus,
  IN_TRANSIT_LOCATION_ID,
  IN_TRANSIT_LOCATION_NAME,
} from '../types';
import {
  executeInventoryMovementInTransaction,
  getCanonicalBalanceId,
  getCanonicalBaselineId,
  generateIdempotencyKey,
  commitInChunks,
  parseJakartaTimestampMs,
  getJakartaTimestamp,
  getJakartaDateString,
  resolveAuthoritativeBalanceDoc,
  buildControlledBaselineReconciliationPlan,
  calculateUnreservedAvailableStock,
  getPendingGoodsIssueReservedQty,
  validateSupplyRequestReceipt,
  buildControlledOpeningOpnameDrafts,
} from '../services/inventoryEngine';
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
  inventoryMovements: InventoryMovement[];
  inventoryBaselines: InventoryBaseline[];
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
  receiveStockTransfer: (transferId: string, notes?: string) => Promise<boolean>;
  rejectStockTransfer: (transferId: string, reason: string, disposition?: TransferRejectionDisposition) => Promise<boolean>;

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
  fetchLiveStockBalance: (materialId: string, locationId: string, materialCode?: string) => Promise<number>;
  reconcileOpnameBaselines: (balanceIds?: string[]) => Promise<{
    success: boolean;
    createdCount: number;
    skippedCount: number;
    errors: string[];
  }>;

  // Consumption (Tissue, Plastik, Chemical)
  recordConsumption: (record: Omit<ConsumptionRecord, 'id' | 'createdAt'>) => Promise<boolean>;

  // Morgan Trolley
  saveMorganTrolley: (data: Partial<MorganTrolleyRecord>) => Promise<boolean>;
  deleteMorganTrolley: (id: string) => Promise<boolean>;

  // Supply Requests (Outstanding Tracker)
  createSupplyRequest: (data: {
    requestingLocationId: string;
    requestingUnit: string;
    materialId: string;
    requestedQuantity: number;
    notes?: string;
  }) => Promise<boolean>;
  receiveSupplyRequest: (requestId: string, quantity: number, refNumber: string) => Promise<boolean>;

  // Excel Bulk Import Engine
  executeExcelImport: (
    moduleType: ImportModuleType,
    records: Record<string, any>[],
    mode: 'INSERT_ONLY' | 'UPDATE_EXISTING' | 'INSERT_OR_UPDATE' | 'HISTORICAL_TRANSACTION' | 'OPENING_BALANCE'
  ) => Promise<{ successCount: number; errorCount: number; errors: ExcelImportValidationError[] }>;

  // Account Management
  createUserAccount: (account: Omit<UserAccount, 'id' | 'createdDate' | 'lastLogin'>) => Promise<boolean>;
  updateUserAccount: (id: string, updates: Partial<UserAccount>) => Promise<boolean>;
  toggleUserStatus: (id: string) => Promise<boolean>;
  resetUserPassword: (
    id: string
  ) => Promise<{ success: boolean; mode: 'RESET_EMAIL_SENT' | 'PROVISIONED_NOTICE' | 'FAILED'; message: string }>;

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
  const [inventoryMovements, setInventoryMovements] = useState<InventoryMovement[]>(() => loadState('inventoryMovements', []));
  const [inventoryBaselines, setInventoryBaselines] = useState<InventoryBaseline[]>(() => loadState('inventoryBaselines', []));
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

    let pendingLoads = 19;
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
    const unsubMovements = bindSync('inventoryMovements', setInventoryMovements, markLoaded);
    const unsubBaselines = bindSync('inventoryBaselines', setInventoryBaselines, markLoaded);
    const unsubReceipts = bindSync('goodsReceipts', setGoodsReceipts, markLoaded);
    const unsubIssues = bindSync('goodsIssues', setGoodsIssues, markLoaded);
    const unsubTransfers = bindSync('stockTransfers', setStockTransfers, markLoaded);
    const unsubOpnames = bindSync('stockOpnames', setStockOpnames, markLoaded);
    const unsubConsumptions = bindSync('consumptions', setConsumptions, markLoaded);
    const unsubTrolleys = bindSync('morganTrolleys', setMorganTrolleys, markLoaded);
    const unsubRequests = bindSync('supplyRequests', setSupplyRequests, markLoaded);
    const unsubApprovals = bindSync('approvals', setApprovals, markLoaded);
    const unsubAudit = bindSync('auditLogs', setAuditLogs, markLoaded);

    // Privacy & security hardening: only ADMIN lists all /users; non-Admin subscribes strictly to own /users/{uid}
    let unsubUsers: () => void;
    if (currentUser.role === 'ADMIN') {
      unsubUsers = bindSync('users', setUsers, markLoaded);
    } else {
      unsubUsers = onSnapshot(
        doc(db, 'users', currentUser.id),
        (docSnap) => {
          if (docSnap.exists()) {
            const profile = { id: docSnap.id, ...(docSnap.data() as Omit<UserAccount, 'id'>) } as UserAccount;
            setUsers([profile]);
            setCurrentUser(profile);
          } else {
            setUsers([]);
          }
          setSyncErrors((prev) => {
            if (!prev.users) return prev;
            const copy = { ...prev };
            delete copy.users;
            return copy;
          });
          markLoaded();
        },
        (error) => {
          console.error('[Firestore Sync: users]', error.message);
          setSyncErrors((prev) => ({ ...prev, users: error.message }));
          markLoaded();
        }
      );
    }

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
      unsubMovements();
      unsubBaselines();
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
  }, [currentUser?.id, currentUser?.role]);

  // Derived active dropdown lists (Rule: Inactive master entities & virtual In-Transit cannot be selected in new transactions)
  const activeMaterials = useMemo(() => materials.filter((m) => m.isActive !== false), [materials]);
  const activeLocations = useMemo(
    () => locations.filter((l) => l.isActive !== false && l.id !== IN_TRANSIT_LOCATION_ID && l.id !== 'loc-in-transit'),
    [locations]
  );
  const activeCategories = useMemo(() => categories.filter((c) => c.isActive !== false), [categories]);
  const activeUnits = useMemo(() => units.filter((u) => u.isActive !== false), [units]);
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
  useEffect(() => { localStorage.setItem(STORAGE_KEY_PREFIX + 'inventoryBaselines', JSON.stringify(inventoryBaselines)); }, [inventoryBaselines]);
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
      categoryId: data.categoryId,
      categoryName: category ? category.name : data.categoryName || 'General',
      unitId: data.unitId || undefined,
      unit: unit ? unit.symbol : data.unit || 'Pcs',
      defaultLocationId: data.defaultLocationId || undefined,
      defaultLocationName: location ? location.name : undefined,
      subcategoryId: data.subcategoryId || undefined,
      variantAttributes: data.variantAttributes || undefined,
      variantValue: data.variantValue || undefined,
      minimumStock: Number(data.minimumStock) || 0,
      reorderPoint: Number(data.reorderPoint) || 0,
      unitCost: Number(data.unitCost) || 0,
      description: data.description || '',
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
      const errMsg = err.code === 'permission-denied'
        ? 'Izin tidak mencukupi untuk menambah material. Diperlukan role ADMIN atau LOGISTIK aktif.'
        : (err.message || 'Gagal menyimpan material ke Cloud Firestore.');
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
    if (!perm.allowed || currentUser?.role !== 'ADMIN') {
      const msg = currentUser?.role !== 'ADMIN'
        ? 'Hanya Administrator yang berwenang menghapus Material Master.'
        : (perm.reason || 'Izin tidak mencukupi.');
      showToast('error', 'Akses Ditolak', msg);
      return { success: false, message: msg };
    }

    const target = materials.find((m) => m.id === id);
    if (!target) {
      return { success: false, message: 'Material tidak ditemukan.' };
    }

    const matchesMat = (itemId?: string, itemCode?: string) =>
      itemId === id || (Boolean(target.materialCode) && itemCode === target.materialCode);

    // Check referential integrity across all operational & ledger collections
    const hasReceipts = goodsReceipts.some((r) => matchesMat(r.itemId, r.itemCode));
    const hasIssues = goodsIssues.some((i) => matchesMat(i.itemId, i.itemCode));
    const hasTransfers = stockTransfers.some((t) => matchesMat(t.itemId, t.itemCode));
    const hasOpnames = stockOpnames.some((o) => matchesMat(o.itemId, o.itemCode));
    const hasConsumptions = consumptions.some((c) => matchesMat(c.materialId, c.materialCode));
    const hasSupplyRequests = supplyRequests.some((sr) => matchesMat(sr.materialId, sr.materialCode));
    const hasMovements = inventoryMovements.some((m) => matchesMat(m.materialId, m.materialCode));
    const hasBaselines = inventoryBaselines.some((b) => matchesMat(b.materialId, b.materialCode));
    const hasNonZeroStock = inventory.some(
      (b) => matchesMat(b.materialId || b.itemId, b.materialCode || b.itemCode) && Number(b.availableStock) !== 0
    );

    if (
      hasReceipts ||
      hasIssues ||
      hasTransfers ||
      hasOpnames ||
      hasConsumptions ||
      hasSupplyRequests ||
      hasMovements ||
      hasBaselines ||
      hasNonZeroStock
    ) {
      const msg = `Material "${target.materialName}" tidak dapat dihapus karena sudah memiliki riwayat transaksi, opname, baseline, movement ledger, atau saldo stok aktif. Gunakan fitur Non-aktifkan Status.`;
      showToast('warning', 'Hapus Ditolak (Data Berelasi)', msg);
      return { success: false, message: msg };
    }

    try {
      await deleteDoc(doc(db, 'materials', id));

      // Clean up any zero unused balances in inventory for this material
      const zeroBalances = inventory.filter(
        (b) => matchesMat(b.materialId || b.itemId, b.materialCode || b.itemCode) && Number(b.availableStock) === 0
      );
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
    const parentLoc = data.parentLocationId ? locations.find((l) => l.id === data.parentLocationId) : undefined;

    const newLocation: MasterLocation = {
      ...data,
      id,
      locationId: id,
      code: codeUpper,
      locationCode: codeUpper,
      locationName: data.name,
      parentLocationId: data.parentLocationId || undefined,
      parentLocationName: parentLoc ? parentLoc.name : undefined,
      isActive: data.isActive !== undefined ? data.isActive : true,
      createdAt: now,
      createdBy: currentUser ? currentUser.employeeId : 'SYSTEM',
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'locations', id), sanitizeFirestoreDoc(newLocation));
      await logAudit(
        'LOCATION_CREATED',
        'Master Data',
        `Menambah lokasi/gudang baru di Firestore: ${newLocation.name} (${newLocation.code})`
      );
      showToast('success', 'Lokasi Berhasil Didaftarkan', `Gudang/Area ${newLocation.name} siap digunakan di seluruh transaksi.`);
      return { success: true, location: newLocation };
    } catch (err: any) {
      console.error('[Firestore Error: addLocation]', err);
      const errMsg = err.code === 'permission-denied'
        ? 'Izin tidak mencukupi untuk menambah lokasi. Diperlukan role ADMIN atau LOGISTIK aktif.'
        : (err.message || 'Gagal menyimpan lokasi ke Cloud Firestore.');
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
    const resolvedParentName = parentLoc
      ? parentLoc.name
      : (updates.parentLocationId === '' ? undefined : currentLoc.parentLocationName);

    const updatedLocation: MasterLocation = {
      ...currentLoc,
      ...updates,
      parentLocationId: updates.parentLocationId !== undefined ? (updates.parentLocationId || undefined) : currentLoc.parentLocationId,
      parentLocationName: resolvedParentName,
      updatedAt: now,
    };

    try {
      await setDoc(doc(db, 'locations', id), sanitizeFirestoreDoc(updatedLocation), { merge: true });

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
      const errMsg = err.code === 'permission-denied'
        ? 'Izin tidak mencukupi untuk memperbarui lokasi. Diperlukan role ADMIN atau LOGISTIK aktif.'
        : (err.message || 'Gagal memperbarui lokasi di Cloud Firestore.');
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
    if (!perm.allowed || currentUser?.role !== 'ADMIN') {
      const msg = currentUser?.role !== 'ADMIN'
        ? 'Hanya Administrator yang berwenang menghapus Lokasi Gudang.'
        : (perm.reason || 'Izin tidak mencukupi.');
      showToast('error', 'Akses Ditolak', msg);
      return { success: false, message: msg };
    }

    if (id === IN_TRANSIT_LOCATION_ID || id === 'loc-in-transit') {
      const msg = 'Lokasi sistem virtual In-Transit tidak boleh dihapus.';
      showToast('error', 'Hapus Ditolak', msg);
      return { success: false, message: msg };
    }

    const target = locations.find((l) => l.id === id);
    if (!target) {
      return { success: false, message: 'Lokasi tidak ditemukan.' };
    }

    const hasActiveStock = inventory.some((b) => b.locationId === id && Number(b.availableStock) !== 0);
    const hasReceipts = goodsReceipts.some((r) => r.destinationLocationId === id);
    const hasIssues = goodsIssues.some((i) => i.locationId === id);
    const hasTransfers = stockTransfers.some(
      (t) => t.originLocationId === id || t.destinationLocationId === id
    );
    const hasOpnames = stockOpnames.some((o) => o.locationId === id);
    const hasConsumptions = consumptions.some((c) => c.locationId === id);
    const hasSupplyRequests = supplyRequests.some((sr) => sr.requestingLocationId === id);
    const hasTrolleys = morganTrolleys.some((t) => t.locationId === id);
    const hasMovements = inventoryMovements.some((m) => m.locationId === id);
    const hasBaselines = inventoryBaselines.some((b) => b.locationId === id);

    if (
      hasActiveStock ||
      hasReceipts ||
      hasIssues ||
      hasTransfers ||
      hasOpnames ||
      hasConsumptions ||
      hasSupplyRequests ||
      hasTrolleys ||
      hasMovements ||
      hasBaselines
    ) {
      const msg = `Lokasi "${target.name}" tidak dapat dihapus karena memiliki saldo stok aktif, histori transaksi, opname, transfer, trolley, atau movement ledger. Gunakan fitur Non-aktifkan Status.`;
      showToast('warning', 'Hapus Ditolak (Data Berelasi)', msg);
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

    const trimmedName = catData.name?.trim() || '';
    const trimmedCode = catData.code?.trim().toUpperCase() || '';
    if (!catData.id && (!trimmedCode || !trimmedName)) {
      showToast('error', 'Validasi Gagal', 'Kode dan nama kategori wajib diisi.');
      return false;
    }

    if (trimmedCode && categories.some((c) => c.id !== catData.id && c.code.toUpperCase() === trimmedCode)) {
      showToast('error', 'Kode Duplikat', `Kode kategori "${trimmedCode}" sudah digunakan.`);
      return false;
    }
    if (trimmedName && categories.some((c) => c.id !== catData.id && c.name.toLowerCase() === trimmedName.toLowerCase())) {
      showToast('error', 'Nama Duplikat', `Nama kategori "${trimmedName}" sudah terdaftar.`);
      return false;
    }

    try {
      if (catData.id) {
        await updateDoc(
          doc(db, 'categories', catData.id),
          sanitizeFirestoreDoc({
            ...catData,
            ...(trimmedCode ? { code: trimmedCode } : {}),
            ...(trimmedName ? { name: trimmedName } : {}),
          })
        );
        showToast('success', 'Kategori Disimpan', `Kategori ${trimmedName || catData.name} diperbarui di Cloud Firestore.`);
      } else {
        const id = 'cat-' + (trimmedCode.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || Date.now());
        const newCat: MasterCategory = {
          id,
          code: trimmedCode,
          name: trimmedName,
          description: catData.description?.trim() || '',
          isActive: catData.isActive !== false,
        };
        await setDoc(doc(db, 'categories', id), sanitizeFirestoreDoc(newCat));
        showToast('success', 'Kategori Ditambahkan', `Kategori ${newCat.name} berhasil dibuat di Cloud Firestore.`);
      }
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: saveCategory]', err);
      const errMsg = err.code === 'permission-denied'
        ? 'Izin tidak mencukupi untuk menyimpan kategori. Diperlukan role ADMIN atau LOGISTIK aktif.'
        : err.message;
      showToast('error', 'Gagal Menyimpan Kategori', errMsg);
      return false;
    }
  };

  const toggleCategoryStatus = async (id: string): Promise<boolean> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }
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

    const trimmedCode = unitData.code?.trim().toUpperCase() || '';
    const trimmedName = unitData.name?.trim() || '';
    const trimmedSymbol = unitData.symbol?.trim() || '';
    if (!unitData.id && (!trimmedCode || !trimmedName || !trimmedSymbol)) {
      showToast('error', 'Validasi Gagal', 'Kode, nama, dan simbol satuan wajib diisi.');
      return false;
    }

    if (trimmedCode && units.some((u) => u.id !== unitData.id && u.code.toUpperCase() === trimmedCode)) {
      showToast('error', 'Kode Duplikat', `Kode satuan "${trimmedCode}" sudah digunakan.`);
      return false;
    }

    try {
      if (unitData.id) {
        await updateDoc(
          doc(db, 'units', unitData.id),
          sanitizeFirestoreDoc({
            ...unitData,
            ...(trimmedCode ? { code: trimmedCode } : {}),
            ...(trimmedName ? { name: trimmedName } : {}),
            ...(trimmedSymbol ? { symbol: trimmedSymbol } : {}),
          })
        );
        showToast('success', 'Satuan Disimpan', `Satuan ${trimmedName || unitData.name} diperbarui di Cloud Firestore.`);
      } else {
        const id = 'unit-' + (trimmedCode.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || Date.now());
        const newU: MasterUnit = {
          id,
          code: trimmedCode,
          name: trimmedName,
          symbol: trimmedSymbol,
          description: unitData.description?.trim() || '',
          isActive: unitData.isActive !== false,
        };
        await setDoc(doc(db, 'units', id), sanitizeFirestoreDoc(newU));
        showToast('success', 'Satuan Ditambahkan', `Satuan ${newU.name} (${newU.symbol}) berhasil dibuat di Cloud Firestore.`);
      }
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: saveUnit]', err);
      const errMsg = err.code === 'permission-denied'
        ? 'Izin tidak mencukupi untuk menyimpan satuan. Diperlukan role ADMIN atau LOGISTIK aktif.'
        : err.message;
      showToast('error', 'Gagal Menyimpan Satuan', errMsg);
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
      await setDoc(doc(db, 'requestingUnits', id), sanitizeFirestoreDoc(newUnit));
      await logAudit('REQUESTING_UNIT_CREATED', 'Master Data', `Mendaftarkan Unit Pemohon baru: ${trimmedName} (${trimmedCode})`);
      showToast('success', 'Unit Pemohon Tersimpan', `Unit Pemohon ${trimmedName} (${trimmedCode}) berhasil ditambahkan ke Cloud Firestore.`);
      return { success: true, unit: newUnit };
    } catch (err: any) {
      console.error('[Firestore Error: addRequestingUnit]', err);
      const errMsg = err.code === 'permission-denied'
        ? 'Izin tidak mencukupi untuk menambah Unit Pemohon. Diperlukan role ADMIN atau LOGISTIK aktif.'
        : (err.message || 'Kesalahan saat menyimpan ke database.');
      showToast('error', 'Gagal Menambahkan Unit Pemohon', errMsg);
      return { success: false, message: errMsg };
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
      await updateDoc(doc(db, 'requestingUnits', id), sanitizeFirestoreDoc(merged));
      await logAudit('REQUESTING_UNIT_UPDATED', 'Master Data', `Memperbarui Unit Pemohon: ${trimmedName} (${trimmedCode})`);
      showToast('success', 'Perubahan Tersimpan', `Unit Pemohon ${trimmedName} berhasil diperbarui di Cloud Firestore.`);
      return { success: true };
    } catch (err: any) {
      console.error('[Firestore Error: updateRequestingUnit]', err);
      const errMsg = err.code === 'permission-denied'
        ? 'Izin tidak mencukupi untuk memperbarui Unit Pemohon. Diperlukan role ADMIN atau LOGISTIK aktif.'
        : (err.message || 'Kesalahan database.');
      showToast('error', 'Gagal Memperbarui Unit Pemohon', errMsg);
      return { success: false, message: errMsg };
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

    const trimmedCode = supData.code?.trim().toUpperCase() || '';
    const trimmedName = supData.name?.trim() || '';
    if (!supData.id && (!trimmedCode || !trimmedName)) {
      showToast('error', 'Validasi Gagal', 'Kode dan nama pemasok wajib diisi.');
      return false;
    }
    if (trimmedCode && suppliers.some((s) => s.id !== supData.id && s.code.toUpperCase() === trimmedCode)) {
      showToast('error', 'Kode Duplikat', `Kode pemasok "${trimmedCode}" sudah terdaftar.`);
      return false;
    }
    if (trimmedName && suppliers.some((s) => s.id !== supData.id && s.name.toLowerCase() === trimmedName.toLowerCase())) {
      showToast('error', 'Nama Duplikat', `Nama pemasok "${trimmedName}" sudah terdaftar.`);
      return false;
    }

    try {
      if (supData.id) {
        await updateDoc(
          doc(db, 'suppliers', supData.id),
          sanitizeFirestoreDoc({
            ...supData,
            ...(trimmedCode ? { code: trimmedCode } : {}),
            ...(trimmedName ? { name: trimmedName } : {}),
          })
        );
        showToast('success', 'Pemasok Disimpan', `Pemasok ${trimmedName || supData.name} berhasil diperbarui di Cloud Firestore.`);
      } else {
        const id = 'sup-' + (trimmedCode.toLowerCase().replace(/[^a-z0-9_-]/g, '-') || Date.now());
        const newSup: MasterSupplier = {
          id,
          code: trimmedCode,
          name: trimmedName,
          contactPerson: supData.contactPerson?.trim() || '-',
          phone: supData.phone?.trim() || '-',
          email: supData.email?.trim() || '-',
          address: supData.address?.trim() || '-',
          isActive: supData.isActive !== false,
        };
        await setDoc(doc(db, 'suppliers', id), sanitizeFirestoreDoc(newSup));
        showToast('success', 'Pemasok Ditambahkan', `Pemasok ${newSup.name} berhasil didaftarkan di Cloud Firestore.`);
      }
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: saveSupplier]', err);
      const errMsg = err.code === 'permission-denied'
        ? 'Izin tidak mencukupi untuk mengelola data pemasok. Diperlukan role ADMIN atau LOGISTIK aktif.'
        : err.message;
      showToast('error', 'Gagal Menyimpan Pemasok', errMsg);
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

  const makeUniqueId = (prefix: string): string => {
    const rand = Math.random().toString(36).slice(2, 7);
    return `${prefix}-${Date.now()}-${rand}`;
  };

  const nextSequentialDocNo = (existingNumbers: string[], prefix: string, baseStart: number): string => {
    let maxSeq = baseStart;
    for (const num of existingNumbers) {
      if (num && num.startsWith(prefix)) {
        const suffix = Number(num.slice(prefix.length));
        if (!Number.isNaN(suffix) && suffix > maxSeq) {
          maxSeq = suffix;
        }
      }
    }
    return `${prefix}${maxSeq + 1}`;
  };

  const findApprovalDocRefs = async (referenceId: string, approvalType?: string): Promise<DocumentReference[]> => {
    const matchedIds = new Set<string>();
    for (const a of approvals) {
      if (a.referenceId === referenceId && (!approvalType || a.type === approvalType)) {
        matchedIds.add(a.id);
      }
    }
    try {
      const snap = await getDocs(query(collection(db, 'approvals'), where('referenceId', '==', referenceId)));
      snap.forEach((d) => {
        const data = d.data() as ApprovalRequest;
        if (!approvalType || data.type === approvalType) {
          matchedIds.add(d.id);
        }
      });
    } catch (err) {
      console.warn('[findApprovalDocRefs] Fallback to local approval state:', err);
    }
    return Array.from(matchedIds).map((id) => doc(db, 'approvals', id));
  };

  const fetchLiveStockBalance = async (
    materialId: string,
    locationId: string,
    materialCode?: string
  ): Promise<number> => {
    if (!materialId || !locationId) return 0;
    try {
      const resolved = await resolveAuthoritativeBalanceDoc(db, materialId, locationId, materialCode);
      return resolved.availableStock;
    } catch (err) {
      console.warn('[fetchLiveStockBalance] Fallback to local cache:', err);
      const localBal = inventory.find(
        (b) =>
          (b.materialId === materialId ||
            b.itemId === materialId ||
            (Boolean(materialCode) && (b.materialCode === materialCode || b.itemCode === materialCode))) &&
          b.locationId === locationId
      );
      return localBal ? Number(localBal.availableStock) || 0 : 0;
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
    const material = materials.find(
      (m) => m.id === targetMatId || m.materialId === targetMatId || (data.itemCode && m.materialCode === data.itemCode)
    );
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

    const nextNumber = nextSequentialDocNo(
      goodsReceipts.map((r) => r.receiptNumber),
      'GR-2026-',
      1000 + goodsReceipts.length
    );
    const now = getJakartaTimestamp();
    const id = makeUniqueId('gr');

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
      // Resolve latest authoritative balance document directly from Firestore
      const resolvedBal = await resolveAuthoritativeBalanceDoc(
        db,
        material.id,
        location.id,
        material.materialCode
      );

      await runTransaction(db, async (transaction) => {
        // 1. Post authoritative movement and update inventory balance inside transaction
        await executeInventoryMovementInTransaction(
          transaction,
          db,
          {
            materialId: material.id,
            materialCode: material.materialCode,
            materialName: material.materialName,
            locationId: location.id,
            locationName: location.name,
            unit: material.unit,
            variantValue: material.variantValue || '',
            movementType: 'GOODS_RECEIPT',
            quantity: data.quantity,
            delta: data.quantity,
            sourceDocumentId: id,
            sourceDocumentType: 'goodsReceipts',
            idempotencyKey: generateIdempotencyKey('GR', id, material.id, location.id, 'GOODS_RECEIPT'),
            actorName: currentUser!.fullName,
            actorEmployeeId: currentUser!.employeeId,
            notes: `Penerimaan dari ${data.sourceSupplier} (Ref: ${data.referenceDocument || '-'})`,
            unitCost: material.unitCost,
            timestamp: now,
            materialFallback: material,
          },
          {
            customBalanceDocId: resolvedBal.balanceId,
          }
        );

        // 2. Set goodsReceipt document inside transaction
        const receiptDocRef = doc(db, 'goodsReceipts', id);
        transaction.set(receiptDocRef, sanitizeFirestoreDoc(newReceipt));
      });

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
    const material = materials.find((m) => m.id === targetMatId || m.materialId === targetMatId);
    if (!material || !material.isActive) {
      showToast('error', 'Material Tidak Valid', 'Material tidak aktif atau tidak ditemukan.');
      return false;
    }

    // Always read latest authoritative balance directly from Firestore (never rely solely on stale cache)
    const resolvedBal = await resolveAuthoritativeBalanceDoc(
      db,
      material.id,
      data.locationId,
      material.materialCode
    );
    const available = resolvedBal.availableStock;

    // Enforce pending Goods Issue reservation policy so aggregate pending requests never exceed available stock
    let pendingReservedQty = 0;
    try {
      const pendingSnap = await getDocs(
        query(collection(db, 'goodsIssues'), where('status', '==', 'PENDING_APPROVAL'))
      );
      const livePendingIssues: GoodsIssue[] = [];
      pendingSnap.forEach((d) => livePendingIssues.push({ ...(d.data() as GoodsIssue), id: d.id }));
      pendingReservedQty = getPendingGoodsIssueReservedQty(
        livePendingIssues,
        material.id,
        data.locationId,
        material.materialCode
      );
    } catch (err) {
      console.warn('[createGoodsIssue] Fallback pending reservation check to local state:', err);
      pendingReservedQty = getPendingGoodsIssueReservedQty(
        goodsIssues,
        material.id,
        data.locationId,
        material.materialCode
      );
    }
    const unreservedAvailable = calculateUnreservedAvailableStock(available, pendingReservedQty);

    // Rule 1: Stock must never become negative or allow aggregate pending requests > available stock
    if (available <= 0 || unreservedAvailable < data.requestedQuantity) {
      const detail =
        pendingReservedQty > 0
          ? `Stok fisik ${available} ${material.unit}, sudah tereservasi pending ${pendingReservedQty} ${material.unit}, sisa tersedia ${unreservedAvailable} ${material.unit}.`
          : `Stok otoritatif di lokasi hanya ${available} ${material.unit}.`;
      showToast(
        'error',
        'Stok / Reservasi Tidak Mencukupi',
        `${detail} Tidak dapat mengajukan pengeluaran ${data.requestedQuantity} ${material.unit}.`
      );
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
    const nextNumber = nextSequentialDocNo(
      goodsIssues.map((g) => g.issueNumber),
      'GI-2026-',
      800 + goodsIssues.length
    );
    const now = getJakartaTimestamp();
    const issueId = makeUniqueId('gi');
    const approvalId = makeUniqueId('app');

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
      const batch = writeBatch(db);
      batch.set(doc(db, 'goodsIssues', issueId), sanitizeFirestoreDoc(newIssue));
      batch.set(doc(db, 'approvals', approvalId), sanitizeFirestoreDoc(newApproval));
      await batch.commit();

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

    if (approvedQty <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas persetujuan harus lebih dari 0.');
      return false;
    }

    const issueRef = doc(db, 'goodsIssues', issueId);
    const now = getJakartaTimestamp();
    let issueNumberReported = issueId;
    let requestingUnitReported = '';
    let unitReported = '';
    let itemNameReported = '';

    try {
      // Pre-resolve authoritative balance doc & matching approval doc(s) from Firestore
      const preSnap = await getDoc(issueRef);
      if (!preSnap.exists()) {
        throw new Error('Dokumen pengeluaran barang tidak ditemukan.');
      }
      const preIssue = preSnap.data() as GoodsIssue;
      const targetLocId = preIssue.locationId || locations[0]?.id;
      const [resolvedBal, approvalRefs] = await Promise.all([
        resolveAuthoritativeBalanceDoc(db, preIssue.itemId, targetLocId, preIssue.itemCode),
        findApprovalDocRefs(issueId, 'BARANG_KELUAR'),
      ]);

      await runTransaction(db, async (transaction) => {
        // 1. READS FIRST: Read goods issue document inside transaction
        const issueSnap = await transaction.get(issueRef);
        if (!issueSnap.exists()) {
          throw new Error('Dokumen pengeluaran barang tidak ditemukan.');
        }

        const issue = issueSnap.data() as GoodsIssue;
        issueNumberReported = issue.issueNumber || issueId;
        requestingUnitReported = issue.requestingUnit || '';
        unitReported = issue.unit || 'Pcs';
        itemNameReported = issue.itemName || 'Material';

        if (issue.status === 'APPROVED') {
          throw new Error(`Pengeluaran ${issueNumberReported} sudah pernah disetujui sebelumnya.`);
        }
        if (issue.status === 'REJECTED') {
          throw new Error(`Pengeluaran ${issueNumberReported} sudah berstatus ditolak.`);
        }
        if (approvedQty > issue.requestedQuantity) {
          throw new Error(`Kuantitas persetujuan (${approvedQty}) tidak boleh melebihi permintaan (${issue.requestedQuantity}).`);
        }

        const issueLocId = issue.locationId || targetLocId;
        const targetLoc = locations.find((l) => l.id === issueLocId);

        // 2. Post movement inside transaction (strictly reads balance & movement idempotency first, verifies anti-negative stock)
        await executeInventoryMovementInTransaction(
          transaction,
          db,
          {
            materialId: issue.itemId,
            materialCode: issue.itemCode,
            materialName: issue.itemName,
            locationId: issueLocId,
            locationName: targetLoc?.name || issue.locationName || 'Gudang',
            unit: issue.unit,
            variantValue: issue.variantValue,
            movementType: 'GOODS_ISSUE',
            quantity: approvedQty,
            delta: -approvedQty,
            sourceDocumentId: issueId,
            sourceDocumentType: 'goodsIssues',
            idempotencyKey: generateIdempotencyKey('GI', issueId, issue.itemId, issueLocId, 'GOODS_ISSUE'),
            actorName: currentUser!.fullName,
            actorEmployeeId: currentUser!.employeeId,
            notes: `Pengeluaran ${issue.issueNumber} untuk ${issue.requestingUnit} (${issue.destination})`,
            timestamp: now,
          },
          {
            customBalanceDocId: resolvedBal.balanceId,
          }
        );

        // 3. WRITES: Authoritative update of goodsIssues doc
        transaction.update(issueRef, sanitizeFirestoreDoc({
          status: 'APPROVED',
          approvedQuantity: approvedQty,
          processedBy: currentUser!.fullName,
          approvedAt: now,
        }));

        // 4. Authoritative update of matching approval request doc(s)
        for (const appRef of approvalRefs) {
          transaction.update(appRef, sanitizeFirestoreDoc({
            status: 'APPROVED',
            actionBy: currentUser!.fullName,
            actionDate: now,
          }));
        }
      });

      await logAudit(
        'ISSUE_APPROVED',
        'Approval Center',
        `Menyetujui pengeluaran ${approvedQty} ${unitReported} ${itemNameReported} (${issueNumberReported}) untuk ${requestingUnitReported}`
      );
      showToast('success', 'Pengeluaran Disetujui', `Dokumen ${issueNumberReported} disetujui. Saldo terpotong.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: approveGoodsIssue]', err);
      showToast('error', 'Gagal Menyetujui Pengeluaran', err.message || 'Terjadi kesalahan transaksi.');
      return false;
    }
  };

  const rejectGoodsIssue = async (issueId: string, reason: string): Promise<boolean> => {
    const perm = can('APPROVE_TRANSACTIONS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const issueRef = doc(db, 'goodsIssues', issueId);
    const now = getJakartaTimestamp();
    try {
      const approvalRefs = await findApprovalDocRefs(issueId, 'BARANG_KELUAR');
      await runTransaction(db, async (transaction) => {
        const issueSnap = await transaction.get(issueRef);
        if (!issueSnap.exists()) {
          throw new Error('Dokumen pengeluaran barang tidak ditemukan.');
        }
        const issue = issueSnap.data() as GoodsIssue;
        if (issue.status !== 'PENDING_APPROVAL') {
          throw new Error(`Dokumen ${issue.issueNumber || issueId} sudah berstatus ${issue.status}.`);
        }

        transaction.update(issueRef, sanitizeFirestoreDoc({
          status: 'REJECTED',
          rejectionReason: reason,
          processedBy: currentUser!.fullName,
        }));

        for (const appRef of approvalRefs) {
          transaction.update(appRef, sanitizeFirestoreDoc({
            status: 'REJECTED',
            rejectionReason: reason,
            actionBy: currentUser!.fullName,
            actionDate: now,
          }));
        }
      });

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
  // STOCK TRANSFER (Cloud Firestore Transaction Authoritative)
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

    if (!data.originLocationId || !data.destinationLocationId) {
      showToast('error', 'Validasi Gagal', 'Pilih lokasi gudang asal dan gudang tujuan.');
      return false;
    }

    if (data.originLocationId === data.destinationLocationId) {
      showToast('error', 'Validasi Gagal', 'Lokasi asal dan tujuan tidak boleh sama.');
      return false;
    }

    const originLoc = locations.find((l) => l.id === data.originLocationId);
    if (!originLoc || !originLoc.isActive || originLoc.id === IN_TRANSIT_LOCATION_ID || originLoc.id === 'loc-in-transit') {
      showToast('error', 'Lokasi Asal Tidak Valid', 'Gudang asal tidak ditemukan, non-aktif, atau bukan gudang fisik.');
      return false;
    }

    const destLoc = locations.find((l) => l.id === data.destinationLocationId);
    if (!destLoc || !destLoc.isActive || destLoc.id === IN_TRANSIT_LOCATION_ID || destLoc.id === 'loc-in-transit') {
      showToast('error', 'Lokasi Tujuan Tidak Valid', 'Gudang tujuan tidak ditemukan, non-aktif, atau bukan gudang fisik.');
      return false;
    }

    const targetMatId = data.materialId || data.itemId;
    if (!targetMatId) {
      showToast('error', 'Validasi Gagal', 'Pilih material barang dari Master Data.');
      return false;
    }

    const material = materials.find(
      (m) => m.id === targetMatId || m.materialId === targetMatId || m.materialCode === targetMatId
    );
    if (!material || !material.isActive) {
      showToast('error', 'Material Tidak Valid', 'Material tidak ditemukan atau berstatus non-aktif.');
      return false;
    }

    const transferQty = Number(data.quantity);
    if (!Number.isFinite(transferQty) || transferQty <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas transfer harus berupa angka lebih dari 0.');
      return false;
    }

    // Read latest authoritative origin balance directly from Firestore (never rely solely on React state)
    const resolvedOrigin = await resolveAuthoritativeBalanceDoc(
      db,
      material.id,
      originLoc.id,
      material.materialCode
    );

    // Enforce pending Goods Issue reservation so transfer never cannibalizes reserved stock
    let pendingReservedQty = 0;
    try {
      const pendingSnap = await getDocs(
        query(collection(db, 'goodsIssues'), where('status', '==', 'PENDING_APPROVAL'))
      );
      const livePendingIssues: GoodsIssue[] = [];
      pendingSnap.forEach((d) => livePendingIssues.push({ ...(d.data() as GoodsIssue), id: d.id }));
      pendingReservedQty = getPendingGoodsIssueReservedQty(
        livePendingIssues,
        material.id,
        originLoc.id,
        material.materialCode
      );
    } catch (err) {
      console.warn('[createStockTransfer] Fallback pending reservation check to local state:', err);
      pendingReservedQty = getPendingGoodsIssueReservedQty(
        goodsIssues,
        material.id,
        originLoc.id,
        material.materialCode
      );
    }

    const unreservedAvailable = calculateUnreservedAvailableStock(
      resolvedOrigin.availableStock,
      pendingReservedQty
    );

    if (resolvedOrigin.availableStock <= 0 || unreservedAvailable < transferQty) {
      const detail =
        pendingReservedQty > 0
          ? `Stok fisik ${resolvedOrigin.availableStock} ${material.unit}, tereservasi pending GI ${pendingReservedQty} ${material.unit}, sisa bebas ${unreservedAvailable} ${material.unit}.`
          : `Saldo otoritatif ${material.materialName} di ${originLoc.name} saat ini adalah ${resolvedOrigin.availableStock} ${material.unit}.`;
      showToast(
        'error',
        'Stok / Reservasi Gudang Asal Tidak Cukup',
        `${detail} Tidak dapat mentransfer ${transferQty} ${material.unit}.`
      );
      return false;
    }

    const nextNumber = nextSequentialDocNo(
      stockTransfers.map((t) => t.transferNumber),
      'TR-2026-',
      200 + stockTransfers.length
    );
    const now = getJakartaTimestamp();
    const transferId = makeUniqueId('tr');

    const newTransfer: StockTransfer = {
      id: transferId,
      transferNumber: nextNumber,
      requestDate: now.split(' ')[0],
      originLocationId: originLoc.id,
      originLocationName: originLoc.name,
      destinationLocationId: destLoc.id,
      destinationLocationName: destLoc.name,
      itemId: material.id,
      itemCode: material.materialCode,
      itemName: material.materialName,
      variantValue: material.variantValue || '',
      quantity: transferQty,
      unit: material.unit,
      requestingUser: `${currentUser!.fullName} (${currentUser!.employeeId})`,
      requestingUnit: data.requestingUnit || '',
      requesterUnitId: data.requesterUnitId || '',
      sendingUser: `${currentUser!.fullName} (${currentUser!.employeeId})`,
      receivingUser: null,
      status: 'IN_TRANSIT',
      notes: data.notes?.trim() || '',
      createdAt: now,
      dispatchedAt: now,
    };

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Post TRANSFER_DISPATCH movement from source warehouse (delta: -transferQty)
        await executeInventoryMovementInTransaction(
          transaction,
          db,
          {
            materialId: material.id,
            materialCode: material.materialCode,
            materialName: material.materialName,
            locationId: originLoc.id,
            locationName: originLoc.name,
            unit: material.unit,
            variantValue: material.variantValue || '',
            movementType: 'TRANSFER_DISPATCH',
            quantity: transferQty,
            delta: -transferQty,
            sourceDocumentId: transferId,
            sourceDocumentType: 'stockTransfers',
            idempotencyKey: generateIdempotencyKey('TR_DISPATCH', transferId, material.id, originLoc.id, 'TRANSFER_DISPATCH'),
            actorName: currentUser!.fullName,
            actorEmployeeId: currentUser!.employeeId,
            notes: `Transfer keluar (${nextNumber}) ke ${destLoc.name}`,
            timestamp: now,
          },
          {
            customBalanceDocId: resolvedOrigin.balanceId,
          }
        );

        // 2. Post TRANSFER_DISPATCH movement into IN_TRANSIT logical bucket (delta: +transferQty)
        await executeInventoryMovementInTransaction(
          transaction,
          db,
          {
            materialId: material.id,
            materialCode: material.materialCode,
            materialName: material.materialName,
            locationId: IN_TRANSIT_LOCATION_ID,
            locationName: IN_TRANSIT_LOCATION_NAME,
            unit: material.unit,
            variantValue: material.variantValue || '',
            movementType: 'TRANSFER_DISPATCH',
            quantity: transferQty,
            delta: transferQty,
            sourceDocumentId: transferId,
            sourceDocumentType: 'stockTransfers',
            idempotencyKey: generateIdempotencyKey('TR_DISPATCH_TRANSIT', transferId, material.id, IN_TRANSIT_LOCATION_ID, 'TRANSFER_DISPATCH'),
            actorName: currentUser!.fullName,
            actorEmployeeId: currentUser!.employeeId,
            notes: `Barang dalam perjalanan (${nextNumber}) dari ${originLoc.name} ke ${destLoc.name}`,
            timestamp: now,
            materialFallback: material,
          }
        );

        // 3. Set transfer document inside transaction
        const transferDocRef = doc(db, 'stockTransfers', transferId);
        transaction.set(transferDocRef, sanitizeFirestoreDoc(newTransfer));
      });

      await logAudit(
        'TRANSFER_CREATED',
        'Transfer Stok',
        `Membuat transfer ${transferQty} ${material.unit} ${material.materialName} (${nextNumber}) dari ${newTransfer.originLocationName} ke ${newTransfer.destinationLocationName}. Stok gudang asal terpotong, tercatat di In-Transit.`
      );
      showToast('success', 'Transfer Diberangkatkan', `Nomor Transfer: ${nextNumber}. Status: In-Transit. Stok di ${originLoc.name} telah dipotong dan dipindahkan ke akun transit.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: createStockTransfer]', err);
      showToast('error', 'Gagal Membuat Transfer Stok', err.message || 'Terjadi kesalahan transaksi.');
      return false;
    }
  };

  const receiveStockTransfer = async (transferId: string, receiverNotes?: string): Promise<boolean> => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const transferRef = doc(db, 'stockTransfers', transferId);
    const now = getJakartaTimestamp();

    try {
      const preSnap = await getDoc(transferRef);
      if (!preSnap.exists()) {
        showToast('error', 'Tidak Ditemukan', 'Dokumen transfer stok tidak ditemukan.');
        return false;
      }
      const preTransfer = preSnap.data() as StockTransfer;
      const [resolvedDest, resolvedTransit] = await Promise.all([
        resolveAuthoritativeBalanceDoc(db, preTransfer.itemId, preTransfer.destinationLocationId, preTransfer.itemCode),
        resolveAuthoritativeBalanceDoc(db, preTransfer.itemId, IN_TRANSIT_LOCATION_ID, preTransfer.itemCode),
      ]);

      await runTransaction(db, async (transaction) => {
        const transferSnap = await transaction.get(transferRef);
        if (!transferSnap.exists()) {
          throw new Error('Dokumen transfer stok tidak ditemukan.');
        }

        const transfer = transferSnap.data() as StockTransfer;
        if (transfer.status !== 'IN_TRANSIT') {
          throw new Error(`Transfer ${transfer.transferNumber} sudah berstatus ${transfer.status} dan tidak dapat diterima ulang.`);
        }

        const material = materials.find((m) => m.id === transfer.itemId || m.materialCode === transfer.itemCode);

        // 1. Post TRANSFER_RECEIPT clearing IN_TRANSIT logical bucket (delta: -transfer.quantity)
        await executeInventoryMovementInTransaction(
          transaction,
          db,
          {
            materialId: transfer.itemId,
            materialCode: transfer.itemCode,
            materialName: transfer.itemName,
            locationId: IN_TRANSIT_LOCATION_ID,
            locationName: IN_TRANSIT_LOCATION_NAME,
            unit: transfer.unit,
            variantValue: transfer.variantValue || '',
            movementType: 'TRANSFER_RECEIPT',
            quantity: Number(transfer.quantity),
            delta: -Number(transfer.quantity),
            sourceDocumentId: transferId,
            sourceDocumentType: 'stockTransfers',
            idempotencyKey: generateIdempotencyKey('TR_RECEIPT_TRANSIT', transferId, transfer.itemId, IN_TRANSIT_LOCATION_ID, 'TRANSFER_RECEIPT'),
            actorName: currentUser!.fullName,
            actorEmployeeId: currentUser!.employeeId,
            notes: `Barang keluar dari transit (${transfer.transferNumber}) tiba di ${transfer.destinationLocationName}`,
            timestamp: now,
            materialFallback: material,
          },
          {
            customBalanceDocId: resolvedTransit.balanceId,
          }
        );

        // 2. Post TRANSFER_RECEIPT into destination warehouse (delta: +transfer.quantity)
        await executeInventoryMovementInTransaction(
          transaction,
          db,
          {
            materialId: transfer.itemId,
            materialCode: transfer.itemCode,
            materialName: transfer.itemName,
            locationId: transfer.destinationLocationId,
            locationName: transfer.destinationLocationName,
            unit: transfer.unit,
            variantValue: transfer.variantValue || '',
            movementType: 'TRANSFER_RECEIPT',
            quantity: Number(transfer.quantity),
            delta: Number(transfer.quantity),
            sourceDocumentId: transferId,
            sourceDocumentType: 'stockTransfers',
            idempotencyKey: generateIdempotencyKey('TR_RECEIPT', transferId, transfer.itemId, transfer.destinationLocationId, 'TRANSFER_RECEIPT'),
            actorName: currentUser!.fullName,
            actorEmployeeId: currentUser!.employeeId,
            notes: `Penerimaan transfer (${transfer.transferNumber}) dari ${transfer.originLocationName}`,
            timestamp: now,
            materialFallback: material,
          },
          {
            customBalanceDocId: resolvedDest.balanceId,
          }
        );

        // 3. Update transfer document to COMPLETED
        const updateData: Partial<StockTransfer> = {
          status: 'COMPLETED',
          receivingUser: `${currentUser!.fullName} (${currentUser!.employeeId})`,
          receivedAt: now,
        };
        if (receiverNotes?.trim()) {
          updateData.notes = transfer.notes ? `${transfer.notes} | Penerima: ${receiverNotes.trim()}` : receiverNotes.trim();
        }

        transaction.update(transferRef, sanitizeFirestoreDoc(updateData));
      });

      const updatedTr = stockTransfers.find((t) => t.id === transferId) || preTransfer;
      await logAudit(
        'TRANSFER_RECEIVED',
        'Transfer Stok',
        `Konfirmasi terima transfer ${updatedTr?.transferNumber || transferId} oleh ${currentUser!.fullName}. Stok berpindah dari In-Transit ke ${updatedTr?.destinationLocationName || 'Gudang Tujuan'}.`
      );

      showToast('success', 'Transfer Diterima (Selesai)', `Kuantitas telah ditambahkan ke saldo inventaris gudang tujuan dan dinolkan dari transit.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: receiveStockTransfer]', err);
      showToast('error', 'Gagal Mengonfirmasi Penerimaan Transfer', err.message || 'Terjadi kesalahan transaksi.');
      return false;
    }
  };

  const rejectStockTransfer = async (
    transferId: string,
    reason: string,
    disposition: TransferRejectionDisposition = 'RETURNED_TO_ORIGIN'
  ): Promise<boolean> => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    if (!reason?.trim()) {
      showToast('error', 'Validasi Gagal', 'Alasan penolakan / pembatalan transfer wajib diisi.');
      return false;
    }

    const transferRef = doc(db, 'stockTransfers', transferId);
    const now = getJakartaTimestamp();

    try {
      const preSnap = await getDoc(transferRef);
      if (!preSnap.exists()) {
        showToast('error', 'Tidak Ditemukan', 'Dokumen transfer stok tidak ditemukan di database.');
        return false;
      }
      const preTransfer = preSnap.data() as StockTransfer;
      const [resolvedOrigin, resolvedTransit] = await Promise.all([
        resolveAuthoritativeBalanceDoc(db, preTransfer.itemId, preTransfer.originLocationId, preTransfer.itemCode),
        resolveAuthoritativeBalanceDoc(db, preTransfer.itemId, IN_TRANSIT_LOCATION_ID, preTransfer.itemCode),
      ]);

      let loggedTransferNumber = transferId;
      let loggedOriginName = 'Gudang Asal';

      await runTransaction(db, async (transaction) => {
        // Step 1: Read transfer document
        const transferSnap = await transaction.get(transferRef);
        if (!transferSnap.exists()) {
          throw new Error('Dokumen transfer stok tidak ditemukan di database.');
        }

        const transfer = transferSnap.data() as StockTransfer;
        loggedTransferNumber = transfer.transferNumber || transferId;
        loggedOriginName = transfer.originLocationName || 'Gudang Asal';

        if (transfer.status !== 'IN_TRANSIT' && transfer.status !== 'PENDING') {
          throw new Error(`Transfer ini sudah berstatus ${transfer.status} dan tidak dapat diubah lagi.`);
        }

        const shouldRestoreToOrigin = disposition === 'RETURNED_TO_ORIGIN' || disposition === 'CANCELLED_BEFORE_DISPATCH';

        if (shouldRestoreToOrigin) {
          // 1. Deduct from IN_TRANSIT logical bucket (delta: -quantity)
          await executeInventoryMovementInTransaction(
            transaction,
            db,
            {
              materialId: transfer.itemId,
              materialCode: transfer.itemCode,
              materialName: transfer.itemName,
              locationId: IN_TRANSIT_LOCATION_ID,
              locationName: IN_TRANSIT_LOCATION_NAME,
              unit: transfer.unit,
              variantValue: transfer.variantValue || '',
              movementType: 'TRANSFER_RETURN',
              quantity: Number(transfer.quantity),
              delta: -Number(transfer.quantity),
              sourceDocumentId: transferId,
              sourceDocumentType: 'stockTransfers',
              idempotencyKey: generateIdempotencyKey('TR_RETURN_TRANSIT', transferId, transfer.itemId, IN_TRANSIT_LOCATION_ID, 'TRANSFER_RETURN'),
              actorName: currentUser!.fullName,
              actorEmployeeId: currentUser!.employeeId,
              notes: `Pembalikan transit (${transfer.transferNumber}) kembali ke gudang asal: ${reason}`,
              timestamp: now,
            },
            {
              customBalanceDocId: resolvedTransit.balanceId,
            }
          );

          // 2. Restore stock to origin warehouse (delta: +quantity)
          await executeInventoryMovementInTransaction(
            transaction,
            db,
            {
              materialId: transfer.itemId,
              materialCode: transfer.itemCode,
              materialName: transfer.itemName,
              locationId: transfer.originLocationId,
              locationName: transfer.originLocationName,
              unit: transfer.unit,
              variantValue: transfer.variantValue || '',
              movementType: 'TRANSFER_RETURN',
              quantity: Number(transfer.quantity),
              delta: Number(transfer.quantity),
              sourceDocumentId: transferId,
              sourceDocumentType: 'stockTransfers',
              idempotencyKey: generateIdempotencyKey('TR_RETURN', transferId, transfer.itemId, transfer.originLocationId, 'TRANSFER_RETURN'),
              actorName: currentUser!.fullName,
              actorEmployeeId: currentUser!.employeeId,
              notes: `Pemulihan transfer (${transfer.transferNumber}): ${reason}`,
              timestamp: now,
            },
            {
              customBalanceDocId: resolvedOrigin.balanceId,
            }
          );
        } else {
          // Compensating movement against IN_TRANSIT bucket (deduct transit quantity)
          const transitLossType = disposition === 'DAMAGED_IN_TRANSIT' ? 'TRANSFER_DAMAGE' : 'TRANSFER_LOSS';
          await executeInventoryMovementInTransaction(
            transaction,
            db,
            {
              materialId: transfer.itemId,
              materialCode: transfer.itemCode,
              materialName: transfer.itemName,
              locationId: IN_TRANSIT_LOCATION_ID,
              locationName: IN_TRANSIT_LOCATION_NAME,
              unit: transfer.unit,
              variantValue: transfer.variantValue || '',
              movementType: transitLossType,
              quantity: Number(transfer.quantity),
              delta: -Number(transfer.quantity),
              sourceDocumentId: transferId,
              sourceDocumentType: 'stockTransfers',
              idempotencyKey: generateIdempotencyKey(
                `TR_${disposition}_TRANSIT`,
                transferId,
                transfer.itemId,
                IN_TRANSIT_LOCATION_ID,
                transitLossType
              ),
              actorName: currentUser!.fullName,
              actorEmployeeId: currentUser!.employeeId,
              notes: `Penghapusan transit: Barang ${disposition === 'DAMAGED_IN_TRANSIT' ? 'rusak' : 'hilang'} di transit (${transfer.transferNumber}): ${reason}`,
              timestamp: now,
            },
            {
              customBalanceDocId: resolvedTransit.balanceId,
            }
          );
        }

        const newStatus = disposition === 'CANCELLED_BEFORE_DISPATCH' ? 'CANCELLED' : 'REJECTED';
        const dispositionLabels: Record<TransferRejectionDisposition, string> = {
          RETURNED_TO_ORIGIN: 'Barang Kembali ke Gudang Asal',
          DAMAGED_IN_TRANSIT: 'Barang Rusak di Transit (Write-Off)',
          LOST_IN_TRANSIT: 'Barang Hilang di Transit (Write-Off)',
          CANCELLED_BEFORE_DISPATCH: 'Dibatalkan Sebelum Dispatch',
        };

        const notesSuffix = `[${dispositionLabels[disposition]}] ${reason.trim()}`;

        transaction.update(transferRef, sanitizeFirestoreDoc({
          status: newStatus,
          rejectionDisposition: disposition,
          rejectionReason: reason.trim(),
          receivingUser: `${currentUser!.fullName} (${currentUser!.employeeId}) [${disposition}]`,
          receivedAt: now,
          notes: transfer.notes ? `${transfer.notes} | ${notesSuffix}` : notesSuffix,
        }));
      });

      const stockMovementSummary =
        disposition === 'RETURNED_TO_ORIGIN' || disposition === 'CANCELLED_BEFORE_DISPATCH'
          ? `Stok dipulihkan ke gudang asal (${loggedOriginName}).`
          : `Stok TIDAK dipulihkan ke gudang asal (Disposisi: ${disposition} / Kerugian transit dicatat).`;

      await logAudit(
        'TRANSFER_REJECTED',
        'Transfer Stok',
        `Transfer ${loggedTransferNumber} ditolak/dibatalkan oleh ${currentUser!.fullName}. Disposisi: ${disposition}. ${stockMovementSummary} Alasan: ${reason.trim()}`
      );

      showToast(
        'warning',
        'Status Transfer Diperbarui',
        `${stockMovementSummary}`
      );
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: rejectStockTransfer]', err);
      showToast('error', 'Gagal Memproses Penolakan Transfer', err.message || 'Terjadi kesalahan transaksi.');
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

    if (data.physicalQuantity === undefined || data.physicalQuantity === null || Number(data.physicalQuantity) < 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas fisik tidak boleh bernilai negatif.');
      return false;
    }

    const targetMatId = data.materialId || data.itemId;
    if (!targetMatId) {
      showToast('error', 'Validasi Gagal', 'Material barang wajib dipilih.');
      return false;
    }

    const material = materials.find(
      (m) => m.id === targetMatId || m.materialId === targetMatId || m.materialCode === targetMatId
    );
    if (!material || !material.isActive) {
      showToast('error', 'Material Tidak Valid', 'Material tidak ditemukan atau berstatus non-aktif pada Master Data.');
      return false;
    }

    const location = locations.find((l) => l.id === data.locationId);
    if (!location || !location.isActive) {
      showToast('error', 'Lokasi Tidak Valid', 'Lokasi gudang tidak ditemukan atau berstatus non-aktif pada Master Data.');
      return false;
    }

    // Retrieve latest authoritative stock balance directly from Firestore
    const resolvedBal = await resolveAuthoritativeBalanceDoc(
      db,
      material.id,
      location.id,
      material.materialCode
    );
    const systemQty = resolvedBal.availableStock;
    const physQty = Number(data.physicalQuantity);
    const variance = physQty - systemQty;

    if (variance !== 0 && !data.varianceReason?.trim()) {
      showToast('error', 'Validasi Gagal', 'Alasan selisih wajib diisi jika terdapat perbedaan antara fisik dan saldo sistem.');
      return false;
    }

    const nextNumber = nextSequentialDocNo(
      stockOpnames.map((o) => o.opnameNumber),
      'SO-2026-',
      40 + stockOpnames.length
    );
    const now = getJakartaTimestamp();
    const opnameId = makeUniqueId('so');
    const approvalId = makeUniqueId('app');

    const newOpname: StockOpname = {
      id: opnameId,
      opnameNumber: nextNumber,
      opnameDate: now.split(' ')[0],
      locationId: location.id,
      locationName: location.name,
      itemId: material.id,
      itemCode: material.materialCode,
      itemName: material.materialName,
      variantValue: material.variantValue || '',
      unit: material.unit,
      systemQuantity: systemQty,
      physicalQuantity: physQty,
      variance,
      varianceReason: data.varianceReason?.trim() || 'Pemeriksaan fisik sesuai saldo sistem',
      verificationStatus: 'PENDING_APPROVAL',
      conductedBy: `${currentUser!.fullName} (${currentUser!.employeeId})`,
      notes: data.notes?.trim() || '',
      createdAt: now,
      // Concurrency & snapshot fields for cutoff
      countStartedAt: now,
      countCompletedAt: now,
      countCompletedTimestampMs: Date.now(),
      systemBalanceAtCount: systemQty,
      lastMovementAtCount: resolvedBal.data?.lastMovementId || '',
      countVersion: resolvedBal.data?.version || 1,
    };

    const newApproval: ApprovalRequest = {
      id: approvalId,
      type: 'STOCK_OPNAME_ADJUSTMENT',
      referenceId: newOpname.id,
      referenceNumber: nextNumber,
      title: `Penyesuaian Opname ${material.materialName} (${variance >= 0 ? '+' : ''}${variance} ${material.unit})`,
      requestingUser: currentUser!.fullName,
      requestingEmployeeId: currentUser!.employeeId,
      location: location.name,
      submissionDate: now,
      details: {
        itemCode: material.materialCode,
        itemName: material.materialName,
        quantity: Math.abs(variance),
        unit: material.unit,
        reasonOrPurpose: data.varianceReason?.trim() || 'Hasil pemeriksaan fisik opname',
        systemQuantity: systemQty,
        physicalQuantity: physQty,
        variance,
        variantValue: material.variantValue || '',
      },
      status: 'PENDING',
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'stockOpnames', opnameId), sanitizeFirestoreDoc(newOpname));
      batch.set(doc(db, 'approvals', approvalId), sanitizeFirestoreDoc(newApproval));
      await batch.commit();

      await logAudit(
        'OPNAME_RECORDED',
        'Stock Opname',
        `Pencatatan opname ${nextNumber}: Sistem ${systemQty}, Fisik ${physQty}, Selisih ${variance} ${material.unit} di ${location.name}. Menunggu persetujuan Administrator.`
      );

      showToast(
        'warning',
        'Stock Opname Tercatat',
        `Nomor ${nextNumber} disimpan dengan status Menunggu Persetujuan. Saldo inventaris belum berubah sebelum disetujui Admin.`
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
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Administrator yang berwenang menyetujui penyesuaian stock opname.');
      return false;
    }

    const opnameRef = doc(db, 'stockOpnames', opnameId);
    const now = getJakartaTimestamp();

    try {
      const preOpnameSnap = await getDoc(opnameRef);
      if (!preOpnameSnap.exists()) {
        showToast('error', 'Tidak Ditemukan', 'Data Stock Opname tidak ditemukan di database.');
        return false;
      }
      const preOpname = preOpnameSnap.data() as StockOpname;
      const [balDoc, approvalRefs] = await Promise.all([
        resolveAuthoritativeBalanceDoc(db, preOpname.itemId, preOpname.locationId, preOpname.itemCode),
        findApprovalDocRefs(opnameId, 'STOCK_OPNAME_ADJUSTMENT'),
      ]);

      let finalOpnameNumber = preOpname.opnameNumber || opnameId;
      let finalPhysQty = preOpname.physicalQuantity;
      let finalUnit = preOpname.unit || 'Pcs';

      await runTransaction(db, async (transaction) => {
        // 1. ALL READS FIRST: Read opname document
        const opnameSnap = await transaction.get(opnameRef);
        if (!opnameSnap.exists()) {
          throw new Error('Data Stock Opname tidak ditemukan di database.');
        }

        const opname = opnameSnap.data() as StockOpname;
        finalOpnameNumber = opname.opnameNumber || opnameId;
        finalPhysQty = opname.physicalQuantity;
        finalUnit = opname.unit || 'Pcs';

        if (opname.verificationStatus === 'ADJUSTED') {
          throw new Error(`Stock Opname ${opname.opnameNumber} sudah pernah disetujui sebelumnya.`);
        }
        if (opname.verificationStatus === 'REJECTED') {
          throw new Error(`Stock Opname ${opname.opnameNumber} sudah berstatus ditolak.`);
        }

        // 2. Read authoritative balance document inside transaction
        const balId = balDoc.balanceId;
        const balRef = doc(db, 'inventory', balId);
        const balSnap = await transaction.get(balRef);

        const currentAvailable = balSnap.exists()
          ? Number(balSnap.data().availableStock) || 0
          : 0;

        // Cutoff protection logic:
        const systemBalanceAtCount = opname.systemBalanceAtCount !== undefined
          ? Number(opname.systemBalanceAtCount)
          : Number(opname.systemQuantity) || 0;
        const physicalQuantity = Number(opname.physicalQuantity) || 0;

        // Variance detected at count time:
        const cutoffVariance = physicalQuantity - systemBalanceAtCount;

        // Any intervening post-count movements between count time and approval:
        const interveningDelta = currentAvailable - systemBalanceAtCount;

        // Preserve all post-count movements by applying the true cutoff variance as the adjustment delta:
        const adjustmentDelta = cutoffVariance;
        const targetBalance = currentAvailable + adjustmentDelta;

        if (targetBalance < 0) {
          throw new Error(
            `INSUFFICIENT_STOCK: Penyesuaian opname sebesar ${adjustmentDelta} menghasilkan saldo akhir negatif (${targetBalance}). Periksa kembali mutasi pasca-opname.`
          );
        }

        // 3a. ALL READS MUST COMPLETE BEFORE ANY WRITES IN FIRESTORE TRANSACTIONS
        const isTransitLocation = opname.locationId === IN_TRANSIT_LOCATION_ID || opname.locationId === 'loc-in-transit';
        const existingActiveBaseline = inventoryBaselines.find(
          (b) =>
            b.status === 'ACTIVE' &&
            b.locationId === opname.locationId &&
            (b.materialId === opname.itemId || (opname.itemCode && b.materialCode === opname.itemCode))
        );
        const canonicalBaseId =
          !isTransitLocation && !existingActiveBaseline
            ? getCanonicalBaselineId(opname.itemId, opname.locationId, 1)
            : '';
        const baseRef = canonicalBaseId ? doc(db, 'inventoryBaselines', canonicalBaseId) : null;
        const baseSnap = baseRef ? await transaction.get(baseRef) : null;

        const material = materials.find((m) => m.id === opname.itemId || m.materialCode === opname.itemCode);
        const locationObj = locations.find((l) => l.id === opname.locationId);

        // 3b. Post STOCK_OPNAME_ADJUSTMENT movement inside transaction (note: performs its own reads before writes)
        let movRes: any = { movementId: '' };
        if (adjustmentDelta !== 0) {
          movRes = await executeInventoryMovementInTransaction(
            transaction,
            db,
            {
              materialId: opname.itemId,
              materialCode: opname.itemCode,
              materialName: opname.itemName,
              locationId: opname.locationId,
              locationName: opname.locationName,
              unit: opname.unit,
              variantValue: opname.variantValue || '',
              movementType: 'STOCK_OPNAME_ADJUSTMENT',
              quantity: Math.abs(adjustmentDelta),
              delta: adjustmentDelta,
              sourceDocumentId: opnameId,
              sourceDocumentType: 'stockOpnames',
              idempotencyKey: generateIdempotencyKey('SO_ADJUST', opnameId, opname.itemId, opname.locationId, 'STOCK_OPNAME_ADJUSTMENT'),
              actorName: currentUser!.fullName,
              actorEmployeeId: currentUser!.employeeId,
              notes: `Penyesuaian Fisik Opname ${opname.opnameNumber}: Fisik ${physicalQuantity}, Sistem saat hitung ${systemBalanceAtCount}, Selisih Cutoff ${cutoffVariance > 0 ? '+' : ''}${cutoffVariance}${interveningDelta !== 0 ? ` (Terdapat mutasi post-count ${interveningDelta > 0 ? '+' : ''}${interveningDelta})` : ''}`,
              timestamp: now,
              materialFallback: material,
            },
            {
              customBalanceDocId: balId,
            }
          );
        }

        // 3c. PHYSICAL BASELINE ANCHOR INTEGRATION (First approved Opname sets v1 baseline; subsequent Opnames adjust only)
        const cutoffAt = opname.countCompletedAt || opname.createdAt || now;
        const cutoffTsMs =
          opname.countCompletedTimestampMs ||
          parseJakartaTimestampMs(cutoffAt) ||
          Date.now();
        let establishedBaselineId = '';

        if (!isTransitLocation && baseRef && baseSnap && !baseSnap.exists() && !existingActiveBaseline) {
          const newBaseline: InventoryBaseline = {
            id: canonicalBaseId,
            baselineId: canonicalBaseId,
            materialId: opname.itemId,
            materialCode: opname.itemCode,
            materialName: opname.itemName,
            locationId: opname.locationId,
            locationName: opname.locationName,
            baselineQuantity: physicalQuantity, // explicitly counted physical quantity (>= 0, including valid explicit zero)
            unit: opname.unit || 'Pcs',
            stockOpnameId: opnameId,
            stockOpnameNumber: opname.opnameNumber,
            sourceMovementId: movRes.movementId || '',
            countStartedAt: opname.countStartedAt || opname.createdAt,
            countCompletedAt: cutoffAt,
            countCompletedTimestampMs: cutoffTsMs,
            cutoffDate: cutoffAt.slice(0, 10),
            approvedAt: now,
            approvedBy: currentUser!.fullName,
            approvedByEmployeeId: currentUser!.employeeId,
            baselineVersion: 1,
            status: 'ACTIVE',
            createdAt: now,
            createdBy: currentUser!.fullName,
            notes: `Baseline fisik perdana ditetapkan melalui Stock Opname ${opname.opnameNumber}`,
          };
          transaction.set(baseRef, sanitizeFirestoreDoc(newBaseline));
          establishedBaselineId = canonicalBaseId;
        }

        // 4. Update opname & baseline metadata on balance document (create if missing & zero-variance)
        const balancePatch: any = {
          lastOpnameDate: opname.opnameDate || now.split(' ')[0],
          lastOpnameNumber: opname.opnameNumber,
          lastOpnameVariance: cutoffVariance,
        };

        if (establishedBaselineId) {
          balancePatch.openingStock = physicalQuantity;
          balancePatch.baselineQuantity = physicalQuantity;
          balancePatch.baselineStockOpnameId = opnameId;
          balancePatch.baselineStockOpnameNumber = opname.opnameNumber;
          balancePatch.baselineCutoffAt = cutoffAt;
          balancePatch.baselineCutoffTimestampMs = cutoffTsMs;
          balancePatch.baselineApprovedAt = now;
          balancePatch.baselineApprovedBy = currentUser!.fullName;
          balancePatch.baselineStatus = 'VERIFIED';
          balancePatch.hasVerifiedBaseline = true;
        }

        if (!balSnap.exists() && adjustmentDelta === 0) {
          const initialBalDoc: InventoryBalance = {
            id: balId,
            materialId: opname.itemId,
            itemId: opname.itemId,
            materialCode: opname.itemCode,
            itemCode: opname.itemCode,
            materialName: opname.itemName,
            itemName: opname.itemName,
            categoryId: material?.categoryId || 'cat-gen',
            categoryName: material?.categoryName || 'General',
            unit: opname.unit || material?.unit || 'Pcs',
            locationId: opname.locationId,
            locationName: opname.locationName || locationObj?.name || '',
            variantValue: opname.variantValue || '',
            openingStock: physicalQuantity,
            qtyIn: 0,
            qtyOut: 0,
            totalAdjustments: 0,
            availableStock: targetBalance,
            minimumStock: material?.minimumStock || 0,
            reorderPoint: material?.reorderPoint || 0,
            lastTransactionDate: now.split(' ')[0],
            unitCost: material?.unitCost ?? material?.unitPrice ?? 0,
            version: 1,
            updatedAt: now,
            updatedBy: currentUser!.fullName,
            ...balancePatch,
          };
          transaction.set(balRef, sanitizeFirestoreDoc(initialBalDoc));
        } else {
          transaction.update(balRef, sanitizeFirestoreDoc(balancePatch));
        }

        // 5. Authoritative update of stockOpnames
        transaction.update(opnameRef, sanitizeFirestoreDoc({
          verificationStatus: 'ADJUSTED',
          verifiedBy: `${currentUser!.fullName} (${currentUser!.employeeId})`,
          adjustedAt: now,
          adjustedBalance: targetBalance,
          adjustmentDelta,
          interveningMovementsCount: interveningDelta !== 0 ? 1 : 0,
          adjustmentMovementId: movRes.movementId || '',
          isBaselineAnchor: Boolean(establishedBaselineId),
          establishedBaselineId: establishedBaselineId || undefined,
        }));

        // 6. Authoritative update of all matching approvals
        for (const appRef of approvalRefs) {
          transaction.update(appRef, sanitizeFirestoreDoc({
            status: 'APPROVED',
            actionBy: currentUser!.fullName,
            actionDate: now,
          }));
        }
      });

      await logAudit(
        'OPNAME_ADJUSTMENT_POSTED',
        'Stock Opname',
        `Administrator ${currentUser!.fullName} (${currentUser!.employeeId}) menyetujui penyesuaian opname ${finalOpnameNumber}. Saldo disesuaikan menjadi ${finalPhysQty} ${finalUnit}.`
      );

      showToast(
        'success',
        'Penyesuaian Berhasil',
        `Saldo inventaris telah diperbarui menjadi kuantitas fisik hasil opname.`
      );
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: approveOpnameAdjustment]', err);
      showToast('error', 'Gagal Memproses Adjustment Opname', err.message || 'Terjadi kesalahan transaksi.');
      return false;
    }
  };

  const rejectOpnameAdjustment = async (opnameId: string, reason: string): Promise<boolean> => {
    const perm = can('ADJUST_STOCK');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const opnameRef = doc(db, 'stockOpnames', opnameId);
    const now = getJakartaTimestamp();

    try {
      const approvalRefs = await findApprovalDocRefs(opnameId, 'STOCK_OPNAME_ADJUSTMENT');

      await runTransaction(db, async (transaction) => {
        const opnameSnap = await transaction.get(opnameRef);
        if (!opnameSnap.exists()) {
          throw new Error('Data Stock Opname tidak ditemukan.');
        }

        const opname = opnameSnap.data() as StockOpname;
        if (opname.verificationStatus === 'ADJUSTED') {
          throw new Error(`Stock Opname ${opname.opnameNumber} sudah pernah disetujui dan tidak dapat ditolak.`);
        }
        if (opname.verificationStatus === 'REJECTED') {
          throw new Error(`Stock Opname ${opname.opnameNumber} sudah berstatus ditolak.`);
        }

        transaction.update(opnameRef, sanitizeFirestoreDoc({
          verificationStatus: 'REJECTED',
          notes: (opname.notes ? opname.notes + ' | ' : '') + `Ditolak Admin: ${reason.trim()}`,
        }));

        for (const appRef of approvalRefs) {
          transaction.update(appRef, sanitizeFirestoreDoc({
            status: 'REJECTED',
            rejectionReason: reason.trim(),
            actionBy: currentUser!.fullName,
            actionDate: now,
          }));
        }
      });

      await logAudit(
        'OPNAME_ADJUSTMENT_REJECTED',
        'Stock Opname',
        `Administrator ${currentUser!.fullName} menolak penyesuaian opname ${opnameId}. Alasan: ${reason}`
      );
      showToast('warning', 'Adjustment Ditolak', `Penyesuaian opname telah ditolak.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: rejectOpnameAdjustment]', err);
      showToast('error', 'Gagal Menolak Adjustment Opname', err.message || 'Terjadi kesalahan transaksi.');
      return false;
    }
  };

  // Controlled manual reconciliation: NEVER auto-executed on startup/page load
  const reconcileOpnameBaselines = async (
    balanceIds?: string[]
  ): Promise<{
    success: boolean;
    createdCount: number;
    skippedCount: number;
    errors: string[];
  }> => {
    const perm = can('ADJUST_STOCK');
    if (!perm.allowed) {
      const msg = perm.reason || 'Hanya Administrator yang berwenang melakukan rekonsiliasi baseline resmi.';
      showToast('error', 'Akses Ditolak', msg);
      return { success: false, createdCount: 0, skippedCount: 0, errors: [msg] };
    }

    const plan = buildControlledBaselineReconciliationPlan({
      inventory,
      stockOpnames,
      existingBaselines: inventoryBaselines,
      actorName: currentUser!.fullName,
      actorEmployeeId: currentUser!.employeeId,
      targetBalanceIds: balanceIds,
    });

    let createdCount = 0;
    let skippedCount = plan.skipped.length;
    const errors: string[] = [];

    for (const planItem of plan.items) {
      const baseRef = doc(db, 'inventoryBaselines', planItem.newBaseline.baselineId);
      const balRef = doc(db, 'inventory', planItem.balanceId);
      const opnameRef = doc(db, 'stockOpnames', planItem.newBaseline.stockOpnameId);

      try {
        await runTransaction(db, async (transaction) => {
          const [baseSnap, balSnap, opnameSnap] = await Promise.all([
            transaction.get(baseRef),
            transaction.get(balRef),
            transaction.get(opnameRef),
          ]);

          if (baseSnap.exists()) {
            throw new Error(`Baseline ${planItem.newBaseline.baselineId} sudah ada di Firestore.`);
          }
          if (!opnameSnap.exists()) {
            throw new Error(`Stock Opname ${planItem.newBaseline.stockOpnameNumber} tidak ditemukan.`);
          }
          const opData = opnameSnap.data() as StockOpname;
          if (opData.verificationStatus !== 'ADJUSTED') {
            throw new Error(`Stock Opname ${planItem.newBaseline.stockOpnameNumber} belum berstatus ADJUSTED.`);
          }

          transaction.set(baseRef, sanitizeFirestoreDoc(planItem.newBaseline));

          if (balSnap.exists()) {
            transaction.update(balRef, sanitizeFirestoreDoc({
              openingStock: planItem.newBaseline.baselineQuantity,
              baselineQuantity: planItem.newBaseline.baselineQuantity,
              baselineStockOpnameId: planItem.newBaseline.stockOpnameId,
              baselineStockOpnameNumber: planItem.newBaseline.stockOpnameNumber,
              baselineCutoffAt: planItem.newBaseline.countCompletedAt,
              baselineCutoffTimestampMs: planItem.newBaseline.countCompletedTimestampMs,
              baselineApprovedAt: planItem.newBaseline.approvedAt,
              baselineApprovedBy: planItem.newBaseline.approvedBy,
              baselineStatus: 'VERIFIED',
              hasVerifiedBaseline: true,
            }));
          }

          transaction.update(opnameRef, sanitizeFirestoreDoc({
            isBaselineAnchor: true,
            establishedBaselineId: planItem.newBaseline.baselineId,
          }));
        });
        createdCount++;
      } catch (err: any) {
        errors.push(`${planItem.materialCode} @ ${planItem.locationName}: ${err.message || 'Gagal rekonsiliasi'}`);
      }
    }

    if (createdCount > 0) {
      await logAudit(
        'BASELINE_RECONCILIATION_APPLIED',
        'Posisi Persediaan',
        `Administrator ${currentUser!.fullName} menetapkan ${createdCount} baseline Stock Opname resmi secara terkontrol (${skippedCount} dilewati).`
      );
      showToast(
        'success',
        'Rekonsiliasi Baseline Selesai',
        `${createdCount} baseline fisik v1 berhasil ditetapkan tanpa mengubah histori transaksi.`
      );
    } else if (errors.length > 0) {
      showToast('error', 'Rekonsiliasi Gagal', errors[0]);
    } else {
      showToast('info', 'Tidak Ada Kandidat Baru', 'Seluruh item sudah memiliki baseline aktif atau belum memiliki Stock Opname disetujui.');
    }

    return {
      success: errors.length === 0,
      createdCount,
      skippedCount,
      errors,
    };
  };

  // ----------------------------------------------------
  // CONSUMPTION (TISSUE & PLASTIK PEMAKAIAN HARIAN/SHIFT)
  // ----------------------------------------------------
  const recordConsumption = async (recordData: Omit<ConsumptionRecord, 'id' | 'createdAt'>): Promise<boolean> => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const qty = Number(recordData.quantityUsed);
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas pemakaian harus berupa angka lebih dari 0.');
      return false;
    }

    if (
      !recordData.locationId ||
      recordData.locationId === IN_TRANSIT_LOCATION_ID ||
      recordData.locationId === 'loc-in-transit'
    ) {
      showToast('error', 'Lokasi Tidak Valid', 'Lokasi konsumsi harus berupa gudang/area fisik yang valid.');
      return false;
    }

    const location = locations.find((l) => l.id === recordData.locationId && l.isActive !== false);
    if (!location) {
      showToast('error', 'Lokasi Tidak Valid', 'Lokasi gudang tidak aktif atau tidak ditemukan.');
      return false;
    }

    const material = materials.find(
      (m) => (m.id === recordData.materialId || m.materialCode === recordData.materialCode) && m.isActive !== false
    );
    if (!material) {
      showToast('error', 'Material Tidak Valid', 'Material tidak aktif atau tidak ditemukan.');
      return false;
    }

    const now = getJakartaTimestamp();
    const consId = makeUniqueId('cons');
    const newRecord: ConsumptionRecord = {
      ...recordData,
      quantityUsed: qty,
      locationId: location.id,
      locationName: location.name,
      materialId: material.id,
      materialCode: material.materialCode,
      materialName: material.materialName,
      unit: material.unit,
      id: consId,
      createdAt: now,
    };

    try {
      const resolvedBal = await resolveAuthoritativeBalanceDoc(
        db,
        material.id,
        location.id,
        material.materialCode
      );

      let pendingReservedQty = 0;
      try {
        const pendingSnap = await getDocs(
          query(collection(db, 'goodsIssues'), where('status', '==', 'PENDING_APPROVAL'))
        );
        const livePendingIssues: GoodsIssue[] = [];
        pendingSnap.forEach((d) => livePendingIssues.push({ ...(d.data() as GoodsIssue), id: d.id }));
        pendingReservedQty = getPendingGoodsIssueReservedQty(
          livePendingIssues,
          material.id,
          location.id,
          material.materialCode
        );
      } catch {
        pendingReservedQty = getPendingGoodsIssueReservedQty(
          goodsIssues,
          material.id,
          location.id,
          material.materialCode
        );
      }

      const unreservedAvailable = calculateUnreservedAvailableStock(
        resolvedBal.availableStock,
        pendingReservedQty
      );
      if (resolvedBal.availableStock <= 0 || unreservedAvailable < qty) {
        showToast(
          'error',
          'Stok / Reservasi Tidak Mencukupi',
          `Stok fisik ${resolvedBal.availableStock} ${material.unit}${pendingReservedQty > 0 ? `, tereservasi GI pending ${pendingReservedQty} ${material.unit}, sisa bebas ${unreservedAvailable} ${material.unit}` : ''}. Tidak dapat mencatat konsumsi ${qty} ${material.unit}.`
        );
        return false;
      }

      await runTransaction(db, async (transaction) => {
        await executeInventoryMovementInTransaction(
          transaction,
          db,
          {
            materialId: material.id,
            materialCode: material.materialCode,
            materialName: material.materialName,
            locationId: location.id,
            locationName: location.name,
            unit: material.unit,
            variantValue: material.variantValue || '',
            movementType: 'DAILY_CONSUMPTION',
            quantity: qty,
            delta: -qty,
            sourceDocumentId: consId,
            sourceDocumentType: 'consumptions',
            idempotencyKey: generateIdempotencyKey('CONS', consId, material.id, location.id, 'DAILY_CONSUMPTION'),
            actorName: currentUser!.fullName,
            actorEmployeeId: currentUser!.employeeId,
            notes: `Pemakaian operasional ${recordData.areaOrToilet} (${recordData.shift})`,
            timestamp: now,
          },
          {
            customBalanceDocId: resolvedBal.balanceId,
          }
        );

        const consDocRef = doc(db, 'consumptions', consId);
        transaction.set(consDocRef, sanitizeFirestoreDoc(newRecord));
      });

      await logAudit(
        'CONSUMPTION_RECORDED',
        'Posisi Persediaan',
        `Pencatatan konsumsi ${qty} ${material.unit} ${material.materialName} di ${recordData.areaOrToilet} (${location.name})`
      );
      showToast('success', 'Pemakaian Tercatat', `Pemakaian ${material.materialName} telah dicatat dan stok dipotong.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: recordConsumption]', err);
      showToast('error', 'Gagal Mencatat Pemakaian', err.message || 'Terjadi kesalahan transaksi.');
      return false;
    }
  };

  // ----------------------------------------------------
  // MORGAN TROLLEY (Cloud Firestore Authoritative)
  // ----------------------------------------------------
  const saveMorganTrolley = async (data: Partial<MorganTrolleyRecord>): Promise<boolean> => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const qty = Number(data.quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast('error', 'Validasi Gagal', 'Jumlah unit Morgan Trolley harus lebih dari 0.');
      return false;
    }

    const locId = data.locationId || '';
    const loc = locations.find(
      (l) => l.id === locId && l.isActive !== false && l.id !== IN_TRANSIT_LOCATION_ID && l.id !== 'loc-in-transit'
    );
    if (!loc) {
      showToast('error', 'Lokasi Tidak Valid', 'Pilih lokasi terminal/gudang yang aktif.');
      return false;
    }

    const area = (data.area || '').trim();
    const placement = (data.placement || '').trim();
    if (!area || !placement) {
      showToast('error', 'Validasi Gagal', 'Zona/Area dan Titik Standby wajib diisi.');
      return false;
    }

    const now = getJakartaTimestamp();

    try {
      if (data.id) {
        const updatePayload: Partial<MorganTrolleyRecord> = {
          quantity: qty,
          locationId: loc.id,
          locationName: loc.name,
          area,
          placement,
          condition: data.condition || 'Baik (Good)',
          personInCharge: (data.personInCharge || currentUser?.fullName || 'Petugas').trim(),
          lastCheckDate: data.lastCheckDate || now.slice(0, 10),
          notes: (data.notes || '').trim(),
          updatedAt: now,
          updatedBy: currentUser!.fullName,
        };
        await updateDoc(doc(db, 'morganTrolleys', data.id), sanitizeFirestoreDoc(updatePayload));
        await logAudit(
          'MORGAN_TROLLEY_UPDATED',
          'Morgan Trolley',
          `Memperbarui data trolley ${area} @ ${loc.name} (${qty} unit)`
        );
        showToast('success', 'Data Trolley Disimpan', 'Pembaruan Morgan Trolley berhasil disimpan ke Cloud Firestore.');
      } else {
        const id = makeUniqueId('mtr');
        const newT: MorganTrolleyRecord = {
          id,
          quantity: qty,
          locationId: loc.id,
          locationName: loc.name,
          area,
          placement,
          condition: data.condition || 'Baik (Good)',
          personInCharge: (data.personInCharge || currentUser?.fullName || 'Petugas').trim(),
          lastCheckDate: data.lastCheckDate || now.slice(0, 10),
          notes: (data.notes || '').trim(),
          createdAt: now,
          createdBy: currentUser!.fullName,
          updatedAt: now,
          updatedBy: currentUser!.fullName,
        };
        await setDoc(doc(db, 'morganTrolleys', id), sanitizeFirestoreDoc(newT));
        await logAudit(
          'MORGAN_TROLLEY_CREATED',
          'Morgan Trolley',
          `Mendaftarkan ${qty} unit Morgan Trolley di ${area} - ${placement} (${loc.name})`
        );
        showToast('success', 'Trolley Ditambahkan', 'Data Morgan Trolley berhasil disimpan ke Cloud Firestore.');
      }
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: saveMorganTrolley]', err);
      showToast('error', 'Gagal Menyimpan Trolley', err.message || 'Gagal menulis data ke Cloud Firestore.');
      return false;
    }
  };

  const deleteMorganTrolley = async (id: string): Promise<boolean> => {
    const perm = can('MANAGE_MASTER_DATA');
    if (!perm.allowed || currentUser?.role !== 'ADMIN') {
      showToast('error', 'Akses Ditolak', 'Hanya Administrator yang berwenang menghapus catatan Morgan Trolley.');
      return false;
    }

    const target = morganTrolleys.find((t) => t.id === id);
    if (!target) {
      showToast('error', 'Tidak Ditemukan', 'Catatan Morgan Trolley tidak ditemukan.');
      return false;
    }

    try {
      await deleteDoc(doc(db, 'morganTrolleys', id));
      await logAudit(
        'MORGAN_TROLLEY_DELETED',
        'Morgan Trolley',
        `Menghapus catatan trolley di ${target.area} (${target.locationName})`
      );
      showToast('info', 'Data Dihapus', 'Catatan Morgan Trolley berhasil dihapus dari Cloud Firestore.');
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: deleteMorganTrolley]', err);
      showToast('error', 'Gagal Menghapus Trolley', err.message || 'Gagal menghapus data dari Cloud Firestore.');
      return false;
    }
  };

  // ----------------------------------------------------
  // SUPPLY REQUESTS & RECEIPTS (OUTSTANDING TRACKER - FIRESTORE AUTHORITATIVE)
  // ----------------------------------------------------
  const createSupplyRequest = async (data: {
    requestingLocationId: string;
    requestingUnit: string;
    materialId: string;
    requestedQuantity: number;
    notes?: string;
  }): Promise<boolean> => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const reqQty = Number(data.requestedQuantity);
    if (!Number.isFinite(reqQty) || reqQty <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas permintaan harus lebih dari 0.');
      return false;
    }

    const material = materials.find((m) => (m.id === data.materialId || m.materialId === data.materialId) && m.isActive !== false);
    if (!material) {
      showToast('error', 'Material Tidak Valid', 'Material tidak ditemukan atau berstatus non-aktif.');
      return false;
    }

    const loc = locations.find(
      (l) =>
        l.id === data.requestingLocationId &&
        l.isActive !== false &&
        l.id !== IN_TRANSIT_LOCATION_ID &&
        l.id !== 'loc-in-transit'
    );
    if (!loc) {
      showToast('error', 'Lokasi Tidak Valid', 'Lokasi pemohon tidak aktif atau tidak valid.');
      return false;
    }

    const reqUnit = (data.requestingUnit || '').trim();
    if (!reqUnit) {
      showToast('error', 'Validasi Gagal', 'Unit pemohon wajib diisi.');
      return false;
    }

    const nextNumber = nextSequentialDocNo(
      supplyRequests.map((r) => r.requestNumber),
      'REQ-2026-',
      1000 + supplyRequests.length
    );
    const now = getJakartaTimestamp();
    const id = makeUniqueId('req');

    const newReq: SupplyRequestRecord = {
      id,
      requestNumber: nextNumber,
      requestDate: now.slice(0, 10),
      requestingLocationId: loc.id,
      requestingLocationName: loc.name,
      requestingUnit: reqUnit,
      materialId: material.id,
      materialCode: material.materialCode,
      materialName: material.materialName,
      variantValue: material.variantValue || '',
      requestedQuantity: reqQty,
      receivedQuantity: 0,
      outstandingQuantity: reqQty,
      unit: material.unit,
      status: 'REQUESTED',
      requestedBy: currentUser!.fullName,
      notes: (data.notes || '').trim(),
      createdAt: now,
      updatedAt: now,
      updatedBy: currentUser!.fullName,
      receiptHistory: [],
    };

    try {
      await setDoc(doc(db, 'supplyRequests', id), sanitizeFirestoreDoc(newReq));
      await logAudit(
        'SUPPLY_REQUEST_CREATED',
        'Permintaan & Penerimaan',
        `Permintaan suplai ${nextNumber}: ${reqQty} ${material.unit} ${material.materialName} untuk ${loc.name}`
      );
      showToast('success', 'Permintaan Terkirim', `Nomor Permintaan: ${nextNumber} tersimpan di Cloud Firestore.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: createSupplyRequest]', err);
      showToast('error', 'Gagal Menyimpan Permintaan', err.message || 'Terjadi kesalahan koneksi database.');
      return false;
    }
  };

  const receiveSupplyRequest = async (
    requestId: string,
    quantity: number,
    refNumber: string
  ): Promise<boolean> => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return false;
    }

    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas penerimaan harus lebih dari 0.');
      return false;
    }

    const reqRef = doc(db, 'supplyRequests', requestId);
    const now = getJakartaTimestamp();
    const cleanRef = (refNumber || '').trim() || `REC-${Date.now().toString().slice(-6)}`;

    try {
      const preSnap = await getDoc(reqRef);
      if (!preSnap.exists()) {
        throw new Error('Dokumen permintaan suplai tidak ditemukan di database.');
      }
      const preReq = preSnap.data() as SupplyRequestRecord;
      const preCheck = validateSupplyRequestReceipt(preReq, qty);
      if (!preCheck.valid) {
        throw new Error(preCheck.reason || 'Penerimaan tidak valid.');
      }

      const material = materials.find(
        (m) => m.id === preReq.materialId || m.materialCode === preReq.materialCode
      );
      const resolvedBal = await resolveAuthoritativeBalanceDoc(
        db,
        preReq.materialId,
        preReq.requestingLocationId,
        preReq.materialCode
      );

      let reportedNumber = preReq.requestNumber || requestId;
      let reportedUnit = preReq.unit || material?.unit || 'Pcs';
      let reportedOutstanding = preCheck.newOutstanding;
      let reportedMaterialName = preReq.materialName;

      await runTransaction(db, async (transaction) => {
        // 1. Read live supply request inside transaction first
        const reqSnap = await transaction.get(reqRef);
        if (!reqSnap.exists()) {
          throw new Error('Dokumen permintaan suplai tidak ditemukan di database.');
        }
        const liveReq = reqSnap.data() as SupplyRequestRecord;
        reportedNumber = liveReq.requestNumber || requestId;
        reportedUnit = liveReq.unit || material?.unit || 'Pcs';
        reportedMaterialName = liveReq.materialName;

        const check = validateSupplyRequestReceipt(liveReq, qty);
        if (!check.valid) {
          throw new Error(check.reason || 'Penerimaan melebihi sisa outstanding atau dokumen sudah ditutup.');
        }

        const seqIndex = (liveReq.receiptHistory?.length || 0) + 1;
        const receiptStepId = `${requestId}-step-${seqIndex}-${cleanRef.replace(/[^a-zA-Z0-9_-]/g, '')}`;

        // 2. Execute authoritative inventory movement inside same Firestore transaction
        const movRes = await executeInventoryMovementInTransaction(
          transaction,
          db,
          {
            materialId: liveReq.materialId,
            materialCode: liveReq.materialCode,
            materialName: liveReq.materialName,
            locationId: liveReq.requestingLocationId,
            locationName: liveReq.requestingLocationName,
            unit: reportedUnit,
            variantValue: liveReq.variantValue || '',
            movementType: 'GOODS_RECEIPT',
            quantity: qty,
            delta: qty,
            sourceDocumentId: requestId,
            sourceDocumentType: 'supplyRequests',
            sourceLineId: receiptStepId,
            idempotencyKey: generateIdempotencyKey(
              'SUP_REC',
              receiptStepId,
              liveReq.materialId,
              liveReq.requestingLocationId,
              'GOODS_RECEIPT'
            ),
            actorName: currentUser!.fullName,
            actorEmployeeId: currentUser!.employeeId,
            notes: `Penerimaan suplai ${reportedNumber} (Ref: ${cleanRef})`,
            unitCost: material?.unitCost,
            timestamp: now,
            materialFallback: material,
          },
          {
            customBalanceDocId: resolvedBal.balanceId,
          }
        );

        const newHistoryItem = {
          receiptId: receiptStepId,
          date: now,
          quantity: qty,
          receivedBy: currentUser!.fullName,
          refNumber: cleanRef,
          movementId: movRes.movementId,
        };

        reportedOutstanding = check.newOutstanding;

        // 3. Authoritatively update supply request document inside transaction
        transaction.update(
          reqRef,
          sanitizeFirestoreDoc({
            receivedQuantity: check.newTotalReceived,
            outstandingQuantity: check.newOutstanding,
            status: check.newStatus,
            updatedAt: now,
            updatedBy: currentUser!.fullName,
            receiptHistory: [newHistoryItem, ...(liveReq.receiptHistory || [])],
          })
        );
      });

      await logAudit(
        'SUPPLY_RECEIVED',
        'Permintaan & Penerimaan',
        `Penerimaan ${qty} ${reportedUnit} ${reportedMaterialName} untuk permintaan ${reportedNumber} (Ref: ${cleanRef}). Sisa outstanding: ${reportedOutstanding} ${reportedUnit}.`
      );
      showToast(
        'success',
        'Penerimaan Berhasil Disimpan',
        `Diterima +${qty} ${reportedUnit} (${reportedNumber}). Sisa outstanding: ${reportedOutstanding} ${reportedUnit}.`
      );
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: receiveSupplyRequest]', err);
      showToast('error', 'Gagal Memproses Penerimaan Suplai', err.message || 'Terjadi kesalahan transaksi.');
      return false;
    }
  };

  // ----------------------------------------------------
  // BULK EXCEL IMPORT ENGINE (Cloud Firestore Authoritative)
  // ----------------------------------------------------
  const executeExcelImport = async (
    moduleType: ImportModuleType,
    rawRows: Record<string, any>[],
    mode: 'INSERT_ONLY' | 'UPDATE_EXISTING' | 'INSERT_OR_UPDATE' | 'HISTORICAL_TRANSACTION' | 'OPENING_BALANCE'
  ): Promise<{ successCount: number; errorCount: number; errors: ExcelImportValidationError[] }> => {
    const perm = can('IMPORT_EXCEL');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Izin tidak mencukupi.');
      return {
        successCount: 0,
        errorCount: rawRows.length,
        errors: [{ rowNumber: 1, field: 'Role', value: currentUser?.role, message: perm.reason || 'Akses ditolak.' }],
      };
    }

    const errors: ExcelImportValidationError[] = [];
    let successCount = 0;
    const now = getJakartaTimestamp();

    try {
      if (moduleType === 'MATERIAL_MASTER') {
        const docsToWrite: MaterialMaster[] = [];
        const seenCodes = new Set<string>();
        const localCopy = [...materials];

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
          if (seenCodes.has(code)) {
            errors.push({ rowNumber: rowNum, field: 'materialCode', value: code, message: `Duplikasi kode material ${code} dalam file upload.` });
            return;
          }
          seenCodes.add(code);

          const minStock = row.minimumStock !== '' && row.minimumStock !== undefined ? Number(row.minimumStock) : undefined;
          const rop = row.reorderPoint !== '' && row.reorderPoint !== undefined ? Number(row.reorderPoint) : undefined;
          const cost = row.unitCost !== '' && row.unitCost !== undefined ? Number(row.unitCost) : undefined;
          if ((minStock !== undefined && (Number.isNaN(minStock) || minStock < 0)) ||
              (rop !== undefined && (Number.isNaN(rop) || rop < 0)) ||
              (cost !== undefined && (Number.isNaN(cost) || cost < 0))) {
            errors.push({ rowNumber: rowNum, field: 'numeric', value: code, message: 'Minimum Stock, ROP, dan Unit Cost harus angka >= 0.' });
            return;
          }

          const existing = localCopy.find((m) => m.materialCode.toUpperCase() === code);
          if (existing) {
            if (mode === 'INSERT_ONLY') {
              errors.push({ rowNumber: rowNum, field: 'materialCode', value: code, message: `Material ${code} sudah ada. Mode Insert Only menolak duplikat.` });
              return;
            }
            const updated: MaterialMaster = {
              ...existing,
              materialName: name,
              subcategoryId: row.subcategory || row.subcategoryId || existing.subcategoryId,
              description: row.description !== undefined ? String(row.description) : existing.description,
              minimumStock: minStock ?? existing.minimumStock,
              reorderPoint: rop ?? existing.reorderPoint,
              unitCost: cost ?? existing.unitCost,
              variantAttributes: row.variantAttributes || existing.variantAttributes,
              updatedAt: now,
              updatedBy: currentUser?.employeeId || 'IMPORT',
            };
            docsToWrite.push(updated);
          } else {
            if (mode === 'UPDATE_EXISTING') {
              errors.push({ rowNumber: rowNum, field: 'materialCode', value: code, message: `Material ${code} tidak ditemukan untuk diupdate.` });
              return;
            }
            const cat = categories.find(
              (c) => c.name.toLowerCase() === String(row.categoryCode || '').toLowerCase() || c.code.toLowerCase() === String(row.categoryCode || '').toLowerCase()
            ) || categories[0];
            const un = units.find(
              (u) => u.symbol.toLowerCase() === String(row.unitSymbol || '').toLowerCase() || u.name.toLowerCase() === String(row.unitSymbol || '').toLowerCase()
            ) || units[0];
            const loc = locations.find(
              (l) => l.code.toLowerCase() === String(row.defaultLocationCode || '').toLowerCase() || l.name.toLowerCase() === String(row.defaultLocationCode || '').toLowerCase()
            );

            const id = 'mat-' + code.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
            const newM: MaterialMaster = {
              id,
              materialId: id,
              materialCode: code,
              materialName: name,
              categoryId: cat ? cat.id : 'cat-tissue',
              categoryName: cat ? cat.name : 'Tissue',
              subcategoryId: row.subcategory || row.subcategoryId || undefined,
              unitId: un ? un.id : 'unit-pack',
              unit: un ? un.symbol : 'Pack',
              description: String(row.description || ''),
              minimumStock: minStock ?? 50,
              reorderPoint: rop ?? 100,
              defaultLocationId: loc ? loc.id : undefined,
              defaultLocationName: loc ? loc.name : undefined,
              variantAttributes: row.variantAttributes || undefined,
              unitCost: cost ?? 0,
              isActive: true,
              createdAt: now,
              createdBy: currentUser?.employeeId || 'IMPORT',
              updatedAt: now,
              updatedBy: currentUser?.employeeId || 'IMPORT',
            };
            docsToWrite.push(newM);
          }
        });

        if (docsToWrite.length > 0) {
          await commitInChunks(docsToWrite, 350, (chunk, batch) => {
            for (const m of chunk) {
              batch.set(doc(db, 'materials', m.id), sanitizeFirestoreDoc(m), { merge: true });
            }
          });
          successCount = docsToWrite.length;
        }
      } else if (moduleType === 'LOCATION_MASTER') {
        const docsToWrite: MasterLocation[] = [];
        const seenCodes = new Set<string>();

        rawRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const code = String(row.locationCode || '').trim().toUpperCase();
          const name = String(row.locationName || '').trim();

          if (!code || !name) {
            errors.push({ rowNumber: rowNum, field: 'locationCode', value: code, message: 'Kode dan Nama lokasi wajib diisi.' });
            return;
          }
          if (code === 'IN-TRANSIT' || code === 'LOC-IN-TRANSIT') {
            errors.push({ rowNumber: rowNum, field: 'locationCode', value: code, message: 'Kode lokasi virtual IN-TRANSIT dicadangkan sistem.' });
            return;
          }
          if (seenCodes.has(code)) {
            errors.push({ rowNumber: rowNum, field: 'locationCode', value: code, message: `Duplikasi kode lokasi ${code} dalam file upload.` });
            return;
          }
          seenCodes.add(code);

          const existing = locations.find((l) => l.code.toUpperCase() === code);
          if (existing) {
            if (mode === 'INSERT_ONLY') {
              errors.push({ rowNumber: rowNum, field: 'locationCode', value: code, message: `Lokasi ${code} sudah ada.` });
              return;
            }
            docsToWrite.push({
              ...existing,
              name,
              locationName: name,
              type: row.locationType || existing.type,
              personInCharge: row.personInCharge || existing.picName,
              picName: row.personInCharge || existing.picName,
              address: row.address !== undefined ? String(row.address) : existing.address,
              updatedAt: now,
            });
          } else {
            if (mode === 'UPDATE_EXISTING') {
              errors.push({ rowNumber: rowNum, field: 'locationCode', value: code, message: `Lokasi ${code} tidak ditemukan.` });
              return;
            }
            const parentLoc = locations.find(
              (l) => l.code.toUpperCase() === String(row.parentLocationCode || '').trim().toUpperCase()
            );
            const id = 'loc-' + code.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
            docsToWrite.push({
              id,
              locationId: id,
              code,
              locationCode: code,
              name,
              locationName: name,
              type: row.locationType || 'Terminal',
              parentLocationId: parentLoc ? parentLoc.id : undefined,
              parentLocationName: parentLoc ? parentLoc.name : undefined,
              picName: row.personInCharge || 'Petugas',
              personInCharge: row.personInCharge || 'Petugas',
              capacityM2: row.capacityM2 ? Number(row.capacityM2) : 100,
              address: String(row.address || ''),
              description: String(row.description || ''),
              isActive: true,
              createdAt: now,
              createdBy: currentUser?.employeeId || 'IMPORT',
              updatedAt: now,
            });
          }
        });

        if (docsToWrite.length > 0) {
          await commitInChunks(docsToWrite, 350, (chunk, batch) => {
            for (const l of chunk) {
              batch.set(doc(db, 'locations', l.id), sanitizeFirestoreDoc(l), { merge: true });
            }
          });
          successCount = docsToWrite.length;
        }
      } else if (moduleType === 'MATERIAL_CATEGORY') {
        const docsToWrite: MasterCategory[] = [];
        const seenCodes = new Set<string>();
        rawRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const code = String(row.code || '').trim().toUpperCase();
          const name = String(row.name || '').trim();
          if (!code || !name) {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: 'Kode dan Nama kategori wajib diisi.' });
            return;
          }
          if (seenCodes.has(code)) {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Duplikasi kode kategori ${code}.` });
            return;
          }
          seenCodes.add(code);
          const existing = categories.find((c) => c.code.toUpperCase() === code);
          if (existing && mode === 'INSERT_ONLY') {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Kategori ${code} sudah ada.` });
            return;
          }
          if (!existing && mode === 'UPDATE_EXISTING') {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Kategori ${code} tidak ditemukan.` });
            return;
          }
          const id = existing?.id || 'cat-' + code.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
          docsToWrite.push({
            id,
            code,
            name,
            description: String(row.description || existing?.description || ''),
            isActive: existing ? existing.isActive : true,
          });
        });

        if (docsToWrite.length > 0) {
          await commitInChunks(docsToWrite, 350, (chunk, batch) => {
            for (const c of chunk) {
              batch.set(doc(db, 'categories', c.id), sanitizeFirestoreDoc(c), { merge: true });
            }
          });
          successCount = docsToWrite.length;
        }
      } else if (moduleType === 'UNIT_OF_MEASURE') {
        const docsToWrite: MasterUnit[] = [];
        const seenCodes = new Set<string>();
        rawRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const code = String(row.code || '').trim().toUpperCase();
          const name = String(row.name || '').trim();
          const symbol = String(row.symbol || '').trim();
          if (!code || !name || !symbol) {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: 'Kode, Nama, dan Simbol satuan wajib diisi.' });
            return;
          }
          if (seenCodes.has(code)) {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Duplikasi kode satuan ${code}.` });
            return;
          }
          seenCodes.add(code);
          const existing = units.find((u) => u.code.toUpperCase() === code);
          if (existing && mode === 'INSERT_ONLY') {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Satuan ${code} sudah ada.` });
            return;
          }
          if (!existing && mode === 'UPDATE_EXISTING') {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Satuan ${code} tidak ditemukan.` });
            return;
          }
          const id = existing?.id || 'unit-' + code.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
          docsToWrite.push({
            id,
            code,
            name,
            symbol,
            description: String(row.description || existing?.description || ''),
            isActive: existing ? existing.isActive : true,
          });
        });

        if (docsToWrite.length > 0) {
          await commitInChunks(docsToWrite, 350, (chunk, batch) => {
            for (const u of chunk) {
              batch.set(doc(db, 'units', u.id), sanitizeFirestoreDoc(u), { merge: true });
            }
          });
          successCount = docsToWrite.length;
        }
      } else if (moduleType === 'SUPPLIER_MASTER') {
        const docsToWrite: MasterSupplier[] = [];
        const seenCodes = new Set<string>();
        rawRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const code = String(row.code || '').trim().toUpperCase();
          const name = String(row.name || '').trim();
          if (!code || !name) {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: 'Kode dan Nama pemasok wajib diisi.' });
            return;
          }
          if (seenCodes.has(code)) {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Duplikasi kode pemasok ${code}.` });
            return;
          }
          seenCodes.add(code);
          const existing = suppliers.find((s) => s.code.toUpperCase() === code);
          if (existing && mode === 'INSERT_ONLY') {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Pemasok ${code} sudah ada.` });
            return;
          }
          if (!existing && mode === 'UPDATE_EXISTING') {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Pemasok ${code} tidak ditemukan.` });
            return;
          }
          const id = existing?.id || 'sup-' + code.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
          docsToWrite.push({
            id,
            code,
            name,
            contactPerson: String(row.contactPerson || existing?.contactPerson || '-'),
            phone: String(row.phone || existing?.phone || '-'),
            email: String(row.email || existing?.email || '-'),
            address: String(row.address || existing?.address || '-'),
            isActive: existing ? existing.isActive : true,
          });
        });

        if (docsToWrite.length > 0) {
          await commitInChunks(docsToWrite, 350, (chunk, batch) => {
            for (const s of chunk) {
              batch.set(doc(db, 'suppliers', s.id), sanitizeFirestoreDoc(s), { merge: true });
            }
          });
          successCount = docsToWrite.length;
        }
      } else if (moduleType === 'REQUESTING_UNIT_MASTER') {
        const docsToWrite: MasterRequestingUnit[] = [];
        const seenCodes = new Set<string>();
        rawRows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const code = String(row.code || '').trim().toUpperCase();
          const name = String(row.name || '').trim();
          const division = String(row.division || 'Umum').trim();
          if (!code || !name) {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: 'Kode dan Nama Unit Pemohon wajib diisi.' });
            return;
          }
          if (seenCodes.has(code)) {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Duplikasi kode unit ${code}.` });
            return;
          }
          seenCodes.add(code);
          const existing = requestingUnits.find((u) => u.code.toUpperCase() === code);
          if (existing && mode === 'INSERT_ONLY') {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Unit Pemohon ${code} sudah ada.` });
            return;
          }
          if (!existing && mode === 'UPDATE_EXISTING') {
            errors.push({ rowNumber: rowNum, field: 'code', value: code, message: `Unit Pemohon ${code} tidak ditemukan.` });
            return;
          }
          const cleanCode = code.replace(/[^A-Z0-9_-]/g, '');
          const id = existing?.id || `UP-${cleanCode || Date.now() + idx}`;
          const actorLabel = currentUser ? `${currentUser.fullName} (${currentUser.employeeId})` : 'Import';
          docsToWrite.push({
            id,
            code,
            unitCode: code,
            name,
            unitName: name,
            division,
            contactPerson: String(row.contactPerson || existing?.contactPerson || '-'),
            description: String(row.description || existing?.description || ''),
            isActive: existing ? existing.isActive : true,
            status: existing ? existing.status : 'Active',
            createdAt: existing?.createdAt || now,
            createdBy: existing?.createdBy || actorLabel,
            updatedAt: now,
            updatedBy: actorLabel,
          });
        });

        if (docsToWrite.length > 0) {
          await commitInChunks(docsToWrite, 350, (chunk, batch) => {
            for (const u of chunk) {
              batch.set(doc(db, 'requestingUnits', u.id), sanitizeFirestoreDoc(u), { merge: true });
            }
          });
          successCount = docsToWrite.length;
        }
      } else if (moduleType === 'INVENTORY_OPENING') {
        // Controlled Physical Stock Opname Baseline flow: create PENDING_APPROVAL StockOpname + ApprovalRequest drafts.
        // Never overwrite /inventory.availableStock directly!
        const result = buildControlledOpeningOpnameDrafts({
          rawRows,
          materials,
          locations,
          inventory,
          existingBaselines: inventoryBaselines,
          existingOpnames: stockOpnames,
          actorName: currentUser?.fullName || 'Import Excel',
          actorEmployeeId: currentUser?.employeeId || 'IMPORT',
          now,
        });
        errors.push(...result.errors);

        if (result.drafts.length > 0) {
          await commitInChunks(result.drafts, 200, (chunk, batch) => {
            for (const item of chunk) {
              batch.set(doc(db, 'stockOpnames', item.opname.id), sanitizeFirestoreDoc(item.opname));
              batch.set(doc(db, 'approvals', item.approval.id), sanitizeFirestoreDoc(item.approval));
            }
          });
          successCount = result.drafts.length;
        }
      } else {
        errors.push({
          rowNumber: 1,
          field: 'Module',
          value: moduleType,
          message: `Import massal untuk modul ${moduleType} tidak diizinkan melewati form transaksi/approval standar.`,
        });
      }

      if (successCount > 0) {
        await logAudit(
          'EXCEL_IMPORTED',
          moduleType,
          `Import Excel selesai (${moduleType}): ${successCount} berhasil dipersist ke Firestore, ${errors.length} gagal.`
        );
        if (moduleType === 'INVENTORY_OPENING') {
          showToast(
            'success',
            'Draft Stock Opname Saldo Awal Terkirim',
            `${successCount} baris dibuat sebagai Stock Opname PENDING_APPROVAL dan diteruskan ke Approval Center untuk otorisasi Baseline Admin.`
          );
        } else {
          showToast('success', 'Import Excel Berhasil', `${successCount} data berhasil disimpan secara permanen ke Cloud Firestore.`);
        }
      }
      if (errors.length > 0) {
        showToast('warning', 'Peringatan Validasi Import', `${errors.length} baris ditolak karena kesalahan validasi.`);
      }

      return { successCount, errorCount: errors.length, errors };
    } catch (err: any) {
      console.error('[Firestore Error: executeExcelImport]', err);
      const errMsg = err.message || 'Gagal menyimpan hasil import ke Cloud Firestore.';
      showToast('error', 'Import Excel Gagal', errMsg);
      return {
        successCount: 0,
        errorCount: Math.max(1, rawRows.length),
        errors: [...errors, { rowNumber: 1, field: 'Firestore', value: moduleType, message: errMsg }],
      };
    }
  };

  // Account Management (Cloud Firestore Authoritative)
  const createUserAccount = async (
    data: Omit<UserAccount, 'id' | 'createdDate' | 'lastLogin'>
  ): Promise<boolean> => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed || currentUser?.role !== 'ADMIN') {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Administrator yang berwenang mengelola akun.');
      return false;
    }

    const cleanEmpId = data.employeeId.trim().toUpperCase();
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.fullName.trim();
    if (!cleanEmpId || !cleanEmail || !cleanName) {
      showToast('error', 'Validasi Gagal', 'Employee ID, Nama Lengkap, dan Email wajib diisi.');
      return false;
    }

    if (users.some((u) => u.employeeId.toLowerCase() === cleanEmpId.toLowerCase())) {
      showToast('error', 'Duplikasi Data', `Employee ID "${cleanEmpId}" sudah digunakan.`);
      return false;
    }

    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      showToast('error', 'Duplikasi Data', `Email "${cleanEmail}" sudah terdaftar.`);
      return false;
    }

    const now = getJakartaTimestamp();
    const newId = makeUniqueId('user');
    const newUser: UserAccount = {
      ...data,
      id: newId,
      employeeId: cleanEmpId,
      fullName: cleanName,
      email: cleanEmail,
      createdDate: now,
      lastLogin: null,
    };

    try {
      await setDoc(doc(db, 'users', newId), sanitizeFirestoreDoc(newUser));
      await logAudit(
        'ACCOUNT_CREATED',
        'Account Management',
        `Admin mendaftarkan profil otorisasi akun: ${newUser.fullName} (${newUser.employeeId}), Peran: ${newUser.role}`
      );
      showToast(
        'success',
        'Profil Akun Disimpan',
        `Profil otorisasi ${newUser.fullName} (${newUser.role}) tersimpan di Firestore.`
      );
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: createUserAccount]', err);
      showToast('error', 'Gagal Menyimpan Akun', err.message || 'Gagal menulis profil pengguna ke Firestore.');
      return false;
    }
  };

  const updateUserAccount = async (id: string, updates: Partial<UserAccount>): Promise<boolean> => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed || currentUser?.role !== 'ADMIN') {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Administrator yang berwenang mengubah akun.');
      return false;
    }

    const target = users.find((u) => u.id === id);
    if (!target) {
      showToast('error', 'Tidak Ditemukan', 'Akun pengguna tidak ditemukan.');
      return false;
    }

    if (id === currentUser.id && updates.role && updates.role !== 'ADMIN') {
      showToast('error', 'Operasi Ditolak', 'Administrator tidak dapat menurunkan peran akun sendiri.');
      return false;
    }

    try {
      const merged = sanitizeFirestoreDoc({
        ...target,
        ...updates,
        id,
      });
      await setDoc(doc(db, 'users', id), merged, { merge: true });
      if (currentUser?.id === id) {
        setCurrentUser(merged as UserAccount);
      }
      await logAudit('ACCOUNT_UPDATED', 'Account Management', `Memperbarui akun ID: ${id} (${target.fullName})`);
      showToast('success', 'Akun Diperbarui', 'Data akun pengguna berhasil disimpan ke Cloud Firestore.');
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: updateUserAccount]', err);
      showToast('error', 'Gagal Memperbarui Akun', err.message || 'Kesalahan penulisan ke Firestore.');
      return false;
    }
  };

  const toggleUserStatus = async (id: string): Promise<boolean> => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed || currentUser?.role !== 'ADMIN') {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Administrator yang berwenang mengubah status akun.');
      return false;
    }

    const target = users.find((u) => u.id === id);
    if (!target) return false;

    if (currentUser?.id === id) {
      showToast('error', 'Operasi Ditolak', 'Anda tidak dapat menonaktifkan akun sendiri.');
      return false;
    }

    const nextStatus: AccountStatus = target.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await updateDoc(doc(db, 'users', id), { status: nextStatus });
      await logAudit(
        'ACCOUNT_STATUS_TOGGLED',
        'Account Management',
        `Status akun ${target.fullName} diubah ke ${nextStatus}`
      );
      showToast('info', 'Status Akun Diperbarui', `Akun ${target.fullName} sekarang ${nextStatus}.`);
      return true;
    } catch (err: any) {
      console.error('[Firestore Error: toggleUserStatus]', err);
      showToast('error', 'Gagal Mengubah Status Akun', err.message || 'Kesalahan database.');
      return false;
    }
  };

  const resetUserPassword = async (
    id: string
  ): Promise<{ success: boolean; mode: 'RESET_EMAIL_SENT' | 'PROVISIONED_NOTICE' | 'FAILED'; message: string }> => {
    const perm = can('MANAGE_ACCOUNTS');
    if (!perm.allowed || currentUser?.role !== 'ADMIN') {
      const msg = perm.reason || 'Hanya Administrator yang berwenang mengirim tautan reset sandi.';
      showToast('error', 'Akses Ditolak', msg);
      return { success: false, mode: 'FAILED', message: msg };
    }

    const target = users.find((u) => u.id === id);
    if (!target || !target.email) {
      const msg = 'Akun atau email pengguna tidak valid.';
      showToast('error', 'Gagal Reset Sandi', msg);
      return { success: false, mode: 'FAILED', message: msg };
    }

    try {
      await sendPasswordResetEmail(auth, target.email.trim());
      await logAudit(
        'PASSWORD_RESET_EMAIL_SENT',
        'Account Management',
        `Mengirim tautan reset sandi Firebase Auth ke ${target.email} (${target.employeeId})`
      );
      const msg = `Tautan penyetelan ulang kata sandi resmi Firebase Authentication telah dikirim ke ${target.email}.`;
      showToast('success', 'Email Reset Terkirim', msg);
      return { success: true, mode: 'RESET_EMAIL_SENT', message: msg };
    } catch (err: any) {
      console.error('[Auth Error: resetUserPassword]', err);
      const msg =
        err?.code === 'auth/user-not-found'
          ? `Email ${target.email} belum terdaftar di Firebase Authentication (keterbatasan Firebase Spark client SDK tanpa Admin SDK). Minta pengguna mendaftar terlebih dahulu di halaman Login atau buat kredensial di Firebase Console.`
          : err?.message || 'Gagal mengirim tautan reset sandi melalui Firebase Authentication.';
      showToast('warning', 'Informasi Reset Sandi', msg);
      return { success: false, mode: 'PROVISIONED_NOTICE', message: msg };
    }
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
        inventoryMovements,
        inventoryBaselines,
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
        rejectStockTransfer,
        createStockOpname,
        approveOpnameAdjustment,
        rejectOpnameAdjustment,
        fetchLiveStockBalance,
        reconcileOpnameBaselines,
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
