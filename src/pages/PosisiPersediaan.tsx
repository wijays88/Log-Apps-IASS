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
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';
import { InventoryBalance } from '../types';
import { exportToExcelFile, exportToCsvFile } from '../utils/excelUtils';

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
    activeMaterials,
    activeLocations,
    categories,
    consumptions,
    morganTrolleys,
    supplyRequests,
    recordConsumption,
    saveMorganTrolley,
    createSupplyRequest,
    receiveSupplyRequest,
    currentUser,
    can,
    showToast,
  } = useApp();

  const [activeSubTab, setActiveSubTab] = useState<PosisiSubTab>('ALL_INVENTORY');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'NORMAL' | 'MENIPIS' | 'KRITIS'>('ALL');

  // Modals state
  const [detailItem, setDetailItem] = useState<InventoryBalance | null>(null);

  // New Consumption modal
  const [consumptionModalOpen, setConsumptionModalOpen] = useState(false);
  const [consDate, setConsDate] = useState(new Date().toISOString().slice(0, 10));
  const [consLocId, setConsLocId] = useState(activeLocations[0]?.id || '');
  const [consArea, setConsArea] = useState('Area Toilet Kedatangan Gate 1B');
  const [consShift, setConsShift] = useState<'Shift 1' | 'Shift 2' | 'Shift 3'>('Shift 1');
  const [consMatId, setConsMatId] = useState(activeMaterials[0]?.id || '');
  const [consQty, setConsQty] = useState(10);
  const [consNotes, setConsNotes] = useState('');

  // New Trolley modal
  const [trolleyModalOpen, setTrolleyModalOpen] = useState(false);
  const [trolleyQty, setTrolleyQty] = useState(1);
  const [trolleyLocId, setTrolleyLocId] = useState(activeLocations[0]?.id || '');
  const [trolleyArea, setTrolleyArea] = useState('Curbside Pintu 1 - 4');
  const [trolleyPlacement, setTrolleyPlacement] = useState('Pos Janitor');
  const [trolleyCondition, setTrolleyCondition] = useState<'Baik (Good)' | 'Perbaikan Ringan (Minor)' | 'Rusak Berat (Damaged)'>('Baik (Good)');
  const [trolleyPic, setTrolleyPic] = useState(currentUser?.fullName || '');
  const [trolleyNotes, setTrolleyNotes] = useState('');

  // New Request modal
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [reqLocId, setReqLocId] = useState(activeLocations[0]?.id || '');
  const [reqUnitName, setReqUnitName] = useState('Divisi Kebersihan Toilet Terminal 1B');
  const [reqMatId, setReqMatId] = useState(activeMaterials[0]?.id || '');
  const [reqQty, setReqQty] = useState(50);
  const [reqNotes, setReqNotes] = useState('');

  // Partial Receive modal
  const [receiveTargetId, setReceiveTargetId] = useState<string | null>(null);
  const [receiveQtyInput, setReceiveQtyInput] = useState(10);
  const [receiveRefDoc, setReceiveRefDoc] = useState('');

  const canMutate = can('CREATE_TRANSACTION').allowed;

  // Filtered Main Inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      const matchSearch =
        item.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

      return matchSearch && matchLoc && matchCat && matchStatus;
    });
  }, [inventory, searchTerm, selectedLocation, selectedCategory, selectedStatus]);

  // Toilet & Building filtered items
  const toiletBuildingItems = useMemo(() => {
    return inventory.filter((item) => {
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

  // Polybag specific items
  const polybagItems = useMemo(() => {
    return inventory.filter((item) => item.categoryId.toLowerCase().includes('plastic') || item.materialName.toLowerCase().includes('polybag'));
  }, [inventory]);

  // Uniform specific items
  const uniformItems = useMemo(() => {
    return inventory.filter((item) => item.categoryId.toLowerCase().includes('uniform') || item.materialName.toLowerCase().includes('uniform') || item.materialName.toLowerCase().includes('seragam'));
  }, [inventory]);

  // Export handlers
  const handleExportExcel = () => {
    const data = filteredInventory.map((item) => ({
      'Material Code': item.materialCode,
      'Material Name': item.materialName,
      'Kategori': item.categoryName,
      'Lokasi Gudang': item.locationName,
      'Varian': item.variantValue || '-',
      'Opening Stock': item.openingStock,
      'Qty IN': item.qtyIn,
      'Qty OUT': item.qtyOut,
      'Closing Balance': item.availableStock,
      'Satuan': item.unit,
      'Min Stock': item.minimumStock,
      'ROP': item.reorderPoint,
      'Status': item.availableStock <= item.minimumStock ? 'Kritis' : item.availableStock <= item.reorderPoint ? 'Menipis' : 'Normal',
      'Last Transaction': item.lastTransactionDate,
    }));
    exportToExcelFile(data, `Posisi_Persediaan_PT_IAS_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Inventory_Position');
    showToast('success', 'Ekspor Berhasil', `${data.length} baris inventaris diekspor ke Excel.`);
  };

  // Submit Consumption
  const handleSubmitConsumption = (e: React.FormEvent) => {
    e.preventDefault();
    const mat = activeMaterials.find((m) => m.id === consMatId);
    const loc = activeLocations.find((l) => l.id === consLocId);
    if (!mat || !loc) return;

    const ok = recordConsumption({
      date: consDate,
      locationId: loc.id,
      locationName: loc.name,
      areaOrToilet: consArea,
      shift: consShift,
      materialId: mat.id,
      materialCode: mat.materialCode,
      materialName: mat.materialName,
      variantValue: mat.variantValue,
      quantityUsed: Number(consQty),
      unit: mat.unit,
      operator: currentUser?.fullName || 'Petugas',
      notes: consNotes,
    });

    if (ok) {
      setConsumptionModalOpen(false);
      setConsQty(10);
      setConsNotes('');
    }
  };

  // Submit Trolley
  const handleSubmitTrolley = (e: React.FormEvent) => {
    e.preventDefault();
    const loc = activeLocations.find((l) => l.id === trolleyLocId);
    if (!loc) return;

    saveMorganTrolley({
      quantity: Number(trolleyQty),
      locationId: loc.id,
      locationName: loc.name,
      area: trolleyArea,
      placement: trolleyPlacement,
      condition: trolleyCondition,
      personInCharge: trolleyPic,
      lastCheckDate: new Date().toISOString().slice(0, 10),
      notes: trolleyNotes,
    });
    setTrolleyModalOpen(false);
  };

  // Submit Supply Request
  const handleSubmitSupplyRequest = (e: React.FormEvent) => {
    e.preventDefault();
    const mat = activeMaterials.find((m) => m.id === reqMatId);
    const loc = activeLocations.find((l) => l.id === reqLocId);
    if (!mat || !loc) return;

    createSupplyRequest({
      requestingLocationId: loc.id,
      requestingUnit: reqUnitName,
      materialId: mat.id,
      requestedQuantity: Number(reqQty),
      notes: reqNotes,
    });
    setRequestModalOpen(false);
  };

  // Confirm Partial/Full Supply Receipt
  const handleConfirmReceiveSupply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveTargetId) return;

    receiveSupplyRequest(receiveTargetId, Number(receiveQtyInput), receiveRefDoc.trim());
    setReceiveTargetId(null);
    setReceiveQtyInput(10);
    setReceiveRefDoc('');
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
            Data saldo riil: Closing Stock = Opening Stock + Posted IN - Posted OUT + Adjustments (Aturan Bisnis 7)
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
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
                    <th className="py-3 px-4">Varian</th>
                    <th className="py-3 px-4 text-right">Opening</th>
                    <th className="py-3 px-4 text-right text-emerald-800">Qty IN</th>
                    <th className="py-3 px-4 text-right text-indigo-900">Qty OUT</th>
                    <th className="py-3 px-4 text-right">Closing Balance</th>
                    <th className="py-3 px-4">Satuan</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4">Last Tx</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(activeSubTab === 'TOILET_BUILDING' ? toiletBuildingItems : filteredInventory).length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-400">
                        Belum ada data saldo stok inventaris yang terdaftar.
                      </td>
                    </tr>
                  ) : (
                    (activeSubTab === 'TOILET_BUILDING' ? toiletBuildingItems : filteredInventory).map((item) => {
                    const isCritical = item.availableStock <= item.minimumStock;
                    const isLow = item.availableStock > item.minimumStock && item.availableStock <= item.reorderPoint;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.materialCode}</td>
                        <td className="py-3 px-4 font-semibold text-slate-900 max-w-[200px]">
                          <div className="truncate" title={item.materialName}>{item.materialName}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{item.categoryName}</td>
                        <td className="py-3 px-4 text-slate-700">{item.locationName}</td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {item.variantValue ? (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-bold">
                              {item.variantValue}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-slate-500">{item.openingStock}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">+{item.qtyIn}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-indigo-800">-{item.qtyOut}</td>
                        <td className="py-3 px-4 text-right font-mono font-extrabold text-sm text-slate-900">
                          {item.availableStock.toLocaleString('id-ID')}
                        </td>
                        <td className="py-3 px-4 text-slate-700 font-medium">{item.unit}</td>
                        <td className="py-3 px-4 text-center">
                          {isCritical ? (
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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {morganTrolleys.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
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
                  supplyRequests.map((r) => (
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
                          r.status === 'FULFILLED'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : r.status === 'PARTIAL'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {r.status !== 'FULFILLED' && canMutate ? (
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
                        <span className="text-slate-400 text-[11px]">Selesai</span>
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
                <label className="text-slate-700 font-bold block mb-1">Kuantitas Terpakai *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={consQty}
                  onChange={(e) => setConsQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold text-base"
                />
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
                onClick={() => setConsumptionModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46]"
              >
                Simpan & Potong Saldo
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
                onClick={() => setTrolleyModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46]"
              >
                Simpan Data Trolley
              </button>
            </div>
          </form>
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
                onClick={() => setRequestModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46]"
              >
                Kirim Permintaan
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
                <label className="text-slate-700 font-bold block mb-1">Kuantitas Masuk Aktual *</label>
                <input
                  type="number"
                  min="1"
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
                Penerimaan ini akan otomatis memotong sisa outstanding dan menambahkan saldo fisik ke lokasi pemohon.
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setReceiveTargetId(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold hover:bg-emerald-800"
              >
                Posting Penerimaan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
