import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowUpFromLine,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Building2,
  Lock,
  X,
  AlertTriangle,
  Eye,
  Warehouse,
  Package,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';
import {
  calculateUnreservedAvailableStock,
  getCanonicalBalanceId,
  getPendingGoodsIssueReservedQty,
} from '../services/inventoryEngine';

export const BarangKeluar: React.FC = () => {
  const {
    goodsIssues,
    inventory,
    activeMaterials,
    activeLocations,
    activeRequestingUnits,
    createGoodsIssue,
    fetchLiveStockBalance,
    currentUser,
    can,
    showToast,
    setActiveNav,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [liveSelectedStock, setLiveSelectedStock] = useState<number | null>(null);
  const [isCheckingLiveStock, setIsCheckingLiveStock] = useState(false);

  // Form state
  const [sourceLocationId, setSourceLocationId] = useState<string>(activeLocations[0]?.id || '');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [materialSearchText, setMaterialSearchText] = useState<string>('');
  const [formData, setFormData] = useState({
    requesterUnitId: activeRequestingUnits[0]?.id || '',
    requestingUnit: activeRequestingUnits[0]?.name || '',
    destination: '',
    requestedQuantity: 1,
    purpose: '',
    notes: '',
  });

  // Keep sourceLocationId in sync with activeLocations
  useEffect(() => {
    if (activeLocations.length > 0 && (!sourceLocationId || !activeLocations.some((l) => l.id === sourceLocationId))) {
      setSourceLocationId(activeLocations[0].id);
    }
  }, [activeLocations, sourceLocationId]);

  // Active materials with positive available stock at the selected source location (multi-key SKU match)
  const locationMaterials = useMemo(() => {
    if (!sourceLocationId) return [];
    return activeMaterials
      .map((mat) => {
        const canonicalId = getCanonicalBalanceId(mat.id, sourceLocationId);
        const matches = inventory.filter(
          (inv) =>
            (inv.materialId === mat.id ||
              inv.itemId === mat.id ||
              (mat.materialCode && (inv.materialCode === mat.materialCode || inv.itemCode === mat.materialCode))) &&
            inv.locationId === sourceLocationId
        );
        const bal =
          matches.find((m) => m.id === canonicalId) ||
          [...matches].sort((a, b) => (Number(b.version) || 0) - (Number(a.version) || 0))[0];
        const stock = bal ? Number(bal.availableStock) || 0 : 0;
        return {
          material: mat,
          availableStock: stock,
          balance: bal,
        };
      })
      .filter((item) => item.availableStock > 0);
  }, [activeMaterials, inventory, sourceLocationId]);

  // Filtered materials by search term
  const searchedMaterials = useMemo(() => {
    if (!materialSearchText.trim()) return locationMaterials;
    const q = materialSearchText.toLowerCase();
    return locationMaterials.filter(
      (it) =>
        it.material.materialCode.toLowerCase().includes(q) ||
        it.material.materialName.toLowerCase().includes(q)
    );
  }, [locationMaterials, materialSearchText]);

  // Synchronize selected material when location materials change
  useEffect(() => {
    if (locationMaterials.length > 0) {
      if (!selectedMaterialId || !locationMaterials.some((it) => it.material.id === selectedMaterialId)) {
        setSelectedMaterialId(locationMaterials[0].material.id);
      }
    } else {
      setSelectedMaterialId('');
    }
  }, [locationMaterials, selectedMaterialId]);

  // Selected item resolved data
  const selectedItemData = useMemo(() => {
    return locationMaterials.find((it) => it.material.id === selectedMaterialId) || locationMaterials[0] || null;
  }, [locationMaterials, selectedMaterialId]);

  // Live Firestore balance verification whenever modal opens or selected SKU/location changes
  useEffect(() => {
    let active = true;
    if (!modalOpen || !selectedItemData || !sourceLocationId) {
      setLiveSelectedStock(null);
      return;
    }
    setIsCheckingLiveStock(true);
    fetchLiveStockBalance(
      selectedItemData.material.id,
      sourceLocationId,
      selectedItemData.material.materialCode
    )
      .then((liveVal) => {
        if (active) {
          setLiveSelectedStock(liveVal);
        }
      })
      .finally(() => {
        if (active) setIsCheckingLiveStock(false);
      });
    return () => {
      active = false;
    };
  }, [modalOpen, selectedItemData?.material.id, selectedItemData?.material.materialCode, sourceLocationId, fetchLiveStockBalance]);

  const effectiveAvailableStock = liveSelectedStock !== null
    ? liveSelectedStock
    : selectedItemData?.availableStock ?? 0;

  const pendingQtyForSelected = useMemo(() => {
    if (!selectedItemData || !sourceLocationId) return 0;
    return getPendingGoodsIssueReservedQty(
      goodsIssues,
      selectedItemData.material.id,
      sourceLocationId,
      selectedItemData.material.materialCode
    );
  }, [goodsIssues, selectedItemData, sourceLocationId]);

  const unreservedAvailableStock = calculateUnreservedAvailableStock(
    effectiveAvailableStock,
    pendingQtyForSelected
  );

  const selectedLocation = useMemo(() => {
    return activeLocations.find((l) => l.id === sourceLocationId) || activeLocations[0] || null;
  }, [activeLocations, sourceLocationId]);

  const filteredIssues = goodsIssues.filter((issue) => {
    const matchSearch =
      issue.issueNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.requestingUnit.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.destination.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.requestedBy.toLowerCase().includes(searchTerm.toLowerCase());

    const matchStatus = statusFilter === 'ALL' || issue.status === statusFilter;

    return matchSearch && matchStatus;
  });

  const handleOpenModal = () => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Peran Site Head hanya dapat melihat dokumen pengeluaran.');
      return;
    }
    const defaultUnit = activeRequestingUnits[0];
    const defaultLoc = activeLocations[0];
    if (defaultLoc) {
      setSourceLocationId(defaultLoc.id);
    }
    setFormData((prev) => ({
      ...prev,
      requesterUnitId: prev.requesterUnitId || defaultUnit?.id || '',
      requestingUnit: prev.requestingUnit || defaultUnit?.name || '',
      requestedQuantity: 1,
    }));
    setMaterialSearchText('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLocation) {
      showToast('error', 'Validasi Gagal', 'Pilih gudang asal pengeluaran.');
      return;
    }

    if (!selectedItemData) {
      showToast('error', 'Validasi Gagal', 'Pilih item barang dari Master Data yang memiliki saldo stok.');
      return;
    }

    if (!formData.requesterUnitId && !formData.requestingUnit) {
      showToast('error', 'Validasi Gagal', 'Silakan pilih Unit Pemohon yang terdaftar.');
      return;
    }

    // Verify unit exists in active list
    const activeUnit = activeRequestingUnits.find(
      (u) =>
        u.id === formData.requesterUnitId ||
        u.name.toLowerCase() === formData.requestingUnit.toLowerCase() ||
        u.code.toLowerCase() === formData.requestingUnit.toLowerCase()
    );

    if (!activeUnit) {
      showToast(
        'error',
        'Unit Pemohon Tidak Valid',
        'Unit Pemohon yang dipilih tidak aktif atau belum terdaftar di Master Data. Daftarkan/aktifkan terlebih dahulu.'
      );
      return;
    }

    const qty = Number(formData.requestedQuantity);
    if (isNaN(qty) || qty <= 0) {
      showToast('error', 'Validasi Gagal', 'Jumlah permintaan harus berupa angka lebih besar dari 0.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Live authoritative Firestore re-check right before creating GI
      const latestAvailable = await fetchLiveStockBalance(
        selectedItemData.material.id,
        selectedLocation.id,
        selectedItemData.material.materialCode
      );
      setLiveSelectedStock(latestAvailable);

      if (latestAvailable <= 0) {
        showToast(
          'error',
          'Stok Habis (Blocked)',
          `Saldo otoritatif ${selectedItemData.material.materialName} di ${selectedLocation.name} adalah ${latestAvailable} ${selectedItemData.material.unit}. Item bersaldo <= 0 tidak dapat dikeluarkan.`
        );
        return;
      }

      const unreservedAtSubmit = calculateUnreservedAvailableStock(latestAvailable, pendingQtyForSelected);

      // Anti-Negative & Pending Reservation Stock Guard
      if (qty > unreservedAtSubmit) {
        showToast(
          'error',
          'Reservasi / Stok Tidak Cukup',
          `Stok live di ${selectedLocation.name}: ${latestAvailable} ${selectedItemData.material.unit}, tereservasi pending: ${pendingQtyForSelected} ${selectedItemData.material.unit}, tersedia bebas: ${unreservedAtSubmit} ${selectedItemData.material.unit}. Tidak dapat mengajukan ${qty} ${selectedItemData.material.unit}.`
        );
        return;
      }

      const success = await createGoodsIssue({
        requesterUnitId: activeUnit.id,
        requestingUnit: activeUnit.name,
        destination: formData.destination.trim(),
        materialId: selectedItemData.material.id,
        locationId: selectedLocation.id,
        requestedQuantity: qty,
        purpose: formData.purpose.trim(),
        notes: formData.notes.trim(),
      });

      if (success) {
        setModalOpen(false);
        const nextDefault = activeRequestingUnits[0];
        setFormData({
          requesterUnitId: nextDefault?.id || '',
          requestingUnit: nextDefault?.name || '',
          destination: '',
          requestedQuantity: 1,
          purpose: '',
          notes: '',
        });
        setMaterialSearchText('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Barang Keluar" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Pengeluaran Barang (Goods Issue)
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-indigo-100 text-indigo-800">
              {filteredIssues.length} Dokumen
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Permohonan pengeluaran barang inventaris untuk unit kerja dan armada operasional PT IAS Support
          </p>
        </div>

        <div className="flex items-center gap-2">
          {currentUser?.role === 'SITE HEAD' ? (
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-400 cursor-not-allowed font-semibold text-xs sm:text-sm border border-slate-200 transition flex items-center gap-2"
              title="Peran Site Head bersifat Read-Only"
            >
              <Lock className="w-4 h-4" />
              <span>Buat Permohonan Keluar</span>
            </button>
          ) : (
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Permohonan Keluar</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nomor issue, item, pemohon, tujuan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 bg-white"
            >
              <option value="ALL">Semua Status Persetujuan</option>
              <option value="PENDING_APPROVAL">Menunggu Persetujuan (Pending)</option>
              <option value="APPROVED">Disetujui (Approved)</option>
              <option value="REJECTED">Ditolak (Rejected)</option>
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
                <th className="py-3 px-4">Issue Number</th>
                <th className="py-3 px-4">Request Date</th>
                <th className="py-3 px-4">Unit Pemohon</th>
                <th className="py-3 px-4">Tujuan / Lokasi Kerja</th>
                <th className="py-3 px-4">Item Barang</th>
                <th className="py-3 px-4 text-center">Req / App Qty</th>
                <th className="py-3 px-4">Keperluan (Purpose)</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Diminta Oleh</th>
                <th className="py-3 px-4">Diproses Oleh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Belum ada rekaman pengeluaran barang.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => (
                  <tr key={issue.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-900">
                      {issue.issueNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {issue.requestDate}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {issue.requestingUnit}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {issue.destination}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[200px]">
                      <div className="truncate" title={issue.itemName}>
                        {issue.itemName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {issue.itemCode}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center font-mono">
                      <span className="font-bold text-slate-800">{issue.requestedQuantity}</span>
                      <span className="text-slate-300 mx-1">/</span>
                      <span className="font-extrabold text-emerald-700">
                        {issue.status === 'APPROVED' ? issue.approvedQuantity : '-'}
                      </span>
                      <span className="text-[10px] text-slate-500 ml-1">{issue.unit}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-[180px]">
                      <div className="truncate" title={issue.purpose}>
                        {issue.purpose}
                      </div>
                      {issue.rejectionReason && (
                        <div className="text-[11px] text-rose-600 font-medium truncate" title={issue.rejectionReason}>
                          Alasan Tolak: {issue.rejectionReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {issue.status === 'APPROVED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          APPROVED
                        </span>
                      ) : issue.status === 'REJECTED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                          <XCircle className="w-3 h-3" />
                          REJECTED
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                          <Clock className="w-3 h-3" />
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-semibold text-slate-800">{issue.requestedBy}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {issue.requestedByEmployeeId}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {issue.processedBy ? (
                        <span className="text-slate-800">{issue.processedBy}</span>
                      ) : (
                        <span className="text-slate-400 italic">Menunggu Review Admin</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Goods Issue Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-100 text-indigo-900">
                  <ArrowUpFromLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Buat Permohonan Pengeluaran Barang
                  </h3>
                  <p className="text-xs text-slate-500">
                    Memerlukan otorisasi Administrator sebelum saldo fisik terpotong
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3.5 text-xs">
              {activeRequestingUnits.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2 text-amber-900">
                  <div className="flex items-center gap-2 font-bold text-xs text-amber-800">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Tidak Ada Unit Pemohon yang Aktif</span>
                  </div>
                  <p className="text-[11px] leading-relaxed text-amber-800">
                    Belum ada Unit Pemohon dalam status aktif. Daftarkan atau aktifkan unit pemohon di Master Data sebelum melanjutkan.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setModalOpen(false);
                      setActiveNav('Master Data');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs transition inline-flex items-center gap-1.5"
                  >
                    <span>Buka Master Data &gt; Unit Pemohon</span>
                  </button>
                </div>
              ) : null}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Unit Kerja Pemohon *</label>
                  <select
                    required
                    disabled={activeRequestingUnits.length === 0}
                    value={formData.requesterUnitId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const found = activeRequestingUnits.find((u) => u.id === selectedId);
                      setFormData({
                        ...formData,
                        requesterUnitId: selectedId,
                        requestingUnit: found ? found.name : '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white font-medium disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {activeRequestingUnits.length === 0 ? (
                      <option value="">-- Tidak ada Unit Pemohon aktif --</option>
                    ) : (
                      activeRequestingUnits.map((u) => (
                        <option key={u.id} value={u.id}>
                          [{u.code || u.unitCode}] {u.name || u.unitName} — {u.division}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-slate-700 block mb-1 font-bold">Tujuan Penggunaan (Lokasi Kerja) *</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Apron Bay 41 T3 / Workshop Hangar"
                    value={formData.destination}
                    onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                  />
                </div>
              </div>

              {/* Source Warehouse Selection */}
              <div>
                <label className="text-slate-700 block mb-1 font-bold">Gudang Asal Pengeluaran *</label>
                <div className="relative">
                  <select
                    required
                    value={sourceLocationId}
                    onChange={(e) => setSourceLocationId(e.target.value)}
                    className="w-full px-3 py-2 pl-9 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white font-medium"
                  >
                    {activeLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.type === 'MAIN' ? '(Gudang Utama)' : ''}
                      </option>
                    ))}
                  </select>
                  <Warehouse className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              {/* Material Search & Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-bold">Pilih Material Barang (Master Data) *</label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {locationMaterials.length} material bersaldo positif di gudang ini
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari kode atau nama material..."
                      value={materialSearchText}
                      onChange={(e) => setMaterialSearchText(e.target.value)}
                      className="w-full px-3 py-1.5 pl-8 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-slate-50"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" />
                  </div>

                  <select
                    required
                    disabled={locationMaterials.length === 0}
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white font-medium disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    {locationMaterials.length === 0 ? (
                      <option value="">-- Tidak ada stok barang tersedia di gudang ini --</option>
                    ) : (
                      searchedMaterials.map((it) => (
                        <option key={it.material.id} value={it.material.id}>
                          [{it.material.materialCode}] {it.material.materialName} (Tersedia: {it.availableStock} {it.material.unit})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Verified Authoritative Stock Preview Card */}
              {selectedItemData && selectedLocation && (
                <div className={`p-3 rounded-xl space-y-1.5 border ${effectiveAvailableStock <= 0 ? 'bg-rose-50/70 border-rose-200' : 'bg-emerald-50/60 border-emerald-200'}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-slate-900 text-xs">
                        {selectedItemData.material.materialName}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          SKU: {selectedItemData.material.materialCode}
                        </span>
                        <span>•</span>
                        <span>Lokasi: {selectedLocation.name}</span>
                        <span>•</span>
                        <span>UoM: {selectedItemData.material.unit}</span>
                      </div>
                      {pendingQtyForSelected > 0 && (
                        <div className="mt-1.5 text-[11px] font-semibold text-amber-800 bg-amber-100/80 border border-amber-200 px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            Tereservasi pending: {pendingQtyForSelected} {selectedItemData.material.unit} • Tersedia bebas: {unreservedAvailableStock} {selectedItemData.material.unit}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                        {isCheckingLiveStock ? 'Memeriksa Saldo...' : 'Stok Live Firestore'}
                      </div>
                      <div className={`text-base font-extrabold font-mono ${unreservedAvailableStock <= 0 ? 'text-rose-700' : 'text-emerald-800'}`}>
                        {effectiveAvailableStock} {selectedItemData.material.unit}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {locationMaterials.length === 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="text-[11px] leading-relaxed">
                    <span className="font-bold">Gudang ini tidak memiliki stok barang aktif.</span> Silakan pilih gudang lain atau catat penerimaan barang masuk terlebih dahulu.
                  </div>
                </div>
              )}

              <div>
                <label className="text-slate-700 block mb-1 font-bold">Kuantitas yang Diminta *</label>
                <input
                  type="number"
                  min="1"
                  max={selectedItemData ? Math.max(1, unreservedAvailableStock) : 99999}
                  required
                  value={formData.requestedQuantity}
                  onChange={(e) => setFormData({ ...formData, requestedQuantity: e.target.value as any })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-mono font-bold"
                />
                {selectedItemData && Number(formData.requestedQuantity) > unreservedAvailableStock && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {pendingQtyForSelected > 0
                      ? `Permintaan (${formData.requestedQuantity}) melebihi sisa tersedia bebas (${unreservedAvailableStock} ${selectedItemData.material.unit}; stok ${effectiveAvailableStock}, tereservasi pending ${pendingQtyForSelected}).`
                      : `Permintaan (${formData.requestedQuantity}) melebihi stok tersedia (${effectiveAvailableStock} ${selectedItemData.material.unit}). Saldo negatif dicegah oleh sistem.`}
                  </p>
                )}
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Tujuan / Keperluan Operasional (Purpose)</label>
                <textarea
                  rows={2}
                  required
                  placeholder="Contoh: Penggantian part rusak rutin maintenance GSE tractor flight schedule..."
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <span className="font-bold">Alur Otorisasi PT IAS Support:</span> Permohonan ini akan diteruskan ke <span className="underline font-semibold">Approval Center</span>. Pemotongan saldo persediaan hanya akan dilakukan secara resmi setelah Administrator memberikan persetujuan.
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={
                  locationMaterials.length === 0 ||
                  !selectedItemData ||
                  unreservedAvailableStock <= 0 ||
                  Number(formData.requestedQuantity) <= 0 ||
                  Number(formData.requestedQuantity) > unreservedAvailableStock ||
                  isSubmitting ||
                  isCheckingLiveStock
                }
                className="px-4 py-2 rounded-xl bg-[#1F5FAF] text-white font-bold hover:bg-[#123B66] disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isSubmitting ? 'Mengirim...' : 'Kirim Permohonan Keluar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
