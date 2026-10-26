import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Package,
  Boxes,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Clock,
  Warehouse,
  TrendingUp,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react';

export const Dashboard: React.FC = () => {
  const {
    items,
    goodsReceipts,
    goodsIssues,
    stockTransfers,
    approvals,
    locations,
    setActiveNav,
    currentUser,
  } = useApp();

  // Metrics calculation
  const totalActiveSKUs = items.length;
  const totalInventoryCount = items.reduce((acc, curr) => acc + curr.availableStock, 0);

  // Critical stock items: availableStock <= minimumStock
  const criticalItems = items.filter((item) => item.availableStock <= item.minimumStock);
  const lowStockItems = items.filter(
    (item) => item.availableStock > item.minimumStock && item.availableStock <= item.reorderPoint
  );

  // Today's receipts & issues calculated dynamically from current date
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayReceipts = goodsReceipts.filter((gr) => gr.receiptDate?.startsWith(todayStr) || gr.createdAt?.startsWith(todayStr));
  const todayReceiptsCount = todayReceipts.reduce((sum, r) => sum + r.quantity, 0);

  const todayIssues = goodsIssues.filter((gi) => gi.requestDate?.startsWith(todayStr) || gi.createdAt?.startsWith(todayStr));
  const todayIssuesCount = todayIssues.reduce((sum, i) => sum + i.requestedQuantity, 0);

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;
  const inTransitTransfersCount = stockTransfers.filter((t) => t.status === 'IN_TRANSIT').length;

  // Stock distribution by location
  const locationStats = locations.map((loc) => {
    const locItems = items.filter((i) => i.locationId === loc.id);
    const totalQty = locItems.reduce((acc, curr) => acc + curr.availableStock, 0);
    const skuCount = locItems.length;
    return {
      ...loc,
      totalQty,
      skuCount,
    };
  });

  return (
    <div className="space-y-6">
      {/* Top Banner & Welcome */}
      <div className="bg-gradient-to-r from-[#064e3b] via-[#065f46] to-[#047857] rounded-2xl p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 text-xs font-semibold backdrop-blur-xs mb-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Sistem Aktif • Menara Kontrol Terpadu
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              PT IAS SUPPORT — LOGISTICS CONTROL TOWER
            </h1>
            <p className="text-emerald-100 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Selamat datang, <span className="font-semibold text-white">{currentUser?.fullName}</span>. Anda saat ini bertindak sebagai <span className="font-bold underline uppercase">{currentUser?.role}</span> untuk wilayah operasional {currentUser?.authorizedLocation}.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setActiveNav('Posisi Persediaan')}
              className="px-3.5 py-2 rounded-xl bg-white text-[#064e3b] hover:bg-emerald-50 font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-1.5"
            >
              <Boxes className="w-4 h-4" />
              <span>Cek Stok Barang</span>
            </button>
            {currentUser?.role !== 'SITE HEAD' && (
              <button
                onClick={() => setActiveNav('Barang Masuk')}
                className="px-3.5 py-2 rounded-xl bg-emerald-700/80 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm border border-emerald-500/50 shadow-sm transition flex items-center gap-1.5"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>Input Masuk</span>
              </button>
            )}
          </div>
        </div>

        {/* Decorative background element */}
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-8 w-64 h-64 rounded-full bg-emerald-400/10 blur-2xl pointer-events-none" />
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 sm:gap-4">
        {/* Card 1: Total SKUs */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition group">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium">Total SKU Aktif</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-[#064e3b] group-hover:bg-[#064e3b] group-hover:text-white transition">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {totalActiveSKUs}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
            <span>Tersebar di {locations.length} gudang</span>
          </div>
        </div>

        {/* Card 2: Total Inventory Count */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition group">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium">Total Fisik Unit</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-600 group-hover:text-white transition">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {totalInventoryCount.toLocaleString('id-ID')}
          </div>
          <div className="mt-1 text-[11px] text-emerald-600 font-semibold flex items-center gap-0.5">
            <TrendingUp className="w-3 h-3" />
            <span>Persediaan siap pakai</span>
          </div>
        </div>

        {/* Card 3: Critical Stock Alert */}
        <div
          onClick={() => setActiveNav('Posisi Persediaan')}
          className={`p-4 rounded-xl border transition cursor-pointer group ${
            criticalItems.length > 0
              ? 'bg-rose-50/50 border-rose-200 hover:border-rose-300'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className={`font-semibold ${criticalItems.length > 0 ? 'text-rose-800' : 'text-slate-500'}`}>
              Stok Kritis (≤ Min)
            </span>
            <div className={`p-1.5 rounded-lg ${criticalItems.length > 0 ? 'bg-rose-100 text-rose-700 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold tracking-tight ${criticalItems.length > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
            {criticalItems.length}
          </div>
          <div className="mt-1 text-[11px] text-rose-600 font-medium">
            {criticalItems.length > 0 ? 'Perlu tindakan restock segera' : 'Semua item di atas batas'}
          </div>
        </div>

        {/* Card 4: Goods Receipts */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition group">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium">Penerimaan Hari Ini</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {todayReceiptsCount} <span className="text-xs font-normal text-slate-500">unit</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {todayReceipts.length} batch dokumen masuk
          </div>
        </div>

        {/* Card 5: Goods Issues */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs hover:border-emerald-300 transition group">
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className="font-medium">Pengeluaran Hari Ini</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition">
              <ArrowUpFromLine className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-slate-900 tracking-tight">
            {todayIssuesCount} <span className="text-xs font-normal text-slate-500">unit</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            {todayIssues.length} permintaan operasional
          </div>
        </div>

        {/* Card 6: Pending Transactions */}
        <div
          onClick={() => setActiveNav('Approval Center')}
          className={`p-4 rounded-xl border transition cursor-pointer group ${
            pendingApprovalsCount > 0
              ? 'bg-amber-50/60 border-amber-300 hover:border-amber-400'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-slate-500 text-xs mb-2">
            <span className={`font-semibold ${pendingApprovalsCount > 0 ? 'text-amber-900' : 'text-slate-500'}`}>
              Pending Approval
            </span>
            <div className={`p-1.5 rounded-lg ${pendingApprovalsCount > 0 ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-600'}`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-extrabold tracking-tight ${pendingApprovalsCount > 0 ? 'text-amber-800' : 'text-slate-900'}`}>
            {pendingApprovalsCount}
          </div>
          <div className="mt-1 text-[11px] text-amber-700 font-medium flex items-center justify-between">
            <span>Menunggu otorisasi</span>
            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
          </div>
        </div>
      </div>

      {/* Two Column Layout: Critical Stock Attention & Stock by Location */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Critical & Low Stock Monitoring */}
        <div className="lg:col-span-2 space-y-6">
          {/* Critical Stock Alert Box */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Indikator Stok Kritis & Perlu Pemesanan Ulang
                  </h3>
                  <p className="text-xs text-slate-500">
                    Item dengan saldo persediaan berada di bawah batas minimum (ROP)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveNav('Posisi Persediaan')}
                className="text-xs font-semibold text-[#064e3b] hover:underline flex items-center gap-1"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 overflow-x-auto">
              {[...criticalItems, ...lowStockItems].length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  Semua persediaan berada pada batas aman operasional.
                </div>
              ) : (
                [...criticalItems, ...lowStockItems].map((item) => {
                  const isCritical = item.availableStock <= item.minimumStock;
                  return (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/80 transition"
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={`mt-0.5 px-2 py-0.5 rounded text-[11px] font-bold uppercase shrink-0 ${
                            isCritical
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {isCritical ? 'KRITIS' : 'MENIPIS'}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-900 leading-snug">
                            {item.itemName}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            SKU: {item.itemCode} • Lokasi: {item.locationName}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 sm:text-right shrink-0">
                        <div>
                          <div className="text-xs text-slate-500">Sisa Stok Fisik</div>
                          <div className={`text-sm font-extrabold font-mono ${isCritical ? 'text-rose-600' : 'text-amber-700'}`}>
                            {item.availableStock} {item.unit}
                          </div>
                        </div>
                        <div className="border-l border-slate-200 pl-4 text-xs text-slate-500">
                          <div>Min: <span className="font-semibold text-slate-700">{item.minimumStock}</span></div>
                          <div>ROP: <span className="font-semibold text-slate-700">{item.reorderPoint}</span></div>
                        </div>
                        {currentUser?.role !== 'SITE HEAD' && (
                          <button
                            onClick={() => setActiveNav('Barang Masuk')}
                            className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-[#064e3b] hover:bg-emerald-100 border border-emerald-200 transition"
                          >
                            Restock
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Recent Operational Movements (Barang Masuk, Keluar, Transfer) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Aktivitas Transaksi Inventaris Terkini
                  </h3>
                  <p className="text-xs text-slate-500">
                    Jurnal mutasi masuk, keluar, dan transfer terdaftar
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveNav('Audit Trail')}
                className="text-xs font-semibold text-[#064e3b] hover:underline flex items-center gap-1"
              >
                <span>Audit Lengkap</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {/* Combine top recent records or show empty state */}
              {goodsReceipts.length === 0 && goodsIssues.length === 0 && stockTransfers.length === 0 && (
                <div className="p-8 text-center text-slate-400">
                  <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600 text-xs">Belum ada transaksi inventaris tercatat</p>
                  <p className="text-[11px] text-slate-400 mt-1">Transaksi penerimaan barang, pengeluaran, atau transfer akan otomatis tampil di sini.</p>
                </div>
              )}

              {goodsReceipts.slice(0, 2).map((gr) => (
                <div key={gr.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-100 text-emerald-800 shrink-0">
                      <ArrowDownToLine className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        Penerimaan Barang: {gr.itemName} (+{gr.quantity} {gr.unit})
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Ref: {gr.receiptNumber} • Supplier: {gr.sourceSupplier} • Petugas: {gr.recordedBy}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      POSTED
                    </span>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      {gr.receiptDate}
                    </div>
                  </div>
                </div>
              ))}

              {goodsIssues.slice(0, 2).map((gi) => (
                <div key={gi.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100 text-indigo-800 shrink-0">
                      <ArrowUpFromLine className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        Pengeluaran: {gi.itemName} ({gi.requestedQuantity} {gi.unit})
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Dokumen: {gi.issueNumber} • Pemohon: {gi.requestingUnit} ({gi.requestedBy})
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        gi.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : gi.status === 'REJECTED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {gi.status}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      {gi.requestDate}
                    </div>
                  </div>
                </div>
              ))}

              {stockTransfers.slice(0, 1).map((tr) => (
                <div key={tr.id} className="p-4 flex items-center justify-between text-xs hover:bg-slate-50 transition">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-100 text-purple-800 shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        Transfer Antar Gudang: {tr.itemName} ({tr.quantity} {tr.unit})
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {tr.originLocationName} → {tr.destinationLocationName} • No: {tr.transferNumber}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        tr.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : tr.status === 'IN_TRANSIT'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {tr.status}
                    </span>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      {tr.requestDate}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Location Breakdown & Control Tower Summary */}
        <div className="space-y-6">
          {/* Distribution by Warehouse */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-[#064e3b]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Distribusi Stok per Lokasi
                </h3>
              </div>
              <span className="text-[11px] text-slate-500">PT IAS Support</span>
            </div>

            <div className="space-y-4">
              {locationStats.length === 0 ? (
                <div className="py-6 text-center text-slate-400">
                  <Warehouse className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  <p className="font-semibold text-slate-600 text-xs">Belum ada lokasi gudang terdaftar</p>
                  <p className="text-[11px] text-slate-400 mt-1">Tambahkan lokasi baru melalui menu Master Lokasi.</p>
                </div>
              ) : (
                locationStats.map((loc) => {
                  const percentage = totalInventoryCount > 0 ? Math.round((loc.totalQty / totalInventoryCount) * 100) : 0;
                  return (
                    <div key={loc.id} className="text-xs">
                      <div className="flex items-center justify-between font-semibold text-slate-800 mb-1">
                        <span className="truncate pr-2">{loc.name}</span>
                        <span className="font-mono text-[#064e3b] shrink-0">
                          {loc.totalQty.toLocaleString('id-ID')} unit ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#064e3b] transition-all duration-500"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1 font-mono">
                        <span>PIC: {loc.picName}</span>
                        <span>{loc.skuCount} SKU terdaftar</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <button
                onClick={() => setActiveNav('Transfer Stok')}
                className="w-full py-2 px-3 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 transition flex items-center justify-center gap-1.5"
              >
                <span>Kelola Transfer Antar Gudang</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Operations Summary */}
          <div className="bg-slate-900 text-slate-100 rounded-xl p-5 shadow-sm">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-2">
              Protokol Tata Kelola PT IAS Support
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              Sistem menara kontrol menerapkan pencegahan saldo negatif otomatis. Setiap mutasi fisik wajib didokumentasikan dan diverifikasi oleh Administrator sebelum pengeluaran stok diproses.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
              <span>Timezone: Asia/Jakarta (WIB)</span>
              <span className="text-emerald-400 font-semibold">Strict RBAC</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
