import React, { useState } from 'react';
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
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';

export const StockOpname: React.FC = () => {
  const {
    stockOpnames,
    items,
    locations,
    createStockOpname,
    approveOpnameAdjustment,
    rejectOpnameAdjustment,
    currentUser,
    can,
    showToast,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    locationId: locations[0]?.id || '',
    itemId: items[0]?.id || '',
    physicalQuantity: 0,
    varianceReason: '',
    notes: '',
  });

  const selectedLocItems = items.filter((it) => it.locationId === formData.locationId);
  const selectedItem = selectedLocItems.find((it) => it.id === formData.itemId) || selectedLocItems[0];
  const systemQty = selectedItem ? selectedItem.availableStock : 0;
  const currentVariance = Number(formData.physicalQuantity) - systemQty;

  const filteredOpnames = stockOpnames.filter((so) => {
    return (
      so.opnameNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      so.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      so.locationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      so.conductedBy.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleOpenModal = () => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Peran Site Head hanya dapat melihat hasil stock opname.');
      return;
    }
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItem) {
      showToast('error', 'Validasi Gagal', 'Pilih item barang.');
      return;
    }

    if (formData.physicalQuantity < 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas fisik tidak boleh negatif.');
      return;
    }

    if (currentVariance !== 0 && !formData.varianceReason.trim()) {
      showToast('error', 'Validasi Gagal', 'Alasan selisih wajib diisi jika terdapat perbedaan fisik dan sistem.');
      return;
    }

    const success = await createStockOpname({
      locationId: formData.locationId,
      itemId: selectedItem.id,
      physicalQuantity: Number(formData.physicalQuantity),
      varianceReason: formData.varianceReason,
      notes: formData.notes,
    });

    if (success) {
      setModalOpen(false);
      setFormData({
        locationId: locations[0]?.id || '',
        itemId: items[0]?.id || '',
        physicalQuantity: 0,
        varianceReason: '',
        notes: '',
      });
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalId) return;
    if (!rejectReason.trim()) {
      showToast('error', 'Validasi Gagal', 'Alasan penolakan wajib diisi.');
      return;
    }
    await rejectOpnameAdjustment(rejectModalId, rejectReason);
    setRejectModalId(null);
    setRejectReason('');
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Stock Opname Fisik" />

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
            Pencatatan hasil hitung fisik gudang dan verifikasi selisih persediaan
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
              className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Input Hasil Opname</span>
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nomor opname, item, lokasi..."
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
                  const hasDiscrepancy = so.variance !== 0;

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
                      <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[200px]">
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
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        {so.verificationStatus === 'PENDING_APPROVAL' && can('ADJUST_STOCK').allowed ? (
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => approveOpnameAdjustment(so.id)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1"
                              title="Setujui Penyesuaian Saldo ke Fisik"
                            >
                              <Check className="w-3 h-3" />
                              <span>Adjust</span>
                            </button>
                            <button
                              onClick={() => setRejectModalId(so.id)}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition"
                              title="Tolak Penyesuaian"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">
                            {so.verificationStatus === 'ADJUSTED' ? 'Telah Disesuaikan' : '-'}
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
                    Sistem otomatis menghitung selisih (Fisik - Saldo Sistem)
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
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Lokasi Gudang Opname</label>
                  <select
                    required
                    value={formData.locationId}
                    onChange={(e) => setFormData({ ...formData, locationId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Item Barang</label>
                  <select
                    required
                    value={selectedItem?.id || ''}
                    onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                  >
                    {selectedLocItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.itemCode} - {it.itemName} ({it.unit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* System vs Physical Display */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div>
                  <div className="text-[11px] text-slate-500">Saldo di Sistem</div>
                  <div className="text-lg font-bold text-slate-800 font-mono mt-0.5">
                    {systemQty} {selectedItem?.unit}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500 font-semibold">Input Fisik Aktual</div>
                  <div className="text-lg font-bold text-indigo-900 font-mono mt-0.5">
                    {formData.physicalQuantity} {selectedItem?.unit}
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-slate-500">Selisih (Variance)</div>
                  <div
                    className={`text-lg font-extrabold font-mono mt-0.5 ${
                      currentVariance === 0
                        ? 'text-emerald-700'
                        : currentVariance > 0
                        ? 'text-blue-700'
                        : 'text-rose-700'
                    }`}
                  >
                    {currentVariance > 0 ? `+${currentVariance}` : currentVariance} {selectedItem?.unit}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Kuantitas Fisik Terhitung</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={formData.physicalQuantity}
                  onChange={(e) => setFormData({ ...formData, physicalQuantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-mono font-bold text-base"
                />
              </div>

              {currentVariance !== 0 && (
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold text-rose-800">
                    Alasan Perbedaan Fisik vs Sistem (Wajib)
                  </label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Contoh: Ditemukan kemasan pecah, tercecer saat bongkar palet, atau tertinggal peminjaman maintenance..."
                    value={formData.varianceReason}
                    onChange={(e) => setFormData({ ...formData, varianceReason: e.target.value })}
                    className="w-full px-3 py-2 border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 bg-rose-50/30"
                  />
                </div>
              )}

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Catatan Pemeriksaan</label>
                <input
                  type="text"
                  placeholder="Nomor tim opname, waktu audit fisik, dll..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
                <span className="font-bold">Ketentuan Bisnis (Aturan 8):</span> Jika terdapat selisih fisik, saldo sistem tidak langsung berubah sampai Administrator meninjau dan menyetujui transaksi penyesuaian (Adjustment).
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
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46]"
              >
                Simpan Hasil Opname
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
                onClick={handleConfirmReject}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700"
              >
                Konfirmasi Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
