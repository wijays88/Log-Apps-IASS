import React from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface AccessDeniedProps {
  module: string;
  requiredRole?: string;
}

export const AccessDenied: React.FC<AccessDeniedProps> = ({ module, requiredRole = 'ADMIN' }) => {
  const { currentUser, setActiveNav } = useApp();

  return (
    <div className="min-h-[500px] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-rose-200 shadow-sm p-6 sm:p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
          <ShieldAlert className="w-7 h-7" />
        </div>

        <div>
          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-200 mb-2">
            Akses Ditolak • 403 Forbidden
          </span>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
            Kewenangan Tidak Mencukupi
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 mt-2 leading-relaxed">
            Akun Anda saat ini bertindak sebagai{' '}
            <span className="font-bold text-slate-900 uppercase">[{currentUser?.role || 'GUEST'}]</span>,
            namun modul <span className="font-bold text-slate-900">"{module}"</span> memerlukan hak akses{' '}
            <span className="font-bold text-rose-700 uppercase">[{requiredRole}]</span>.
          </p>
        </div>

        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs space-y-1.5">
          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Protokol Tata Kelola RBAC PT IAS Support</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-normal">
            Akses administratif ke manajemen pengguna, persetujuan opname, dan konfigurasi sistem dibatasi secara ketat oleh aturan keamanan Cloud Firestore.
          </p>
        </div>

        <div className="pt-2">
          <button
            onClick={() => setActiveNav('Dashboard')}
            className="w-full py-2.5 px-4 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Dashboard Utama</span>
          </button>
        </div>
      </div>
    </div>
  );
};
