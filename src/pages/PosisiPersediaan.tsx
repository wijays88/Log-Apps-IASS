import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Boxes,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle2,
  Package,
  MapPin,
  Tag,
  Eye,
  Edit2,
  X,
  Plus,
  Clock,
  Building2,
  Layers,
  Shirt,
  Trash,
  Truck,
  Check,
  FileSpreadsheet,
  FileText,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Trash2,
  Loader2,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';
import { InventoryBalance, BaselineStatus, IN_TRANSIT_LOCATION_ID } from '../types';
import { exportToExcelFile, exportToCsvFile } from '../utils/excelUtils';
import {
  BaselineLedgerSummary,
  runBaselineMigrationDryRun,
  buildInventoryReconciliationMap,
  getJakartaDateString,
  normalizeSupplyRequestStatus,
  getPendingGoodsIssueReservedQty,
  calculateUnreservedAvailableStock,
} from '../services/inventoryEngine';

type PosisiSubTab =
  | 'ALL_INVENTORY'
  | 'TOILET_BUILDING'
  | 'CONSUMPTION_RECORDS'
  | 'POLYBAG_SIZES'
  | 'UNIFORM_SIZES'
  | 'MORGAN_TROLLEY'
  | 'REQUESTS_RECEIPTS';

export const PosisiPersediaan: React.FC = () => {
  const {
    inventory,
    inventoryBaselines,
    inventoryMovements,
    stockOpnames,
    goodsIssues,
    activeMaterials,
    activeLocations,
    categories,
    consumptions,
    morganTrolleys,
    supplyRequests,
    recordConsumption,
    saveMorganTrolley,
    deleteMorganTrolley,
    createSupplyRequest,
    receiveSupplyRequest,
    reconcileOpnameBaselines,
    currentUser,
    can,
    showToast,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<PosisiSubTab>('ALL_INVENTORY');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'NORMAL' | 'MENIPIS' | 'KRITIS'>('ALL');
  const [selectedBaselineStatus, setSelectedBaselineStatus] = useState<'ALL' | BaselineStatus>('ALL');

  // Modals state
  const [detailItem, setDetailItem] = useState<InventoryBalance | null>(null);
  const [traceModalSummary, setTraceModalSummary] = useState<BaselineLedgerSummary | null>(null);
  const [migrationDryRunModalOpen, setMigrationDryRunModalOpen] = useState(false);
  const [confirmReconcileOpen, setConfirmReconcileOpen] = useState(false);
  const [isApplyingReconciliation, setIsApplyingReconciliation] = useState(false);

  // New Consumption modal
  const [consumptionModalOpen, setConsumptionModalOpen] = useState(false);
  const [consDate, setConsDate] = useState(() => getJakartaDateString());
  const [consLocId, setConsLocId] = useState(activeLocations[0]?.id || '');
  const [consArea, setConsArea] = useState('Area Toilet Kedatangan Gate 1B');
  const [consShift, setConsShift] = useState<'Shift 1' | 'Shift 2' | 'Shift 3'>('Shift 1');
  const [consMatId, setConsMatId] = useState(activeMaterials[0]?.id || '');
  const [consQty, setConsQty] = useState(10);
  const [consNotes, setConsNotes] = useState('');
  const [isSubmittingCons, setIsSubmittingCons] = useState(false);

  // New Trolley modal
  const [trolleyModalOpen, setTrolleyModalOpen] = useState(false);
  const [trolleyQty, setTrolleyQty] = useState(1);
  const [trolleyLocId, setTrolleyLocId] = useState(activeLocations[0]?.id || '');
  const [trolleyArea, setTrolleyArea] = useState('Curbside Pintu 1 - 4');
  const [trolleyPlacement, setTrolleyPlacement] = useState('Pos Janitor');
  const [trolleyCondition, setTrolleyCondition] = useState<'Baik (Good)' | 'Perbaikan Ringan (Minor)' | 'Rusak Berat (Damaged)'>('Baik (Good)');
  const [trolleyPic, setTrolleyPic] = useState(currentUser?.fullName || '');
  const [trolleyNotes, setTrolleyNotes] = useState('');
  const [isSubmittingTrolley, setIsSubmittingTrolley] = useState(false);
  const [confirmDeleteTrolleyId, setConfirmDeleteTrolleyId] = useState<string | null>(null);
  const [isDeletingTrolley, setIsDeletingTrolley] = useState(false);

  // New Request modal
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reqLocId, setReqLocId] = useState(activeLocations[0]?.id || '');
  const [reqUnitName, setReqUnitName] = useState('Divisi Kebersihan Toilet Terminal 1B');
  const [reqMatId, setReqMatId] = useState(activeMaterials[0]?.id || '');
  const [reqQty, setReqQty] = useState(50);
  const [reqNotes, setReqNotes] = useState('');
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);

  // Partial Receive modal
  const [receiveTargetId, setReceiveTargetId] = useState<string | null>(null);
  const [receiveQtyInput, setReceiveQtyInput] = useState(10);
  const [receiveRefDoc, setReceiveRefDoc] = useState('');
  const [isSubmittingReceive, setIsSubmittingReceive] = useState(false);

  const canMutate = can('CREATE_TRANSACTION').allowed;
  const isAdmin = currentUser?.role === 'ADMIN';

  // Authoritative physical stock & reservation preview for Consumption modal
  const selectedConsStockInfo = useMemo(() => {
    const resolvedLocId = consLocId || activeLocations[0]?.id || '';
    const resolvedMat = activeMaterials.find((m) => m.id === consMatId) || activeMaterials[0];
    if (!resolvedLocId || !resolvedMat) {
      return { physical: 0, reserved: 0, unreserved: 0, unit: '' };
    }
    const bal = inventory.find(
      (b) =>
        b.locationId === resolvedLocId &&
        (b.materialId === resolvedMat.id ||
          b.itemId === resolvedMat.id ||
          (resolvedMat.materialCode && b.materialCode === resolvedMat.materialCode))
    );
    const physical = bal ? Number(bal.availableStock) || 0 : 0;
    const reserved = getPendingGoodsIssueReservedQty(
      goodsIssues,
      resolvedMat.id,
      resolvedLocId,
      resolvedMat.materialCode
    );
    return {
      physical,
      reserved,
      unreserved: calculateUnreservedAvailableStock(physical, reserved),
      unit: resolvedMat.unit || '',
    };
  }, [consLocId, consMatId, activeLocations, activeMaterials, inventory, goodsIssues]);

  const activeReceiveTarget = useMemo(
    () => supplyRequests.find((r) => r.id === receiveTargetId) || null,
    [supplyRequests, receiveTargetId]
  );

  // Authoritative physical baseline summary map for every SKU + warehouse location (shared helper)
  const itemSummaryMap = useMemo(() => {
    return buildInventoryReconciliationMap({
      inventory,
      inventoryBaselines,
      inventoryMovements,
      stockOpnames,
    });
  }, [inventory, inventoryBaselines, inventoryMovements, stockOpnames]);

  const dryRunReport = useMemo(() => {
    return runBaselineMigrationDryRun({
      inventory,
      stockOpnames,
      inventoryMovements,
      existingBaselines: inventoryBaselines,
    });
  }, [inventory, stockOpnames, inventoryMovements, inventoryBaselines]);

  // Filtered Main Inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      // Exclude virtual in-transit buffer from normal warehouse physical baseline reporting
      if (item.locationId === IN_TRANSIT_LOCATION_ID || item.locationId === 'loc-in-transit') {
        return false;
      }

      const nameStr = (item.materialName || item.itemName || '').toLowerCase();
      const codeStr = (item.materialCode || item.itemCode || '').toLowerCase();
      const locStr = (item.locationName || '').toLowerCase();
      const matchSearch =
        nameStr.includes(searchTerm.toLowerCase()) ||
        codeStr.includes(searchTerm.toLowerCase()) ||
        locStr.includes(searchTerm.toLowerCase()) ||
        (item.variantValue || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchLoc = selectedLocation === 'ALL' || item.locationId === selectedLocation;
      const matchCat = selectedCategory === 'ALL' || item.categoryId === selectedCategory;

      let matchStatus = true;
      const isCritical = item.availableStock <= item.minimumStock;
      const isLow = item.availableStock > item.minimumStock && item.availableStock <= item.reorderPoint;
      const isNormal = item.availableStock > item.reorderPoint;

      if (selectedStatus === 'KRITIS') matchStatus = isCritical;
      else if (selectedStatus === 'MENIPIS') matchStatus = isLow;
      else if (selectedStatus === 'NORMAL') matchStatus = isNormal;

      const summary = itemSummaryMap.get(item.id);
      const matchBaseline =
        selectedBaselineStatus === 'ALL' || summary?.baselineStatus === selectedBaselineStatus;

      return matchSearch && matchLoc && matchCat && matchStatus && matchBaseline;
    });
  }, [inventory, itemSummaryMap, searchTerm, selectedLocation, selectedCategory, selectedStatus, selectedBaselineStatus]);

  // Toilet & Building filtered items
  const toiletBuildingItems = useMemo(() => {
    return inventory.filter((item) => {
      if (item.locationId === IN_TRANSIT_LOCATION_ID || item.locationId === 'loc-in-transit') {
        return false;
      }
      const catCode = item.categoryId.toLowerCase();
      const isToiletCat =
        catCode.includes('tissue') ||
        catCode.includes('plastic') ||
        catCode.includes('chemical') ||
        catCode.includes('equipment');

      const isT1 = item.locationName.includes('Terminal 1B') || item.locationName.includes('Terminal 1C');
      return isToiletCat || isT1;
    });
  }, [inventory]);

  // Polybag specific items (exclude loc-in-transit)
  const polybagItems = useMemo(() => {
    return inventory.filter(
      (item) =>
        item.locationId !== IN_TRANSIT_LOCATION_ID &&
        item.locationId !== 'loc-in-transit' &&
        ((item.categoryId || '').toLowerCase().includes('plastic') ||
          (item.materialName || item.itemName || '').toLowerCase().includes('polybag'))
    );
  }, [inventory]);

  // Uniform specific items (exclude loc-in-transit)
  const uniformItems = useMemo(() => {
    return inventory.filter(
      (item) =>
        item.locationId !== IN_TRANSIT_LOCATION_ID &&
        item.locationId !== 'loc-in-transit' &&
        ((item.categoryId || '').toLowerCase().includes('uniform') ||
          (item.materialName || item.itemName || '').toLowerCase().includes('uniform') ||
          (item.materialName || item.itemName || '').toLowerCase().includes('seragam'))
    );
  }, [inventory]);

  // Export handlers
  const handleExportExcel = () => {
    const data = filteredInventory.map((item) => {
      const summary = itemSummaryMap.get(item.id);
      return {
        'Material Code': item.materialCode,
        'Material Name': item.materialName,
        'Kategori': item.categoryName,
        'Lokasi Gudang': item.locationName,
        'Varian': item.variantValue || '-',
        'Physical Opening (Baseline)': summary?.baseline ? summary.baselineQuantity : 'Unverified',
        'Qty IN (Post-Cutoff)': summary ? summary.qtyIn : item.qtyIn,
        'Qty OUT (Post-Cutoff)': summary ? summary.qtyOut : item.qtyOut,
        'Penyesuaian (Adjustment)': summary ? summary.adjustments : 0,
        'Closing Balance (Authoritative)': item.availableStock,
        'Satuan': item.unit,
        'Status Baseline': summary ? summary.baselineStatus : 'UNVERIFIED',
        'Nomor Stock Opname Baseline': summary?.baseline?.stockOpnameNumber || '-',
        'Tanggal Cutoff Opname': summary?.baseline?.countCompletedAt || '-',
        'Disetujui Oleh': summary?.baseline?.approvedBy || '-',
        'Min Stock': item.minimumStock,
        'ROP': item.reorderPoint,
        'Status Stok':
          item.availableStock < 0
            ? 'DEFISIT NEGATIF'
            : item.availableStock <= item.minimumStock
            ? 'Kritis'
            : item.availableStock <= item.reorderPoint
            ? 'Menipis'
            : 'Normal',
        'Last Transaction': item.lastTransactionDate,
      };
    });
    exportToExcelFile(data, `Posisi_Persediaan_PT_IAS_${getJakartaDateString()}.xlsx`, 'Inventory_Position');
    showToast('success', 'Ekspor Berhasil', `${data.length} baris inventaris diekspor ke Excel dengan rekonsiliasi baseline fisik.`);
  };

  // Submit Consumption
  const handleSubmitConsumption = async (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedMat = activeMaterials.find((m) => m.id === consMatId) || activeMaterials[0];
    const resolvedLoc = activeLocations.find((l) => l.id === consLocId) || activeLocations[0];
    if (!resolvedMat || !resolvedLoc) {
      showToast('error', 'Validasi Gagal', 'Pilih lokasi dan material aktif.');
      return;
    }

    if (Number(consQty) <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas pemakaian harus lebih dari 0.');
      return;
    }

    setIsSubmittingCons(true);
    try {
      const ok = await recordConsumption({
        date: consDate,
        locationId: resolvedLoc.id,
        locationName: resolvedLoc.name,
        areaOrToilet: consArea.trim(),
        shift: consShift,
        materialId: resolvedMat.id,
        materialCode: resolvedMat.materialCode,
        materialName: resolvedMat.materialName,
        variantValue: resolvedMat.variantValue,
        quantityUsed: Number(consQty),
        unit: resolvedMat.unit,
        operator: currentUser?.fullName || 'Petugas',
        notes: consNotes.trim(),
      });

      if (ok) {
        setConsumptionModalOpen(false);
        setConsQty(10);
        setConsNotes('');
      }
    } finally {
      setIsSubmittingCons(false);
    }
  };

  // Submit Trolley
  const handleSubmitTrolley = async (e: React.FormEvent) => {
    e.preventDefault();
    const loc = activeLocations.find((l) => l.id === trolleyLocId) || activeLocations[0];
    if (!loc) {
      showToast('error', 'Validasi Gagal', 'Pilih lokasi penempatan trolley.');
      return;
    }

    if (Number(trolleyQty) <= 0) {
      showToast('error', 'Validasi Gagal', 'Jumlah unit trolley harus lebih dari 0.');
      return;
    }

    setIsSubmittingTrolley(true);
    try {
      const ok = await saveMorganTrolley({
        quantity: Number(trolleyQty),
        locationId: loc.id,
        locationName: loc.name,
        area: trolleyArea.trim(),
        placement: trolleyPlacement.trim(),
        condition: trolleyCondition,
        personInCharge: trolleyPic.trim(),
        lastCheckDate: getJakartaDateString(),
        notes: trolleyNotes.trim(),
      });
      if (ok) {
        setTrolleyModalOpen(false);
        setTrolleyQty(1);
        setTrolleyNotes('');
      }
    } finally {
      setIsSubmittingTrolley(false);
    }
  };

  const handleConfirmDeleteTrolley = async () => {
    if (!confirmDeleteTrolleyId) return;
    setIsDeletingTrolley(true);
    try {
      const ok = await deleteMorganTrolley(confirmDeleteTrolleyId);
      if (ok) {
        setConfirmDeleteTrolleyId(null);
      }
    } finally {
      setIsDeletingTrolley(false);
    }
  };

  // Submit Supply Request
  const handleSubmitSupplyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const mat = activeMaterials.find((m) => m.id === reqMatId) || activeMaterials[0];
    const loc = activeLocations.find((l) => l.id === reqLocId) || activeLocations[0];
    if (!mat || !loc) {
      showToast('error', 'Validasi Gagal', 'Pilih lokasi pemohon dan material aktif.');
      return;
    }

    if (Number(reqQty) <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas permintaan harus lebih dari 0.');
      return;
    }

    setIsSubmittingReq(true);
    try {
      const ok = await createSupplyRequest({
        requestingLocationId: loc.id,
        requestingUnit: reqUnitName.trim(),
        materialId: mat.id,
        requestedQuantity: Number(reqQty),
        notes: reqNotes.trim(),
      });
      if (ok) {
        setRequestModalOpen(false);
        setReqQty(50);
        setReqNotes('');
      }
    } finally {
      setIsSubmittingReq(false);
    }
  };

  // Confirm Partial/Full Supply Receipt
  const handleConfirmReceiveSupply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveTargetId) return;

    if (Number(receiveQtyInput) <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas penerimaan harus lebih dari 0.');
      return;
    }

    if (activeReceiveTarget && Number(receiveQtyInput) > activeReceiveTarget.outstandingQuantity) {
      showToast(
        'error',
        'Melebihi Sisa Outstanding',
        `Kuantitas diterima (${receiveQtyInput}) melebihi sisa outstanding (${activeReceiveTarget.outstandingQuantity}).`
      );
      return;
    }

    setIsSubmittingReceive(true);
    try {
      const ok = await receiveSupplyRequest(receiveTargetId, Number(receiveQtyInput), receiveRefDoc.trim());
      if (ok) {
        setReceiveTargetId(null);
        setReceiveQtyInput(10);
        setReceiveRefDoc('');
      }
    } finally {
      setIsSubmittingReceive(false);
    }
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Posisi Persediaan & Modul Operasional" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Posisi Persediaan & Operasional Logistik
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
              {filteredInventory.length} Saldo Lokasi
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Physical Opening = Baseline Stock Opname Resmi | Closing = Saldo Otoritatif Real-Time (/inventory.availableStock)
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMigrationDryRunModalOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
            title="Buka pratinjau simulasi migrasi baseline fisik tanpa mutasi data produksi"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Simulasi Baseline (Dry-Run)</span>
          </button>
          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            <span>Ekspor Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Sub-Tabs Navigation (Operational Modules from Excel reference) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 text-xs">
        {[
          { id: 'ALL_INVENTORY', label: 'Semua Saldo Stok (Ledger)', icon: Boxes },
          { id: 'TOILET_BUILDING', label: 'Stok Toilet & Gedung (T1 B & C)', icon: Building2 },
          { id: 'CONSUMPTION_RECORDS', label: `Pemakaian Tissue & Plastik (${consumptions.length})`, icon: Clock },
          { id: 'POLYBAG_SIZES', label: 'Stok Polybag (Per Ukuran)', icon: Trash },
          { id: 'UNIFORM_SIZES', label: 'Stok Uniform (Per Size)', icon: Shirt },
          { id: 'MORGAN_TROLLEY', label: `Data Morgan Trolley (${morganTrolleys.length})`, icon: Truck },
          { id: 'REQUESTS_RECEIPTS', label: `Permintaan & Penerimaan (${supplyRequests.length})`, icon: Package },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveSubTab(tab.id as PosisiSubTab);
                setSearchTerm('');
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 font-bold rounded-t-xl transition whitespace-nowrap border-b-2 ${
                isActive
                  ? 'border-[#064e3b] text-[#064e3b] bg-emerald-50/50'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* VIEW 1: ALL INVENTORY / TOILET & BUILDING */}
      {/* ------------------------------------------------------------------ */}
      {(activeSubTab === 'ALL_INVENTORY' || activeSubTab === 'TOILET_BUILDING') && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cari kode material, nama, varian, lokasi..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
                />
              </div>

              <div>
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="ALL">Semua Lokasi Gudang / Hub</option>
                  {activeLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="ALL">Semua Kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  <option value="ALL">Semua Status Stok</option>
                  <option value="NORMAL">Normal (Aman)</option>
                  <option value="MENIPIS">Menipis (≤ ROP)</option>
                  <option value="KRITIS">Kritis (≤ Min)</option>
                </select>
              </div>

              <div>
                <select
                  value={selectedBaselineStatus}
                  onChange={(e) => setSelectedBaselineStatus(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white font-medium"
                >
                  <option value="ALL">Semua Status Baseline</option>
                  <option value="VERIFIED">VERIFIED (Fisik Disetujui)</option>
                  <option value="UNVERIFIED">UNVERIFIED (Belum Ada)</option>
                  <option value="REVIEW_REQUIRED">REVIEW REQUIRED (Perlu Tinjauan)</option>
                  <option value="RECONCILIATION_EXCEPTION">RECONCILIATION EXCEPTION (Anomali/Defisit)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Material Code</th>
                    <th className="py-3 px-4">Material Name</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Lokasi Gudang</th>
                    <th className="py-3 px-4 text-right">Physical Opening</th>
                    <th className="py-3 px-4 text-right text-emerald-800">Qty IN</th>
                    <th className="py-3 px-4 text-right text-indigo-900">Qty OUT</th>
                    <th className="py-3 px-4 text-right text-amber-900">Penyesuaian</th>
                    <th className="py-3 px-4 text-right">Closing Balance</th>
                    <th className="py-3 px-4">Satuan</th>
                    <th className="py-3 px-4 text-center">Status Baseline</th>
                    <th className="py-3 px-4 text-center">Status Stok</th>
                    <th className="py-3 px-4">Last Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(activeSubTab === 'TOILET_BUILDING' ? toiletBuildingItems : filteredInventory).length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-400">
                        Belum ada data saldo stok inventaris yang terdaftar.
                      </td>
                    </tr>
                  ) : (
                    (activeSubTab === 'TOILET_BUILDING' ? toiletBuildingItems : filteredInventory).map((item) => {
                    const isCritical = item.availableStock <= item.minimumStock;
                    const isLow = item.availableStock > item.minimumStock && item.availableStock <= item.reorderPoint;
                    const isNegative = item.availableStock < 0;
                    const summary = itemSummaryMap.get(item.id);
                    const baselineStatus = summary?.baselineStatus || 'UNVERIFIED';

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.materialCode || item.itemCode}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 max-w-[200px]">
                          <div className="truncate" title={item.materialName || item.itemName}>{item.materialName || item.itemName}</div>
                          {item.variantValue && (
                            <span className="inline-block mt-0.5 px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 font-mono text-[10px] border border-blue-200">
                              {item.variantValue}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{item.categoryName}</td>
                        <td className="py-3 px-4 text-slate-700">{item.locationName}</td>
                        <td className="py-3 px-4 text-right font-mono">
                          {summary?.baseline ? (
                            <button
                              onClick={() => setTraceModalSummary(summary)}
                              className="inline-flex items-center gap-1 font-bold text-emerald-800 hover:text-emerald-950 hover:underline bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200"
                              title={`Terverifikasi dari ${summary.baseline.stockOpnameNumber}. Klik untuk audit jejak fisik.`}
                            >
                              <span>{summary.baselineQuantity.toLocaleString('id-ID')}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          ) : baselineStatus === 'RECONCILIATION_EXCEPTION' ? (
                            <button
                              onClick={() => summary && setTraceModalSummary(summary)}
                              className="inline-flex items-center gap-1 font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 hover:underline"
                              title={summary?.exceptionReason || 'Anomali rekonsiliasi saldo. Klik untuk rincian.'}
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Unverified</span>
                            </button>
                          ) : baselineStatus === 'REVIEW_REQUIRED' ? (
                            <button
                              onClick={() => summary && setTraceModalSummary(summary)}
                              className="inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 hover:underline"
                              title={summary?.exceptionReason || 'Perlu verifikasi / rekonsiliasi stock opname'}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              <span>Unverified</span>
                            </button>
                          ) : (
                            <button
                              onClick={() => summary && setTraceModalSummary(summary)}
                              className="text-slate-500 italic text-[11px] hover:underline"
                              title="Belum pernah dilakukan stock opname fisik resmi. Tidak menampilkan 0 agar tidak keliru sebagai stok terhitung."
                            >
                              Unverified
                            </button>
                          )}
                        </td>
                        <td
                          className="py-3 px-4 text-right font-mono font-bold text-emerald-700"
                          title={summary?.hasLegacyCountersFallback ? 'Menggunakan counter /inventory historis (pre-ledger)' : 'Mutasi ledger pasca-cutoff'}
                        >
                          +{summary ? summary.qtyIn : item.qtyIn}
                        </td>
                        <td
                          className="py-3 px-4 text-right font-mono font-bold text-indigo-800"
                          title={summary?.hasLegacyCountersFallback ? 'Menggunakan counter /inventory historis (pre-ledger)' : 'Mutasi ledger pasca-cutoff'}
                        >
                          -{summary ? summary.qtyOut : item.qtyOut}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-800">
                          {(summary ? summary.adjustments : (item.totalAdjustments || 0)) >= 0 ? '+' : ''}
                          {summary ? summary.adjustments : (item.totalAdjustments || 0)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono">
                          {isNegative ? (
                            <span className="inline-flex items-center gap-1 font-black text-sm text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-300">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              <span>{item.availableStock.toLocaleString('id-ID')}</span>
                            </span>
                          ) : (
                            <span className="font-extrabold text-sm text-slate-900">
                              {item.availableStock.toLocaleString('id-ID')}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{item.unit}</td>
                        <td className="py-3 px-4 text-center">
                          {baselineStatus === 'VERIFIED' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <ShieldCheck className="w-3 h-3 text-emerald-700" />
                              VERIFIED
                            </span>
                          ) : baselineStatus === 'RECONCILIATION_EXCEPTION' ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200"
                              title={summary?.exceptionReason}
                            >
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              RECONCILIATION EXCEPTION
                            </span>
                          ) : baselineStatus === 'REVIEW_REQUIRED' ? (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200"
                              title={summary?.exceptionReason}
                            >
                              <AlertTriangle className="w-3 h-3 text-amber-600" />
                              REVIEW REQUIRED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                              <HelpCircle className="w-3 h-3 text-slate-400" />
                              UNVERIFIED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isNegative ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white shadow-2xs">
                              DEFISIT
                            </span>
                          ) : isCritical ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                              KRITIS
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              MENIPIS
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              NORMAL
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-slate-500 text-[11px]">{item.lastTransactionDate}</td>
                      </tr>
                    );
                  })
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW 2: TISSUE & PLASTIC CONSUMPTION (Harian / Shift) */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'CONSUMPTION_RECORDS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Pencatatan Pemakaian Harian (Tissue, Plastik, & Chemical)
              </h3>
              <p className="text-xs text-slate-500">
                Dokumentasi log pemakaian aktual per shift kerja dan zona toilet Terminal 1B & 1C
              </p>
            </div>

            {canMutate && (
              <button
                onClick={() => setConsumptionModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Catat Pemakaian Harian / Shift</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Lokasi Terminal</th>
                    <th className="py-3 px-4">Toilet / Area Kerja</th>
                    <th className="py-3 px-4">Shift</th>
                    <th className="py-3 px-4">Material Yang Digunakan</th>
                    <th className="py-3 px-4 text-right">Kuantitas Terpakai</th>
                    <th className="py-3 px-4">Satuan</th>
                    <th className="py-3 px-4">Petugas / Operator</th>
                    <th className="py-3 px-4">Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {consumptions.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        Belum ada pencatatan pemakaian harian (tissue, plastik, & chemical).
                      </td>
                    </tr>
                  ) : (
                    consumptions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800">{c.date}</td>
                      <td className="py-3 px-4 font-semibold text-slate-900">{c.locationName}</td>
                      <td className="py-3 px-4 text-slate-700">{c.areaOrToilet}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-[10px] font-bold">
                          {c.shift}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {c.materialName}
                        {c.variantValue && <span className="ml-1 text-slate-400 font-mono">({c.variantValue})</span>}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-sm text-indigo-900">
                        {c.quantityUsed}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{c.unit}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">{c.operator}</td>
                      <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate" title={c.notes}>
                        {c.notes || '-'}
                      </td>
                    </tr>
                  ))
                )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW 3: POLYBAG SIZES */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'POLYBAG_SIZES' && (
        <div className="space-y-4">
          <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
            <h4 className="font-bold text-emerald-950 text-xs">Spesifikasi Ukuran Polybag Sampah Terminal</h4>
            <p className="text-xs text-emerald-900/80 mt-0.5">
              Setiap ukuran kantong plastik sampah (40x50, 60x100, 90x120) dicatat secara terpisah agar tidak tercampur dalam saldo fisik (Aturan 2.7).
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">Material Code</th>
                  <th className="py-3 px-4">Nama Ukuran Polybag</th>
                  <th className="py-3 px-4">Varian Dimensi</th>
                  <th className="py-3 px-4">Lokasi Gudang</th>
                  <th className="py-3 px-4 text-right">Saldo Saat Ini</th>
                  <th className="py-3 px-4">Satuan</th>
                  <th className="py-3 px-4 text-center">Batas Min</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {polybagItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Belum ada data stok polybag per ukuran yang terdaftar.
                    </td>
                  </tr>
                ) : (
                  polybagItems.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.materialCode}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{p.materialName}</td>
                    <td className="py-3 px-4 font-mono text-blue-800 font-semibold">{p.variantValue || '-'}</td>
                    <td className="py-3 px-4 text-slate-700">{p.locationName}</td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-sm text-slate-900">{p.availableStock}</td>
                    <td className="py-3 px-4 text-slate-600">{p.unit}</td>
                    <td className="py-3 px-4 text-center font-mono">{p.minimumStock}</td>
                    <td className="py-3 px-4 text-center font-bold text-[10px]">
                      {p.availableStock <= p.minimumStock ? (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded">KRITIS</span>
                      ) : (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">NORMAL</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW 4: UNIFORM SIZES */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'UNIFORM_SIZES' && (
        <div className="space-y-4">
          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl">
            <h4 className="font-bold text-blue-950 text-xs">Varian Ukuran Seragam Kerja (S, M, L, XL, XXL)</h4>
            <p className="text-xs text-blue-900/80 mt-0.5">
              Saldo seragam personil terdistribusi presisi per ukuran spesifik tanpa digabungkan (Aturan 2.7).
            </p>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">Material Code</th>
                  <th className="py-3 px-4">Item Seragam</th>
                  <th className="py-3 px-4 text-center">Ukuran (Size)</th>
                  <th className="py-3 px-4">Lokasi Gudang</th>
                  <th className="py-3 px-4 text-right">Saldo Fisik</th>
                  <th className="py-3 px-4">Satuan</th>
                  <th className="py-3 px-4 text-center">Batas Min</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {uniformItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Belum ada data stok seragam per size yang terdaftar.
                    </td>
                  </tr>
                ) : (
                  uniformItems.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{u.materialCode}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{u.materialName}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="px-2.5 py-1 rounded bg-slate-900 text-white font-mono font-bold text-xs">
                        {u.variantValue || 'M'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{u.locationName}</td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-sm text-slate-900">{u.availableStock}</td>
                    <td className="py-3 px-4 text-slate-600">{u.unit}</td>
                    <td className="py-3 px-4 text-center font-mono">{u.minimumStock}</td>
                    <td className="py-3 px-4 text-center font-bold text-[10px]">
                      {u.availableStock <= u.minimumStock ? (
                        <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded">KRITIS</span>
                      ) : (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">NORMAL</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW 5: DATA MORGAN TROLLEY */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'MORGAN_TROLLEY' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Distribusi & Kondisi Morgan Trolley Janitorial
              </h3>
              <p className="text-xs text-slate-500">
                Pencatatan penempatan troli dorong per area curbside dan airside Terminal 1B & 1C
              </p>
            </div>

            {canMutate && (
              <button
                onClick={() => setTrolleyModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Penempatan Trolley</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
                <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">Lokasi Terminal</th>
                  <th className="py-3 px-4">Area / Zona</th>
                  <th className="py-3 px-4">Titik Stanby (Placement)</th>
                  <th className="py-3 px-4 text-right">Kuantitas Unit</th>
                  <th className="py-3 px-4 text-center">Kondisi Fisik</th>
                  <th className="py-3 px-4">PIC Lapangan</th>
                  <th className="py-3 px-4 font-mono">Pengecekan Terakhir</th>
                  <th className="py-3 px-4">Catatan Kondisi</th>
                  {isAdmin && <th className="py-3 px-4 text-center">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {morganTrolleys.length === 0 ? (
                  <tr>
                    <td colSpan={isAdmin ? 9 : 8} className="py-12 text-center text-slate-400">
                      Belum ada penempatan Morgan Trolley yang terdaftar.
                    </td>
                  </tr>
                ) : (
                  morganTrolleys.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-semibold text-slate-900">{t.locationName}</td>
                    <td className="py-3 px-4 font-medium text-slate-800">{t.area}</td>
                    <td className="py-3 px-4 text-slate-700">{t.placement}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sm text-slate-900">
                      {t.quantity} Unit
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          t.condition.includes('Baik')
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : t.condition.includes('Ringan')
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {t.condition}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-800">{t.personInCharge}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{t.lastCheckDate}</td>
                    <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate" title={t.notes}>
                      {t.notes || '-'}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTrolleyId(t.id)}
                          className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition"
                          title="Hapus Penempatan Trolley (Admin)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VIEW 6: REQUESTS AND RECEIPTS (OUTSTANDING TRACKER) */}
      {/* ------------------------------------------------------------------ */}
      {activeSubTab === 'REQUESTS_RECEIPTS' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Permintaan & Penerimaan Barang (Outstanding Supply Tracker)
              </h3>
              <p className="text-xs text-slate-500">
                Perhitungan otomatis sisa pemenuhan: <strong>Outstanding Quantity = Requested - Received</strong> (Aturan Bisnis 8)
              </p>
            </div>

            {canMutate && (
              <button
                onClick={() => setRequestModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Permintaan Barang Baru</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">No Request</th>
                  <th className="py-3 px-4">Tanggal</th>
                  <th className="py-3 px-4">Lokasi Pemohon</th>
                  <th className="py-3 px-4">Item Material</th>
                  <th className="py-3 px-4 text-right">Diminta (Req)</th>
                  <th className="py-3 px-4 text-right text-emerald-800">Diterima (Rec)</th>
                  <th className="py-3 px-4 text-right text-rose-700">Sisa Outstanding</th>
                  <th className="py-3 px-4">Satuan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi Penerimaan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supplyRequests.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-12 text-center text-slate-400">
                      Belum ada permintaan barang (supply request) yang terdaftar.
                    </td>
                  </tr>
                ) : (
                  supplyRequests.map((r) => {
                    const normStatus = normalizeSupplyRequestStatus(r.status);
                    return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-mono font-bold text-blue-900">{r.requestNumber}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{r.requestDate}</td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{r.requestingLocationName}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">{r.materialName}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-800">{r.requestedQuantity}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">{r.receivedQuantity}</td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-sm text-rose-700">
                      {r.outstandingQuantity}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{r.unit}</td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          normStatus === 'RECEIVED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : normStatus === 'PARTIALLY_RECEIVED'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : normStatus === 'CANCELLED'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {normStatus}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {normStatus !== 'RECEIVED' && normStatus !== 'CANCELLED' && r.outstandingQuantity > 0 && canMutate ? (
                        <button
                          onClick={() => {
                            setReceiveTargetId(r.id);
                            setReceiveQtyInput(r.outstandingQuantity);
                            setReceiveRefDoc(`DO-REC-${Date.now().toString().slice(-4)}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-2xs"
                        >
                          Terima Barang
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[11px]">
                          {normStatus === 'CANCELLED' ? 'Dibatalkan' : 'Selesai'}
                        </span>
                      )}
                    </td>
                  </tr>
                    );
                  })
              )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: INPUT PEMAKAIAN HARIAN / SHIFT */}
      {/* ------------------------------------------------------------------ */}
      {consumptionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSubmitConsumption}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                Pencatatan Pemakaian Harian (Tissue & Plastik)
              </h3>
              <button
                type="button"
                onClick={() => setConsumptionModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Tanggal *</label>
                  <input
                    type="date"
                    required
                    value={consDate}
                    onChange={(e) => setConsDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Shift Kerja *</label>
                  <select
                    value={consShift}
                    onChange={(e) => setConsShift(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Shift 1">Shift 1 (07:00 - 15:00)</option>
                    <option value="Shift 2">Shift 2 (15:00 - 23:00)</option>
                    <option value="Shift 3">Shift 3 (23:00 - 07:00)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Lokasi Terminal *</label>
                  <select
                    value={consLocId}
                    onChange={(e) => setConsLocId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {activeLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Toilet / Area Kerja *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Area Toilet Kedatangan Gate 1B"
                    value={consArea}
                    onChange={(e) => setConsArea(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Pilih Material *</label>
                <select
                  value={consMatId}
                  onChange={(e) => setConsMatId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
                >
                  {activeMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.materialCode} - {m.materialName} ({m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-bold">Kuantitas Terpakai *</label>
                  <span className="text-[11px] font-mono text-slate-600">
                    Fisik: <strong>{selectedConsStockInfo.physical}</strong> • Bebas Reservasi:{' '}
                    <strong className={selectedConsStockInfo.unreserved <= 0 ? 'text-rose-700' : 'text-emerald-700'}>
                      {selectedConsStockInfo.unreserved} {selectedConsStockInfo.unit}
                    </strong>
                  </span>
                </div>
                <input
                  type="number"
                  min="1"
                  max={selectedConsStockInfo.unreserved > 0 ? selectedConsStockInfo.unreserved : undefined}
                  required
                  value={consQty}
                  onChange={(e) => setConsQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-base"
                />
                {consQty > selectedConsStockInfo.unreserved && (
                  <p className="text-[11px] text-rose-700 font-semibold mt-1">
                    Kuantitas melebihi saldo bebas reservasi ({selectedConsStockInfo.unreserved} {selectedConsStockInfo.unit}).
                  </p>
                )}
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Catatan</label>
                <textarea
                  rows={2}
                  placeholder="Keterangan kondisi traffic penumpang, kehabisan stok, dll..."
                  value={consNotes}
                  onChange={(e) => setConsNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isSubmittingCons}
                onClick={() => setConsumptionModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingCons || consQty <= 0 || consQty > selectedConsStockInfo.unreserved}
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46] disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingCons && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmittingCons ? 'Menyimpan...' : 'Simpan & Potong Saldo'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: NEW MORGAN TROLLEY PLACEMENT */}
      {/* ------------------------------------------------------------------ */}
      {trolleyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSubmitTrolley}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Tambah Data Morgan Trolley</h3>
              <button type="button" onClick={() => setTrolleyModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Lokasi Terminal *</label>
                  <select
                    value={trolleyLocId}
                    onChange={(e) => setTrolleyLocId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {activeLocations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Jumlah Unit *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={trolleyQty}
                    onChange={(e) => setTrolleyQty(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Zona / Area Kerja *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Curbside Pintu 1 - 4"
                  value={trolleyArea}
                  onChange={(e) => setTrolleyArea(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Titik Stanby (Placement) *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Pos Janitor Timur 1B"
                  value={trolleyPlacement}
                  onChange={(e) => setTrolleyPlacement(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Kondisi Fisik *</label>
                  <select
                    value={trolleyCondition}
                    onChange={(e) => setTrolleyCondition(e.target.value as any)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Baik (Good)">Baik (Good)</option>
                    <option value="Perbaikan Ringan (Minor)">Perbaikan Ringan (Minor)</option>
                    <option value="Rusak Berat (Damaged)">Rusak Berat (Damaged)</option>
                  </select>
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">PIC Lapangan</label>
                  <input
                    type="text"
                    value={trolleyPic}
                    onChange={(e) => setTrolleyPic(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Catatan</label>
                <input
                  type="text"
                  value={trolleyNotes}
                  onChange={(e) => setTrolleyNotes(e.target.value)}
                  placeholder="Roda lancar, kantong vinyl utuh..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                disabled={isSubmittingTrolley}
                onClick={() => setTrolleyModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingTrolley}
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46] disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingTrolley && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmittingTrolley ? 'Menyimpan...' : 'Simpan Data Trolley'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirm Delete Morgan Trolley Modal (Admin) */}
      {confirmDeleteTrolleyId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-xs space-y-4">
            <div className="flex items-center gap-2 text-rose-700 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              <span>Hapus Catatan Morgan Trolley?</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Tindakan ini menghapus catatan penempatan Morgan Trolley dari Firestore secara permanen dan tercatat di Audit Trail.
            </p>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isDeletingTrolley}
                onClick={() => setConfirmDeleteTrolleyId(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeletingTrolley}
                onClick={handleConfirmDeleteTrolley}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50 flex items-center gap-1.5"
              >
                {isDeletingTrolley && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isDeletingTrolley ? 'Menghapus...' : 'Ya, Hapus Data'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: NEW SUPPLY REQUEST */}
      {/* ------------------------------------------------------------------ */}
      {requestModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSubmitSupplyRequest}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Buat Permintaan Suplai Barang</h3>
              <button type="button" onClick={() => setRequestModalOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-700 font-bold block mb-1">Gudang / Lokasi Pemohon *</label>
                <select
                  value={reqLocId}
                  onChange={(e) => setReqLocId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                >
                  {activeLocations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Unit Pemohon *</label>
                <input
                  type="text"
                  required
                  value={reqUnitName}
                  onChange={(e) => setReqUnitName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Pilih Material *</label>
                <select
                  value={reqMatId}
                  onChange={(e) => setReqMatId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-semibold"
                >
                  {activeMaterials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.materialCode} - {m.materialName} ({m.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Kuantitas Permintaan *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={reqQty}
                  onChange={(e) => setReqQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-base"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Catatan Tambahan</label>
                <textarea
                  rows={2}
                  value={reqNotes}
                  onChange={(e) => setReqNotes(e.target.value)}
                  placeholder="Kebutuhan mendesak atau pengiriman bertahap..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                disabled={isSubmittingReq}
                onClick={() => setRequestModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingReq}
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46] disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingReq && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmittingReq ? 'Mengirim...' : 'Kirim Permintaan'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: RECEIVE SUPPLY (PARTIAL / FULL) */}
      {/* ------------------------------------------------------------------ */}
      {receiveTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <form
            onSubmit={handleConfirmReceiveSupply}
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in text-xs"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h3 className="font-bold text-slate-900 text-sm">Konfirmasi Penerimaan Barang</h3>
              <button type="button" onClick={() => setReceiveTargetId(null)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-bold">Kuantitas Masuk Aktual *</label>
                  {activeReceiveTarget && (
                    <span className="text-[11px] font-mono text-slate-500">
                      Maks: {activeReceiveTarget.outstandingQuantity} {activeReceiveTarget.unit}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  max={activeReceiveTarget?.outstandingQuantity || undefined}
                  required
                  value={receiveQtyInput}
                  onChange={(e) => setReceiveQtyInput(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-base"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Nomor Referensi (DO/Surat Jalan)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: DO-2026/10/44"
                  value={receiveRefDoc}
                  onChange={(e) => setReceiveRefDoc(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                />
              </div>

              <div className="p-2.5 bg-emerald-50 rounded-lg text-[11px] text-emerald-900">
                Penerimaan ini akan otomatis memotong sisa outstanding dan menambahkan saldo fisik ke lokasi pemohon melalui ledger atomik.
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                disabled={isSubmittingReceive}
                onClick={() => setReceiveTargetId(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingReceive || receiveQtyInput <= 0}
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmittingReceive && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmittingReceive ? 'Memposting...' : 'Posting Penerimaan'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: BASELINE PHYSICAL COUNT TRACEABILITY */}
      {/* ------------------------------------------------------------------ */}
      {traceModalSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 text-xs space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Audit Jejak Fisik & Rekonsiliasi Baseline
                  </h3>
                  <p className="text-slate-500 text-[11px]">
                    Traceability resmi Stock Opname sebagai saldo awal operasional
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTraceModalSummary(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl space-y-2 border border-slate-100">
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Material:</span>
                <span className="font-bold text-slate-900">{traceModalSummary.materialId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-medium">Lokasi Gudang:</span>
                <span className="font-bold text-slate-900">{traceModalSummary.locationId}</span>
              </div>
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium">Status Verifikasi:</span>
                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                  traceModalSummary.baselineStatus === 'VERIFIED'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    : traceModalSummary.baselineStatus === 'RECONCILIATION_EXCEPTION'
                    ? 'bg-rose-100 text-rose-800 border border-rose-200'
                    : traceModalSummary.baselineStatus === 'REVIEW_REQUIRED'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-slate-100 text-slate-700 border border-slate-200'
                }`}>
                  {traceModalSummary.baselineStatus.replace(/_/g, ' ')}
                </span>
              </div>
            </div>

            {/* Baseline Source Opname Data */}
            {traceModalSummary.baseline ? (
              <div className="border border-emerald-200 bg-emerald-50/50 p-3.5 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-emerald-900 flex items-center gap-1.5 uppercase tracking-wide">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Sumber Stock Opname Resmi:</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Nomor Opname:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {traceModalSummary.baseline.stockOpnameNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Kuantitas Fisik Terhitung:</span>
                    <span className="font-mono font-extrabold text-emerald-800 text-sm">
                      {traceModalSummary.baseline.baselineQuantity} {traceModalSummary.baseline.unit}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Cutoff Penghitungan Fisik:</span>
                    <span className="font-mono text-slate-700">
                      {traceModalSummary.baseline.countCompletedAt}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Disetujui Oleh Admin:</span>
                    <span className="font-medium text-slate-800">
                      {traceModalSummary.baseline.approvedBy}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border border-amber-200 bg-amber-50 p-3.5 rounded-xl space-y-1.5 text-amber-900">
                <div className="font-bold flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-amber-700" />
                  <span>Belum Memiliki Baseline Fisik Terverifikasi</span>
                </div>
                <p className="text-[11px] text-amber-800">
                  Material pada lokasi ini belum pernah melewati persetujuan Stock Opname fisik resmi. Saldo awal saat ini bernilai 0 dan memerlukan penghitungan fisik langsung.
                </p>
              </div>
            )}

            {/* Reconciliation Proof Breakdown */}
            <div className="border border-slate-200 rounded-xl p-3.5 space-y-2.5">
              <div className="font-bold text-slate-800 text-[11px] uppercase tracking-wide">
                Rekonsiliasi Mutasi Pasca-Cutoff (Non-Double Count):
              </div>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex justify-between text-slate-700">
                  <span>Saldo Awal Fisik (Opening Baseline):</span>
                  <span className="font-bold">{traceModalSummary.baselineQuantity}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>+ Mutasi Masuk Pasca-Cutoff (Qty IN):</span>
                  <span>+{traceModalSummary.qtyIn}</span>
                </div>
                <div className="flex justify-between text-indigo-800">
                  <span>- Mutasi Keluar Pasca-Cutoff (Qty OUT):</span>
                  <span>-{traceModalSummary.qtyOut}</span>
                </div>
                <div className="flex justify-between text-amber-800">
                  <span>± Penyesuaian Opname Lanjutan:</span>
                  <span>{traceModalSummary.adjustments >= 0 ? '+' : ''}{traceModalSummary.adjustments}</span>
                </div>
                <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900 text-xs">
                  <span>= Saldo Rekonstruksi Akhir:</span>
                  <span>{traceModalSummary.reconstructedClosing}</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[10px]">
                  <span>Saldo Otoritatif Saat Ini (/inventory):</span>
                  <span>{traceModalSummary.authoritativeBalance}</span>
                </div>
                <div className={`flex justify-between font-bold text-[11px] pt-1 border-t border-dashed ${
                  traceModalSummary.isReconciled ? 'text-emerald-700' : 'text-rose-700'
                }`}>
                  <span>Selisih Rekonsiliasi:</span>
                  <span>{traceModalSummary.reconciliationDifference} ({traceModalSummary.isReconciled ? 'PARITAS PASS' : 'MISMATCH'})</span>
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setTraceModalSummary(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition"
              >
                Tutup Audit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: DEVELOPMENT BASELINE MIGRATION DRY-RUN PREVIEW (PHASE 7) */}
      {/* ------------------------------------------------------------------ */}
      {migrationDryRunModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col p-6 shadow-2xl border border-slate-200 text-xs space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">
                    Simulasi Pratinjau Migrasi Baseline Fisik (Dry-Run Preview)
                  </h3>
                  <p className="text-slate-500 text-[11px]">
                    Lingkungan Pengujian & Pengembangan — Strict Read-Only (Nol Penulisan ke Firestore Produksi)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMigrationDryRunModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-blue-950 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0" />
                <span>
                  Simulasi ini mengevaluasi Stock Opname fisik kandidat tanpa mengubah dokumen Firestore produksi.
                </span>
              </div>
              <span className="font-mono font-bold text-[11px] bg-white px-2 py-0.5 rounded border border-blue-200">
                Mode Dry-Run
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px]">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block">Total Gudang</span>
                <span className="font-mono font-extrabold text-slate-900 text-sm">{dryRunReport.totalWarehouseBalances}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-700 block">Kandidat PASS</span>
                <span className="font-mono font-extrabold text-emerald-800 text-sm">{dryRunReport.verifiedCandidateCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-amber-700 block">Unverified</span>
                <span className="font-mono font-extrabold text-amber-800 text-sm">{dryRunReport.unverifiedCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-orange-50 border border-orange-200">
                <span className="text-orange-700 block">Review Req.</span>
                <span className="font-mono font-extrabold text-orange-800 text-sm">{dryRunReport.reviewRequiredCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
                <span className="text-rose-700 block">Exception</span>
                <span className="font-mono font-extrabold text-rose-800 text-sm">{dryRunReport.exceptionCount}</span>
              </div>
              <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-blue-700 block">Duplikat / No TS</span>
                <span className="font-mono font-extrabold text-blue-900 text-sm">
                  {dryRunReport.duplicateCandidateConflicts} / {dryRunReport.missingTimestampCount}
                </span>
              </div>
            </div>

            {/* Dry-Run Register Table */}
            <div className="flex-1 overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-100 text-slate-700 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">SKU Material</th>
                    <th className="py-2.5 px-3">Gudang</th>
                    <th className="py-2.5 px-3">Kandidat Opname</th>
                    <th className="py-2.5 px-3 text-right">Fisik Baseline</th>
                    <th className="py-2.5 px-3 text-right">Post-Count (+/-)</th>
                    <th className="py-2.5 px-3 text-right">Closing Otoritatif</th>
                    <th className="py-2.5 px-3 text-right">Rekonstruksi</th>
                    <th className="py-2.5 px-3 text-center">Status Audit</th>
                    <th className="py-2.5 px-3">Catatan & Eksepsi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                  {dryRunReport.rows.map((row) => {
                    const isCandidatePassed = row.auditStatus === 'PASS';
                    const isNegative = row.authoritativeClosing < 0;

                    return (
                      <tr key={row.balanceId} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-bold text-slate-900">{row.materialCode}</td>
                        <td className="py-2.5 px-3 text-slate-600 font-sans">{row.locationName}</td>
                        <td className="py-2.5 px-3 text-slate-800">
                          <div>{row.candidateOpnameNumber || '-'}</div>
                          {row.duplicateCandidatesCount > 0 && (
                            <span className="text-[9px] font-sans text-amber-700 font-bold">
                              +{row.duplicateCandidatesCount} kandidat ganda
                            </span>
                          )}
                          {row.missingTimestampFlag && (
                            <span className="text-[9px] font-sans text-rose-700 font-bold block">
                              Timestamp cutoff hilang
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-800">
                          {row.proposedBaselineQty !== null ? row.proposedBaselineQty : '-'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-slate-600">
                          {row.postCountMovementsCount > 0 ? (
                            <span>
                              +{row.postCountQtyIn} / -{row.postCountQtyOut}
                            </span>
                          ) : (
                            '0'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-extrabold text-slate-900">
                          {isNegative ? (
                            <span className="text-rose-600 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                              {row.authoritativeClosing}
                            </span>
                          ) : (
                            row.authoritativeClosing
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-slate-700">
                          {row.reconstructedClosing}
                        </td>
                        <td className="py-2.5 px-3 text-center font-sans">
                          {isCandidatePassed ? (
                            <span className="px-2 py-0.5 rounded-full font-extrabold text-[9px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                              PASS
                            </span>
                          ) : row.auditStatus === 'RECONCILIATION_EXCEPTION' ? (
                            <span className="px-2 py-0.5 rounded-full font-extrabold text-[9px] bg-rose-100 text-rose-800 border border-rose-200">
                              RECONCILIATION EXCEPTION
                            </span>
                          ) : row.auditStatus === 'REVIEW_REQUIRED' ? (
                            <span className="px-2 py-0.5 rounded-full font-extrabold text-[9px] bg-amber-100 text-amber-800 border border-amber-200">
                              REVIEW REQUIRED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full font-bold text-[9px] bg-slate-100 text-slate-600 border border-slate-200">
                              UNVERIFIED
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 font-sans text-[10px]">
                          {row.exceptions.length > 0 ? row.exceptions.join('; ') : row.recommendation}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {dryRunReport.exceptionSummary.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 max-h-24 overflow-y-auto">
                <div className="font-bold mb-1">Laporan Eksepsi Audit ({dryRunReport.exceptionSummary.length}):</div>
                <ul className="list-disc pl-4 space-y-0.5 font-mono text-[10px]">
                  {dryRunReport.exceptionSummary.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
            )}

            {confirmReconcileOpen && (
              <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="text-emerald-950">
                  <span className="font-bold block">Konfirmasi Rekonsiliasi Baseline Terkontrol (Admin Only)</span>
                  <span className="text-[11px] text-emerald-800">
                    Menetapkan {dryRunReport.rows.filter((r) => r.canApplyReconciliation).length} baseline fisik v1 dari Stock Opname ADJUSTED pertama tanpa mengubah histori mutasi atau baseline aktif yang sudah ada.
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={isApplyingReconciliation}
                    onClick={() => setConfirmReconcileOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-semibold"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    disabled={isApplyingReconciliation}
                    onClick={async () => {
                      setIsApplyingReconciliation(true);
                      try {
                        const targetIds = dryRunReport.rows
                          .filter((r) => r.canApplyReconciliation)
                          .map((r) => r.balanceId);
                        await reconcileOpnameBaselines(targetIds);
                        setConfirmReconcileOpen(false);
                      } finally {
                        setIsApplyingReconciliation(false);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold disabled:opacity-50"
                  >
                    {isApplyingReconciliation ? 'Menerapkan...' : 'Ya, Tetapkan Baseline V1'}
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-slate-500">
                Total item diaudit: {dryRunReport.totalWarehouseBalances} saldo gudang (loc-in-transit dikecualikan)
              </span>
              <div className="flex items-center gap-2">
                {currentUser?.role === 'ADMIN' &&
                  dryRunReport.rows.some((r) => r.canApplyReconciliation) &&
                  !confirmReconcileOpen && (
                    <button
                      type="button"
                      onClick={() => setConfirmReconcileOpen(true)}
                      className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold transition flex items-center gap-1.5"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        Terapkan Rekonsiliasi Baseline Terkontrol ({dryRunReport.rows.filter((r) => r.canApplyReconciliation).length})
                      </span>
                    </button>
                  )}
                <button
                  type="button"
                  onClick={() => {
                    setConfirmReconcileOpen(false);
                    setMigrationDryRunModalOpen(false);
                  }}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition"
                >
                  Selesai Pratinjau
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
