import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Database,
  Plus,
  Search,
  Package,
  Layers,
  Ruler,
  Warehouse,
  Users,
  Truck,
  Edit2,
  Trash2,
  Lock,
  X,
  CheckCircle2,
  Eye,
  Download,
  Upload,
  Power,
  FileSpreadsheet,
  AlertTriangle,
  FolderTree,
  Tag,
  Shield,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';
import { ExcelImportExportModal } from '../components/ExcelImportExportModal';
import {
  MaterialMaster,
  MasterCategory,
  MasterUnit,
  MasterLocation,
  MasterRequestingUnit,
  MasterSupplier,
} from '../types';
import { downloadModuleTemplate, exportToExcelFile, exportToCsvFile } from '../utils/excelUtils';

type MasterTab = 'MATERIALS' | 'LOCATIONS' | 'CATEGORIES' | 'UNITS' | 'REQUESTING_UNITS' | 'SUPPLIERS';

export const MasterData: React.FC = () => {
  const {
    materials,
    addMaterial,
    updateMaterial,
    toggleMaterialStatus,
    deleteMaterial,
    locations,
    addLocation,
    updateLocation,
    toggleLocationStatus,
    deleteLocation,
    categories,
    saveCategory,
    toggleCategoryStatus,
    units,
    saveUnit,
    toggleUnitStatus,
    requestingUnits,
    suppliers,
    settings,
    currentUser,
    can,
    showToast,
    syncLoading,
    syncErrors,
    seedDemoData,
  } = useApp();

  const [activeTab, setActiveTab] = useState<MasterTab>('MATERIALS');
  const [searchTerm, setSearchTerm] = useState('');

  // Delete modals and submission states
  const [materialToDelete, setMaterialToDelete] = useState<MaterialMaster | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<MasterLocation | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSubmittingMat, setIsSubmittingMat] = useState(false);
  const [isSubmittingLoc, setIsSubmittingLoc] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  // Filters for Materials
  const [filterCat, setFilterCat] = useState('ALL');
  const [filterUnit, setFilterUnit] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Filters for Locations
  const [filterLocType, setFilterLocType] = useState('ALL');

  // Excel Modal
  const [excelModalOpen, setExcelModalOpen] = useState(false);
  const [excelInitialModule, setExcelInitialModule] = useState<'MATERIAL_MASTER' | 'LOCATION_MASTER'>('MATERIAL_MASTER');

  // Modals state
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [viewMaterialDetail, setViewMaterialDetail] = useState<MaterialMaster | null>(null);
  const [viewLocationDetail, setViewLocationDetail] = useState<MasterLocation | null>(null);

  // Form states for Material
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [matCode, setMatCode] = useState('');
  const [matName, setMatName] = useState('');
  const [matCategoryId, setMatCategoryId] = useState('');
  const [matSubcategoryId, setMatSubcategoryId] = useState('');
  const [matUnitId, setMatUnitId] = useState('');
  const [matMinStock, setMatMinStock] = useState(50);
  const [matRop, setMatRop] = useState(100);
  const [matDefaultLocId, setMatDefaultLocId] = useState('');
  const [matVariantAttrs, setMatVariantAttrs] = useState('');
  const [matVariantVal, setMatVariantVal] = useState('');
  const [matUnitCost, setMatUnitCost] = useState(15000);
  const [matDescription, setMatDescription] = useState('');
  const [autoGenCode, setAutoGenCode] = useState(false);
  const [codeDuplicateError, setCodeDuplicateError] = useState('');

  // Form states for Location
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locCode, setLocCode] = useState('');
  const [locName, setLocName] = useState('');
  const [locType, setLocType] = useState('Terminal');
  const [locParentId, setLocParentId] = useState('');
  const [locPic, setLocPic] = useState('');
  const [locCapacity, setLocCapacity] = useState(500);
  const [locAddress, setLocAddress] = useState('');
  const [locDesc, setLocDesc] = useState('');

  // Category & Unit modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<Partial<MasterCategory> | null>(null);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Partial<MasterUnit> | null>(null);

  const canManage = can('MANAGE_MASTER_DATA').allowed;

  // Filtered Materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      const matchSearch =
        m.materialName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.materialCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (m.description || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchCat = filterCat === 'ALL' || m.categoryId === filterCat;
      const matchUnit = filterUnit === 'ALL' || m.unit === filterUnit;
      const matchStatus =
        filterStatus === 'ALL' ||
        (filterStatus === 'ACTIVE' && m.isActive) ||
        (filterStatus === 'INACTIVE' && !m.isActive);

      return matchSearch && matchCat && matchUnit && matchStatus;
    });
  }, [materials, searchTerm, filterCat, filterUnit, filterStatus]);

  // Filtered Locations
  const filteredLocations = useMemo(() => {
    return locations.filter((l) => {
      const matchSearch =
        l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.picName || '').toLowerCase().includes(searchTerm.toLowerCase());

      const matchType = filterLocType === 'ALL' || l.type === filterLocType;

      return matchSearch && matchType;
    });
  }, [locations, searchTerm, filterLocType]);

  // Open Material Modal (Create)
  const handleOpenAddMaterial = () => {
    setEditingMaterialId(null);
    setCodeDuplicateError('');
    setAutoGenCode(settings.autoGenerateMaterialCode);
    const nextSeq = settings.materialCodeSequence + materials.length + 1;
    setMatCode(settings.autoGenerateMaterialCode ? `${settings.materialCodePrefix}-${nextSeq}` : '');
    setMatName('');
    setMatCategoryId(categories[0]?.id || '');
    setMatSubcategoryId('');
    setMatUnitId(units[0]?.id || '');
    setMatMinStock(50);
    setMatRop(100);
    setMatDefaultLocId(locations[0]?.id || '');
    setMatVariantAttrs('');
    setMatVariantVal('');
    setMatUnitCost(25000);
    setMatDescription('');
    setMaterialModalOpen(true);
  };

  // Open Material Modal (Edit)
  const handleOpenEditMaterial = (m: MaterialMaster) => {
    setEditingMaterialId(m.id);
    setCodeDuplicateError('');
    setAutoGenCode(false);
    setMatCode(m.materialCode);
    setMatName(m.materialName);
    setMatCategoryId(m.categoryId);
    setMatSubcategoryId(m.subcategoryId || '');
    setMatUnitId(m.unitId);
    setMatMinStock(m.minimumStock);
    setMatRop(m.reorderPoint);
    setMatDefaultLocId(m.defaultLocationId || '');
    setMatVariantAttrs(m.variantAttributes || '');
    setMatVariantVal(m.variantValue || '');
    setMatUnitCost(m.unitCost || 0);
    setMatDescription(m.description || '');
    setMaterialModalOpen(true);
  };

  // Submit Material
  const handleSubmitMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeDuplicateError('');
    setIsSubmittingMat(true);

    const targetCat = categories.find((c) => c.id === matCategoryId);
    const targetUnit = units.find((u) => u.id === matUnitId);
    const targetLoc = locations.find((l) => l.id === matDefaultLocId);

    try {
      if (editingMaterialId) {
        const result = await updateMaterial(editingMaterialId, {
          materialCode: matCode.trim().toUpperCase(),
          materialName: matName.trim(),
          categoryId: matCategoryId,
          categoryName: targetCat?.name || 'General',
          subcategoryId: matSubcategoryId.trim() || undefined,
          unitId: matUnitId,
          unit: targetUnit?.symbol || 'Pcs',
          minimumStock: Number(matMinStock),
          reorderPoint: Number(matRop),
          defaultLocationId: matDefaultLocId || undefined,
          defaultLocationName: targetLoc?.name || undefined,
          variantAttributes: matVariantAttrs.trim() || undefined,
          variantValue: matVariantVal.trim() || undefined,
          unitCost: Number(matUnitCost),
          description: matDescription.trim(),
        });
        if (result.success) {
          setMaterialModalOpen(false);
        } else {
          setCodeDuplicateError(result.message || 'Gagal menyimpan.');
        }
      } else {
        const result = await addMaterial({
          materialCode: matCode.trim().toUpperCase(),
          materialName: matName.trim(),
          categoryId: matCategoryId,
          categoryName: targetCat?.name || 'General',
          subcategoryId: matSubcategoryId.trim() || undefined,
          unitId: matUnitId,
          unit: targetUnit?.symbol || 'Pcs',
          minimumStock: Number(matMinStock),
          reorderPoint: Number(matRop),
          defaultLocationId: matDefaultLocId || undefined,
          defaultLocationName: targetLoc?.name || undefined,
          variantAttributes: matVariantAttrs.trim() || undefined,
          variantValue: matVariantVal.trim() || undefined,
          unitCost: Number(matUnitCost),
          description: matDescription.trim(),
          isActive: true,
        });

        if (result.success) {
          setMaterialModalOpen(false);
        } else {
          setCodeDuplicateError(result.message || 'Gagal menambahkan material.');
        }
      }
    } finally {
      setIsSubmittingMat(false);
    }
  };

  // Open Location Modal (Create)
  const handleOpenAddLocation = () => {
    setEditingLocationId(null);
    setLocCode(`LOC-WH-${10 + locations.length + 1}`);
    setLocName('');
    setLocType('Warehouse');
    setLocParentId('');
    setLocPic(currentUser?.fullName || 'Petugas');
    setLocCapacity(500);
    setLocAddress('');
    setLocDesc('');
    setLocationModalOpen(true);
  };

  const handleOpenEditLocation = (l: MasterLocation) => {
    setEditingLocationId(l.id);
    setLocCode(l.code);
    setLocName(l.name);
    setLocType(l.type);
    setLocParentId(l.parentLocationId || '');
    setLocPic(l.picName || '');
    setLocCapacity(l.capacityM2 || 500);
    setLocAddress(l.address || '');
    setLocDesc(l.description || '');
    setLocationModalOpen(true);
  };

  const handleSubmitLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingLoc(true);

    try {
      if (editingLocationId) {
        const res = await updateLocation(editingLocationId, {
          code: locCode.trim().toUpperCase(),
          name: locName.trim(),
          type: locType,
          parentLocationId: locParentId || null,
          picName: locPic.trim(),
          personInCharge: locPic.trim(),
          capacityM2: Number(locCapacity),
          address: locAddress.trim(),
          description: locDesc.trim(),
        });
        if (res.success) setLocationModalOpen(false);
      } else {
        const res = await addLocation({
          code: locCode.trim().toUpperCase(),
          name: locName.trim(),
          type: locType,
          parentLocationId: locParentId || null,
          picName: locPic.trim(),
          personInCharge: locPic.trim(),
          capacityM2: Number(locCapacity),
          address: locAddress.trim(),
          description: locDesc.trim(),
          isActive: true,
        });
        if (res.success) setLocationModalOpen(false);
      }
    } finally {
      setIsSubmittingLoc(false);
    }
  };

  const handleDeleteMaterialConfirm = async () => {
    if (!materialToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteMaterial(materialToDelete.id);
      if (res.success) {
        setMaterialToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteLocationConfirm = async () => {
    if (!locationToDelete) return;
    setIsDeleting(true);
    try {
      const res = await deleteLocation(locationToDelete.id);
      if (res.success) {
        setLocationToDelete(null);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSeedDemoData = async () => {
    setIsSeeding(true);
    try {
      await seedDemoData();
    } finally {
      setIsSeeding(false);
    }
  };

  const handleExportMaterialsQuick = (format: 'xlsx' | 'csv') => {
    const data = filteredMaterials.map((m) => ({
      'Material Code': m.materialCode,
      'Material Name': m.materialName,
      'Category': m.categoryName,
      'Unit': m.unit,
      'Min Stock': m.minimumStock,
      'ROP': m.reorderPoint,
      'Default Location': m.defaultLocationName || '-',
      'Variant': m.variantAttributes || '-',
      'Unit Cost': m.unitCost || 0,
      'Status': m.isActive ? 'Active' : 'Inactive',
    }));
    const dateStr = new Date().toISOString().slice(0, 10);
    if (format === 'xlsx') {
      exportToExcelFile(data, `Material_Master_${dateStr}.xlsx`, 'Materials');
    } else {
      exportToCsvFile(data, `Material_Master_${dateStr}.csv`);
    }
    showToast('success', 'Ekspor Berhasil', `${data.length} material diekspor.`);
  };

  const handleExportLocationsQuick = (format: 'xlsx' | 'csv') => {
    const data = filteredLocations.map((l) => ({
      'Location Code': l.code,
      'Location Name': l.name,
      'Type': l.type,
      'Parent Location': l.parentLocationName || '-',
      'PIC': l.picName,
      'Capacity (m2)': l.capacityM2 || 0,
      'Status': l.isActive ? 'Active' : 'Inactive',
    }));
    const dateStr = new Date().toISOString().slice(0, 10);
    if (format === 'xlsx') {
      exportToExcelFile(data, `Location_Master_${dateStr}.xlsx`, 'Locations');
    } else {
      exportToCsvFile(data, `Location_Master_${dateStr}.csv`);
    }
    showToast('success', 'Ekspor Berhasil', `${data.length} lokasi diekspor.`);
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Master Data" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Master Data Katalog & Entitas
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
              Database-Driven Dynamic Master
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pengelolaan terpusat Material, Lokasi, Kategori, Satuan, dan Integrasi Excel PT IAS Support
          </p>
        </div>

        {/* Global Excel Import/Export Trigger */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setExcelInitialModule(activeTab === 'LOCATIONS' ? 'LOCATION_MASTER' : 'MATERIAL_MASTER');
              setExcelModalOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Excel Import / Export</span>
          </button>
        </div>
      </div>

      {/* Synchronization Status Notification */}
      {syncLoading && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5 text-xs text-blue-800 animate-pulse">
          <Loader2 className="w-4 h-4 text-blue-600 animate-spin shrink-0" />
          <span>Menyinkronkan data dengan Cloud Firestore...</span>
        </div>
      )}

      {syncErrors['materials'] && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Gagal menyinkronkan data material dari Firestore: {syncErrors['materials']}</span>
        </div>
      )}

      {syncErrors['locations'] && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-800">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Gagal menyinkronkan data lokasi dari Firestore: {syncErrors['locations']}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 text-xs">
        {[
          { id: 'MATERIALS', label: `Material Master (${materials.length})`, icon: Package },
          { id: 'LOCATIONS', label: `Location Master (${locations.length})`, icon: Warehouse },
          { id: 'CATEGORIES', label: `Kategori Material (${categories.length})`, icon: Layers },
          { id: 'UNITS', label: `Satuan Ukur (${units.length})`, icon: Ruler },
          { id: 'REQUESTING_UNITS', label: `Unit Pemohon (${requestingUnits.length})`, icon: Users },
          { id: 'SUPPLIERS', label: `Pemasok (${suppliers.length})`, icon: Truck },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as MasterTab);
                setSearchTerm('');
              }}
              className={`flex items-center gap-2 px-3.5 py-2.5 font-bold rounded-t-xl transition whitespace-nowrap border-b-2 ${
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
      {/* TAB 1: DYNAMIC MATERIAL MASTER */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'MATERIALS' && (
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 flex-1">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari kode material, nama, spesifikasi..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
                  />
                </div>

                {/* Category filter */}
                <div>
                  <select
                    value={filterCat}
                    onChange={(e) => setFilterCat(e.target.value)}
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

                {/* Unit filter */}
                <div>
                  <select
                    value={filterUnit}
                    onChange={(e) => setFilterUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="ALL">Semua Satuan</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.symbol}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status filter */}
                <div>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="ALL">Semua Status (Aktif & Non-Aktif)</option>
                    <option value="ACTIVE">Hanya Aktif</option>
                    <option value="INACTIVE">Hanya Non-Aktif</option>
                  </select>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadModuleTemplate('MATERIAL_MASTER')}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Unduh Template Excel Material Master"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Template</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportMaterialsQuick('xlsx')}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
                  title="Ekspor Material Terfilter ke Excel"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Ekspor</span>
                </button>

                {canManage && (
                  <button
                    onClick={handleOpenAddMaterial}
                    className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Material</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Materials Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Material Code</th>
                    <th className="py-3 px-4">Material Name</th>
                    <th className="py-3 px-4">Kategori</th>
                    <th className="py-3 px-4">Satuan</th>
                    <th className="py-3 px-4">Varian / Spesifikasi</th>
                    <th className="py-3 px-4 text-center">Min / ROP</th>
                    <th className="py-3 px-4">Default Lokasi</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        {materials.length === 0 ? (
                          <div className="max-w-md mx-auto space-y-3">
                            <Package className="w-10 h-10 text-slate-300 mx-auto" />
                            <div>
                              <p className="font-bold text-slate-700 text-sm">Belum Ada Master Material di Cloud Firestore</p>
                              <p className="text-xs text-slate-500 mt-0.5">
                                Daftarkan material baru atau inisialisasi data standar PT IAS untuk memulai operasional logistik.
                              </p>
                            </div>
                            <div className="flex items-center justify-center gap-2 pt-1">
                              {canManage && (
                                <button
                                  type="button"
                                  onClick={handleOpenAddMaterial}
                                  className="px-3.5 py-2 rounded-xl bg-[#064e3b] text-white font-bold text-xs hover:bg-[#065f46] transition flex items-center gap-1.5"
                                >
                                  <Plus className="w-4 h-4" />
                                  <span>Tambah Material Baru</span>
                                </button>
                              )}
                              {currentUser?.role === 'ADMIN' && (
                                <button
                                  type="button"
                                  disabled={isSeeding}
                                  onClick={handleSeedDemoData}
                                  className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold text-xs hover:bg-emerald-100 transition flex items-center gap-1.5 disabled:opacity-50"
                                >
                                  {isSeeding ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                                  ) : (
                                    <Sparkles className="w-4 h-4 text-emerald-700" />
                                  )}
                                  <span>Inisialisasi Data Demo PT IAS</span>
                                </button>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span>Tidak ada material yang sesuai kriteria pencarian.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((m) => (
                      <tr key={m.id} className="hover:bg-slate-50/70 transition">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {m.materialCode}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 max-w-[220px]">
                          <div className="truncate" title={m.materialName}>
                            {m.materialName}
                          </div>
                          {m.description && (
                            <div className="text-[10px] text-slate-400 truncate" title={m.description}>
                              {m.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-medium">
                          {m.categoryName}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-slate-700">
                          {m.unit}
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {m.variantAttributes ? (
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 font-mono text-[10px] font-semibold">
                              {m.variantAttributes}
                            </span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-mono">
                          <span className="text-rose-700 font-bold">{m.minimumStock}</span>
                          <span className="text-slate-300 mx-1">/</span>
                          <span className="text-amber-700 font-bold">{m.reorderPoint}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-700">
                          {m.defaultLocationName || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              m.isActive
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-slate-100 text-slate-500 border border-slate-200'
                            }`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${m.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            {m.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => setViewMaterialDetail(m)}
                              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                              title="Lihat Detail Material"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            {canManage && (
                              <>
                                <button
                                  onClick={() => handleOpenEditMaterial(m)}
                                  className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition"
                                  title="Edit Material"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => toggleMaterialStatus(m.id)}
                                  className={`p-1.5 rounded-lg transition ${
                                    m.isActive
                                      ? 'text-rose-600 hover:bg-rose-50'
                                      : 'text-emerald-700 hover:bg-emerald-50'
                                  }`}
                                  title={m.isActive ? 'Non-aktifkan Material (Cegah transaksi baru)' : 'Aktifkan Material'}
                                >
                                  <Power className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setMaterialToDelete(m)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                                  title="Hapus Material dari Master Data"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
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
      {/* TAB 2: DYNAMIC LOCATION MASTER */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'LOCATIONS' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1 max-w-lg">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari kode lokasi, nama, PIC..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
                  />
                </div>

                <div>
                  <select
                    value={filterLocType}
                    onChange={(e) => setFilterLocType(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="ALL">Semua Tipe Lokasi</option>
                    <option value="Terminal">Terminal</option>
                    <option value="Toilet Area">Toilet Area</option>
                    <option value="Warehouse">Warehouse (Gudang)</option>
                    <option value="Gedung">Gedung Fasilitas</option>
                    <option value="Transit Hub">Transit Hub</option>
                    <option value="Workshop">Workshop</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => downloadModuleTemplate('LOCATION_MASTER')}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Template</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExportLocationsQuick('xlsx')}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold flex items-center gap-1.5 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>Ekspor</span>
                </button>

                {canManage && (
                  <button
                    onClick={handleOpenAddLocation}
                    className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Lokasi</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLocations.map((loc) => (
              <div
                key={loc.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2.5 hover:border-slate-300 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                    {loc.code}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {loc.type}
                    </span>
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${loc.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                      title={loc.isActive ? 'Aktif' : 'Non-Aktif'}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-slate-900 text-sm leading-tight">{loc.name}</h3>
                  {loc.parentLocationName && (
                    <div className="text-[11px] text-emerald-800 font-medium flex items-center gap-1 mt-0.5">
                      <FolderTree className="w-3 h-3 text-slate-400" />
                      <span>Induk: {loc.parentLocationName}</span>
                    </div>
                  )}
                  {loc.address && (
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">{loc.address}</p>
                  )}
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
                  <span>PIC: <strong>{loc.picName || '-'}</strong></span>
                  <span>Kapasitas: {loc.capacityM2 || 0} m²</span>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => setViewLocationDetail(loc)}
                    className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
                    title="Detail Lokasi"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {canManage && (
                    <>
                      <button
                        onClick={() => handleOpenEditLocation(loc)}
                        className="p-1.5 text-slate-600 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg"
                        title="Edit Lokasi"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleLocationStatus(loc.id)}
                        className={`p-1.5 rounded-lg ${loc.isActive ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'}`}
                        title={loc.isActive ? 'Non-aktifkan Lokasi' : 'Aktifkan Lokasi'}
                      >
                        <Power className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setLocationToDelete(loc)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Hapus Lokasi dari Master Data"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 3: CATEGORIES */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'CATEGORIES' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Konfigurasi dinamis kategori material PT IAS Support</span>
            {canManage && (
              <button
                onClick={() => {
                  setEditingCat({ code: 'CAT-' + (categories.length + 1), name: '', description: '', isActive: true });
                  setCatModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#064e3b] text-white font-bold text-xs shadow-2xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Kategori</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((c) => (
              <div key={c.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {c.code}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${c.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {canManage && (
                      <button
                        onClick={() => {
                          setEditingCat(c);
                          setCatModalOpen(true);
                        }}
                        className="p-1 text-slate-400 hover:text-slate-700"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{c.name}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{c.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 4: UNITS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'UNITS' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs text-slate-500">Daftar satuan ukuran fisik persediaan</span>
            {canManage && (
              <button
                onClick={() => {
                  setEditingUnit({ name: '', symbol: '', description: '', isActive: true });
                  setUnitModalOpen(true);
                }}
                className="px-3.5 py-2 rounded-xl bg-[#064e3b] text-white font-bold text-xs shadow-2xs flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Satuan</span>
              </button>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">Nama Satuan</th>
                  <th className="py-3 px-4">Simbol</th>
                  <th className="py-3 px-4">Keterangan</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {units.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4 font-bold text-slate-800">{u.name}</td>
                    <td className="py-3 px-4 font-mono font-bold text-emerald-800">{u.symbol}</td>
                    <td className="py-3 px-4 text-slate-500">{u.description}</td>
                    <td className="py-3 px-4 text-center font-bold text-[10px]">
                      {u.isActive ? (
                        <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Active</span>
                      ) : (
                        <span className="text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Inactive</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {canManage ? (
                        <button
                          onClick={() => {
                            setEditingUnit(u);
                            setUnitModalOpen(true);
                          }}
                          className="p-1 text-slate-500 hover:text-slate-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* TAB 5: REQUESTING UNITS & TAB 6: SUPPLIERS */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'REQUESTING_UNITS' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                <th className="py-3 px-4">Kode Unit</th>
                <th className="py-3 px-4">Nama Unit Kerja</th>
                <th className="py-3 px-4">Divisi Induk</th>
                <th className="py-3 px-4">Contact Person / PIC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {requestingUnits.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-slate-800">{u.code}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{u.name}</td>
                  <td className="py-3 px-4 text-slate-600">{u.division}</td>
                  <td className="py-3 px-4 text-slate-700">{u.contactPerson}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'SUPPLIERS' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map((s) => (
            <div key={s.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                {s.code}
              </span>
              <h3 className="font-bold text-slate-900 text-sm">{s.name}</h3>
              <p className="text-xs text-slate-500">{s.address}</p>
              <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600">
                <div>PIC: <strong>{s.contactPerson}</strong></div>
                <div>{s.phone} • {s.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: ADD / EDIT MATERIAL MASTER */}
      {/* ------------------------------------------------------------------ */}
      {materialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitMaterial}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in my-auto max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                {editingMaterialId ? 'Ubah Data Material' : 'Tambah Material Baru (Dynamic Master)'}
              </h3>
              <button
                type="button"
                onClick={() => setMaterialModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs overflow-y-auto flex-1 pr-1">
              {codeDuplicateError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{codeDuplicateError}</span>
                </div>
              )}

              {/* Material Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-700 font-bold">Kode Material (Unique) *</label>
                    {!editingMaterialId && (
                      <label className="text-[10px] text-emerald-700 cursor-pointer flex items-center gap-1 font-semibold">
                        <input
                          type="checkbox"
                          checked={autoGenCode}
                          onChange={(e) => {
                            setAutoGenCode(e.target.checked);
                            if (e.target.checked) {
                              setMatCode(`${settings.materialCodePrefix}-${settings.materialCodeSequence + materials.length + 1}`);
                            }
                          }}
                          className="rounded text-[#064e3b]"
                        />
                        <span>Auto-Gen</span>
                      </label>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: MAT-TIS-HT01"
                    value={matCode}
                    onChange={(e) => setMatCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Satuan Ukur (Unit of Measure) *</label>
                  <select
                    required
                    value={matUnitId}
                    onChange={(e) => setMatUnitId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.symbol})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Material Name */}
              <div>
                <label className="text-slate-700 font-bold block mb-1">Nama Material / Barang *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Hand Towel (HT) Tissue Interfold 2-Ply"
                  value={matName}
                  onChange={(e) => setMatName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                />
              </div>

              {/* Category, Subcategory, and Default Location */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Kategori Material *</label>
                  <select
                    required
                    value={matCategoryId}
                    onChange={(e) => setMatCategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Subkategori (Opsional)</label>
                  <input
                    type="text"
                    placeholder="Contoh: Dispensers, Janitorial"
                    value={matSubcategoryId}
                    onChange={(e) => setMatSubcategoryId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Default Lokasi Gudang</label>
                  <select
                    value={matDefaultLocId}
                    onChange={(e) => setMatDefaultLocId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Lokasi Default --</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Variants Section */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-950">Atribut Varian (Opsional)</span>
                  <span className="text-[10px] text-blue-700 font-medium">Contoh: Size L / Polybag 60x100</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Atribut (misal: Ukuran: 60x100 cm)"
                    value={matVariantAttrs}
                    onChange={(e) => setMatVariantAttrs(e.target.value)}
                    className="w-full px-3 py-1.5 border border-blue-200 rounded-lg bg-white"
                  />
                  <input
                    type="text"
                    placeholder="Nilai Singkat (misal: 60x100 atau L)"
                    value={matVariantVal}
                    onChange={(e) => setMatVariantVal(e.target.value)}
                    className="w-full px-3 py-1.5 border border-blue-200 rounded-lg bg-white font-mono"
                  />
                </div>
              </div>

              {/* Min, ROP, Unit Cost */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Batas Minimum</label>
                  <input
                    type="number"
                    min="0"
                    value={matMinStock}
                    onChange={(e) => setMatMinStock(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Reorder Point</label>
                  <input
                    type="number"
                    min="0"
                    value={matRop}
                    onChange={(e) => setMatRop(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Estimasi Harga (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    value={matUnitCost}
                    onChange={(e) => setMatUnitCost(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-slate-700 font-bold block mb-1">Keterangan Spesifikasi</label>
                <textarea
                  rows={2}
                  placeholder="Spesifikasi bahan, pemakaian tempat sampah, atau peruntukan..."
                  value={matDescription}
                  onChange={(e) => setMatDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 text-xs">
              <button
                type="button"
                disabled={isSubmittingMat}
                onClick={() => setMaterialModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingMat}
                className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingMat ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Firestore...</span>
                  </>
                ) : (
                  <span>{editingMaterialId ? 'Simpan Perubahan' : 'Daftarkan Material'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: ADD / EDIT LOCATION MASTER */}
      {/* ------------------------------------------------------------------ */}
      {locationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitLocation}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in my-auto max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                {editingLocationId ? 'Ubah Data Lokasi' : 'Daftarkan Lokasi Baru (Dynamic Location Master)'}
              </h3>
              <button
                type="button"
                onClick={() => setLocationModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs overflow-y-auto flex-1 pr-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Kode Lokasi (Unique) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: LOC-T1B-02"
                    value={locCode}
                    onChange={(e) => setLocCode(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold uppercase"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Tipe Lokasi *</label>
                  <select
                    value={locType}
                    onChange={(e) => setLocType(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Terminal">Terminal</option>
                    <option value="Toilet Area">Toilet Area</option>
                    <option value="Warehouse">Warehouse (Gudang)</option>
                    <option value="Gedung">Gedung Fasilitas</option>
                    <option value="Transit Hub">Transit Hub</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Depot">Depot</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Nama Lokasi / Area *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Area Toilet Kedatangan Gate 1B"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Lokasi Induk (Parent Location)</label>
                  <select
                    value={locParentId}
                    onChange={(e) => setLocParentId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">-- Tidak Ada Induk (Independen) --</option>
                    {locations
                      .filter((l) => l.id !== editingLocationId)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.code})
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Person In Charge (PIC)</label>
                  <input
                    type="text"
                    value={locPic}
                    onChange={(e) => setLocPic(e.target.value)}
                    placeholder="Nama PIC lokasi"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Alamat / Detail Titik Penempatan</label>
                <input
                  type="text"
                  value={locAddress}
                  onChange={(e) => setLocAddress(e.target.value)}
                  placeholder="Contoh: Airside Gate 1 - 7 Lantai 1 Terminal 1B"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Keterangan Tambahan</label>
                <textarea
                  rows={2}
                  value={locDesc}
                  onChange={(e) => setLocDesc(e.target.value)}
                  placeholder="Catatan fungsi lokasi atau protokol pemakaian..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 shrink-0 text-xs">
              <button
                type="button"
                disabled={isSubmittingLoc}
                onClick={() => setLocationModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingLoc}
                className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingLoc ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Firestore...</span>
                  </>
                ) : (
                  <span>{editingLocationId ? 'Simpan Perubahan' : 'Daftarkan Lokasi'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: VIEW MATERIAL DETAILS */}
      {/* ------------------------------------------------------------------ */}
      {viewMaterialDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200">
                  {viewMaterialDetail.materialCode}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {viewMaterialDetail.materialName}
                </h3>
              </div>
              <button
                onClick={() => setViewMaterialDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400">Kategori:</span>
                  <div className="font-bold text-slate-800">{viewMaterialDetail.categoryName}</div>
                </div>
                <div>
                  <span className="text-slate-400">Subkategori:</span>
                  <div className="font-bold text-slate-800">{viewMaterialDetail.subcategoryId || '-'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Satuan (UOM):</span>
                  <div className="font-bold text-slate-800">{viewMaterialDetail.unit}</div>
                </div>
                <div>
                  <span className="text-slate-400">Default Lokasi:</span>
                  <div className="font-bold text-slate-800">{viewMaterialDetail.defaultLocationName || '-'}</div>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-400">Status Operasi:</span>
                  <div className={`font-bold ${viewMaterialDetail.isActive ? 'text-emerald-700' : 'text-slate-500'}`}>
                    {viewMaterialDetail.isActive ? 'Active (Tersedia untuk transaksi)' : 'Inactive (Arsip / Non-Aktif)'}
                  </div>
                </div>
              </div>

              {viewMaterialDetail.variantAttributes && (
                <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <span className="text-blue-900 font-bold block mb-0.5">Spesifikasi Varian:</span>
                  <span className="text-blue-800 font-mono">{viewMaterialDetail.variantAttributes}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 p-3 border border-slate-200 rounded-xl text-center">
                <div>
                  <span className="text-slate-400">Batas Min:</span>
                  <div className="text-base font-extrabold text-rose-700 font-mono">
                    {viewMaterialDetail.minimumStock} {viewMaterialDetail.unit}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Reorder Point:</span>
                  <div className="text-base font-extrabold text-amber-700 font-mono">
                    {viewMaterialDetail.reorderPoint} {viewMaterialDetail.unit}
                  </div>
                </div>
              </div>

              <div className="text-slate-500 text-[11px] space-y-0.5 pt-1">
                <div>Dibuat oleh: <span className="font-mono text-slate-700">{viewMaterialDetail.createdBy}</span> ({viewMaterialDetail.createdAt})</div>
                <div>Terakhir diperbarui: <span className="font-mono text-slate-700">{viewMaterialDetail.updatedBy}</span> ({viewMaterialDetail.updatedAt})</div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewMaterialDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: VIEW LOCATION DETAILS */}
      {/* ------------------------------------------------------------------ */}
      {viewLocationDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-blue-50 text-blue-900 border border-blue-200">
                  {viewLocationDetail.code}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {viewLocationDetail.name}
                </h3>
              </div>
              <button
                onClick={() => setViewLocationDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl">
                <div>
                  <span className="text-slate-400">Tipe:</span>
                  <div className="font-bold text-slate-800">{viewLocationDetail.type}</div>
                </div>
                <div>
                  <span className="text-slate-400">Induk:</span>
                  <div className="font-bold text-slate-800">{viewLocationDetail.parentLocationName || '-'}</div>
                </div>
                <div>
                  <span className="text-slate-400">PIC:</span>
                  <div className="font-bold text-slate-800">{viewLocationDetail.picName || '-'}</div>
                </div>
                <div>
                  <span className="text-slate-400">Kapasitas:</span>
                  <div className="font-bold text-slate-800">{viewLocationDetail.capacityM2 || 0} m²</div>
                </div>
              </div>

              {viewLocationDetail.address && (
                <div>
                  <span className="text-slate-400 block mb-0.5">Alamat / Area:</span>
                  <div className="p-2.5 bg-slate-50 rounded-lg text-slate-700">{viewLocationDetail.address}</div>
                </div>
              )}

              {viewLocationDetail.description && (
                <div>
                  <span className="text-slate-400 block mb-0.5">Keterangan Operasional:</span>
                  <div className="p-2.5 bg-slate-50 rounded-lg text-slate-700">{viewLocationDetail.description}</div>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setViewLocationDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE MATERIAL CONFIRMATION */}
      {materialToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Material</h3>
                <p className="text-xs text-slate-500">Tindakan ini akan menghapus data dari Cloud Firestore</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <div>
                Kode Material: <span className="font-mono font-bold text-slate-900">{materialToDelete.materialCode}</span>
              </div>
              <div>
                Nama Material: <span className="font-bold text-slate-900">{materialToDelete.materialName}</span>
              </div>
              <div>
                Kategori: <span className="font-medium text-slate-800">{materialToDelete.categoryName}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus material ini? Material hanya dapat dihapus jika tidak memiliki riwayat transaksi atau sisa stok aktif.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setMaterialToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteMaterialConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Konfirmasi Hapus</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE LOCATION CONFIRMATION */}
      {locationToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Lokasi Master</h3>
                <p className="text-xs text-slate-500">Tindakan ini akan menghapus data dari Cloud Firestore</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <div>
                Kode Lokasi: <span className="font-mono font-bold text-slate-900">{locationToDelete.code}</span>
              </div>
              <div>
                Nama Lokasi: <span className="font-bold text-slate-900">{locationToDelete.name}</span>
              </div>
              <div>
                Tipe: <span className="font-medium text-slate-800">{locationToDelete.type}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus lokasi ini? Lokasi hanya dapat dihapus jika tidak memiliki sisa saldo stok di dalamnya.
            </p>

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setLocationToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteLocationConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menghapus...</span>
                  </>
                ) : (
                  <span>Konfirmasi Hapus</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Excel Import & Export Modal */}
      <ExcelImportExportModal
        isOpen={excelModalOpen}
        initialModule={excelInitialModule}
        onClose={() => setExcelModalOpen(false)}
      />
    </div>
  );
};
