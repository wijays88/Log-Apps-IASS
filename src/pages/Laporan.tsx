import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileBarChart,
  Download,
  Printer,
  Calendar,
  Filter,
  Boxes,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ClipboardCheck,
  AlertTriangle,
  TrendingUp,
  MapPin,
} from 'lucide-react';
import { PermissionNotice } from '../components/PermissionNotice';

type ReportType =
  | 'CURRENT_INVENTORY'
  | 'GOODS_RECEIPTS'
  | 'GOODS_ISSUES'
  | 'STOCK_TRANSFERS'
  | 'INVENTORY_MOVEMENTS'
  | 'STOCK_OPNAME'
  | 'STOCK_DISCREPANCIES'
  | 'CRITICAL_STOCK'
  | 'CONSUMPTION_TRENDS'
  | 'LOCATION_CONSUMPTION';

export const Laporan: React.FC = () => {
  const {
    items,
    goodsReceipts,
    goodsIssues,
    stockTransfers,
    stockOpnames,
    locations,
    categories,
    currentUser,
  } = useApp();

  const [selectedReport, setSelectedReport] = useState<ReportType>('CURRENT_INVENTORY');
  const [selectedLocation, setSelectedLocation] = useState('ALL');
  const [startDate, setStartDate] = useState('2026-10-01');
  const [endDate, setEndDate] = useState('2026-10-21');

  const reportOptions = [
    { id: 'CURRENT_INVENTORY', name: '1. Posisi Persediaan Terkini (Current Inventory)', icon: Boxes },
    { id: 'GOODS_RECEIPTS', name: '2. Rekap Penerimaan Barang (Goods Receipts)', icon: ArrowDownToLine },
    { id: 'GOODS_ISSUES', name: '3. Rekap Pengeluaran Barang (Goods Issues)', icon: ArrowUpFromLine },
    { id: 'STOCK_TRANSFERS', name: '4. Mutasi Transfer Antar Gudang', icon: ArrowLeftRight },
    { id: 'INVENTORY_MOVEMENTS', name: '5. Arus Mutasi Inventaris (All Movements)', icon: TrendingUp },
    { id: 'STOCK_OPNAME', name: '6. Berita Acara Stock Opname', icon: ClipboardCheck },
    { id: 'STOCK_DISCREPANCIES', name: '7. Analisis Selisih Opname (Discrepancies)', icon: AlertTriangle },
    { id: 'CRITICAL_STOCK', name: '8. Laporan Stok Kritis & Warning ROP', icon: AlertTriangle },
    { id: 'CONSUMPTION_TRENDS', name: '9. Tren Konsumsi & Permintaan Barang', icon: TrendingUp },
    { id: 'LOCATION_CONSUMPTION', name: '10. Distribusi Konsumsi per Lokasi', icon: MapPin },
  ];

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `PT_IAS_${selectedReport}_${new Date().toISOString().slice(0, 10)}.csv`;

    if (selectedReport === 'CURRENT_INVENTORY') {
      headers = ['Kode Item', 'Nama Item', 'Kategori', 'Satuan', 'Gudang', 'Stok Tersedia', 'Stok Min', 'ROP', 'Nilai Estimasi'];
      rows = items.map((i) => [
        `"${i.itemCode}"`,
        `"${i.itemName}"`,
        `"${i.categoryName}"`,
        `"${i.unit}"`,
        `"${i.locationName}"`,
        i.availableStock,
        i.minimumStock,
        i.reorderPoint,
        (i.unitCost || 0) * i.availableStock,
      ]);
    } else if (selectedReport === 'GOODS_RECEIPTS') {
      headers = ['No Penerimaan', 'Tanggal', 'Pemasok', 'Dokumen Ref', 'Nama Item', 'Qty', 'Satuan', 'Lokasi', 'Petugas'];
      rows = goodsReceipts.map((r) => [
        `"${r.receiptNumber}"`,
        `"${r.receiptDate}"`,
        `"${r.sourceSupplier}"`,
        `"${r.referenceDocument}"`,
        `"${r.itemName}"`,
        r.quantity,
        `"${r.unit}"`,
        `"${r.destinationLocationName}"`,
        `"${r.recordedBy}"`,
      ]);
    } else if (selectedReport === 'GOODS_ISSUES') {
      headers = ['No Pengeluaran', 'Tanggal', 'Unit Pemohon', 'Tujuan', 'Item', 'Qty Diminta', 'Qty Disetujui', 'Status', 'Petugas'];
      rows = goodsIssues.map((g) => [
        `"${g.issueNumber}"`,
        `"${g.requestDate}"`,
        `"${g.requestingUnit}"`,
        `"${g.destination}"`,
        `"${g.itemName}"`,
        g.requestedQuantity,
        g.approvedQuantity,
        `"${g.status}"`,
        `"${g.requestedBy}"`,
      ]);
    } else if (selectedReport === 'STOCK_TRANSFERS') {
      headers = ['No Transfer', 'Tanggal', 'Unit Inisiator', 'Gudang Asal', 'Gudang Tujuan', 'Item', 'Kuantitas', 'Satuan', 'Status', 'Petugas'];
      rows = stockTransfers.map((t) => [
        `"${t.transferNumber}"`,
        `"${t.requestDate}"`,
        `"${t.requestingUnit || '-'}"`,
        `"${t.originLocationName}"`,
        `"${t.destinationLocationName}"`,
        `"${t.itemName}"`,
        t.quantity,
        `"${t.unit}"`,
        `"${t.status}"`,
        `"${t.requestingUser}"`,
      ]);
    } else {
      headers = ['Kode/No', 'Keterangan', 'Lokasi', 'Tanggal'];
      rows = items.map((i) => [`"${i.itemCode}"`, `"${i.itemName}"`, `"${i.locationName}"`, `"${i.lastTransactionDate}"`]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <PermissionNotice moduleName="Laporan Operasional" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Pusat Laporan & Analitika Logistik
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
              10 Format Laporan
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Ekspor data dan audit transparansi persediaan seluruh hub PT IAS Support
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs sm:text-sm shadow-2xs transition flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Cetak Dokumen</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 rounded-xl bg-[#1F5FAF] hover:bg-[#123B66] text-white font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-1.5"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector & Filters */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-4 no-print">
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1.5 uppercase tracking-wider">
            Pilih Format Laporan Operasional
          </label>
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value as ReportType)}
            className="w-full px-3 py-2 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] font-semibold text-slate-800 bg-white"
          >
            {reportOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
          <div>
            <label className="text-slate-500 block mb-1 font-medium">Filter Lokasi Gudang</label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white"
            >
              <option value="ALL">Semua Hub / Gudang</option>
              {locations.map((l) => (
                <option key={l.id} value={l.name}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-slate-500 block mb-1 font-medium">Periode Mulai</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
            />
          </div>

          <div>
            <label className="text-slate-500 block mb-1 font-medium">Periode Sampai</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#064e3b]"
            />
          </div>
        </div>
      </div>

      {/* Printable Report Paper Preview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 print:border-none print:shadow-none print:p-0">
        {/* Report Official Letterhead */}
        <div className="border-b-2 border-[#064e3b] pb-4 mb-6 flex items-start justify-between">
          <div>
            <div className="text-base font-extrabold text-slate-900 tracking-tight">
              PT IAS SUPPORT
            </div>
            <div className="text-xs font-bold text-emerald-800 uppercase tracking-widest">
              LOGISTICS CONTROL TOWER • DIVISI LOGISTIK & PERGUDANGAN
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Kawasan Pergudangan Bandara Soekarno-Hatta • Dokumen Resmi Pengawasan
            </div>
          </div>
          <div className="text-right text-xs">
            <div className="font-bold text-slate-800">
              {reportOptions.find((r) => r.id === selectedReport)?.name}
            </div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5">
              Dicetak: {new Date().toISOString().slice(0, 10)} WIB oleh {currentUser?.fullName}
            </div>
            <div className="text-[10px] text-slate-400">
              Lokasi: {selectedLocation} | Periode: {startDate} s/d {endDate}
            </div>
          </div>
        </div>

        {/* Report Content Dynamic Table based on report selection */}
        {selectedReport === 'CURRENT_INVENTORY' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Kode SKU</th>
                  <th className="py-2.5 px-3">Nama Barang</th>
                  <th className="py-2.5 px-3">Kategori</th>
                  <th className="py-2.5 px-3">Satuan</th>
                  <th className="py-2.5 px-3">Lokasi</th>
                  <th className="py-2.5 px-3 text-right">Stok Fisik</th>
                  <th className="py-2.5 px-3 text-center">Batas Min</th>
                  <th className="py-2.5 px-3 text-right">Nilai Total Estimasi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Belum ada data saldo stok inventaris yang terdaftar.
                    </td>
                  </tr>
                ) : (
                  items.map((it) => (
                    <tr key={it.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-slate-800">{it.itemCode}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{it.itemName}</td>
                      <td className="py-2 px-3 text-slate-600">{it.categoryName}</td>
                      <td className="py-2 px-3 text-slate-600">{it.unit}</td>
                      <td className="py-2 px-3 text-slate-700">{it.locationName}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                        {it.availableStock}
                      </td>
                      <td className="py-2 px-3 text-center font-mono text-slate-600">{it.minimumStock}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-800">
                        Rp {((it.unitCost || 0) * it.availableStock).toLocaleString('id-ID')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'GOODS_RECEIPTS' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">No Receipt</th>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Pemasok</th>
                  <th className="py-2.5 px-3">No Dokumen Referensi</th>
                  <th className="py-2.5 px-3">Nama Barang</th>
                  <th className="py-2.5 px-3 text-right">Kuantitas</th>
                  <th className="py-2.5 px-3">Lokasi Tujuan</th>
                  <th className="py-2.5 px-3">Pencatat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {goodsReceipts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Belum ada transaksi penerimaan barang dalam periode ini.
                    </td>
                  </tr>
                ) : (
                  goodsReceipts.map((gr) => (
                    <tr key={gr.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-emerald-900">{gr.receiptNumber}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{gr.receiptDate}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{gr.sourceSupplier}</td>
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{gr.referenceDocument}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{gr.itemName}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                        +{gr.quantity} {gr.unit}
                      </td>
                      <td className="py-2 px-3 text-slate-700">{gr.destinationLocationName}</td>
                      <td className="py-2 px-3 text-slate-600">{gr.recordedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'GOODS_ISSUES' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">No Issue</th>
                  <th className="py-2.5 px-3">Tanggal</th>
                  <th className="py-2.5 px-3">Unit Pemohon</th>
                  <th className="py-2.5 px-3">Tujuan Penggunaan</th>
                  <th className="py-2.5 px-3">Nama Barang</th>
                  <th className="py-2.5 px-3 text-right">Req Qty</th>
                  <th className="py-2.5 px-3 text-right">App Qty</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Diproses Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {goodsIssues.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-400">
                      Belum ada transaksi pengeluaran barang dalam periode ini.
                    </td>
                  </tr>
                ) : (
                  goodsIssues.map((gi) => (
                    <tr key={gi.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-indigo-900">{gi.issueNumber}</td>
                      <td className="py-2 px-3 font-mono text-slate-600">{gi.requestDate}</td>
                      <td className="py-2 px-3 font-semibold text-slate-800">{gi.requestingUnit}</td>
                      <td className="py-2 px-3 text-slate-700">{gi.destination}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{gi.itemName}</td>
                      <td className="py-2 px-3 text-right font-mono">{gi.requestedQuantity} {gi.unit}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                        {gi.status === 'APPROVED' ? `${gi.approvedQuantity} ${gi.unit}` : '-'}
                      </td>
                      <td className="py-2 px-3 text-center font-bold text-[10px]">{gi.status}</td>
                      <td className="py-2 px-3 text-slate-600">{gi.processedBy || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {selectedReport === 'CRITICAL_STOCK' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">SKU</th>
                  <th className="py-2.5 px-3">Nama Barang</th>
                  <th className="py-2.5 px-3">Gudang</th>
                  <th className="py-2.5 px-3 text-right">Stok Fisik</th>
                  <th className="py-2.5 px-3 text-center">Min</th>
                  <th className="py-2.5 px-3 text-center">ROP</th>
                  <th className="py-2.5 px-3 text-center">Tingkat Bahaya</th>
                  <th className="py-2.5 px-3">Rekomendasi Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {items.filter((it) => it.availableStock <= it.reorderPoint).length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      Tidak ada material yang mencapai batas kritis atau titik pemesanan ulang (ROP).
                    </td>
                  </tr>
                ) : (
                  items
                    .filter((it) => it.availableStock <= it.reorderPoint)
                    .map((it) => {
                      const isCritical = it.availableStock <= it.minimumStock;
                      return (
                        <tr key={it.id} className="hover:bg-slate-50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-800">{it.itemCode}</td>
                          <td className="py-2 px-3 font-bold text-slate-900">{it.itemName}</td>
                          <td className="py-2 px-3 text-slate-700">{it.locationName}</td>
                          <td className={`py-2 px-3 text-right font-mono font-extrabold ${isCritical ? 'text-rose-700' : 'text-amber-700'}`}>
                            {it.availableStock} {it.unit}
                          </td>
                          <td className="py-2 px-3 text-center font-mono">{it.minimumStock}</td>
                          <td className="py-2 px-3 text-center font-mono">{it.reorderPoint}</td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                isCritical ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {isCritical ? 'KRITIS TINGGI' : 'MENIPIS (ROP)'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-slate-700 text-[11px]">
                            Segera terbitkan Purchase Order penambahan stok minimum {it.reorderPoint * 2} {it.unit}.
                          </td>
                        </tr>
                      );
                    })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Generic Table Fallback for other reports */}
        {!['CURRENT_INVENTORY', 'GOODS_RECEIPTS', 'GOODS_ISSUES', 'CRITICAL_STOCK'].includes(selectedReport) && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/80 border-b border-slate-300 text-slate-700 font-bold uppercase text-[10px]">
                  <th className="py-2.5 px-3">Identitas / No Transaksi</th>
                  <th className="py-2.5 px-3">Keterangan Aktivitas</th>
                  <th className="py-2.5 px-3">Gudang / Lokasi</th>
                  <th className="py-2.5 px-3 text-right">Kuantitas</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {stockTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-10 text-center text-slate-400">
                      Belum ada pergerakan transfer stok antar gudang.
                    </td>
                  </tr>
                ) : (
                  stockTransfers.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-bold text-blue-900">{st.transferNumber}</td>
                      <td className="py-2 px-3 text-slate-800">Transfer: {st.itemName} ({st.originLocationName} → {st.destinationLocationName})</td>
                      <td className="py-2 px-3 text-slate-600">{st.destinationLocationName}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{st.quantity} {st.unit}</td>
                      <td className="py-2 px-3 text-center font-bold text-[10px]">{st.status}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{st.requestDate}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Report Footer & Signature Block */}
        <div className="mt-12 pt-6 border-t border-slate-200 grid grid-cols-3 gap-6 text-center text-xs">
          <div>
            <p className="text-slate-500 text-[11px]">Dibuat Oleh Petugas:</p>
            <div className="h-16 flex items-end justify-center font-bold text-slate-800">
              {currentUser?.fullName}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">ID: {currentUser?.employeeId} ({currentUser?.role})</p>
          </div>
          <div>
            <p className="text-slate-500 text-[11px]">Diverifikasi Site Head:</p>
            <div className="h-16 flex items-end justify-center font-bold text-slate-800">
              ( ........................................ )
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Site Head Operasional</p>
          </div>
          <div>
            <p className="text-slate-500 text-[11px]">Disetujui Administrator:</p>
            <div className="h-16 flex items-end justify-center font-bold text-slate-800">
              ( ........................................ )
            </div>
            <p className="text-[10px] text-slate-400 font-mono">Administrator PT IAS Support</p>
          </div>
        </div>
      </div>
    </div>
  );
};
