import React, { useState, useEffect, useMemo } from 'react';
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
  AlertTriangle,
  Loader2,
  XCircle,
  Building2,
  Layers,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';
import { TransferRejectionDisposition } from '../types';

export const TransferStok: React.FC = () => {
  const {
    stockTransfers,
    inventory,
    activeMaterials,
    activeLocations,
    activeRequestingUnits,
    createStockTransfer,
    receiveStockTransfer,
    rejectStockTransfer,
    currentUser,
    can,
    showToast,
    syncLoading,
  } = useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Reject / Exception Modal State
  const [rejectModalId, setRejectModalId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectDisposition, setRejectDisposition] = useState<TransferRejectionDisposition>('RETURNED_TO_ORIGIN');

  // Receipt Modal State (optional notes)
  const [receiveModalId, setReceiveModalId] = useState<string | null>(null);
  const [receiverNotes, setReceiverNotes] = useState('');

  // Form states
  const [originLocationId, setOriginLocationId] = useState<string>('');
  const [destinationLocationId, setDestinationLocationId] = useState<string>('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>('');
  const [quantity, setQuantity] = useState<number | string>(1);
  const [requesterUnitId, setRequesterUnitId] = useState<string>('');
  const [shippingNotes, setShippingNotes] = useState<string>('');

  // Synchronize origin warehouse default when locations load
  useEffect(() => {
    if (activeLocations.length > 0) {
      if (!originLocationId || !activeLocations.some((l) => l.id === originLocationId)) {
        setOriginLocationId(activeLocations[0].id);
      }
    }
  }, [activeLocations, originLocationId]);

  // Synchronize destination warehouse default (must differ from origin)
  useEffect(() => {
    if (activeLocations.length > 1) {
      const validDestinations = activeLocations.filter((l) => l.id !== originLocationId);
      if (
        !destinationLocationId ||
        destinationLocationId === originLocationId ||
        !validDestinations.some((l) => l.id === destinationLocationId)
      ) {
        if (validDestinations[0]) {
          setDestinationLocationId(validDestinations[0].id);
        }
      }
    } else {
      setDestinationLocationId('');
    }
  }, [activeLocations, originLocationId, destinationLocationId]);

  // Available destination locations (strictly exclude source warehouse)
  const availableDestinations = useMemo(() => {
    return activeLocations.filter((l) => l.id !== originLocationId);
  }, [activeLocations, originLocationId]);

  // Active materials with available stock in the selected origin warehouse
  const originStockItems = useMemo(() => {
    if (!originLocationId) return [];
    return activeMaterials
      .map((mat) => {
        const bal = inventory.find(
          (inv) =>
            (inv.materialId === mat.id || inv.itemId === mat.id) &&
            inv.locationId === originLocationId
        );
        const stock = bal ? Number(bal.availableStock) || 0 : 0;
        return {
          material: mat,
          availableStock: stock,
        };
      })
      .filter((item) => item.availableStock > 0);
  }, [activeMaterials, inventory, originLocationId]);

  // Synchronize material default when origin stock items change
  useEffect(() => {
    if (originStockItems.length > 0) {
      if (!selectedMaterialId || !originStockItems.some((it) => it.material.id === selectedMaterialId)) {
        setSelectedMaterialId(originStockItems[0].material.id);
      }
    } else {
      setSelectedMaterialId('');
    }
  }, [originStockItems, selectedMaterialId]);

  // Selected material entity and stock balance
  const selectedItemData = useMemo(() => {
    return originStockItems.find((it) => it.material.id === selectedMaterialId) || originStockItems[0] || null;
  }, [originStockItems, selectedMaterialId]);

  const selectedMaterial = selectedItemData?.material || null;
  const availableOriginStock = selectedItemData?.availableStock || 0;
  const currentUnit = selectedMaterial?.unit || 'Pcs';
  const numericQty = quantity === '' ? 0 : Number(quantity);

  const filteredTransfers = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return stockTransfers.filter((tr) => {
      return (
        tr.transferNumber.toLowerCase().includes(q) ||
        tr.itemName.toLowerCase().includes(q) ||
        tr.itemCode.toLowerCase().includes(q) ||
        tr.originLocationName.toLowerCase().includes(q) ||
        tr.destinationLocationName.toLowerCase().includes(q) ||
        tr.requestingUser.toLowerCase().includes(q) ||
        (tr.requestingUnit && tr.requestingUnit.toLowerCase().includes(q))
      );
    });
  }, [stockTransfers, searchTerm]);

  const handleOpenModal = () => {
    const perm = can('CREATE_TRANSACTION');
    if (!perm.allowed) {
      showToast('error', 'Akses Dibatasi', perm.reason || 'Peran Site Head hanya dapat melihat riwayat transfer.');
      return;
    }

    if (activeLocations.length < 2) {
      showToast('error', 'Lokasi Tidak Cukup', 'Dibutuhkan minimal 2 lokasi gudang aktif untuk melakukan transfer antar gudang.');
      return;
    }

    setQuantity(1);
    setShippingNotes('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!originLocationId || !destinationLocationId) {
      showToast('error', 'Validasi Gagal', 'Pilih lokasi gudang asal dan tujuan.');
      return;
    }

    if (originLocationId === destinationLocationId) {
      showToast('error', 'Validasi Gagal', 'Gudang asal dan gudang tujuan tidak boleh sama.');
      return;
    }

    if (!selectedMaterial) {
      showToast('error', 'Validasi Gagal', 'Pilih material barang dari stok tersedia di gudang asal.');
      return;
    }

    if (numericQty <= 0) {
      showToast('error', 'Validasi Gagal', 'Kuantitas transfer harus lebih besar dari 0.');
      return;
    }

    if (numericQty > availableOriginStock) {
      showToast(
        'error',
        'Stok Asal Tidak Mencukupi',
        `Kuantitas transfer (${numericQty} ${currentUnit}) melebihi stok tersedia (${availableOriginStock} ${currentUnit}) di gudang asal.`
      );
      return;
    }

    const resolvedReq = activeRequestingUnits.find((u) => u.id === requesterUnitId);

    setIsSubmitting(true);
    try {
      const success = await createStockTransfer({
        originLocationId,
        destinationLocationId,
        materialId: selectedMaterial.id,
        itemId: selectedMaterial.id,
        quantity: numericQty,
        requesterUnitId: resolvedReq?.id,
        requestingUnit: resolvedReq ? resolvedReq.name : undefined,
        notes: shippingNotes.trim(),
      });

      if (success) {
        setModalOpen(false);
        setQuantity(1);
        setShippingNotes('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveModalId) return;

    setActionLoadingId(receiveModalId);
    try {
      const success = await receiveStockTransfer(receiveModalId, receiverNotes.trim());
      if (success) {
        setReceiveModalId(null);
        setReceiverNotes('');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalId) return;

    if (!rejectReason.trim()) {
      showToast('error', 'Validasi Gagal', 'Alasan pembatalan/penolakan transfer wajib diisi.');
      return;
    }

    setActionLoadingId(rejectModalId);
    try {
      const success = await rejectStockTransfer(rejectModalId, rejectReason.trim(), rejectDisposition);
      if (success) {
        setRejectModalId(null);
        setRejectReason('');
        setRejectDisposition('RETURNED_TO_ORIGIN');
      }
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Transfer Stok Antar Gudang" />

      {/* Sync Status Banner */}
      {syncLoading && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-xl">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Sinkronisasi data transfer antar gudang dengan Cloud Firestore sedang berjalan...</span>
        </div>
      )}

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
            Penyeimbangan persediaan dan mutasi antar hub logistik bandara PT IAS Support (Transaksi Atomik & Idempotent)
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
              disabled={syncLoading || activeLocations.length < 2}
              className="px-4 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              <span>Kirim Transfer Baru</span>
            </button>
          )}
        </div>
      </div>

      {/* Warning if insufficient locations */}
      {!syncLoading && activeLocations.length < 2 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Kurang dari 2 Gudang Aktif</div>
            <p className="mt-0.5">
              Fitur transfer memerlukan minimal 2 lokasi gudang yang berstatus aktif. Silakan tambahkan atau aktifkan gudang pada modul <strong>Master Data</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nomor transfer, kode item, nama barang, gudang..."
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
                <th className="py-3 px-4">Item Barang (Master Data)</th>
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
                    Belum ada rekaman transfer stok antar gudang.
                  </td>
                </tr>
              ) : (
                filteredTransfers.map((tr) => {
                  const isLoadingThis = actionLoadingId === tr.id;

                  return (
                    <tr key={tr.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-900">
                        {tr.transferNumber}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {tr.requestDate}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                          <span className="truncate max-w-[130px]" title={tr.originLocationName}>
                            {tr.originLocationName}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[130px] text-emerald-800" title={tr.destinationLocationName}>
                            {tr.destinationLocationName}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-slate-900 max-w-[200px]">
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
                        ) : tr.status === 'REJECTED' ? (
                          <span className="text-rose-700 text-[11px] font-medium">Dibatalkan</span>
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
                        ) : tr.status === 'REJECTED' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                            <XCircle className="w-3 h-3" />
                            REJECTED
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
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setReceiveModalId(tr.id);
                                  setReceiverNotes('');
                                }}
                                disabled={isLoadingThis}
                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs transition flex items-center gap-1 disabled:opacity-50"
                                title="Konfirmasi Terima Barang di Gudang Tujuan"
                              >
                                {isLoadingThis ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PackageCheck className="w-3.5 h-3.5" />}
                                <span>Terima</span>
                              </button>
                              <button
                                onClick={() => {
                                  setRejectModalId(tr.id);
                                  setRejectReason('');
                                }}
                                disabled={isLoadingThis}
                                className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition disabled:opacity-50"
                                title="Batalkan / Tolak Transfer"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Read-Only</span>
                          )
                        ) : (
                          <span className="text-[11px] text-slate-400">Selesai</span>
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
                    Validasi stok real-time, transaksi atomik, dan pelacakan In-Transit
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
                {/* Source Warehouse (activeLocations) */}
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">
                    Gudang Asal (Pengirim) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={originLocationId}
                    onChange={(e) => setOriginLocationId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white text-slate-800"
                  >
                    {activeLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name} {loc.code ? `(${loc.code})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Destination Warehouse (activeLocations excluding source) */}
                <div>
                  <label className="text-slate-700 block mb-1 font-semibold">
                    Gudang Tujuan (Penerima) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={destinationLocationId}
                    onChange={(e) => setDestinationLocationId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white text-slate-800"
                  >
                    {availableDestinations.length === 0 ? (
                      <option value="">Tidak ada gudang tujuan lain</option>
                    ) : (
                      availableDestinations.map((loc) => (
                        <option key={loc.id} value={loc.id}>
                          {loc.name} {loc.code ? `(${loc.code})` : ''}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Requesting Unit (Optional) */}
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">
                  Unit Pemohon / Inisiator Mutasi (Opsional)
                </label>
                <select
                  value={requesterUnitId}
                  onChange={(e) => setRequesterUnitId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white font-medium text-slate-800"
                >
                  <option value="">-- Mutasi Rutin Antar Gudang (Tanpa Unit Pemohon) --</option>
                  {activeRequestingUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      [{u.code || u.unitCode}] {u.name || u.unitName} — {u.division}
                    </option>
                  ))}
                </select>
              </div>

              {/* Item Selection from Active Materials with Available Stock */}
              <div>
                <label className="text-slate-700 block mb-1 font-semibold">
                  Pilih Material Barang dari Gudang Asal <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                  disabled={originStockItems.length === 0}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white text-slate-800"
                >
                  {originStockItems.length === 0 ? (
                    <option value="">Tidak ada material dengan saldo stok &gt; 0 di gudang asal ini</option>
                  ) : (
                    originStockItems.map((it) => (
                      <option key={it.material.id} value={it.material.id}>
                        {it.material.materialCode} - {it.material.materialName} (Tersedia: {it.availableStock} {it.material.unit})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Selected Material Info Card */}
              {selectedMaterial ? (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      <span>Kategori: <strong>{selectedMaterial.categoryName}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span>Satuan: <strong>{currentUnit}</strong></span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60">
                    <div className="text-slate-600 font-semibold">Stok Tersedia di Gudang Asal:</div>
                    <div className="text-base font-extrabold font-mono text-emerald-800">
                      {availableOriginStock} {currentUnit}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs">
                  Gudang asal ini tidak memiliki saldo persediaan untuk ditransfer. Pilih gudang asal lain atau lakukan penerimaan barang terlebih dahulu.
                </div>
              )}

              {/* Quantity Input */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-700 font-semibold">
                    Kuantitas Transfer <span className="text-rose-500">*</span>
                  </label>
                  {selectedMaterial && (
                    <span className="text-[11px] text-slate-500 font-mono">
                      Maksimal: {availableOriginStock} {currentUnit}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  min="1"
                  max={availableOriginStock > 0 ? availableOriginStock : undefined}
                  required
                  value={quantity}
                  onChange={(e) => {
                    const val = e.target.value;
                    setQuantity(val === '' ? '' : Number(val));
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-mono font-bold text-slate-900 bg-white"
                  placeholder="1"
                />
              </div>

              {/* Shipping Instructions / Notes */}
              <div>
                <label className="text-slate-600 block mb-1 font-semibold">
                  Instruksi / Catatan Pengiriman (AWB / Ekspedisi / Armada)
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pengiriman via armada internal shuttle CGK-SUB AWB-IAS-8821..."
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] text-slate-800"
                />
              </div>

              {/* Governance Rules Notice */}
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-[11px] text-blue-900 leading-relaxed">
                <span className="font-bold">Ketentuan Tata Kelola (Aturan 7):</span> Saat diberangkatkan, stok gudang asal langsung berkurang secara atomik. Stok gudang tujuan baru akan bertambah setelah petugas di lokasi tujuan mengonfirmasi penerimaan fisik barang.
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
                  !selectedMaterial ||
                  originStockItems.length === 0 ||
                  numericQty <= 0 ||
                  numericQty > availableOriginStock ||
                  isSubmitting ||
                  originLocationId === destinationLocationId
                }
                className="px-4 py-2 rounded-xl bg-[#1F5FAF] text-white font-bold hover:bg-[#123B66] disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSubmitting ? 'Mengirim...' : 'Kirim Transfer (In-Transit)'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal for Receipt */}
      {receiveModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleConfirmReceive}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                <PackageCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Konfirmasi Penerimaan Transfer Fisik
                </h3>
                <p className="text-xs text-slate-500">
                  Saldo gudang tujuan akan bertambah secara atomik
                </p>
              </div>
            </div>

            <div className="space-y-3 py-2 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-semibold">
                  Catatan Penerimaan (Opsional)
                </label>
                <textarea
                  rows={2}
                  value={receiverNotes}
                  onChange={(e) => setReceiverNotes(e.target.value)}
                  placeholder="Kondisi kemasan baik, segel utuh, nomor AWB sesuai..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 text-xs pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setReceiveModalId(null);
                  setReceiverNotes('');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={actionLoadingId !== null}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
              >
                {actionLoadingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Konfirmasi Terima Barang</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Reject / Cancel Modal */}
      {rejectModalId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleConfirmReject}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 rounded-lg bg-rose-100 text-rose-800">
                <XCircle className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                Disposisi Pembatalan / Penolakan Transfer Stok
              </h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Tentukan perlakuan fisik dan akuntansi saldo inventaris untuk transfer ini:
            </p>

            {/* Disposition Selection */}
            <div className="space-y-2 mb-3">
              <label className="text-[11px] font-bold text-slate-700 block">
                Jenis Disposisi / Status Fisik Barang:
              </label>

              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${rejectDisposition === 'RETURNED_TO_ORIGIN' ? 'border-amber-400 bg-amber-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="disposition"
                  value="RETURNED_TO_ORIGIN"
                  checked={rejectDisposition === 'RETURNED_TO_ORIGIN'}
                  onChange={() => setRejectDisposition('RETURNED_TO_ORIGIN')}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div>
                  <p className="font-bold text-slate-900">Barang Kembali Utuh ke Gudang Asal</p>
                  <p className="text-[11px] text-slate-500">Barang fisik ditolak &amp; dipulangkan utuh. Saldo stok gudang asal akan dipulihkan.</p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${rejectDisposition === 'CANCELLED_BEFORE_DISPATCH' ? 'border-blue-400 bg-blue-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="disposition"
                  value="CANCELLED_BEFORE_DISPATCH"
                  checked={rejectDisposition === 'CANCELLED_BEFORE_DISPATCH'}
                  onChange={() => setRejectDisposition('CANCELLED_BEFORE_DISPATCH')}
                  className="mt-0.5 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="font-bold text-slate-900">Dibatalkan Sebelum Pengiriman Fisik</p>
                  <p className="text-[11px] text-slate-500">Armada belum berangkat / barang belum keluar gudang. Saldo gudang asal dipulihkan.</p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${rejectDisposition === 'DAMAGED_IN_TRANSIT' ? 'border-rose-400 bg-rose-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="disposition"
                  value="DAMAGED_IN_TRANSIT"
                  checked={rejectDisposition === 'DAMAGED_IN_TRANSIT'}
                  onChange={() => setRejectDisposition('DAMAGED_IN_TRANSIT')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <p className="font-bold text-rose-900">Barang Rusak / Pecah Selama Transit</p>
                  <p className="text-[11px] text-slate-500">Barang rusak di perjalanan. Stok <span className="font-bold text-rose-700">TIDAK</span> dipulihkan ke gudang asal (pencatatan kerugian transit).</p>
                </div>
              </label>

              <label className={`flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${rejectDisposition === 'LOST_IN_TRANSIT' ? 'border-rose-400 bg-rose-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input
                  type="radio"
                  name="disposition"
                  value="LOST_IN_TRANSIT"
                  checked={rejectDisposition === 'LOST_IN_TRANSIT'}
                  onChange={() => setRejectDisposition('LOST_IN_TRANSIT')}
                  className="mt-0.5 text-rose-600 focus:ring-rose-500"
                />
                <div>
                  <p className="font-bold text-rose-900">Barang Hilang / Kurang Selama Transit</p>
                  <p className="text-[11px] text-slate-500">Barang hilang di perjalanan. Stok <span className="font-bold text-rose-700">TIDAK</span> dipulihkan ke gudang asal (pencatatan kehilangan transit).</p>
                </div>
              </label>
            </div>

            {/* Impact indicator */}
            <div className={`p-2.5 rounded-xl text-[11px] mb-3 flex items-center gap-2 ${
              rejectDisposition === 'RETURNED_TO_ORIGIN' || rejectDisposition === 'CANCELLED_BEFORE_DISPATCH'
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}>
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {rejectDisposition === 'RETURNED_TO_ORIGIN' || rejectDisposition === 'CANCELLED_BEFORE_DISPATCH'
                  ? 'Perlakuan Stok: Saldo inventaris gudang asal akan otomatis bertambah kembali sejumlah barang yang dibatalkan.'
                  : 'Perlakuan Stok: Saldo inventaris gudang asal tetap terpotong (barang fisik telah keluar). Discrepancy dicatat pada log audit.'}
              </span>
            </div>

            <div className="mb-4">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">
                Alasan / Catatan Berita Acara <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows={2}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Jelaskan alasan detail, nomor berita acara kerusakan/kehilangan, atau konfirmasi tim logistik..."
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-800"
              />
            </div>

            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => {
                  setRejectModalId(null);
                  setRejectReason('');
                  setRejectDisposition('RETURNED_TO_ORIGIN');
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={actionLoadingId !== null}
                className="px-3.5 py-1.5 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 disabled:opacity-50 flex items-center gap-1"
              >
                {actionLoadingId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Konfirmasi Disposisi</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
