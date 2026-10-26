import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Bell,
  Clock,
  MapPin,
  Shield,
  ChevronDown,
  User,
  LogOut,
  Settings,
  Menu,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { UserRole } from '../types';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  onOpenExcelModal?: (module?: any) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileSidebar, onOpenExcelModal }) => {
  const { currentUser, approvals, setActiveNav, resetToInitialData, logout } = useApp();
  const [currentTime, setCurrentTime] = useState<string>('');
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      // Format in Indonesian Asia/Jakarta WIB style
      const formatted = new Intl.DateTimeFormat('id-ID', {
        timeZone: 'Asia/Jakarta',
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(now);
      setCurrentTime(formatted + ' WIB');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const pendingCount = approvals.filter((a) => a.status === 'PENDING').length;

  const getRoleBadgeStyle = (role?: UserRole) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-emerald-900 text-emerald-100 border-emerald-700';
      case 'SITE HEAD':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'LOGISTIK':
      default:
        return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200/80 shadow-xs">
      <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 gap-3">
        {/* Left: Mobile Toggle & Brand / Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            {/* Monogram brand icon */}
            <div className="w-8 h-8 rounded-lg bg-[#064e3b] text-white flex items-center justify-center font-bold text-xs shadow-sm tracking-tight">
              IAS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-slate-900 tracking-tight text-sm sm:text-base leading-none">
                  PT IAS SUPPORT
                </span>
                <span className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-semibold tracking-wider bg-emerald-100 text-emerald-800 rounded uppercase">
                  Logistics Control Tower
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Menara Kontrol Logistik & Pergudangan Terpadu
              </div>
            </div>
          </div>
        </div>

        {/* Center / Right tools: Realtime clock, Location, Pending approvals, Role Switcher */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Timezone badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-slate-600 bg-slate-100/80 border border-slate-200 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-emerald-700" />
            <span>{currentTime || 'Memuat waktu Asia/Jakarta...'}</span>
          </div>

          {/* Location Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-medium max-w-[130px] truncate" title={currentUser?.authorizedLocation}>
              {currentUser?.authorizedLocation || 'Semua Lokasi'}
            </span>
          </div>

          {/* Authenticated Role Badge (Enforced from Firestore, immutable) */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg shadow-2xs border select-none"
            style={{
              backgroundColor:
                currentUser?.role === 'ADMIN'
                  ? '#064e3b'
                  : currentUser?.role === 'SITE HEAD'
                  ? '#78350f'
                  : '#047857',
              color: '#ffffff',
              borderColor: 'transparent',
            }}
            title={`Peran Pengguna Terverifikasi: ${currentUser?.role || 'LOGISTIK'}`}
          >
            <Shield className="w-3.5 h-3.5 text-emerald-200" />
            <span className="hidden xs:inline text-emerald-100/90 font-medium">Peran:</span>
            <span className="uppercase font-bold tracking-wide">{currentUser?.role || 'LOGISTIK'}</span>
          </div>

          {/* Universal Excel Hub Trigger */}
          <button
            onClick={() => onOpenExcelModal ? onOpenExcelModal('MATERIAL_MASTER') : setActiveNav('Master Data')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition shadow-2xs"
            title="Pusat Integrasi Import / Export Excel (.xlsx / .csv)"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="hidden sm:inline">Excel Hub</span>
          </button>

          {/* Approval Notification Bell */}
          <button
            onClick={() => setActiveNav('Approval Center')}
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            title={`${pendingCount} Transaksi Menunggu Persetujuan`}
          >
            <Bell className="w-4 h-4" />
            {pendingCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-xs animate-pulse">
                {pendingCount}
              </span>
            )}
          </button>

          {/* User Profile Pill & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 p-1 sm:px-2.5 sm:py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition"
            >
              <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs uppercase border border-slate-300">
                {currentUser?.fullName.charAt(0) || 'U'}
              </div>
              <div className="hidden sm:block text-left text-xs">
                <div className="font-bold text-slate-800 leading-tight max-w-[120px] truncate">
                  {currentUser?.fullName}
                </div>
                <div className="text-[10px] text-slate-500 font-mono leading-tight">
                  {currentUser?.employeeId}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {profileDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-slate-200 p-2 z-50 text-xs animate-in fade-in"
                onClick={() => setProfileDropdownOpen(false)}
              >
                <div className="px-3 py-2 border-b border-slate-100">
                  <div className="font-bold text-slate-900 truncate">{currentUser?.fullName}</div>
                  <div className="text-slate-500 font-mono text-[11px] truncate">{currentUser?.email}</div>
                  <div className="mt-1.5">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold uppercase border ${getRoleBadgeStyle(currentUser?.role)}`}>
                      {currentUser?.role}
                    </span>
                  </div>
                </div>

                <div className="mt-1 space-y-0.5">
                  <button
                    onClick={() => setActiveNav('Profil Akun')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg transition"
                  >
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Profil Akun Saya</span>
                  </button>

                  <button
                    onClick={() => setActiveNav('Pengaturan')}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50 rounded-lg transition"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-500" />
                    <span>Pengaturan Sistem</span>
                  </button>

                  {currentUser?.role === 'ADMIN' && (
                    <button
                      onClick={resetToInitialData}
                      className="w-full flex items-center gap-2 px-3 py-2 text-amber-700 hover:bg-amber-50 rounded-lg transition"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                      <span>Reset Data Demo PT IAS</span>
                    </button>
                  )}

                  <div className="border-t border-slate-100 my-1"></div>

                  <button
                    onClick={async () => {
                      await logout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition font-medium"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-600" />
                    <span>Keluar (Logout)</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
