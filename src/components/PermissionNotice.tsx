import React from 'react';
import { useApp } from '../context/AppContext';
import { ShieldAlert, ShieldCheck, Lock, Eye } from 'lucide-react';

interface Props {
  moduleName: string;
  actionRequired?: string;
}

export const PermissionNotice: React.FC<Props> = ({ moduleName, actionRequired }) => {
  const { currentUser } = useApp();

  if (!currentUser) return null;

  if (currentUser.role === 'ADMIN') {
    return null; // Admin has full access, no restriction banner needed
  }

  if (currentUser.role === 'SITE HEAD') {
    return (
      <div className="mb-5 bg-amber-50/80 border border-amber-200 rounded-xl p-3.5 flex items-start gap-3 text-amber-900 text-xs sm:text-sm">
        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800 shrink-0 mt-0.5">
          <Eye className="w-4 h-4" />
        </div>
        <div className="flex-1 leading-relaxed">
          <span className="font-semibold text-amber-950">Mode Pantau Eksekutif (Site Head - Read Only):</span> Anda dapat melihat seluruh riwayat, data inventaris, dan status transaksi di modul <span className="font-semibold underline">{moduleName}</span>. Pembuatan atau otorisasi perubahan dibatasi untuk peran Logistik / Administrator.
        </div>
      </div>
    );
  }

  if (currentUser.role === 'LOGISTIK' && actionRequired === 'ADMIN_ONLY') {
    return (
      <div className="mb-5 bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex items-start gap-3 text-blue-900 text-xs sm:text-sm">
        <div className="p-1.5 rounded-lg bg-blue-100 text-blue-800 shrink-0 mt-0.5">
          <Lock className="w-4 h-4" />
        </div>
        <div className="flex-1 leading-relaxed">
          <span className="font-semibold text-blue-950">Akses Terbatas Peran Logistik:</span> Modul <span className="font-semibold underline">{moduleName}</span> adalah wewenang Administrator. Anda dapat meninjau informasi yang relevan dengan tugas operasional, namun tindakan modifikasi dan pengaturan akun hanya dapat dilakukan oleh Admin.
        </div>
      </div>
    );
  }

  return null;
};
