import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  ShieldCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Check,
  X,
  Lock,
  User,
  Calendar,
  Building2,
  Search,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';
import { ApprovalRequest } from '../types';

export const ApprovalCenter: React.FC = () => {
  const {
    approvals,
    approveGoodsIssue,
    rejectGoodsIssue,
    approveOpnameAdjustment,
    rejectOpnameAdjustment,
    can,
    currentUser,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'PENDING' | 'HISTORY'>('PENDING');
  const [searchTerm, setSearchTerm] = useState('');

  // Reject modal state
  const [rejectItem, setRejectItem] = useState<ApprovalRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Approve quantity modal for goods issue (Admin can modify or approve full quantity)
  const [approveItem, setApproveItem] = useState<ApprovalRequest | null>(null);
  const [approvedQty, setApprovedQty] = useState<number>(0);

  const pendingList = approvals.filter((a) => a.status === 'PENDING');
  const historyList = approvals.filter((a) => a.status !== 'PENDING');

  const currentList = (activeTab === 'PENDING' ? pendingList : historyList).filter((item) => {
    return (
      item.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.requestingUser.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const handleStartApprove = async (item: ApprovalRequest) => {
    const perm = can('APPROVE_TRANSACTIONS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Administrator yang memiliki wewenang persetujuan.');
      return;
    }

    if (item.type === 'BARANG_KELUAR') {
      setApproveItem(item);
      setApprovedQty(item.details.quantity);
    } else if (item.type === 'STOCK_OPNAME_ADJUSTMENT') {
      await approveOpnameAdjustment(item.referenceId);
    }
  };

  const handleConfirmGoodsIssueApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!approveItem) return;

    if (approvedQty <= 0) {
      showToast('error', 'Validasi Gagal', 'Jumlah disetujui harus lebih dari 0.');
      return;
    }

    await approveGoodsIssue(approveItem.referenceId, approvedQty);
    setApproveItem(null);
  };

  const handleStartReject = (item: ApprovalRequest) => {
    const perm = can('APPROVE_TRANSACTIONS');
    if (!perm.allowed) {
      showToast('error', 'Akses Ditolak', perm.reason || 'Hanya Administrator yang memiliki wewenang penolakan.');
      return;
    }
    setRejectItem(item);
    setRejectionReason('');
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectItem) return;

    if (!rejectionReason.trim()) {
      showToast('error', 'Validasi Gagal', 'Alasan penolakan wajib diisi.');
      return;
    }

    if (rejectItem.type === 'BARANG_KELUAR') {
      await rejectGoodsIssue(rejectItem.referenceId, rejectionReason);
    } else if (rejectItem.type === 'STOCK_OPNAME_ADJUSTMENT') {
      await rejectOpnameAdjustment(rejectItem.referenceId, rejectionReason);
    }

    setRejectItem(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Approval Center" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Pusat Persetujuan (Approval Center)
            </h1>
            {pendingList.length > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 animate-pulse">
                {pendingList.length} Menunggu Otorisasi
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Verifikasi independen pengeluaran persediaan dan penyesuaian selisih stock opname
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'PENDING'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Permohonan Tertunda ({pendingList.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('HISTORY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'HISTORY'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Riwayat Persetujuan ({historyList.length})</span>
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Cari permohonan, item, lokasi..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
          />
        </div>
      </div>

      {/* Approvals List */}
      <div className="space-y-4">
        {currentList.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="font-semibold text-slate-700">Tidak ada data approval pada tab ini.</p>
            <p className="text-xs text-slate-400 mt-1">
              Semua permohonan telah selesai diproses sesuai tata kelola operasional.
            </p>
          </div>
        ) : (
          currentList.map((app) => {
            const isPending = app.status === 'PENDING';

            return (
              <div
                key={app.id}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 hover:border-slate-300 transition"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Left: Info */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                        {app.referenceNumber}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          app.type === 'BARANG_KELUAR'
                            ? 'bg-indigo-100 text-indigo-900'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {app.type === 'BARANG_KELUAR' ? 'Pengeluaran Barang' : 'Penyesuaian Opname'}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          app.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : app.status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-amber-100 text-amber-800 animate-pulse'
                        }`}
                      >
                        {app.status}
                      </span>
                    </div>

                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                      {app.title}
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 pt-1">
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Pemohon: <strong>{app.requestingUser}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Lokasi: <strong>{app.location}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-mono">{app.submissionDate}</span>
                      </div>
                    </div>

                    {/* Specific details */}
                    <div className="p-3 bg-slate-50 rounded-lg text-xs space-y-1 text-slate-700">
                      <div>
                        <span className="font-semibold">Keperluan/Alasan:</span> {app.details.reasonOrPurpose}
                      </div>
                      {app.details.destination && (
                        <div>
                          <span className="font-semibold">Tujuan Unit Kerja:</span> {app.details.destination}
                        </div>
                      )}
                      {app.details.variance !== undefined && (
                        <div>
                          <span className="font-semibold">Rincian Fisik vs Sistem:</span> Saldo Sistem: {app.details.systemQuantity} {app.details.unit} | Fisik: {app.details.physicalQuantity} {app.details.unit} (Selisih: {app.details.variance > 0 ? `+${app.details.variance}` : app.details.variance} {app.details.unit})
                        </div>
                      )}
                      {app.rejectionReason && (
                        <div className="text-rose-700 font-semibold pt-1">
                          Alasan Penolakan: {app.rejectionReason}
                        </div>
                      )}
                      {app.actionBy && (
                        <div className="text-slate-500 text-[11px] pt-1">
                          Diproses oleh: <span className="font-bold text-slate-800">{app.actionBy}</span> pada <span className="font-mono">{app.actionDate}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0 border-t sm:border-t-0 sm:border-l border-slate-100 sm:pl-4 pt-3 sm:pt-0">
                    {isPending ? (
                      currentUser?.role === 'ADMIN' ? (
                        <>
                          <button
                            onClick={() => handleStartApprove(app)}
                            className="w-full sm:w-36 py-2 px-3 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white text-xs font-bold shadow-2xs transition flex items-center justify-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            <span>Setujui</span>
                          </button>
                          <button
                            onClick={() => handleStartReject(app)}
                            className="w-full sm:w-36 py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition flex items-center justify-center gap-1.5"
                          >
                            <X className="w-4 h-4" />
                            <span>Tolak</span>
                          </button>
                        </>
                      ) : (
                        <div className="text-xs text-slate-400 p-2 text-center bg-slate-50 rounded-lg border border-slate-200 max-w-[150px]">
                          <Lock className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                          <span>Hanya Admin yang dapat mengotorisasi</span>
                        </div>
                      )
                    ) : (
                      <div className="text-center py-2 px-4 rounded-lg bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600">
                        {app.status === 'APPROVED' ? 'Telah Disetujui' : 'Telah Ditolak'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Set Approved Quantity for Goods Issue */}
      {approveItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleConfirmGoodsIssueApprove}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Konfirmasi Persetujuan Pengeluaran
              </h3>
              <button
                type="button"
                onClick={() => setApproveItem(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <label className="text-slate-500 block mb-1">Dokumen</label>
                <div className="font-bold text-slate-900 font-mono text-sm">
                  {approveItem.referenceNumber}
                </div>
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Item Barang</label>
                <div className="font-bold text-slate-900">
                  {approveItem.details.itemName}
                </div>
              </div>

              <div>
                <label className="text-slate-500 block mb-1">Kuantitas Disetujui ({approveItem.details.unit})</label>
                <input
                  type="number"
                  min="1"
                  max={approveItem.details.quantity}
                  required
                  value={approvedQty}
                  onChange={(e) => setApprovedQty(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-mono font-bold text-base"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  Diminta: {approveItem.details.quantity} {approveItem.details.unit}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setApproveItem(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#064e3b] text-white font-bold hover:bg-[#065f46]"
              >
                Otorisasi & Kurangi Stok
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Rejection Reason */}
      {rejectItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <form
            onSubmit={handleConfirmReject}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Tolak Permohonan Transaksi
              </h3>
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-3 text-xs">
              <div>
                <label className="text-slate-500 block mb-1">Dokumen</label>
                <div className="font-bold text-slate-900 font-mono">
                  {rejectItem.referenceNumber} - {rejectItem.title}
                </div>
              </div>

              <div>
                <label className="text-slate-700 block mb-1 font-semibold">Alasan Penolakan (Wajib)</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Contoh: Stok dipertahankan untuk prioritas penerbangan VVIP, permohonan agar diajukan kembali besok..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setRejectItem(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 font-semibold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700"
              >
                Konfirmasi Penolakan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
