import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowDownToLine,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Calendar,
  Building2,
  FileText,
  Package,
  X,
  Lock,
  Download,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';

export const BarangMasuk: React.FC = () => {
  const {
    goodsReceipts,
    items,
    suppliers,
    locations,
    addGoodsReceipt,
    currentUser,
    can,
    showToast,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    receiptDate: new Date().toISOString().slice(0, 10),
    sourceSupplier: suppliers[0]?.name || '',
    referenceDocument: '',
    itemId: items[0]?.id || '',
    quantity: 1,
    destinationLocationId: locations[0]?.id || '',
    notes: '',
  });

  const filteredReceipts = goodsReceipts.filter((receipt) => {
    const matchSearch =
      receipt.receiptNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.sourceSupplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.referenceDocument.toLowerCase().includes(searchTerm.toLowerCase()) ||
      receipt.recordedBy.toLowerCase().includes(searchTerm.toLowerCase());

    const matchSup = selectedSupplier === 'ALL' || receipt.sourceSupplier === selectedSupplier;

    return matchSearch && matchSup;
  });

  const handleOpenModal = () => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Dibatasi', perm.reason || 'Peran Site Head hanya dapat melihat riwayat barang masuk.');
      return;
    }
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const selectedItem = items.find((i) => i.id === formData.itemId);
    const selectedLoc = locations.find((l) => l.id === formData.destinationLocationId);

    if (!selectedItem) {
      showToast('error', 'Validasi Gagal', 'Silakan pilih item barang.');
      return;
    }

    if (!formData.sourceSupplier) {
      showToast('error', 'Validasi Gagal', 'Silakan tentukan supplier/asal barang.');
      return;
    }

    if (!formData.referenceDocument.trim()) {
      showToast('error', 'Validasi Gagal', 'Nomor dokumen referensi (PO/DO) wajib diisi.');
      return;
    }

    const success = addGoodsReceipt({
      receiptDate: formData.receiptDate,
      sourceSupplier: formData.sourceSupplier,
      referenceDocument: formData.referenceDocument,
      itemId: selectedItem.id,
      itemCode: selectedItem.itemCode,
      itemName: selectedItem.itemName,
      quantity: Number(formData.quantity),
      unit: selectedItem.unit,
      destinationLocationId: selectedLoc ? selectedLoc.id : selectedItem.locationId,
      destinationLocationName: selectedLoc ? selectedLoc.name : selectedItem.locationName,
      notes: formData.notes,
    });

    if (success) {
      setModalOpen(false);
      // Reset form
      setFormData({
        receiptDate: new Date().toISOString().slice(0, 10),
        sourceSupplier: suppliers[0]?.name || '',
        referenceDocument: '',
        itemId: items[0]?.id || '',
        quantity: 1,
        destinationLocationId: locations[0]?.id || '',
        notes: '',
      });
    }
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Barang Masuk" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Penerimaan Barang Masuk (Goods Receipt)
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
              {filteredReceipts.length} Dokumen
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pencatatan mutasi penerimaan inventaris dari supplier dan vendor logistik
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
              <span>Input Barang Masuk</span>
            </button>
          ) : (
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Input Barang Masuk</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nomor receipt, item, PO/DO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
            />
          </div>

          <div>
            <select
              value={selectedSupplier}
              onChange={(e) => setSelectedSupplier(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 bg-white"
            >
              <option value="ALL">Semua Pemasok / Supplier</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Receipts Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Receipt Number</th>
                <th className="py-3 px-4">Receipt Date</th>
                <th className="py-3 px-4">Supplier / Sumber</th>
                <th className="py-3 px-4">Ref. Document</th>
                <th className="py-3 px-4">Item Barang</th>
                <th className="py-3 px-4 text-right">Qty Masuk</th>
                <th className="py-3 px-4">Satuan</th>
                <th className="py-3 px-4">Gudang Tujuan</th>
                <th className="py-3 px-4">Recorded By</th>
                <th className="py-3 px-4">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Belum ada data barang masuk yang terdaftar.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((gr) => (
                  <tr key={gr.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-emerald-800">
                      {gr.receiptNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {gr.receiptDate}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">
                      {gr.sourceSupplier}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                      <span className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                        {gr.referenceDocument}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[200px]">
                      <div className="truncate" title={gr.itemName}>
                        {gr.itemName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {gr.itemCode}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-sm text-emerald-700">
                      +{gr.quantity.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {gr.unit}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {gr.destinationLocationName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-semibold text-slate-800">{gr.recordedBy}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {gr.recordedByEmployeeId}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 max-w-[180px] truncate" title={gr.notes}>
                      {gr.notes || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Goods Receipt Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-[#064e3b]">
                  <ArrowDownToLine className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Catat Penerimaan Barang Masuk
                  </h3>
                  <p className="text-xs text-slate-500">
                    Sistem akan memvalidasi dan menambahkan kuantitas ke stok fisik
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
                  <label className="text-slate-600 block mb-1 font-semibold">Tanggal Penerimaan</label>
                  <input
                    type="date"
                    required
                    value={formData.receiptDate}
                    onChange={(e) => setFormData({ ...formData, receiptDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                  />
                </div>

                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Pemasok / Sumber</label>
                  <select
                    required
                    value={formData.sourceSupplier}
                    onChange={(e) => setFormData({ ...formData, sourceSupplier: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Nomor Dokumen Referensi (PO / Surat Jalan)</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: PO-2026/GSE/1120 - DO-DSP-9981"
                  value={formData.referenceDocument}
                  onChange={(e) => setFormData({ ...formData, referenceDocument: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-slate-600 block mb-1 font-semibold">Item Barang</label>
                  <select
                    required
                    value={formData.itemId}
                    onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                  >
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.itemCode} - {it.itemName} ({it.unit})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 block mb-1 font-semibold">Kuantitas Masuk</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Gudang / Lokasi Tujuan</label>
                <select
                  required
                  value={formData.destinationLocationId}
                  onChange={(e) => setFormData({ ...formData, destinationLocationId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                >
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.code} - {loc.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Catatan Pemeriksaan Fisik</label>
                <textarea
                  rows={2}
                  placeholder="Catatan kondisi kemasan, nomor seal, atau batch pabrik..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                />
              </div>

              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-[11px] text-emerald-900 leading-relaxed">
                <span className="font-bold">Pemberitahuan Sistem:</span> Transaksi ini akan langsung memposting penambahan stok fisik inventaris dan tercatat pada Audit Trail secara permanen atas nama <strong>{currentUser?.fullName}</strong>.
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
                Posting Barang Masuk
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
