import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  History,
  Search,
  Filter,
  Download,
  Shield,
  Clock,
  Calendar,
  User,
  Activity,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';

export const AuditTrail: React.FC = () => {
  const { auditLogs } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [moduleFilter, setModuleFilter] = useState('ALL');

  const modules = Array.from(new Set(auditLogs.map((l) => l.module)));

  const filteredLogs = auditLogs.filter((log) => {
    const matchSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.employeeId.toLowerCase().includes(searchTerm.toLowerCase());

    const matchModule = moduleFilter === 'ALL' || log.module === moduleFilter;

    return matchSearch && matchModule;
  });

  const handleExportCSV = () => {
    const headers = ['ID', 'Waktu (WIB)', 'Employee ID', 'Nama Pengguna', 'Peran', 'Aksi', 'Modul', 'Rincian Aktivitas', 'IP Address'];
    const rows = filteredLogs.map((l) => [
      `"${l.id}"`,
      `"${l.timestamp}"`,
      `"${l.employeeId}"`,
      `"${l.userName}"`,
      `"${l.role}"`,
      `"${l.action}"`,
      `"${l.module}"`,
      `"${l.details.replace(/"/g, '""')}"`,
      `"${l.ipAddress}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PT_IAS_Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Audit Trail Sistem" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Audit Trail & Rekam Jejak Sistem
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-800">
              {filteredLogs.length} Entri Log
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Log aktivitas operasional, transaksi saldo, otorisasi approval, dan keamanan PT IAS Support
          </p>
        </div>

        <div>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs sm:text-sm shadow-2xs transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>Ekspor Log CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cari aksi, rincian, petugas, employee ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30"
            />
          </div>

          <div>
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]/30 bg-white"
            >
              <option value="ALL">Semua Modul Aplikasi</option>
              {modules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Waktu (WIB)</th>
                <th className="py-3 px-4">Pengguna & NIP</th>
                <th className="py-3 px-4 text-center">Peran</th>
                <th className="py-3 px-4">Aksi Terdata</th>
                <th className="py-3 px-4">Modul</th>
                <th className="py-3 px-4">Rincian Aktivitas Transaksi</th>
                <th className="py-3 px-4 font-mono">IP Host</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Tidak ada aktivitas yang sesuai pencarian.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono text-slate-600 whitespace-nowrap text-[11px]">
                      {log.timestamp}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{log.userName}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{log.employeeId}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          log.role === 'ADMIN'
                            ? 'bg-emerald-900 text-white'
                            : log.role === 'SITE HEAD'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {log.role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-800 text-[11px]">
                      {log.action}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-semibold">
                      {log.module}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-sm">
                      <div className="leading-relaxed">{log.details}</div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-400 text-[11px]">
                      {log.ipAddress}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
