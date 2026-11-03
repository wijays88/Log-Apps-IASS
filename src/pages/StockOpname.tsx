import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  ClipboardCheck,
  Plus,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Check,
  X,
  Lock,
  Loader2,
  Layers,
  Warehouse,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';

export const StockOpname: React.FC = () => {
  const {
    stockOpnames,
    inventory,
    activeMaterials,
    activeLocations,
    createStockOpname,
    approveOpnameAdjustment,
    rejectOpnameAdjustment,
    currentUser,
    can,
    showToast,
    syncLoading,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Form selection states
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [physicalQuantity, setPhysicalQuantity] = useState<number | string>(0);
  const [varianceReason, setVarianceReason] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  // Synchronize default selections when active data loads or modal opens
  useEffect(() => {
    if (activeLocations.length > 0 && (!selectedLocationId || !activeLocations.some((l) => l.id === selectedLocationId))) {
      setSelectedLocationId(activeLocations[0].id);
    }
  }, [activeLocations, selectedLocationId]);

  useEffect(() => {
    if (activeMaterials.length > 0 && (!selectedMaterialId || !activeMaterials.some((m) => m.id === selectedMaterialId))) {
      setSelectedMaterialId(activeMaterials[0].id);
    }
  }, [activeMaterials, selectedMaterialId]);

  // Derived references from active Master Data
  const selectedLocation = useMemo(() => {
    return activeLocations.find((l) => l.id === selectedLocationId) || activeLocations[0] || null;
  }, [activeLocations, selectedLocationId]);

  const selectedMaterial = useMemo(() => {
    return activeMaterials.find((m) => m.id === selectedMaterialId) || activeMaterials[0] || null;
  }, [activeMaterials, selectedMaterialId]);

  // Retrieve actual stock balance from Inventory for matching material & location
  const currentInventory = useMemo(() => {
    if (!selectedMaterial || !selectedLocation) return undefined;
    return inventory.find(
      (inv) =>
        (inv.materialId === selectedMaterial.id || inv.itemId === selectedMaterial.id) &&
        inv.locationId === selectedLocation.id
    );
  }, [inventory, selectedMaterial, selectedLocation]);

  // Real-time stock calculations
  const systemQty = currentInventory ? Number(currentInventory.availableStock) || 0 : 0;
  const currentUnit = selectedMaterial?.unit || 'Pcs';
  const numericPhysQty = physicalQuantity === '' ? 0 : Number(physicalQuantity);
  const currentVariance = numericPhysQty - systemQty;

  const filteredOpnames = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return stockOpnames.filter((so) => {
      return (
        so.opnameNumber.toLowerCase().includes(q) ||
        so.itemName.toLowerCase().includes(q) ||
        so.itemCode.toLowerCase().includes(q) ||
        so.locationName.toLowerCase().includes(q) ||
        so.conductedBy.toLowerCase().includes(q)
      );
    });
  }, [stockOpnames, searchTerm]);

  const handleOpenModal = () => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Peran Site Head hanya dapat melihat hasil stock opname.');
      return;
    }

    if (activeLocations.length === 0) {
      showToast('error', 'Master Data Kosong', 'Belum ada data Lokasi Gudang aktif. Tambahkan Lokasi terlebih dahulu.');
      return;
    }

    if (activeMaterials.length === 0) {
      showToast('error', 'Master Data Kosong', 'Belum ada data Material aktif. Tambahkan Material terlebih dahulu.');
      return;
    }

    // Set initial defaults
    if (!selectedLocationId && activeLocations[0]) {
      setSelectedLocationId(activeLocations[0].id);
    }
    if (!selectedMaterialId && activeMaterials[0]) {
      setSelectedMaterialId(activeMaterials[0].id);
    }
    setPhysicalQuantity(0);
    setVarianceReason('');
    setNotes('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedLocation) {
      showToast('error', 'Validasi Gagal', 'Pilih lokasi gudang opname.');
      return;
    }

    if (!selectedMaterial) {
      showToast('error', 'Validasi Gagal', 'Pilih material barang yang dihitung.');
      return;
    }

    if (numericPhysQty < 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas fisik tidak boleh bernilai negatif.');
      return;
    }

    if (currentVariance !== 0 && !varianceReason.trim()) {
      showToast('error', 'Validasi Gagal', 'Alasan selisih wajib diisi jika terdapat perbedaan antara fisik dan saldo sistem.');
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await createStockOpname({
        locationId: selectedLocation.id,
        materialId: selectedMaterial.id,
        itemId: selectedMaterial.id,
        physicalQuantity: numericPhysQty,
        varianceReason: varianceReason.trim(),
        notes: notes.trim(),
      });

      if (success) {
        setModalOpen(false);
        setPhysicalQuantity(0);
        setVarianceReason('');
        setNotes('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (opnameId: string) => {
    setActionLoadingId(opnameId);
    try {
      await approveOpnameAdjustment(opnameId);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalId) return;
    if (!rejectReason.trim()) {
      showToast('error', 'Validasi Gagal', 'Alasan penolakan wajib diisi.');
      return;
    }
    setActionLoadingId(rejectModalId);
    try {
      await rejectOpnameAdjustment(rejectModalId, rejectReason.trim());
      setRejectModalId(null);
      setRejectReason('');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Stock Opname Fisik" />

      {/* Sync Status Banner */}
      {syncLoading && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Sinkronisasi data Master Data & Inventaris dengan Cloud Firestore sedang berjalan...</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Stock Opname & Rekonsiliasi Fisik
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
              {filteredOpnames.length} Rekaman Opname
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pencatatan hasil hitung fisik gudang dan verifikasi selisih persediaan terintegrasi Firestore
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
              <span>Input Hasil Opname</span>
            </button>
          ) : (
            <button
              onClick={handleOpenModal}
              disabled={syncLoading || activeMaterials.length === 0 || activeLocations.length === 0}
              className="px-4 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>Input Hasil Opname</span>
            </button>
          )}
        </div>
      </div>

      {/* Master Data Availability Warning */}
      {!syncLoading && (activeMaterials.length === 0 || activeLocations.length === 0) && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Master Data Belum Lengkap</div>
            <p className="mt-0.5">
              {activeLocations.length === 0 && 'Lokasi Gudang belum tersedia atau tidak ada yang berstatus aktif. '}
              {activeMaterials.length === 0 && 'Material barang belum tersedia atau tidak ada yang berstatus aktif. '}
              Silakan daftarkan master data aktif pada modul <strong>Master Data</strong> terlebih dahulu.
            </p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nomor opname, kode item, nama barang, lokasi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
          />
        </div>
      </div>

      {/* Opname Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">SO Number</th>
                <th className="py-3 px-4">Tanggal Opname</th>
                <th className="py-3 px-4">Lokasi Gudang</th>
                <th className="py-3 px-4">Item Barang</th>
                <th className="py-3 px-4 text-center">System Qty</th>
                <th className="py-3 px-4 text-center">Physical Qty</th>
                <th className="py-3 px-4 text-center">Variance (Selisih)</th>
                <th className="py-3 px-4">Alasan Selisih</th>
                <th className="py-3 px-4 text-center">Status Verifikasi</th>
                <th className="py-3 px-4">Petugas / Pemeriksa</th>
                <th className="py-3 px-4 text-center">Aksi Admin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredOpnames.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    Belum ada rekaman stock opname.
                  </td>
                </tr>
              ) : (
                filteredOpnames.map((so) => {
                  const isLoadingThis = actionLoadingId === so.id;

                  return (
                    <tr key={so.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                        {so.opnameNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {so.opnameDate}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {so.locationName}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[220px]">
                        <div className="truncate" title={so.itemName}>
                          {so.itemName}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono">
                          {so.itemCode}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                        {so.systemQuantity} {so.unit}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-900">
                        {so.physicalQuantity} {so.unit}
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono">
                        {so.variance === 0 ? (
                          <span className="font-semibold text-emerald-700">0 {so.unit} (Sesuai)</span>
                        ) : so.variance > 0 ? (
                          <span className="font-extrabold text-blue-700">+{so.variance} {so.unit}</span>
                        ) : (
                          <span className="font-extrabold text-rose-700">{so.variance} {so.unit}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-[200px]">
                        <div className="truncate" title={so.varianceReason}>
                          {so.varianceReason}
                        </div>
                        {so.notes && (
                          <div className="text-[10px] text-slate-400 truncate" title={so.notes}>
                            {so.notes}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {so.verificationStatus === 'ADJUSTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" />
                            ADJUSTED
                          </span>
                        ) : so.verificationStatus === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            REJECTED
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                            <Clock className="w-3 h-3" />
                            PENDING_APPROVAL
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-700">
                        <div className="font-semibold text-slate-800">{so.conductedBy}</div>
                        {so.verifiedBy && (
                          <div className="text-[10px] text-emerald-700 font-medium">Verifikator: {so.verifiedBy}</div>
                        )}
                        {so.adjustedAt && (
                          <div className="text-[9px] text-slate-400 font-mono">{so.adjustedAt}</div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {so.verificationStatus === 'PENDING_APPROVAL' && can('ADJUST_STOCK').allowed ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleApprove(so.id)}
                              disabled={isLoadingThis}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1 disabled:opacity-50"
                              title="Setujui Penyesuaian Saldo ke Fisik"
                            >
                              {isLoadingThis ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              <span>Adjust</span>
                            </button>
                            <button
                              onClick={() => setRejectModalId(so.id)}
                              disabled={isLoadingThis}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition disabled:opacity-50"
                              title="Tolak Penyesuaian"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {so.verificationStatus === 'ADJUSTED'
                              ? 'Telah Disesuaikan'
                              : so.verificationStatus === 'REJECTED'
                              ? 'Ditolak'
                              : 'Menunggu Review'}
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

      {/* Input Opname Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-[#064e3b]">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Input Hasil Perhitungan Fisik (Stock Opname)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Integrasi Master Data & Saldo Inventaris Cloud Firestore
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Warehouse Location Dropdown */}
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">
                    Lokasi Gudang Opname <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedLocationId}
                    onChange={(e) => setSelectedLocationId(e.target.value)}
                    disabled={syncLoading || activeLocations.length === 0}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white text-slate-800"
                  >
                    {activeLocations.length === 0 ? (
                      <option value="">{syncLoading ? 'Memuat lokasi...' : 'Tidak ada lokasi aktif'}</option>
                    ) : (
                      activeLocations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} {loc.code ? `(${loc.code})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Material Dropdown */}
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">
                    Item Barang (Master Data) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={selectedMaterialId}
                    onChange={(e) => setSelectedMaterialId(e.target.value)}
                    disabled={syncLoading || activeMaterials.length === 0}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white text-slate-800"
                  >
                    {activeMaterials.length === 0 ? (
                      <option value="">{syncLoading ? 'Memuat material...' : 'Tidak ada material aktif'}</option>
                    ) : (
                      activeMaterials.map((mat) => (
                        <option key={mat.id} value={mat.id}>
                          {mat.materialCode} - {mat.materialName} ({mat.unit})
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Selected Material Summary Card */}
              {selectedMaterial && (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-[11px] text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>Kategori: <strong>{selectedMaterial.categoryName}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Warehouse className="w-3.5 h-3.5 text-slate-400" />
                    <span>Satuan Ukur: <strong>{currentUnit}</strong></span>
                  </div>
                </div>
              )}

              {/* System vs Physical vs Variance Display */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Saldo di Sistem</div>
                  <div className="text-lg font-bold text-slate-800 font-mono mt-0.5">
                    {syncLoading ? (
                      <span className="text-xs text-slate-400 font-sans">Memuat...</span>
                    ) : (
                      `${systemQty} ${currentUnit}`
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 font-semibold">Input Fisik Aktual</div>
                  <div className="text-lg font-bold text-indigo-900 font-mono mt-0.5">
                    {numericPhysQty} {currentUnit}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 font-medium">Selisih (Variance)</div>
                  <div
                    className={`text-lg font-extrabold font-mono mt-0.5 ${
                      currentVariance === 0
                        ? 'text-emerald-700'
                        : currentVariance > 0
                        ? 'text-blue-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {currentVariance > 0 ? `+${currentVariance}` : currentVariance} {currentUnit}
                  </div>
                </div>
              </div>

              {/* Physical Quantity Input */}
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">
                  Kuantitas Fisik Terhitung <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={physicalQuantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPhysicalQuantity(val === '' ? '' : Number(val));
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-mono font-bold text-base text-slate-900 bg-white"
                  placeholder="0"
                />
              </div>

              {/* Reason Input (Mandatory if Variance != 0) */}
              {currentVariance !== 0 ? (
                <div>
                  <label className="block mb-1 font-semibold text-rose-800">
                    Alasan Perbedaan Fisik vs Sistem <span className="text-rose-500">*</span> (Wajib Diisi)
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Contoh: Ditemukan kemasan pecah, salah hitung saat penerimaan, tercecer saat pembongkaran, dll."
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    className="w-full px-3 py-2 border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-rose-50/40 text-slate-800 text-xs"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">
                    Keterangan Pemeriksaan (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Fisik dan sistem cocok sesuai jadwal audit..."
                    value={varianceReason}
                    onChange={(e) => setVarianceReason(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] text-slate-800"
                  />
                </div>
              )}

              {/* Inspection Notes */}
              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Catatan Tim Pemeriksa</label>
                <input
                  type="text"
                  placeholder="Nomor tim opname, waktu audit fisik, nomor berita acara..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] text-slate-800"
                />
              </div>

              {/* Business Rule Notice */}
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <span className="font-bold">Ketentuan Tata Kelola:</span> Hasil stock opname disimpan dengan status <strong>Menunggu Persetujuan</strong>. Saldo persediaan di sistem tidak langsung berubah hingga Administrator menyetujui penyesuaian (Adjustment).
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
                disabled={isSubmitting || syncLoading || !selectedLocation || !selectedMaterial}
                className="px-4 py-2 rounded-xl bg-[#1F5FAF] text-white font-bold hover:bg-[#123B66] transition disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmitting ? 'Menyimpan...' : 'Simpan Hasil Opname'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in">
            <h3 className="text-sm font-bold text-slate-900 mb-2">
              Tolak Penyesuaian Selisih Opname
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Masukkan alasan penolakan untuk dicatat ke audit log sistem:
            </p>
            <textarea
              rows={3}
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Contoh: Perlu penghitungan fisik ulang bersama tim supervisor..."
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 mb-4"
            />
            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setRejectModalId(null);
                  setRejectReason('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={actionLoadingId !== null}
                onClick={handleConfirmReject}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1"
              >
                {actionLoadingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Konfirmasi Tolak</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
