import React, { useState } from 'react';
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
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';

export const BarangKeluar: React.FC = () => {
  const {
    goodsIssues,
    items,
    requestingUnits,
    createGoodsIssue,
    currentUser,
    can,
    showToast,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    requestingUnit: requestingUnits[0]?.name || '',
    destination: '',
    itemId: items[0]?.id || '',
    requestedQuantity: 1,
    purpose: '',
    notes: '',
  });

  const selectedItemData = items.find((it) => it.id === formData.itemId);

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
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItemData) {
      showToast('error', 'Validasi Gagal', 'Pilih item barang.');
      return;
    }

    if (formData.requestedQuantity <= 0) {
      showToast('error', 'Validasi Gagal', 'Jumlah permintaan harus lebih besar dari 0.');
      return;
    }

    // Business Rule 1: Stock must never become negative
    if (formData.requestedQuantity > selectedItemData.availableStock) {
      showToast(
        'error',
        'Stok Tidak Cukup (Negative Stock Blocked)',
        `Stok tersedia untuk ${selectedItemData.itemName} hanya ${selectedItemData.availableStock} ${selectedItemData.unit}. Tidak dapat meminta ${formData.requestedQuantity} ${selectedItemData.unit}.`
      );
      return;
    }

    const success = createGoodsIssue({
      requestingUnit: formData.requestingUnit,
      destination: formData.destination,
      materialId: selectedItemData.materialId || selectedItemData.id,
      locationId: selectedItemData.locationId,
      requestedQuantity: Number(formData.requestedQuantity),
      purpose: formData.purpose,
      notes: formData.notes,
    });

    if (success) {
      setModalOpen(false);
      setFormData({
        requestingUnit: requestingUnits[0]?.name || '',
        destination: '',
        itemId: items[0]?.id || '',
        requestedQuantity: 1,
        purpose: '',
        notes: '',
      });
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
              className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-2"
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Unit / Divisi Pemohon</label>
                  <select
                    required
                    value={formData.requestingUnit}
                    onChange={(e) => setFormData({ ...formData, requestingUnit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                  >
                    {requestingUnits.map((u) => (
                      <option key={u.id} value={u.name}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Tujuan Penggunaan (Lokasi Kerja)</label>
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

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Item Barang</label>
                <select
                  required
                  value={formData.itemId}
                  onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                >
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.itemCode} - {it.itemName} (Tersedia: {it.availableStock} {it.unit} di {it.locationName})
                    </option>
                  ))}
                </select>
              </div>

              {selectedItemData && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="text-slate-600">
                    <div>Lokasi Gudang: <span className="font-semibold text-slate-800">{selectedItemData.locationName}</span></div>
                    <div className="text-[11px] text-slate-400">SKU: {selectedItemData.itemCode}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-500">Stok Tersedia Saat Ini</div>
                    <div className={`text-base font-extrabold font-mono ${selectedItemData.availableStock <= selectedItemData.minimumStock ? 'text-rose-600' : 'text-emerald-700'}`}>
                      {selectedItemData.availableStock} {selectedItemData.unit}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Kuantitas yang Diminta</label>
                <input
                  type="number"
                  min="1"
                  max={selectedItemData ? selectedItemData.availableStock : 99999}
                  required
                  value={formData.requestedQuantity}
                  onChange={(e) => setFormData({ ...formData, requestedQuantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-mono font-bold"
                />
                {selectedItemData && formData.requestedQuantity > selectedItemData.availableStock && (
                  <p className="text-[11px] text-rose-600 font-semibold mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Permintaan melebihi stok tersedia. Aturan sistem melarang saldo negatif.
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
                disabled={selectedItemData && formData.requestedQuantity > selectedItemData.availableStock}
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Kirim Permohonan Keluar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
