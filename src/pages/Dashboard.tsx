import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  Package,
  Boxes,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  Clock,
  Warehouse,
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Search,
  Filter,
  Download,
  FileSpreadsheet,
  FileText,
  DollarSign,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Eye,
} from 'lucide-react';
import { exportToExcelFile, exportToCsvFile } from '../utils/excelUtils';

export const Dashboard: React.FC = () => {
  const {
    items,
    materials,
    activeMaterials,
    locations,
    activeLocations,
    categories,
    goodsReceipts,
    goodsIssues,
    stockTransfers,
    approvals,
    setActiveNav,
    currentUser,
  } = useApp();

  // Stock Table Filter & Pagination States
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStockStatus, setSelectedStockStatus] = useState<'ALL' | 'NORMAL' | 'MENIPIS' | 'KOSONG'>('ALL');
  const [sortField, setSortField] = useState<'materialName' | 'availableStock' | 'minimumStock'>('availableStock');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  // Selected Detail Modal
  const [selectedDetailItem, setSelectedDetailItem] = useState<any | null>(null);

  // 1. KPI Calculations (Authoritative Real-Time Data)
  const totalActiveSKUs = useMemo(
    () => (activeMaterials.length > 0 ? activeMaterials.length : new Set(items.map((i) => i.materialId || i.itemId)).size),
    [activeMaterials, items]
  );

  const totalActiveWarehouses = useMemo(
    () => (activeLocations.length > 0 ? activeLocations.length : locations.length),
    [activeLocations, locations]
  );

  const totalStockQuantity = useMemo(
    () => items.reduce((acc, curr) => acc + (Number(curr.availableStock) || 0), 0),
    [items]
  );

  // Estimated Inventory Valuation (using cost from materials if present, default 25000 per unit for industrial supplies)
  const estimatedValuation = useMemo(() => {
    return items.reduce((sum, item) => {
      const mat = materials.find(
        (m) =>
          m.id === item.materialId ||
          m.materialId === item.materialId ||
          m.materialCode === item.materialCode ||
          m.itemCode === item.materialCode
      );
      const unitCost = mat?.unitCost || mat?.unitPrice || 35000;
      return sum + (Number(item.availableStock) || 0) * unitCost;
    }, 0);
  }, [items, materials]);

  // Movement & Flow Counters
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayReceipts = goodsReceipts.filter((gr) => gr.receiptDate?.startsWith(todayStr) || gr.createdAt?.startsWith(todayStr));
  const todayReceiptsCount = todayReceipts.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

  const todayIssues = goodsIssues.filter((gi) => gi.requestDate?.startsWith(todayStr) || gi.createdAt?.startsWith(todayStr));
  const todayIssuesCount = todayIssues.reduce((sum, i) => sum + (Number(i.requestedQuantity) || 0), 0);

  const criticalItems = useMemo(
    () => items.filter((item) => item.availableStock > 0 && item.availableStock <= item.minimumStock),
    [items]
  );

  const emptyStockItems = useMemo(
    () => items.filter((item) => Number(item.availableStock) <= 0),
    [items]
  );

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;
  const inTransitTransfersCount = stockTransfers.filter((t) => t.status === 'IN_TRANSIT').length;

  // 2. Warehouse Distribution Calculation
  const locationStats = useMemo(() => {
    return locations.map((loc) => {
      const locItems = items.filter((i) => i.locationId === loc.id);
      const totalQty = locItems.reduce((acc, curr) => acc + (Number(curr.availableStock) || 0), 0);
      const skuCount = locItems.length;
      return {
        ...loc,
        totalQty,
        skuCount,
      };
    });
  }, [locations, items]);

  // 3. Filtered Stock Position Table Data
  const filteredStockData = useMemo(() => {
    return items.filter((item) => {
      const code = (item.materialCode || item.itemCode || '').toLowerCase();
      const name = (item.materialName || item.itemName || '').toLowerCase();
      const locName = (item.locationName || '').toLowerCase();
      const cat = (item.categoryId || item.categoryName || '').toLowerCase();
      const s = searchTerm.toLowerCase();

      const matchSearch = !s || code.includes(s) || name.includes(s) || locName.includes(s) || cat.includes(s);
      const matchLoc = selectedLocation === 'ALL' || item.locationId === selectedLocation;
      const matchCat = selectedCategory === 'ALL' || item.categoryId === selectedCategory;

      let matchStatus = true;
      if (selectedStockStatus === 'KOSONG') matchStatus = Number(item.availableStock) <= 0;
      else if (selectedStockStatus === 'MENIPIS') matchStatus = item.availableStock > 0 && item.availableStock <= item.minimumStock;
      else if (selectedStockStatus === 'NORMAL') matchStatus = item.availableStock > item.minimumStock;

      return matchSearch && matchLoc && matchCat && matchStatus;
    });
  }, [items, searchTerm, selectedLocation, selectedCategory, selectedStockStatus]);

  // Sorted and Paginated Stock Data
  const sortedStockData = useMemo(() => {
    const list = [...filteredStockData];
    list.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];
      if (sortField === 'materialName') {
        valA = (a.materialName || a.itemName || '').toLowerCase();
        valB = (b.materialName || b.itemName || '').toLowerCase();
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
    return list;
  }, [filteredStockData, sortField, sortOrder]);

  const totalPages = Math.ceil(sortedStockData.length / itemsPerPage) || 1;
  const paginatedStock = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedStockData.slice(start, start + itemsPerPage);
  }, [sortedStockData, currentPage]);

  const handleSort = (field: 'materialName' | 'availableStock' | 'minimumStock') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Export handlers
  const handleExportExcel = () => {
    const data = filteredStockData.map((item) => ({
      'Kode Barang': item.materialCode || item.itemCode,
      'Nama Barang': item.materialName || item.itemName,
      'Kategori': item.categoryName || item.categoryId,
      'Gudang / Lokasi': item.locationName,
      'Satuan': item.unit,
      'Saldo Stok': item.availableStock,
      'Stok Minimum': item.minimumStock,
      'ROP': item.reorderPoint,
      'Status': item.availableStock <= 0 ? 'KOSONG' : item.availableStock <= item.minimumStock ? 'MENIPIS' : 'NORMAL',
    }));
    exportToExcelFile(data, `Posisi_Stok_Control_Tower_${new Date().toISOString().slice(0, 10)}.xlsx`, 'Posisi Stok');
  };

  const handleExportCSV = () => {
    const csvData = filteredStockData.map((item) => ({
      'Kode Barang': item.materialCode || item.itemCode,
      'Nama Barang': item.materialName || item.itemName,
      'Kategori': item.categoryName || item.categoryId,
      'Gudang': item.locationName,
      'Satuan': item.unit,
      'Saldo Stok': item.availableStock,
      'Stok Minimum': item.minimumStock,
      'Status': item.availableStock <= 0 ? 'KOSONG' : item.availableStock <= item.minimumStock ? 'MENIPIS' : 'NORMAL',
    }));
    exportToCsvFile(csvData, `Posisi_Stok_Control_Tower_${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Welcome - Blue Corporate Theme */}
      <div className="bg-gradient-to-r from-[#123B66] via-[#1F5FAF] to-[#3182CE] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/15 text-[#EFF6FF] text-xs font-semibold backdrop-blur-xs mb-2">
              <span className="w-2 h-2 rounded-full bg-[#EFF6FF] animate-pulse" />
              Sistem Aktif • Menara Kontrol Terpadu
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              PT IAS SUPPORT — LOGISTICS CONTROL TOWER
            </h1>
            <p className="text-[#EFF6FF]/90 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Selamat datang, <span className="font-semibold text-white">{currentUser?.fullName}</span>. Anda bertindak sebagai{' '}
              <span className="font-bold uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded">{currentUser?.role}</span> untuk wilayah operasional {currentUser?.authorizedLocation}.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setActiveNav('Kartu Stok')}
              className="px-3.5 py-2 rounded-xl bg-white text-[#123B66] hover:bg-[#EFF6FF] font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-1.5"
            >
              <FileText className="w-4 h-4 text-[#1F5FAF]" />
              <span>Buka Kartu Stok</span>
            </button>
            {currentUser?.role !== 'SITE HEAD' && (
              <button
                onClick={() => setActiveNav('Barang Masuk')}
                className="px-3.5 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs sm:text-sm border border-white/30 transition flex items-center gap-1.5"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>Input Masuk</span>
              </button>
            )}
          </div>
        </div>

        {/* Subtle Decorative Aura */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-8 w-64 h-64 rounded-full bg-white/10 blur-2xl pointer-events-none" />
      </div>

      {/* 10 Executive KPI Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* KPI 1: Total SKU Aktif */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-2xs hover:border-[#3182CE] transition group">
          <div className="flex items-center justify-between text-[#64748B] text-xs mb-1.5">
            <span className="font-bold text-[11px] uppercase tracking-wider">Total SKU Aktif</span>
            <div className="p-1.5 rounded-lg bg-[#EFF6FF] text-[#1F5FAF]">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#123B66] font-mono">
            {totalActiveSKUs}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B]">
            Terdaftar di katalog
          </div>
        </div>

        {/* KPI 2: Total Gudang Aktif */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-2xs hover:border-[#3182CE] transition group">
          <div className="flex items-center justify-between text-[#64748B] text-xs mb-1.5">
            <span className="font-bold text-[11px] uppercase tracking-wider">Gudang Aktif</span>
            <div className="p-1.5 rounded-lg bg-[#EFF6FF] text-[#1F5FAF]">
              <Warehouse className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#123B66] font-mono">
            {totalActiveWarehouses}
          </div>
          <div className="mt-1 text-[11px] text-[#64748B]">
            Hub operasional bandara
          </div>
        </div>

        {/* KPI 3: Total Kuantitas Stok Fisik */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-2xs hover:border-[#3182CE] transition group">
          <div className="flex items-center justify-between text-[#64748B] text-xs mb-1.5">
            <span className="font-bold text-[11px] uppercase tracking-wider">Total Fisik Unit</span>
            <div className="p-1.5 rounded-lg bg-[#EFF6FF] text-[#1F5FAF]">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#123B66] font-mono">
            {totalStockQuantity.toLocaleString('id-ID')}
          </div>
          <div className="mt-1 text-[11px] text-[#1F5FAF] font-semibold">
            Saldo stok siap pakai
          </div>
        </div>

        {/* KPI 4: Estimasi Nilai Persediaan */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-2xs hover:border-[#3182CE] transition group">
          <div className="flex items-center justify-between text-[#64748B] text-xs mb-1.5">
            <span className="font-bold text-[11px] uppercase tracking-wider">Nilai Persediaan</span>
            <div className="p-1.5 rounded-lg bg-[#EFF6FF] text-[#1F5FAF]">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-extrabold text-[#123B66] font-mono truncate" title={`Rp ${estimatedValuation.toLocaleString('id-ID')}`}>
            Rp {(estimatedValuation / 1000000).toFixed(1)}Jt
          </div>
          <div className="mt-1 text-[11px] text-[#64748B]">
            Estimasi total aset logistik
          </div>
        </div>

        {/* KPI 5: Barang Masuk Hari Ini */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-2xs hover:border-[#3182CE] transition group">
          <div className="flex items-center justify-between text-[#64748B] text-xs mb-1.5">
            <span className="font-bold text-[11px] uppercase tracking-wider">Masuk Hari Ini</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#123B66] font-mono">
            {todayReceiptsCount} <span className="text-xs font-normal text-[#64748B]">unit</span>
          </div>
          <div className="mt-1 text-[11px] text-[#64748B]">
            {todayReceipts.length} batch dokumen GR
          </div>
        </div>

        {/* KPI 6: Barang Keluar Hari Ini */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-2xs hover:border-[#3182CE] transition group">
          <div className="flex items-center justify-between text-[#64748B] text-xs mb-1.5">
            <span className="font-bold text-[11px] uppercase tracking-wider">Keluar Hari Ini</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700">
              <ArrowUpFromLine className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#123B66] font-mono">
            {todayIssuesCount} <span className="text-xs font-normal text-[#64748B]">unit</span>
          </div>
          <div className="mt-1 text-[11px] text-[#64748B]">
            {todayIssues.length} permintaan unit kerja
          </div>
        </div>

        {/* KPI 7: Stok Kritis (<= Min Stock) */}
        <div
          onClick={() => {
            setSelectedStockStatus('MENIPIS');
            const el = document.getElementById('stock-table-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`p-4 rounded-2xl border transition cursor-pointer group ${
            criticalItems.length > 0
              ? 'bg-amber-50/50 border-amber-200 hover:border-amber-400'
              : 'bg-white border-[#D9E2EF]'
          }`}
        >
          <div className="flex items-center justify-between text-[#64748B] text-xs mb-1.5">
            <span className={`font-bold text-[11px] uppercase tracking-wider ${criticalItems.length > 0 ? 'text-amber-900' : 'text-[#64748B]'}`}>
              Stok Kritis (≤ Min)
            </span>
            <div className={`p-1.5 rounded-lg ${criticalItems.length > 0 ? 'bg-amber-100 text-amber-700 animate-pulse' : 'bg-slate-100 text-[#64748B]'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold font-mono ${criticalItems.length > 0 ? 'text-amber-800' : 'text-[#123B66]'}`}>
            {criticalItems.length}
          </div>
          <div className="mt-1 text-[11px] text-amber-700 font-medium">
            {criticalItems.length > 0 ? 'Perlu tindakan restock segera' : 'Semua item di atas batas'}
          </div>
        </div>

        {/* KPI 8: Stok Kosong (0 Qty) */}
        <div
          onClick={() => {
            setSelectedStockStatus('KOSONG');
            const el = document.getElementById('stock-table-section');
            el?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`p-4 rounded-2xl border transition cursor-pointer group ${
            emptyStockItems.length > 0
              ? 'bg-rose-50/50 border-rose-200 hover:border-rose-400'
              : 'bg-white border-[#D9E2EF]'
          }`}
        >
          <div className="flex items-center justify-between text-[#64748B] text-xs mb-1.5">
            <span className={`font-bold text-[11px] uppercase tracking-wider ${emptyStockItems.length > 0 ? 'text-rose-900' : 'text-[#64748B]'}`}>
              Stok Kosong (0)
            </span>
            <div className={`p-1.5 rounded-lg ${emptyStockItems.length > 0 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-[#64748B]'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold font-mono ${emptyStockItems.length > 0 ? 'text-rose-700' : 'text-[#123B66]'}`}>
            {emptyStockItems.length}
          </div>
          <div className="mt-1 text-[11px] text-rose-600 font-medium">
            {emptyStockItems.length > 0 ? 'Habis total di lokasi' : 'Tidak ada SKU kosong'}
          </div>
        </div>

        {/* KPI 9: Menunggu Approval */}
        <div
          onClick={() => setActiveNav('Approval Center')}
          className={`p-4 rounded-2xl border transition cursor-pointer group ${
            pendingApprovalsCount > 0
              ? 'bg-[#EFF6FF] border-[#3182CE] hover:border-[#1F5FAF]'
              : 'bg-white border-[#D9E2EF]'
          }`}
        >
          <div className="flex items-center justify-between text-[#64748B] text-xs mb-1.5">
            <span className={`font-bold text-[11px] uppercase tracking-wider ${pendingApprovalsCount > 0 ? 'text-[#123B66]' : 'text-[#64748B]'}`}>
              Pending Approval
            </span>
            <div className={`p-1.5 rounded-lg ${pendingApprovalsCount > 0 ? 'bg-blue-100 text-[#1F5FAF]' : 'bg-slate-100 text-[#64748B]'}`}>
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold font-mono ${pendingApprovalsCount > 0 ? 'text-[#1F5FAF]' : 'text-[#123B66]'}`}>
            {pendingApprovalsCount}
          </div>
          <div className="mt-1 text-[11px] text-[#1F5FAF] font-medium flex items-center justify-between">
            <span>Menunggu verifikasi</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
          </div>
        </div>

        {/* KPI 10: Transfer dalam Proses (In Transit) */}
        <div
          onClick={() => setActiveNav('Transfer Stok')}
          className={`p-4 rounded-2xl border transition cursor-pointer group ${
            inTransitTransfersCount > 0
              ? 'bg-indigo-50/60 border-indigo-200 hover:border-indigo-400'
              : 'bg-white border-[#D9E2EF]'
          }`}
        >
          <div className="flex items-center justify-between text-[#64748B] text-xs mb-1.5">
            <span className={`font-bold text-[11px] uppercase tracking-wider ${inTransitTransfersCount > 0 ? 'text-indigo-900' : 'text-[#64748B]'}`}>
              Transfer Transit
            </span>
            <div className={`p-1.5 rounded-lg ${inTransitTransfersCount > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-[#64748B]'}`}>
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold font-mono ${inTransitTransfersCount > 0 ? 'text-indigo-800' : 'text-[#123B66]'}`}>
            {inTransitTransfersCount}
          </div>
          <div className="mt-1 text-[11px] text-indigo-700 font-medium flex items-center justify-between">
            <span>Dalam perjalanan</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
          </div>
        </div>
      </div>

      {/* Main Stock Position Table Section per Section 10 */}
      <div id="stock-table-section" className="bg-white rounded-2xl border border-[#D9E2EF] shadow-2xs overflow-hidden">
        {/* Table Header & Controls Ribbon */}
        <div className="p-5 border-b border-[#D9E2EF] bg-[#F7F9FC]">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-[#1F5FAF]" />
                <h2 className="text-base font-extrabold text-[#123B66]">
                  Tabel Posisi Stok Inventaris Real-Time
                </h2>
              </div>
              <p className="text-xs text-[#64748B] mt-0.5">
                Monitoring saldo per gudang, batas minimum, status ketersediaan, dan kartu stok
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleExportExcel}
                className="px-3 py-1.5 rounded-xl bg-white text-[#123B66] hover:bg-[#EFF6FF] border border-[#D9E2EF] font-bold text-xs shadow-2xs transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 text-[#1F5FAF]" />
                <span>Export Excel</span>
              </button>
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 rounded-xl bg-white text-[#64748B] hover:bg-slate-100 border border-[#D9E2EF] font-semibold text-xs shadow-2xs transition flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari kode, nama, atau gudang..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#D9E2EF] rounded-xl text-xs sm:text-sm font-medium text-[#1F2937] focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF]"
              />
            </div>

            {/* Warehouse Filter */}
            <div className="relative">
              <Warehouse className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
              <select
                value={selectedLocation}
                onChange={(e) => {
                  setSelectedLocation(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#D9E2EF] rounded-xl text-xs sm:text-sm font-medium text-[#1F2937] focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF]"
              >
                <option value="ALL">Semua Gudang ({locations.length})</option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Category Filter */}
            <div>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-[#D9E2EF] rounded-xl text-xs sm:text-sm font-medium text-[#1F2937] focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF]"
              >
                <option value="ALL">Semua Kategori ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={selectedStockStatus}
                onChange={(e) => {
                  setSelectedStockStatus(e.target.value as any);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 bg-white border border-[#D9E2EF] rounded-xl text-xs sm:text-sm font-medium text-[#1F2937] focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF]"
              >
                <option value="ALL">Semua Status Stok</option>
                <option value="NORMAL">Normal (Aman)</option>
                <option value="MENIPIS">Menipis (≤ Min Stock)</option>
                <option value="KOSONG">Kosong (Saldo 0)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[#64748B] border-b border-[#D9E2EF] font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Kode Barang</th>
                <th
                  onClick={() => handleSort('materialName')}
                  className="py-3 px-4 cursor-pointer hover:text-[#123B66] select-none"
                >
                  Nama Barang {sortField === 'materialName' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Gudang</th>
                <th className="py-3 px-4">Satuan</th>
                <th
                  onClick={() => handleSort('availableStock')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-[#123B66] select-none"
                >
                  Saldo Stok {sortField === 'availableStock' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('minimumStock')}
                  className="py-3 px-4 text-right cursor-pointer hover:text-[#123B66] select-none"
                >
                  Stok Min {sortField === 'minimumStock' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9E2EF]">
              {paginatedStock.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#64748B]">
                    <Boxes className="w-8 h-8 text-[#64748B]/40 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-[#1F2937]">Tidak ada data persediaan sesuai filter</p>
                    <p className="text-xs text-[#64748B] mt-1">Coba ubah kata kunci pencarian atau reset filter.</p>
                  </td>
                </tr>
              ) : (
                paginatedStock.map((item) => {
                  const isZero = Number(item.availableStock) <= 0;
                  const isLow = !isZero && item.availableStock <= item.minimumStock;

                  return (
                    <tr key={item.id} className="hover:bg-[#EFF6FF]/40 transition">
                      <td className="py-3 px-4 font-mono font-bold text-[#1F5FAF] whitespace-nowrap">
                        {item.materialCode || item.itemCode}
                      </td>
                      <td className="py-3 px-4 font-semibold text-[#1F2937]">
                        {item.materialName || item.itemName}
                      </td>
                      <td className="py-3 px-4 text-[#64748B] whitespace-nowrap">
                        {item.categoryName || item.categoryId}
                      </td>
                      <td className="py-3 px-4 text-[#1F2937] whitespace-nowrap">
                        {item.locationName}
                      </td>
                      <td className="py-3 px-4 text-[#64748B] font-mono text-xs">
                        {item.unit}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-sm text-[#123B66]">
                        {item.availableStock.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs text-[#64748B]">
                        {item.minimumStock}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            isZero
                              ? 'bg-rose-100 text-rose-800'
                              : isLow
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-[#1F5FAF]'
                          }`}
                        >
                          {isZero ? 'KOSONG' : isLow ? 'MENIPIS' : 'NORMAL'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedDetailItem(item)}
                            className="p-1.5 text-[#64748B] hover:text-[#1F5FAF] hover:bg-[#EFF6FF] rounded-lg transition"
                            title="Detail Posisi Stok"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setActiveNav('Kartu Stok')}
                            className="p-1.5 text-[#1F5FAF] hover:bg-[#EFF6FF] rounded-lg transition"
                            title="Buka Kartu Stok"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-4 border-t border-[#D9E2EF] bg-[#F7F9FC] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-[#64748B]">
            Menampilkan <span className="font-bold text-[#1F2937]">{paginatedStock.length}</span> dari{' '}
            <span className="font-bold text-[#1F2937]">{filteredStockData.length}</span> record stok terdaftar
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-[#D9E2EF] bg-white text-[#64748B] hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-semibold text-[#1F2937] px-2">
              Halaman {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-[#D9E2EF] bg-white text-[#64748B] hover:bg-slate-100 disabled:opacity-40 transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Detail Modal for Item Drill-down */}
      {selectedDetailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#123B66]/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#D9E2EF] space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#D9E2EF] pb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 text-[#1F5FAF]" />
                <h3 className="text-base font-extrabold text-[#123B66]">
                  Detail Posisi Persediaan
                </h3>
              </div>
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="text-[#64748B] hover:text-[#1F2937] text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="grid grid-cols-2 gap-3 p-3 bg-[#F7F9FC] rounded-xl border border-[#D9E2EF]">
                <div>
                  <span className="text-[11px] text-[#64748B] uppercase font-bold block">Kode SKU</span>
                  <span className="font-mono font-extrabold text-[#1F5FAF] text-sm">
                    {selectedDetailItem.materialCode || selectedDetailItem.itemCode}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-[#64748B] uppercase font-bold block">Lokasi Gudang</span>
                  <span className="font-semibold text-[#1F2937]">
                    {selectedDetailItem.locationName}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-[11px] text-[#64748B] uppercase font-bold block">Nama Lengkap Barang</span>
                <span className="font-bold text-[#123B66] text-sm">
                  {selectedDetailItem.materialName || selectedDetailItem.itemName}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold block">Saldo Fisik</span>
                  <span className="text-lg font-mono font-extrabold text-[#123B66]">
                    {selectedDetailItem.availableStock}
                  </span>
                  <span className="text-[10px] text-[#64748B] block">{selectedDetailItem.unit}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-[#D9E2EF]">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold block">Stok Min</span>
                  <span className="text-lg font-mono font-bold text-[#1F2937]">
                    {selectedDetailItem.minimumStock}
                  </span>
                  <span className="text-[10px] text-[#64748B] block">{selectedDetailItem.unit}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-[#D9E2EF]">
                  <span className="text-[10px] text-[#64748B] uppercase font-bold block">ROP</span>
                  <span className="text-lg font-mono font-bold text-[#1F2937]">
                    {selectedDetailItem.reorderPoint}
                  </span>
                  <span className="text-[10px] text-[#64748B] block">{selectedDetailItem.unit}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D9E2EF]">
              <button
                onClick={() => {
                  setSelectedDetailItem(null);
                  setActiveNav('Kartu Stok');
                }}
                className="px-4 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold text-xs shadow-sm transition flex items-center gap-1.5"
              >
                <FileText className="w-4 h-4" />
                <span>Lihat Kartu Stok</span>
              </button>
              <button
                onClick={() => setSelectedDetailItem(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#1F2937] font-semibold text-xs transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
