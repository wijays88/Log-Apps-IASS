import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ArrowLeftRight,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  ArrowRight,
  PackageCheck,
  Lock,
  X,
  Truck,
  MapPin,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';

export const TransferStok: React.FC = () => {
  const {
    stockTransfers,
    items,
    locations,
    createStockTransfer,
    receiveStockTransfer,
    currentUser,
    can,
    showToast,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    originLocationId: locations[0]?.id || '',
    destinationLocationId: locations[1]?.id || '',
    itemId: items[0]?.id || '',
    quantity: 1,
    notes: '',
  });

  const originItems = items.filter((it) => it.locationId === formData.originLocationId);
  const selectedItem = originItems.find((it) => it.id === formData.itemId) || originItems[0];

  const filteredTransfers = stockTransfers.filter((tr) => {
    return (
      tr.transferNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tr.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tr.originLocationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tr.destinationLocationName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tr.requestingUser.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleOpenModal = () => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Dibatasi', perm.reason || 'Peran Site Head hanya dapat melihat riwayat transfer.');
      return;
    }
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.originLocationId === formData.destinationLocationId) {
      showToast('error', 'Validasi Gagal', 'Lokasi asal dan tujuan tidak boleh sama.');
      return;
    }

    if (!selectedItem) {
      showToast('error', 'Validasi Gagal', 'Pilih item barang yang ada di gudang asal.');
      return;
    }

    if (formData.quantity <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas transfer harus lebih dari 0.');
      return;
    }

    if (formData.quantity > selectedItem.availableStock) {
      showToast(
        'error',
        'Stok Asal Tidak Mencukupi',
        `Stok di ${selectedItem.locationName} hanya ${selectedItem.availableStock} ${selectedItem.unit}.`
      );
      return;
    }

    const success = createStockTransfer({
      originLocationId: formData.originLocationId,
      destinationLocationId: formData.destinationLocationId,
      itemId: selectedItem.id,
      quantity: Number(formData.quantity),
      notes: formData.notes,
    });

    if (success) {
      setModalOpen(false);
      setFormData({
        originLocationId: locations[0]?.id || '',
        destinationLocationId: locations[1]?.id || '',
        itemId: items[0]?.id || '',
        quantity: 1,
        notes: '',
      });
    }
  };

  const handleReceive = (transferId: string) => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Dibatasi', perm.reason || 'Peran Site Head bersifat Read-Only.');
      return;
    }
    receiveStockTransfer(transferId);
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Transfer Stok Antar Gudang" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Transfer Stok Antar Gudang
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-blue-100 text-blue-800">
              {filteredTransfers.length} Mutasi
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Penyeimbangan persediaan dan mutasi antar hub logistik bandara PT IAS Support
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
              <span>Kirim Transfer Baru</span>
            </button>
          ) : (
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Kirim Transfer Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari transfer number, item, gudang..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
          />
        </div>
      </div>

      {/* Transfers Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Transfer Number</th>
                <th className="py-3 px-4">Tanggal Kirim</th>
                <th className="py-3 px-4">Rute Pengiriman (Asal → Tujuan)</th>
                <th className="py-3 px-4">Item Barang</th>
                <th className="py-3 px-4 text-right">Kuantitas</th>
                <th className="py-3 px-4">Satuan</th>
                <th className="py-3 px-4">Petugas Pengirim</th>
                <th className="py-3 px-4">Penerima Gudang Tujuan</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransfers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    Belum ada transfer stok antar gudang.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((tr) => (
                  <tr key={tr.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                      {tr.transferNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {tr.requestDate}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                        <span className="truncate max-w-[130px]" title={tr.originLocationName}>{tr.originLocationName}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate max-w-[130px] text-emerald-800" title={tr.destinationLocationName}>{tr.destinationLocationName}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[180px]">
                      <div className="truncate" title={tr.itemName}>
                        {tr.itemName}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {tr.itemCode}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-extrabold text-sm text-slate-900">
                      {tr.quantity.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-slate-700">
                      {tr.unit}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-medium text-slate-800">{tr.sendingUser || tr.requestingUser}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{tr.dispatchedAt?.slice(11, 16) || ''}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      {tr.receivingUser ? (
                        <div>
                          <div className="font-semibold text-emerald-900">{tr.receivingUser}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{tr.receivedAt}</div>
                        </div>
                      ) : (
                        <span className="text-amber-700 text-[11px] font-medium italic">
                          Menunggu Fisik Sampai
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {tr.status === 'COMPLETED' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          COMPLETED
                        </span>
                      ) : tr.status === 'IN_TRANSIT' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
                          <Truck className="w-3 h-3" />
                          IN_TRANSIT
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          <Clock className="w-3 h-3" />
                          PENDING
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {tr.status === 'IN_TRANSIT' ? (
                        currentUser?.role !== 'SITE HEAD' ? (
                          <button
                            onClick={() => handleReceive(tr.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1 mx-auto"
                          >
                            <PackageCheck className="w-3.5 h-3.5" />
                            <span>Konfirmasi Terima</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Read-Only</span>
                        )
                      ) : (
                        <span className="text-[11px] text-slate-400">Selesai</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Stock Transfer Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleSubmit}
            className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-100 text-blue-900">
                  <ArrowLeftRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    Kirim Transfer Stok Antar Gudang
                  </h3>
                  <p className="text-xs text-slate-500">
                    Saldo lokasi asal akan dipotong saat status In-Transit
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
                  <label className="text-slate-600 block mb-1 font-semibold">Gudang Asal (Pengirim)</label>
                  <select
                    required
                    value={formData.originLocationId}
                    onChange={(e) => setFormData({ ...formData, originLocationId: e.target.value })}
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
                  <label className="text-slate-600 block mb-1 font-semibold">Gudang Tujuan (Penerima)</label>
                  <select
                    required
                    value={formData.destinationLocationId}
                    onChange={(e) => setFormData({ ...formData, destinationLocationId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id} disabled={loc.id === formData.originLocationId}>
                        {loc.name} {loc.id === formData.originLocationId ? '(Lokasi Asal)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Pilih Item Barang dari Gudang Asal</label>
                <select
                  required
                  value={selectedItem?.id || ''}
                  onChange={(e) => setFormData({ ...formData, itemId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
                >
                  {originItems.length === 0 ? (
                    <option value="">Tidak ada item di gudang asal ini</option>
                  ) : (
                    originItems.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.itemCode} - {it.itemName} (Stok: {it.availableStock} {it.unit})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {selectedItem && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="text-slate-600">
                    <div>Stok Tersedia di {selectedItem.locationName}:</div>
                  </div>
                  <div className="text-base font-extrabold font-mono text-emerald-800">
                    {selectedItem.availableStock} {selectedItem.unit}
                  </div>
                </div>
              )}

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Kuantitas Transfer</label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem ? selectedItem.availableStock : 99999}
                  required
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Instruksi / Catatan Pengiriman (AWB / Ekspedisi Internal)</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pengiriman via armada internal shuttle CGK-SUB AWB-IAS-..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
                />
              </div>

              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-[11px] text-blue-900 leading-relaxed">
                <span className="font-bold">Konsistensi Inventaris (Aturan 7):</span> Saat diberangkatkan, stok gudang asal langsung berkurang. Stok gudang tujuan baru akan bertambah setelah petugas di lokasi tujuan mengklik <em>Konfirmasi Terima</em>.
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
                disabled={!selectedItem || formData.quantity > selectedItem.availableStock}
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46] disabled:opacity-50"
              >
                Kirim Transfer (In-Transit)
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
