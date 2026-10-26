import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { ToastContainer } from './components/ToastContainer';

// Pages
import { Dashboard } from './pages/Dashboard';
import { PosisiPersediaan } from './pages/PosisiPersediaan';
import { BarangMasuk } from './pages/BarangMasuk';
import { BarangKeluar } from './pages/BarangKeluar';
import { TransferStok } from './pages/TransferStok';
import { StockOpname } from './pages/StockOpname';
import { ApprovalCenter } from './pages/ApprovalCenter';
import { Laporan } from './pages/Laporan';
import { MasterData } from './pages/MasterData';
import { AccountManagement } from './pages/AccountManagement';
import { AuditTrail } from './pages/AuditTrail';
import { ProfilAkun } from './pages/ProfilAkun';
import { Pengaturan } from './pages/Pengaturan';
import { Login } from './pages/Login';
import { ExcelImportExportModal } from './components/ExcelImportExportModal';
import { ImportModuleType } from './utils/excelUtils';

const MainLayout: React.FC = () => {
  const { currentUser, activeNav } = useApp();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [globalExcelModalOpen, setGlobalExcelModalOpen] = useState(false);
  const [globalExcelModule, setGlobalExcelModule] = useState<ImportModuleType>('MATERIAL_MASTER');

  // If user is logged out, show Login page
  if (!currentUser) {
    return <Login />;
  }

  const renderActivePage = () => {
    switch (activeNav) {
      case 'Dashboard':
        return <Dashboard />;
      case 'Posisi Persediaan':
        return <PosisiPersediaan />;
      case 'Barang Masuk':
        return <BarangMasuk />;
      case 'Barang Keluar':
        return <BarangKeluar />;
      case 'Transfer Stok':
        return <TransferStok />;
      case 'Stock Opname':
        return <StockOpname />;
      case 'Approval Center':
        return <ApprovalCenter />;
      case 'Laporan':
        return <Laporan />;
      case 'Master Data':
        return <MasterData />;
      case 'Account Management':
        return <AccountManagement />;
      case 'Audit Trail':
        return <AuditTrail />;
      case 'Profil Akun':
        return <ProfilAkun />;
      case 'Pengaturan':
        return <Pengaturan />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      <div className="flex flex-1">
        {/* Fixed Enterprise Sidebar */}
        <Sidebar
          mobileOpen={mobileSidebarOpen}
          onCloseMobile={() => setMobileSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Header
            onToggleMobileSidebar={() => setMobileSidebarOpen(true)}
            onOpenExcelModal={(mod) => {
              setGlobalExcelModule(mod || 'MATERIAL_MASTER');
              setGlobalExcelModalOpen(true);
            }}
          />

          <main className="flex-1 p-3.5 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
            {renderActivePage()}
          </main>

          <footer className="py-4 px-6 border-t border-slate-200/80 bg-white text-center text-xs text-slate-500 no-print">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="font-semibold text-slate-700">
                PT IAS SUPPORT — LOGISTICS CONTROL TOWER
              </span>
              <span className="text-[11px] text-slate-400">
                Sistem Pengawasan Inventaris Terintegrasi • Hak Cipta © PT IAS Support 2026
              </span>
            </div>
          </footer>
        </div>
      </div>

      {/* Global Excel Import / Export Modal accessible across modules */}
      <ExcelImportExportModal
        isOpen={globalExcelModalOpen}
        initialModule={globalExcelModule}
        onClose={() => setGlobalExcelModalOpen(false)}
      />

      <ToastContainer />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}
