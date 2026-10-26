import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  Settings,
  Shield,
  Clock,
  Building2,
  RefreshCw,
  CheckCircle2,
  Lock,
  Sliders,
  AlertTriangle,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';

export const Pengaturan: React.FC = () => {
  const { settings, updateSettings, resetToInitialData, currentUser, can } = useApp();

  const [companyName, setCompanyName] = useState(settings.companyName);
  const [applicationName, setApplicationName] = useState(settings.applicationName);
  const [timezone, setTimezone] = useState(settings.timezone);
  const [requireAdminOpnameAdjustment, setRequireAdminOpnameAdjustment] = useState(
    settings.requireAdminOpnameAdjustment
  );
  const [lowStockAlertPercentage, setLowStockAlertPercentage] = useState(settings.lowStockAlertPercentage);

  const isAdmin = currentUser?.role === 'ADMIN';

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings({
      companyName,
      applicationName,
      timezone,
      requireAdminOpnameAdjustment,
      lowStockAlertPercentage: Number(lowStockAlertPercentage),
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <PermissionNotice moduleName="Pengaturan Sistem" actionRequired="ADMIN_ONLY" />

      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
          Pengaturan Sistem & Tata Kelola
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Konfigurasi identitas aplikasi, kebijakan approval, dan zona waktu PT IAS Support
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        {/* Card 1: Branding & Identitas */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6">
          <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 mb-4 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-[#064e3b]" />
            <span>Identitas Perusahaan & Aplikasi</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="text-slate-600 block mb-1 font-semibold">Nama Resmi Perusahaan</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] disabled:bg-slate-50 disabled:text-slate-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Wajib menggunakan: PT IAS Support</span>
            </div>

            <div>
              <label className="text-slate-600 block mb-1 font-semibold">Nama Resmi Aplikasi</label>
              <input
                type="text"
                disabled={!isAdmin}
                value={applicationName}
                onChange={(e) => setApplicationName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] disabled:bg-slate-50 disabled:text-slate-500"
              />
              <span className="text-[10px] text-slate-400 mt-1 block">PT IAS SUPPORT — LOGISTICS CONTROL TOWER</span>
            </div>
          </div>
        </div>

        {/* Card 2: Tata Kelola Inventaris & Zona Waktu */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6">
          <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-100 mb-4 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-[#064e3b]" />
            <span>Kebijakan Otorisasi & Zona Waktu (Asia/Jakarta)</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Zona Waktu Sistem (Timezone)</label>
                <input
                  type="text"
                  disabled
                  value="Asia/Jakarta (WIB - UTC+07:00)"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-1 block">
                  Sesuai aturan bisnis 12: Waktu aplikasi menggunakan Asia/Jakarta
                </span>
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-semibold">Ambang Batas Peringatan Stok Rendah (%)</label>
                <input
                  type="number"
                  disabled={!isAdmin}
                  min="5"
                  max="50"
                  value={lowStockAlertPercentage}
                  onChange={(e) => setLowStockAlertPercentage(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] disabled:bg-slate-50 disabled:text-slate-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={requireAdminOpnameAdjustment}
                  onChange={(e) => setRequireAdminOpnameAdjustment(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#064e3b] focus:ring-[#064e3b]"
                />
                <div>
                  <div className="font-bold text-slate-800">
                    Wajibkan Persetujuan Administrator untuk Selisih Opname (Aturan Bisnis 8)
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                    Setiap perbedaan antara kuantitas fisik dan sistem tidak boleh langsung menimpa saldo gudang sebelum disetujui di Approval Center.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Save button */}
        {isAdmin && (
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs shadow-sm transition"
            >
              Simpan Pengaturan
            </button>
          </div>
        )}
      </form>

      {/* Card 3: Storage Cache Reset */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <RefreshCw className="w-4 h-4 text-emerald-700" />
            <span>Bersihkan / Reset Cache Data Lokal</span>
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-lg">
            Mengembalikan master data standar dan mengosongkan cache transaksi lokal pada peramban ke kondisi bersih operasional PT IAS Support.
          </p>
        </div>

        <button
          onClick={resetToInitialData}
          className="px-4 py-2 rounded-xl bg-white border border-emerald-300 text-emerald-900 hover:bg-emerald-50 font-bold text-xs shadow-2xs transition flex items-center gap-2 shrink-0"
        >
          <RefreshCw className="w-4 h-4 text-emerald-700" />
          <span>Reset ke Kondisi Bersih</span>
        </button>
      </div>
    </div>
  );
};
