import React from 'react';
import { useApp } from '../context/AppContext';
import {
  LayoutDashboard,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ClipboardCheck,
  ShieldCheck,
  FileBarChart,
  Database,
  Users,
  History,
  User,
  Settings,
  X,
  Lock,
  Eye,
  CheckCircle2,
} from 'lucide-react';

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const NAV_ITEMS = [
  { name: 'Dashboard', icon: LayoutDashboard, badge: null, restrictedFor: [] },
  { name: 'Posisi Persediaan', icon: Boxes, badge: null, restrictedFor: [] },
  { name: 'Barang Masuk', icon: ArrowDownToLine, badge: null, restrictedFor: ['SITE HEAD'] },
  { name: 'Barang Keluar', icon: ArrowUpFromLine, badge: null, restrictedFor: ['SITE HEAD'] },
  { name: 'Transfer Stok', icon: ArrowLeftRight, badge: null, restrictedFor: ['SITE HEAD'] },
  { name: 'Stock Opname', icon: ClipboardCheck, badge: null, restrictedFor: ['SITE HEAD'] },
  { name: 'Approval Center', icon: ShieldCheck, badge: 'approval', restrictedFor: ['SITE HEAD', 'LOGISTIK'] },
  { name: 'Laporan', icon: FileBarChart, badge: null, restrictedFor: [] },
  { name: 'Master Data', icon: Database, badge: null, restrictedFor: ['SITE HEAD'] },
  { name: 'Account Management', icon: Users, badge: null, restrictedFor: ['SITE HEAD', 'LOGISTIK'] },
  { name: 'Audit Trail', icon: History, badge: null, restrictedFor: [] },
  { name: 'Profil Akun', icon: User, badge: null, restrictedFor: [] },
  { name: 'Pengaturan', icon: Settings, badge: null, restrictedFor: ['SITE HEAD', 'LOGISTIK'] },
];

export const Sidebar: React.FC<SidebarProps> = ({ mobileOpen, onCloseMobile }) => {
  const { activeNav, setActiveNav, currentUser, approvals } = useApp();

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;

  const handleNavClick = (name: string) => {
    setActiveNav(name);
    onCloseMobile();
  };

  const getRoleAccessBadge = (itemRestricted: string[]) => {
    if (!currentUser) return null;
    if (currentUser.role === 'ADMIN') return null;

    if (currentUser.role === 'SITE HEAD') {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-medium flex items-center gap-0.5">
          <Eye className="w-2.5 h-2.5" />
          <span>Lihat</span>
        </span>
      );
    }

    if (currentUser.role === 'LOGISTIK' && itemRestricted.includes('LOGISTIK')) {
      return (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium flex items-center gap-0.5">
          <Lock className="w-2.5 h-2.5" />
          <span>Admin</span>
        </span>
      );
    }

    return null;
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Sidebar Header / Brand */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#064e3b] text-white flex items-center justify-center font-extrabold text-sm shadow-md">
            IAS
          </div>
          <div>
            <div className="font-extrabold text-slate-900 tracking-tight text-sm leading-snug">
              PT IAS SUPPORT
            </div>
            <div className="text-[10px] text-emerald-700 font-bold uppercase tracking-wider">
              Logistics Control Tower
            </div>
          </div>
        </div>

        {/* Close button for mobile */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List - Exact 13 items shown identically to all roles */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
          Menu Operasional
        </div>

        {NAV_ITEMS.map((item, index) => {
          const Icon = item.icon;
          const isActive = activeNav === item.name;
          const isApproval = item.badge === 'approval';

          return (
            <React.Fragment key={item.name}>
              {/* Visual divider before administrative/settings modules */}
              {index === 8 && (
                <div className="pt-3 pb-1.5 px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Administrasi & Sistem
                </div>
              )}

              <button
                onClick={() => handleNavClick(item.name)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all group ${
                  isActive
                    ? 'bg-[#064e3b] text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-3 truncate">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-emerald-300' : 'text-slate-400 group-hover:text-[#064e3b]'
                    }`}
                  />
                  <span className="truncate">{item.name}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  {/* Approval Counter Badge */}
                  {isApproval && pendingApprovalsCount > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-rose-500 text-white'
                          : 'bg-rose-100 text-rose-700'
                      }`}
                    >
                      {pendingApprovalsCount}
                    </span>
                  )}

                  {/* Contextual role badge for non-admin */}
                  {!isActive && getRoleAccessBadge(item.restrictedFor)}
                </div>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Sidebar Footer with current session & company info */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="p-2.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Status Operasi</span>
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Aktif WIB
            </span>
          </div>
          <div className="mt-1 text-[11px] text-slate-600 truncate font-medium">
            PT IAS Support • Hub CGK
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 h-screen sticky top-0 z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
