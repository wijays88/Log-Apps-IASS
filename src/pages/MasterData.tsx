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
    activeRequestingUnits,
    addRequestingUnit,
    updateRequestingUnit,
    toggleRequestingUnitStatus,
    deleteRequestingUnit,
    suppliers,
    activeSuppliers,
    saveSupplier,
    deleteSupplier,
    goodsIssues,
    stockTransfers,
    supplyRequests,
    goodsReceipts,
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

    if (!matCode.trim()) {
      setCodeDuplicateError('Kode material wajib diisi.');
      return;
    }
    if (!matName.trim()) {
      setCodeDuplicateError('Nama material wajib diisi.');
      return;
    }
    if (!matCategoryId) {
      setCodeDuplicateError('Kategori material wajib dipilih.');
      return;
    }
    if (!matUnitId) {
      setCodeDuplicateError('Satuan ukur material wajib dipilih.');
      return;
    }

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

  // ----------------------------------------------------
  // UNIT PEMOHON (REQUESTING UNITS) LOGIC & STATE
  // ----------------------------------------------------
  const [reqSearchTerm, setReqSearchTerm] = useState('');
  const [reqFilterStatus, setReqFilterStatus] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [reqUnitModalOpen, setReqUnitModalOpen] = useState(false);
  const [editingReqUnitId, setEditingReqUnitId] = useState<string | null>(null);
  const [reqCode, setReqCode] = useState('');
  const [reqName, setReqName] = useState('');
  const [reqDivision, setReqDivision] = useState('Divisi Operasi');
  const [reqContactPerson, setReqContactPerson] = useState('');
  const [reqDescription, setReqDescription] = useState('');
  const [reqIsActive, setReqIsActive] = useState(true);
  const [isSubmittingReq, setIsSubmittingReq] = useState(false);
  const [viewReqUnitDetail, setViewReqUnitDetail] = useState<MasterRequestingUnit | null>(null);
  const [reqUnitToDelete, setReqUnitToDelete] = useState<MasterRequestingUnit | null>(null);
  const [reqDeleteBlockingReason, setReqDeleteBlockingReason] = useState<string | null>(null);
  const [isDeletingReq, setIsDeletingReq] = useState(false);
  const [reqDuplicateError, setReqDuplicateError] = useState('');

  // Filtered Requesting Units
  const filteredRequestingUnits = useMemo(() => {
    return requestingUnits.filter((u) => {
      const term = (reqSearchTerm || searchTerm).toLowerCase().trim();
      const codeStr = (u.code || u.unitCode || '').toLowerCase();
      const nameStr = (u.name || u.unitName || '').toLowerCase();
      const divStr = (u.division || '').toLowerCase();
      const picStr = (u.contactPerson || '').toLowerCase();
      const descStr = (u.description || '').toLowerCase();

      const matchSearch =
        !term ||
        codeStr.includes(term) ||
        nameStr.includes(term) ||
        divStr.includes(term) ||
        picStr.includes(term) ||
        descStr.includes(term);

      const matchStatus =
        reqFilterStatus === 'ALL' ||
        (reqFilterStatus === 'ACTIVE' && u.isActive !== false) ||
        (reqFilterStatus === 'INACTIVE' && u.isActive === false);

      return matchSearch && matchStatus;
    });
  }, [requestingUnits, reqSearchTerm, searchTerm, reqFilterStatus]);

  const handleOpenAddReqUnit = () => {
    if (!canManage) {
      showToast('error', 'Akses Ditolak', 'Hanya staf berwenang yang dapat mendaftarkan Unit Pemohon.');
      return;
    }
    setEditingReqUnitId(null);
    setReqCode(`UP-${String(requestingUnits.length + 1).padStart(3, '0')}`);
    setReqName('');
    setReqDivision('Divisi Operasi');
    setReqContactPerson('');
    setReqDescription('');
    setReqIsActive(true);
    setReqDuplicateError('');
    setReqUnitModalOpen(true);
  };

  const handleOpenEditReqUnit = (u: MasterRequestingUnit) => {
    if (!canManage) {
      showToast('error', 'Akses Ditolak', 'Hanya staf berwenang yang dapat mengubah data Unit Pemohon.');
      return;
    }
    setEditingReqUnitId(u.id);
    setReqCode(u.code || u.unitCode || '');
    setReqName(u.name || u.unitName || '');
    setReqDivision(u.division || 'Divisi Operasi');
    setReqContactPerson(u.contactPerson || '');
    setReqDescription(u.description || '');
    setReqIsActive(u.isActive !== false);
    setReqDuplicateError('');
    setReqUnitModalOpen(true);
  };

  const handleSubmitReqUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReqDuplicateError('');

    const cleanCode = reqCode.trim().toUpperCase();
    const cleanName = reqName.trim();

    if (!cleanCode) {
      setReqDuplicateError('Kode Unit Pemohon wajib diisi.');
      return;
    }
    if (!cleanName) {
      setReqDuplicateError('Nama Unit Pemohon wajib diisi.');
      return;
    }

    // Check duplicate code
    const dupCode = requestingUnits.some(
      (u) =>
        u.id !== editingReqUnitId &&
        ((u.code && u.code.toUpperCase() === cleanCode) ||
          (u.unitCode && u.unitCode.toUpperCase() === cleanCode))
    );
    if (dupCode) {
      setReqDuplicateError(`Kode Unit "${cleanCode}" sudah digunakan oleh unit lain.`);
      return;
    }

    // Check duplicate name
    const dupName = requestingUnits.some(
      (u) =>
        u.id !== editingReqUnitId &&
        ((u.name && u.name.toLowerCase() === cleanName.toLowerCase()) ||
          (u.unitName && u.unitName.toLowerCase() === cleanName.toLowerCase()))
    );
    if (dupName) {
      setReqDuplicateError(`Nama Unit "${cleanName}" sudah terdaftar dalam sistem.`);
      return;
    }

    setIsSubmittingReq(true);
    try {
      if (editingReqUnitId) {
        const res = await updateRequestingUnit(editingReqUnitId, {
          code: cleanCode,
          unitCode: cleanCode,
          name: cleanName,
          unitName: cleanName,
          division: reqDivision.trim() || 'Umum',
          contactPerson: reqContactPerson.trim() || '-',
          description: reqDescription.trim(),
          isActive: reqIsActive,
        });
        if (res.success) {
          setReqUnitModalOpen(false);
        } else if (res.message) {
          setReqDuplicateError(res.message);
        }
      } else {
        const res = await addRequestingUnit({
          code: cleanCode,
          unitCode: cleanCode,
          name: cleanName,
          unitName: cleanName,
          division: reqDivision.trim() || 'Umum',
          contactPerson: reqContactPerson.trim() || '-',
          description: reqDescription.trim(),
          isActive: reqIsActive,
        });
        if (res.success) {
          setReqUnitModalOpen(false);
        } else if (res.message) {
          setReqDuplicateError(res.message);
        }
      }
    } finally {
      setIsSubmittingReq(false);
    }
  };

  const handleToggleReqStatus = async (u: MasterRequestingUnit) => {
    if (!canManage) {
      showToast('error', 'Akses Ditolak', 'Hanya staf berwenang yang dapat mengubah status.');
      return;
    }
    await toggleRequestingUnitStatus(u.id);
  };

  const handleOpenDeleteReqUnit = (u: MasterRequestingUnit) => {
    if (!canManage || currentUser?.role !== 'ADMIN') {
      showToast('error', 'Akses Ditolak', 'Hanya Administrator yang memiliki wewenang menghapus Unit Pemohon.');
      return;
    }

    // Check operational references across Goods Issues, Stock Transfers, and Supply Requests
    const giRefs = goodsIssues.filter(
      (gi) =>
        gi.requesterUnitId === u.id ||
        (gi.requestingUnit && u.name && gi.requestingUnit.toLowerCase() === u.name.toLowerCase()) ||
        (gi.requestingUnit && u.code && gi.requestingUnit.toLowerCase() === u.code.toLowerCase())
    );
    const stRefs = stockTransfers.filter(
      (st) =>
        st.requesterUnitId === u.id ||
        (st.requestingUnit && u.name && st.requestingUnit.toLowerCase() === u.name.toLowerCase()) ||
        (st.requestingUnit && u.code && st.requestingUnit.toLowerCase() === u.code.toLowerCase())
    );
    const srRefs = supplyRequests.filter(
      (sr) =>
        sr.requesterUnitId === u.id ||
        (sr.requestingUnit && u.name && sr.requestingUnit.toLowerCase() === u.name.toLowerCase()) ||
        (sr.requestingUnit && u.code && sr.requestingUnit.toLowerCase() === u.code.toLowerCase())
    );

    const totalRefs = giRefs.length + stRefs.length + srRefs.length;
    if (totalRefs > 0) {
      setReqDeleteBlockingReason(
        `Unit Pemohon "${u.name}" (${u.code}) TIDAK DAPAT DIHAPUS karena tercatat dalam ${totalRefs} transaksi operasional: ` +
          `${giRefs.length} Pengeluaran Barang, ${stRefs.length} Transfer Stok, dan ${srRefs.length} Permohonan Pasokan. ` +
          `Untuk menjaga integritas riwayat logistik, Anda disarankan menonaktifkan status unit ini agar tidak dapat dipilih lagi pada transaksi baru.`
      );
    } else {
      setReqDeleteBlockingReason(null);
    }
    setReqUnitToDelete(u);
  };

  const handleConfirmDeleteReqUnit = async () => {
    if (!reqUnitToDelete || reqDeleteBlockingReason) return;
    setIsDeletingReq(true);
    try {
      const res = await deleteRequestingUnit(reqUnitToDelete.id);
      if (res.success) {
        setReqUnitToDelete(null);
      }
    } finally {
      setIsDeletingReq(false);
    }
  };

  const handleExportReqUnitsQuick = (format: 'xlsx' | 'csv') => {
    const data = filteredRequestingUnits.map((u) => ({
      'Kode Unit': u.code || u.unitCode,
      'Nama Unit Pemohon': u.name || u.unitName,
      'Divisi Induk': u.division,
      'Contact Person / PIC': u.contactPerson,
      'Keterangan': u.description || '-',
      'Status': u.isActive !== false ? 'Active' : 'Inactive',
      'Dibuat Pada': u.createdAt || '-',
      'Dibuat Oleh': u.createdBy || '-',
      'Terakhir Diperbarui': u.updatedAt || '-',
    }));
    const dateStr = new Date().toISOString().slice(0, 10);
    if (format === 'xlsx') {
      exportToExcelFile(data, `Master_Unit_Pemohon_${dateStr}.xlsx`, 'Unit Pemohon');
    } else {
      exportToCsvFile(data, `Master_Unit_Pemohon_${dateStr}.csv`);
    }
    showToast('success', 'Ekspor Berhasil', `${data.length} unit pemohon diekspor.`);
  };

  // ----------------------------------------------------
  // SUPPLIER MASTER LOGIC & STATE
  // ----------------------------------------------------
  const [supModalOpen, setSupModalOpen] = useState(false);
  const [editingSupId, setEditingSupId] = useState<string | null>(null);
  const [supCode, setSupCode] = useState('');
  const [supName, setSupName] = useState('');
  const [supContactPerson, setSupContactPerson] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supEmail, setSupEmail] = useState('');
  const [supAddress, setSupAddress] = useState('');
  const [isSubmittingSup, setIsSubmittingSup] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<MasterSupplier | null>(null);
  const [supDeleteBlockingReason, setSupDeleteBlockingReason] = useState<string | null>(null);
  const [isDeletingSup, setIsDeletingSup] = useState(false);

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const term = (searchTerm || '').toLowerCase().trim();
      if (!term) return true;
      return (
        s.code.toLowerCase().includes(term) ||
        s.name.toLowerCase().includes(term) ||
        s.contactPerson.toLowerCase().includes(term) ||
        s.address.toLowerCase().includes(term)
      );
    });
  }, [suppliers, searchTerm]);

  const handleOpenAddSupplier = () => {
    if (!canManage) {
      showToast('error', 'Akses Ditolak', 'Hanya staf berwenang yang dapat menambah data pemasok.');
      return;
    }
    setEditingSupId(null);
    setSupCode(`SUP-${String(suppliers.length + 1).padStart(3, '0')}`);
    setSupName('');
    setSupContactPerson('');
    setSupPhone('');
    setSupEmail('');
    setSupAddress('');
    setSupModalOpen(true);
  };

  const handleOpenEditSupplier = (s: MasterSupplier) => {
    if (!canManage) {
      showToast('error', 'Akses Ditolak', 'Hanya staf berwenang yang dapat mengubah data pemasok.');
      return;
    }
    setEditingSupId(s.id);
    setSupCode(s.code);
    setSupName(s.name);
    setSupContactPerson(s.contactPerson);
    setSupPhone(s.phone);
    setSupEmail(s.email);
    setSupAddress(s.address);
    setSupModalOpen(true);
  };

  const handleSubmitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) {
      showToast('error', 'Validasi Gagal', 'Nama pemasok wajib diisi.');
      return;
    }
    setIsSubmittingSup(true);
    try {
      const success = await saveSupplier({
        id: editingSupId || undefined,
        code: supCode.trim().toUpperCase() || `SUP-${Date.now()}`,
        name: supName.trim(),
        contactPerson: supContactPerson.trim() || '-',
        phone: supPhone.trim() || '-',
        email: supEmail.trim() || '-',
        address: supAddress.trim() || '-',
        isActive: true,
      });
      if (success) {
        setSupModalOpen(false);
      }
    } finally {
      setIsSubmittingSup(false);
    }
  };

  const handleOpenDeleteSupplier = (s: MasterSupplier) => {
    if (!canManage || currentUser?.role !== 'ADMIN') {
      showToast('error', 'Akses Ditolak', 'Hanya Administrator yang dapat menghapus data pemasok.');
      return;
    }
    const refReceipts = goodsReceipts.filter(
      (gr) => gr.sourceSupplier?.toLowerCase() === s.name.toLowerCase()
    );
    if (refReceipts.length > 0) {
      setSupDeleteBlockingReason(
        `Pemasok "${s.name}" tidak dapat dihapus karena tercatat dalam ${refReceipts.length} transaksi penerimaan barang masuk.`
      );
    } else {
      setSupDeleteBlockingReason(null);
    }
    setSupplierToDelete(s);
  };

  const handleConfirmDeleteSupplier = async () => {
    if (!supplierToDelete || supDeleteBlockingReason) return;
    setIsDeletingSup(true);
    try {
      const res = await deleteSupplier(supplierToDelete.id);
      if (res.success) {
        setSupplierToDelete(null);
      }
    } finally {
      setIsDeletingSup(false);
    }
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
                  ? 'border-[#1F5FAF] text-[#123B66] bg-[#EFF6FF]'
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
                    className="px-4 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
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
                    className="px-4 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
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
        <div className="space-y-4">
          {/* Action & Filter Bar */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1 max-w-lg">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Cari kode, nama unit kerja, divisi, PIC..."
                    value={reqSearchTerm}
                    onChange={(e) => setReqSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
                  />
                </div>
                <div>
                  <select
                    value={reqFilterStatus}
                    onChange={(e) => setReqFilterStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="ALL">Semua Status (Aktif & Non-Aktif)</option>
                    <option value="ACTIVE">Hanya Unit Aktif</option>
                    <option value="INACTIVE">Hanya Unit Non-Aktif</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleExportReqUnitsQuick('xlsx')}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs shadow-2xs flex items-center gap-1.5 transition"
                  title="Ekspor data Unit Pemohon ke Excel"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-700" />
                  <span>XLSX</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExportReqUnitsQuick('csv')}
                  className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs shadow-2xs flex items-center gap-1.5 transition"
                  title="Ekspor data Unit Pemohon ke CSV"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>CSV</span>
                </button>

                {canManage && (
                  <button
                    type="button"
                    onClick={handleOpenAddReqUnit}
                    className="px-4 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 transition"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Tambah Unit Pemohon</span>
                  </button>
                )}
              </div>
            </div>

            {/* Metrics Ribbon */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-[11px] text-slate-500 block">Total Unit Terdaftar</span>
                <span className="text-base font-extrabold text-slate-900">{requestingUnits.length}</span>
              </div>
              <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
                <span className="text-[11px] text-emerald-800 block">Unit Aktif (Siap Transaksi)</span>
                <span className="text-base font-extrabold text-emerald-900">
                  {requestingUnits.filter((u) => u.isActive !== false).length}
                </span>
              </div>
              <div className="p-2.5 bg-slate-100/70 rounded-lg border border-slate-200">
                <span className="text-[11px] text-slate-600 block">Unit Non-Aktif (Arsip)</span>
                <span className="text-base font-extrabold text-slate-700">
                  {requestingUnits.filter((u) => u.isActive === false).length}
                </span>
              </div>
              <div className="p-2.5 bg-indigo-50/60 rounded-lg border border-indigo-100">
                <span className="text-[11px] text-indigo-800 block">Total Transaksi Terkait</span>
                <span className="text-base font-extrabold text-indigo-900">
                  {goodsIssues.length + stockTransfers.length + supplyRequests.length}
                </span>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                    <th className="py-3 px-4">Kode Unit</th>
                    <th className="py-3 px-4">Nama Unit Kerja Pemohon</th>
                    <th className="py-3 px-4">Divisi Induk</th>
                    <th className="py-3 px-4">Contact Person / PIC</th>
                    <th className="py-3 px-4">Keterangan</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRequestingUnits.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        {requestingUnits.length === 0 ? (
                          <div className="space-y-2">
                            <p className="font-semibold text-slate-600">Belum ada Unit Pemohon yang terdaftar.</p>
                            <p className="text-[11px] text-slate-400">
                              Klik tombol "Tambah Unit Pemohon" di atas untuk mendaftarkan unit kerja pertama.
                            </p>
                          </div>
                        ) : (
                          'Tidak ada Unit Pemohon yang cocok dengan kata kunci atau filter pencarian.'
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredRequestingUnits.map((u) => {
                      const isActive = u.isActive !== false;
                      const hasRef =
                        goodsIssues.some(
                          (gi) =>
                            gi.requesterUnitId === u.id ||
                            (gi.requestingUnit && u.name && gi.requestingUnit.toLowerCase() === u.name.toLowerCase())
                        ) ||
                        stockTransfers.some(
                          (st) =>
                            st.requesterUnitId === u.id ||
                            (st.requestingUnit && u.name && st.requestingUnit.toLowerCase() === u.name.toLowerCase())
                        ) ||
                        supplyRequests.some(
                          (sr) =>
                            sr.requesterUnitId === u.id ||
                            (sr.requestingUnit && u.name && sr.requestingUnit.toLowerCase() === u.name.toLowerCase())
                        );

                      return (
                        <tr key={u.id} className="hover:bg-slate-50 transition">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                              {u.code || u.unitCode}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 text-xs">{u.name || u.unitName}</div>
                            {u.createdAt && (
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Terdaftar: {u.createdAt.split(' ')[0]}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-700 font-medium">{u.division}</td>
                          <td className="py-3 px-4 text-slate-700">
                            <span className="font-semibold">{u.contactPerson || '-'}</span>
                          </td>
                          <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate" title={u.description || ''}>
                            {u.description || '-'}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3" />
                                Aktif
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                                Non-Aktif
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* View detail button */}
                              <button
                                type="button"
                                onClick={() => setViewReqUnitDetail(u)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100 transition"
                                title="Lihat detail Unit Pemohon"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {canManage && (
                                <>
                                  {/* Edit button */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditReqUnit(u)}
                                    className="p-1 text-slate-500 hover:text-slate-800 rounded hover:bg-slate-100 transition"
                                    title="Ubah data Unit Pemohon"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Toggle status button */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleReqStatus(u)}
                                    className={`p-1 rounded transition ${
                                      isActive
                                        ? 'text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50'
                                        : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                                    }`}
                                    title={isActive ? 'Nonaktifkan Unit' : 'Aktifkan Unit'}
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Delete button (with reference protection) */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenDeleteReqUnit(u)}
                                    className={`p-1 rounded transition ${
                                      hasRef
                                        ? 'text-slate-300 hover:text-amber-700 hover:bg-amber-50'
                                        : 'text-slate-400 hover:text-rose-700 hover:bg-rose-50'
                                    }`}
                                    title={
                                      hasRef
                                        ? 'Unit memiliki transaksi terkait (Penghapusan diproteksi)'
                                        : 'Hapus Unit Pemohon'
                                    }
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
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

      {activeTab === 'SUPPLIERS' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <span className="text-xs text-slate-600 font-semibold">
              Katalog Pemasok Resmi & Rekanan Pengadaan Barang ({suppliers.length} Terdaftar)
            </span>
            {canManage && (
              <button
                type="button"
                onClick={handleOpenAddSupplier}
                className="px-3.5 py-2 rounded-xl bg-[#064e3b] text-white font-bold text-xs shadow-2xs flex items-center gap-1.5 hover:bg-[#065f46] transition"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Pemasok</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuppliers.map((s) => (
              <div
                key={s.id}
                className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-2 hover:border-emerald-300 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {s.code}
                  </span>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEditSupplier(s)}
                        className="p-1 text-slate-400 hover:text-slate-700 rounded hover:bg-slate-100"
                        title="Ubah data pemasok"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenDeleteSupplier(s)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                        title="Hapus pemasok"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
                <h3 className="font-bold text-slate-900 text-sm">{s.name}</h3>
                <p className="text-xs text-slate-500">{s.address}</p>
                <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-600 space-y-0.5">
                  <div>
                    PIC: <strong>{s.contactPerson}</strong>
                  </div>
                  <div>
                    {s.phone} • {s.email}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
                className="px-4 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
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
                className="px-4 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
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

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: ADD / EDIT UNIT PEMOHON */}
      {/* ------------------------------------------------------------------ */}
      {reqUnitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in">
          <form
            onSubmit={handleSubmitReqUnit}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 my-auto flex flex-col space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingReqUnitId ? 'Ubah Data Unit Pemohon' : 'Tambah Unit Pemohon Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Master entitas divisi / unit pemohon permohonan logistik PT IAS Support
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReqUnitModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {reqDuplicateError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div className="font-semibold">{reqDuplicateError}</div>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Kode Unit *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: UP-OPS-01"
                    value={reqCode}
                    onChange={(e) => {
                      setReqCode(e.target.value.toUpperCase());
                      setReqDuplicateError('');
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold uppercase focus:ring-2 focus:ring-[#064e3b]/30 focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Kode unik pengenal unit kerja</span>
                </div>

                <div>
                  <label className="text-slate-700 font-bold block mb-1">Divisi Induk *</label>
                  <select
                    value={reqDivision}
                    onChange={(e) => setReqDivision(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-[#064e3b]/30 focus:outline-none"
                  >
                    <option value="Divisi Operasi">Divisi Operasi (Hub & Terminal)</option>
                    <option value="Divisi Kebersihan & Fasilitas">Divisi Kebersihan & Fasilitas</option>
                    <option value="Divisi Ground Handling">Divisi Ground Handling</option>
                    <option value="Divisi Pemeliharaan (Maintenance)">Divisi Pemeliharaan (Maintenance)</option>
                    <option value="Divisi Logistik & Pergudangan">Divisi Logistik & Pergudangan</option>
                    <option value="Divisi Keamanan & K3 (Safety)">Divisi Keamanan & K3 (Safety)</option>
                    <option value="Divisi Administrasi & Umum">Divisi Administrasi & Umum</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Nama Unit Kerja Pemohon *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Unit Kebersihan Terminal 1B Airside"
                  value={reqName}
                  onChange={(e) => {
                    setReqName(e.target.value);
                    setReqDuplicateError('');
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#064e3b]/30 focus:outline-none font-medium"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Contact Person / PIC Unit</label>
                <input
                  type="text"
                  placeholder="Nama penanggung jawab operasional unit"
                  value={reqContactPerson}
                  onChange={(e) => setReqContactPerson(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#064e3b]/30 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Keterangan / Ruang Lingkup</label>
                <textarea
                  rows={2}
                  placeholder="Deskripsi tugas, lokasi kerja utama, atau peruntukan barang..."
                  value={reqDescription}
                  onChange={(e) => setReqDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#064e3b]/30 focus:outline-none resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="font-bold text-slate-800">Status Operasi Unit</div>
                  <div className="text-[11px] text-slate-500">
                    Hanya unit berstatus aktif yang dapat dipilih pada transaksi Pengeluaran dan Transfer Stok.
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reqIsActive}
                    onChange={(e) => setReqIsActive(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#064e3b]"></div>
                </label>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isSubmittingReq}
                onClick={() => setReqUnitModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingReq}
                className="px-4 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold shadow-2xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isSubmittingReq ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Menyimpan ke Firestore...</span>
                  </>
                ) : (
                  <span>{editingReqUnitId ? 'Simpan Perubahan' : 'Daftarkan Unit Pemohon'}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: VIEW UNIT PEMOHON DETAILS */}
      {/* ------------------------------------------------------------------ */}
      {viewReqUnitDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-xs font-extrabold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200">
                  {viewReqUnitDetail.code || viewReqUnitDetail.unitCode}
                </span>
                <h3 className="text-base font-extrabold text-slate-900 mt-1">
                  {viewReqUnitDetail.name || viewReqUnitDetail.unitName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewReqUnitDetail(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block mb-0.5">Divisi Induk:</span>
                  <span className="font-bold text-slate-800">{viewReqUnitDetail.division}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Contact Person (PIC):</span>
                  <span className="font-bold text-slate-800">{viewReqUnitDetail.contactPerson || '-'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Status Saat Ini:</span>
                  <span
                    className={`font-bold ${
                      viewReqUnitDetail.isActive !== false ? 'text-emerald-700' : 'text-slate-500'
                    }`}
                  >
                    {viewReqUnitDetail.isActive !== false
                      ? 'Aktif (Dapat dipilih di transaksi)'
                      : 'Non-Aktif (Diarsipkan)'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block mb-0.5">Database ID:</span>
                  <span className="font-mono text-[10px] text-slate-700">{viewReqUnitDetail.id}</span>
                </div>
              </div>

              {viewReqUnitDetail.description && (
                <div>
                  <span className="text-slate-400 block mb-1">Keterangan / Catatan:</span>
                  <div className="p-2.5 bg-slate-50 rounded-lg text-slate-700 border border-slate-100">
                    {viewReqUnitDetail.description}
                  </div>
                </div>
              )}

              {/* Usage references */}
              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100">
                <span className="text-blue-900 font-bold block mb-1.5">Riwayat Keterlibatan Transaksi:</span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-white rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block">Barang Keluar</span>
                    <span className="font-extrabold text-blue-900">
                      {
                        goodsIssues.filter(
                          (gi) =>
                            gi.requesterUnitId === viewReqUnitDetail.id ||
                            (gi.requestingUnit &&
                              viewReqUnitDetail.name &&
                              gi.requestingUnit.toLowerCase() === viewReqUnitDetail.name.toLowerCase())
                        ).length
                      }
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block">Transfer Stok</span>
                    <span className="font-extrabold text-blue-900">
                      {
                        stockTransfers.filter(
                          (st) =>
                            st.requesterUnitId === viewReqUnitDetail.id ||
                            (st.requestingUnit &&
                              viewReqUnitDetail.name &&
                              st.requestingUnit.toLowerCase() === viewReqUnitDetail.name.toLowerCase())
                        ).length
                      }
                    </span>
                  </div>
                  <div className="p-2 bg-white rounded-lg border border-blue-100">
                    <span className="text-[10px] text-slate-500 block">Permohonan</span>
                    <span className="font-extrabold text-blue-900">
                      {
                        supplyRequests.filter(
                          (sr) =>
                            sr.requesterUnitId === viewReqUnitDetail.id ||
                            (sr.requestingUnit &&
                              viewReqUnitDetail.name &&
                              sr.requestingUnit.toLowerCase() === viewReqUnitDetail.name.toLowerCase())
                        ).length
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* Metadata */}
              <div className="text-[11px] text-slate-500 space-y-0.5 pt-1 border-t border-slate-100">
                <div>
                  Dibuat oleh:{' '}
                  <span className="font-mono text-slate-700">{viewReqUnitDetail.createdBy || 'System'}</span>
                  {viewReqUnitDetail.createdAt && <span> ({viewReqUnitDetail.createdAt})</span>}
                </div>
                {viewReqUnitDetail.updatedAt && (
                  <div>
                    Terakhir diperbarui:{' '}
                    <span className="font-mono text-slate-700">{viewReqUnitDetail.updatedBy || 'System'}</span> (
                    {viewReqUnitDetail.updatedAt})
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setViewReqUnitDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: DELETE UNIT PEMOHON CONFIRMATION (WITH PROTECTED REFERENCING) */}
      {/* ------------------------------------------------------------------ */}
      {reqUnitToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-2.5 rounded-xl ${
                  reqDeleteBlockingReason ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-700'
                }`}
              >
                {reqDeleteBlockingReason ? <AlertTriangle className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {reqDeleteBlockingReason ? 'Penghapusan Diblokir' : 'Hapus Unit Pemohon'}
                </h3>
                <p className="text-xs text-slate-500">Master Data Unit Pemohon PT IAS Support</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <div>
                Kode Unit: <span className="font-mono font-bold text-slate-900">{reqUnitToDelete.code || reqUnitToDelete.unitCode}</span>
              </div>
              <div>
                Nama Unit: <span className="font-bold text-slate-900">{reqUnitToDelete.name || reqUnitToDelete.unitName}</span>
              </div>
              <div>
                Divisi: <span className="font-medium text-slate-800">{reqUnitToDelete.division}</span>
              </div>
            </div>

            {reqDeleteBlockingReason ? (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-xs text-amber-900">
                <p className="leading-relaxed">{reqDeleteBlockingReason}</p>
                <div className="pt-2 border-t border-amber-200/60 flex items-center justify-between">
                  <span className="font-semibold text-amber-800">Solusi yang disarankan:</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await toggleRequestingUnitStatus(reqUnitToDelete.id);
                      setReqUnitToDelete(null);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-bold hover:bg-amber-800 transition"
                  >
                    Nonaktifkan Unit Ini
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus data Unit Pemohon ini secara permanen dari Cloud Firestore?
              </p>
            )}

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isDeletingReq}
                onClick={() => setReqUnitToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200 disabled:opacity-50"
              >
                {reqDeleteBlockingReason ? 'Mengerti & Tutup' : 'Batal'}
              </button>
              {!reqDeleteBlockingReason && (
                <button
                  type="button"
                  disabled={isDeletingReq}
                  onClick={handleConfirmDeleteReqUnit}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
                >
                  {isDeletingReq ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Menghapus...</span>
                    </>
                  ) : (
                    <span>Konfirmasi Hapus</span>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: ADD / EDIT SUPPLIER */}
      {/* ------------------------------------------------------------------ */}
      {supModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <form
            onSubmit={handleSubmitSupplier}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingSupId ? 'Ubah Data Pemasok' : 'Tambah Pemasok Baru'}
                  </h3>
                  <p className="text-xs text-slate-500">Master Data Vendor & Pemasok Barang</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSupModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Kode Pemasok *</label>
                  <input
                    type="text"
                    required
                    value={supCode}
                    onChange={(e) => setSupCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono font-bold uppercase"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Nama Pemasok *</label>
                  <input
                    type="text"
                    required
                    value={supName}
                    onChange={(e) => setSupName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-bold block mb-1">Contact Person (PIC)</label>
                  <input
                    type="text"
                    value={supContactPerson}
                    onChange={(e) => setSupContactPerson(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-slate-700 font-bold block mb-1">No. Telepon / HP</label>
                  <input
                    type="text"
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Alamat Email</label>
                <input
                  type="email"
                  value={supEmail}
                  onChange={(e) => setSupEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="text-slate-700 font-bold block mb-1">Alamat Kantor / Gudang</label>
                <textarea
                  rows={2}
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg resize-none"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isSubmittingSup}
                onClick={() => setSupModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmittingSup}
                className="px-4 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold transition flex items-center gap-1.5"
              >
                {isSubmittingSup ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Simpan Pemasok</span>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MODAL: DELETE SUPPLIER CONFIRMATION */}
      {/* ------------------------------------------------------------------ */}
      {supplierToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Hapus Data Pemasok</h3>
                <p className="text-xs text-slate-500">Master Data Pemasok PT IAS Support</p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-1">
              <div>
                Kode: <span className="font-mono font-bold text-slate-900">{supplierToDelete.code}</span>
              </div>
              <div>
                Nama: <span className="font-bold text-slate-900">{supplierToDelete.name}</span>
              </div>
            </div>

            {supDeleteBlockingReason ? (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed">
                {supDeleteBlockingReason}
              </div>
            ) : (
              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus data pemasok ini?
              </p>
            )}

            <div className="pt-2 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                disabled={isDeletingSup}
                onClick={() => setSupplierToDelete(null)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
              >
                {supDeleteBlockingReason ? 'Tutup' : 'Batal'}
              </button>
              {!supDeleteBlockingReason && (
                <button
                  type="button"
                  disabled={isDeletingSup}
                  onClick={handleConfirmDeleteSupplier}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition flex items-center gap-1.5"
                >
                  {isDeletingSup ? <Loader2 className="w-4 h-4 animate-spin" /> : <span>Konfirmasi Hapus</span>}
                </button>
              )}
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
