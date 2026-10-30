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
  FileSpreadsheet,
} from 'lucide-react';
import { UserRole } from '../types';

interface HeaderProps {
  onToggleMobileSidebar: () => void;
  onOpenExcelModal?: (module?: any) => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobileSidebar, onOpenExcelModal }) => {
  const { currentUser, approvals, setActiveNav, resetToInitialData, clearLocalCache, logout } = useApp();
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

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-[#D9E2EF] shadow-2xs">
      <div className="flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 gap-3">
        {/* Left: Mobile Toggle & Brand / Breadcrumb */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileSidebar}
            className="lg:hidden p-2 text-[#64748B] hover:text-[#123B66] hover:bg-[#EFF6FF] rounded-lg transition"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5">
            {/* Monogram brand icon in Corporate Blue */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#123B66] to-[#1F5FAF] text-white flex items-center justify-center font-bold text-xs shadow-sm tracking-tight">
              IAS
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-[#123B66] tracking-tight text-sm sm:text-base leading-none">
                  PT IAS SUPPORT
                </span>
                <span className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-bold tracking-wider bg-[#EFF6FF] text-[#1F5FAF] border border-[#D9E2EF] rounded uppercase">
                  Control Tower
                </span>
              </div>
              <div className="text-[11px] text-[#64748B] font-medium hidden sm:block">
                Sistem Manajemen Inventaris & Logistik Terpadu
              </div>
            </div>
          </div>
        </div>

        {/* Center / Right tools: Realtime clock, Location, Role, Excel Hub, Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Timezone badge */}
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono text-[#1F2937] bg-[#F7F9FC] border border-[#D9E2EF] rounded-lg">
            <Clock className="w-3.5 h-3.5 text-[#1F5FAF]" />
            <span>{currentTime || 'WIB'}</span>
          </div>

          {/* Location Badge */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 text-xs text-[#1F2937] bg-[#F7F9FC] border border-[#D9E2EF] rounded-lg">
            <MapPin className="w-3.5 h-3.5 text-[#3182CE]" />
            <span className="font-medium max-w-[130px] truncate" title={currentUser?.authorizedLocation}>
              {currentUser?.authorizedLocation || 'Semua Lokasi'}
            </span>
          </div>

          {/* Authenticated Role Badge (Enforced from Firestore) */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg shadow-2xs border select-none"
            style={{
              backgroundColor:
                currentUser?.role === 'ADMIN'
                  ? '#123B66'
                  : currentUser?.role === 'SITE HEAD'
                  ? '#1E3A8A'
                  : '#1F5FAF',
              color: '#ffffff',
              borderColor: 'transparent',
            }}
            title={`Peran Pengguna Terverifikasi: ${currentUser?.role || 'LOGISTIK'}`}
          >
            <Shield className="w-3.5 h-3.5 text-[#EFF6FF]" />
            <span className="hidden xs:inline text-[#EFF6FF]/80 font-medium">Peran:</span>
            <span className="uppercase font-bold tracking-wide">{currentUser?.role || 'LOGISTIK'}</span>
          </div>

          {/* Universal Excel Hub Trigger in Corporate Blue */}
          <button
            onClick={() => onOpenExcelModal ? onOpenExcelModal('MATERIAL_MASTER') : setActiveNav('Master Data')}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#EFF6FF] text-[#1F5FAF] border border-[#D9E2EF] hover:bg-blue-100/80 transition shadow-2xs"
            title="Pusat Integrasi Import / Export Excel (.xlsx / .csv)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-[#1F5FAF]" />
            <span className="hidden sm:inline">Excel Hub</span>
          </button>

          {/* User Profile Dropdown Trigger */}
          <div className="relative">
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 p-1.5 pl-2 rounded-xl border border-[#D9E2EF] hover:bg-[#F7F9FC] transition shadow-2xs group"
              aria-expanded={profileDropdownOpen}
              aria-label="Menu Pengguna"
            >
              <div className="w-7 h-7 rounded-lg bg-[#123B66] text-white flex items-center justify-center font-bold text-xs">
                {currentUser?.fullName ? currentUser.fullName.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-[#1F2937] leading-tight max-w-[110px] truncate">
                  {currentUser?.fullName || 'Pengguna'}
                </span>
                <span className="text-[10px] text-[#64748B] font-mono leading-tight">
                  {currentUser?.employeeId || 'ID'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#123B66] transition-transform duration-200" />
            </button>

            {/* Profile Dropdown Menu */}
            {profileDropdownOpen && (
              <div
                className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-[#D9E2EF] py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setProfileDropdownOpen(false)}
              >
                <div className="px-4 py-2.5 border-b border-[#D9E2EF] bg-[#F7F9FC]">
                  <p className="text-xs font-bold text-[#1F2937] truncate">{currentUser?.fullName}</p>
                  <p className="text-[11px] text-[#64748B] truncate font-mono">{currentUser?.email}</p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#EFF6FF] text-[#1F5FAF] uppercase border border-[#D9E2EF]">
                      {currentUser?.role}
                    </span>
                    <span className="text-[10px] text-[#64748B]">{currentUser?.employeeId}</span>
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => setActiveNav('Profil Akun')}
                    className="w-full px-4 py-2 text-left text-xs text-[#1F2937] hover:bg-[#EFF6FF] flex items-center gap-2 font-medium"
                  >
                    <User className="w-3.5 h-3.5 text-[#1F5FAF]" />
                    <span>Profil Saya & Ubah Sandi</span>
                  </button>

                  {currentUser?.role === 'ADMIN' && (
                    <button
                      onClick={() => setActiveNav('Account Management')}
                      className="w-full px-4 py-2 text-left text-xs text-[#1F2937] hover:bg-[#EFF6FF] flex items-center gap-2 font-medium"
                    >
                      <Shield className="w-3.5 h-3.5 text-[#1F5FAF]" />
                      <span>Kelola Akun & Hak Akses</span>
                    </button>
                  )}

                  {currentUser?.role === 'ADMIN' && (
                    <button
                      onClick={() => setActiveNav('Pengaturan')}
                      className="w-full px-4 py-2 text-left text-xs text-[#1F2937] hover:bg-[#EFF6FF] flex items-center gap-2 font-medium"
                    >
                      <Settings className="w-3.5 h-3.5 text-[#1F5FAF]" />
                      <span>Pengaturan Sistem</span>
                    </button>
                  )}
                </div>

                <div className="border-t border-[#D9E2EF] pt-1">
                  <button
                    onClick={async () => {
                      await logout();
                    }}
                    className="w-full px-4 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2 font-semibold"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-500" />
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
