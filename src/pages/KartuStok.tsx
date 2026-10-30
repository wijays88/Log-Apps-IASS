import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileText,
  Search,
  Filter,
  Download,
  Calendar,
  Warehouse,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Printer,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { exportToExcelFile, exportToCsvFile } from '../utils/excelUtils';

interface StockLedgerRow {
  id: string;
  date: string;
  transactionNumber: string;
  type: 'BARANG_MASUK' | 'BARANG_KELUAR' | 'TRANSFER_MASUK' | 'TRANSFER_KELUAR' | 'OPNAME_ADJUSTMENT' | 'SALDO_AWAL';
  typeLabel: string;
  referenceDoc: string;
  originDest: string;
  qtyIn: number;
  qtyOut: number;
  runningBalance: number;
  actor: string;
  notes: string;
  status: string;
}

export const KartuStok: React.FC = () => {
  const {
    items,
    activeMaterials,
    activeLocations,
    goodsReceipts,
    goodsIssues,
    stockTransfers,
    stockOpnames,
    currentUser,
    setActiveNav,
  } = useApp();

  // Filters
  const [selectedLocationId, setSelectedLocationId] = useState<string>(activeLocations[0]?.id || '');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(activeMaterials[0]?.id || '');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [searchDoc, setSearchDoc] = useState<string>('');

  // Selected Material & Location Objects
  const currentMaterial = useMemo(
    () => activeMaterials.find((m) => m.id === selectedMaterialId || m.materialId === selectedMaterialId) || activeMaterials[0],
    [activeMaterials, selectedMaterialId]
  );

  const currentLocation = useMemo(
    () => activeLocations.find((l) => l.id === selectedLocationId) || activeLocations[0],
    [activeLocations, selectedLocationId]
  );

  // Live Inventory balance in this warehouse for this material
  const liveInventoryBalance = useMemo(() => {
    if (!currentMaterial || !currentLocation) return 0;
    const inv = items.find(
      (i) =>
        (i.materialId === currentMaterial.id || i.itemId === currentMaterial.id || i.materialCode === (currentMaterial.materialCode || currentMaterial.itemCode)) &&
        i.locationId === currentLocation.id
    );
    return inv ? inv.availableStock : 0;
  }, [items, currentMaterial, currentLocation]);

  // Build the complete Chronological Mutation Ledger
  const ledgerData = useMemo(() => {
    if (!currentMaterial || !currentLocation) return [];

    const matId = currentMaterial.id;
    const matCode = currentMaterial.materialCode || currentMaterial.itemCode || '';
    const locId = currentLocation.id;

    const allEvents: {
      date: string;
      createdAt: string;
      refNum: string;
      type: StockLedgerRow['type'];
      typeLabel: string;
      refDoc: string;
      originDest: string;
      qtyIn: number;
      qtyOut: number;
      actor: string;
      notes: string;
      status: string;
    }[] = [];

    // 1. Goods Receipts (Barang Masuk) to this location
    goodsReceipts.forEach((gr) => {
      const matchMat = gr.itemId === matId || gr.itemCode === matCode;
      const matchLoc = gr.destinationLocationId === locId;
      if (matchMat && matchLoc) {
        allEvents.push({
          date: gr.receiptDate || gr.createdAt.slice(0, 10),
          createdAt: gr.createdAt || gr.receiptDate,
          refNum: gr.receiptNumber,
          type: 'BARANG_MASUK',
          typeLabel: 'Barang Masuk (GR)',
          refDoc: gr.referenceDocument || '-',
          originDest: `Dari: ${gr.sourceSupplier || 'Supplier'}`,
          qtyIn: gr.quantity,
          qtyOut: 0,
          actor: gr.recordedBy || 'Petugas Gudang',
          notes: gr.notes || 'Penerimaan barang dari supplier',
          status: 'POSTED',
        });
      }
    });

    // 2. Approved Goods Issues (Barang Keluar) from this location
    goodsIssues.forEach((gi) => {
      const matchMat = gi.itemId === matId || gi.itemCode === matCode;
      const matchLoc = !gi.locationId || gi.locationId === locId;
      const isApproved = gi.status === 'APPROVED';

      if (matchMat && matchLoc && isApproved) {
        const qty = gi.approvedQuantity ?? gi.requestedQuantity;
        allEvents.push({
          date: gi.approvedAt ? gi.approvedAt.slice(0, 10) : gi.requestDate || gi.createdAt.slice(0, 10),
          createdAt: gi.approvedAt || gi.createdAt,
          refNum: gi.issueNumber,
          type: 'BARANG_KELUAR',
          typeLabel: 'Barang Keluar (GI)',
          refDoc: gi.requesterUnitId || gi.requestingUnit || 'Unit Kerja',
          originDest: `Tujuan: ${gi.destination || gi.requestingUnit}`,
          qtyIn: 0,
          qtyOut: qty,
          actor: gi.requestedBy || 'Pemohon',
          notes: gi.purpose || gi.notes || 'Pengeluaran operasional',
          status: gi.status,
        });
      }
    });

    // 3. Stock Transfers (Transfer Stok) - Outbound and Inbound
    stockTransfers.forEach((tr) => {
      const matchMat = tr.itemId === matId || tr.itemCode === matCode;
      if (!matchMat) return;

      // Transfer Out from this location (dispatched or completed)
      if (tr.originLocationId === locId && (tr.status === 'IN_TRANSIT' || tr.status === 'COMPLETED')) {
        allEvents.push({
          date: tr.dispatchedAt ? tr.dispatchedAt.slice(0, 10) : tr.requestDate || tr.createdAt.slice(0, 10),
          createdAt: tr.dispatchedAt || tr.createdAt,
          refNum: tr.transferNumber,
          type: 'TRANSFER_KELUAR',
          typeLabel: 'Transfer Keluar (TR-OUT)',
          refDoc: tr.transferNumber,
          originDest: `Ke: ${tr.destinationLocationName}`,
          qtyIn: 0,
          qtyOut: tr.quantity,
          actor: tr.sendingUser || tr.requestingUser,
          notes: tr.notes || 'Transfer antar gudang',
          status: tr.status,
        });
      }

      // Transfer In to this location (completed only)
      if (tr.destinationLocationId === locId && tr.status === 'COMPLETED') {
        allEvents.push({
          date: tr.receivedAt ? tr.receivedAt.slice(0, 10) : tr.createdAt.slice(0, 10),
          createdAt: tr.receivedAt || tr.createdAt,
          refNum: tr.transferNumber,
          type: 'TRANSFER_MASUK',
          typeLabel: 'Transfer Masuk (TR-IN)',
          refDoc: tr.transferNumber,
          originDest: `Dari: ${tr.originLocationName}`,
          qtyIn: tr.quantity,
          qtyOut: 0,
          actor: tr.receivingUser || 'Penerima',
          notes: tr.notes || 'Penerimaan transfer',
          status: 'COMPLETED',
        });
      }
    });

    // 4. Stock Opname Adjustments (Adjusted only)
    stockOpnames.forEach((so) => {
      const matchMat = so.itemId === matId || so.itemCode === matCode;
      const matchLoc = so.locationId === locId;
      const isAdjusted = so.verificationStatus === 'ADJUSTED';

      if (matchMat && matchLoc && isAdjusted) {
        const variance = so.variance; // physical - system
        allEvents.push({
          date: so.adjustedAt ? so.adjustedAt.slice(0, 10) : so.opnameDate || so.createdAt.slice(0, 10),
          createdAt: so.adjustedAt || so.createdAt,
          refNum: so.opnameNumber,
          type: 'OPNAME_ADJUSTMENT',
          typeLabel: variance >= 0 ? 'Opname Surplus (+)' : 'Opname Defisit (-)',
          refDoc: `Fisik: ${so.physicalQuantity} (Selisih: ${variance > 0 ? '+' : ''}${variance})`,
          originDest: `Lokasi: ${so.locationName}`,
          qtyIn: variance > 0 ? variance : 0,
          qtyOut: variance < 0 ? Math.abs(variance) : 0,
          actor: so.conductedBy || 'Petugas Opname',
          notes: so.varianceReason || so.notes || 'Penyesuaian hasil stock opname',
          status: 'ADJUSTED',
        });
      }
    });

    // Sort strictly chronological ascending
    allEvents.sort((a, b) => {
      const cmp = a.date.localeCompare(b.date);
      if (cmp !== 0) return cmp;
      return a.createdAt.localeCompare(b.createdAt);
    });

    // Calculate running balance starting from 0 or initial reference
    let running = 0;
    const ledgerWithBalances: StockLedgerRow[] = allEvents.map((evt, idx) => {
      running += evt.qtyIn - evt.qtyOut;
      return {
        id: `row-${idx}-${evt.refNum}`,
        date: evt.date,
        transactionNumber: evt.refNum,
        type: evt.type,
        typeLabel: evt.typeLabel,
        referenceDoc: evt.refDoc,
        originDest: evt.originDest,
        qtyIn: evt.qtyIn,
        qtyOut: evt.qtyOut,
        runningBalance: running,
        actor: evt.actor,
        notes: evt.notes,
        status: evt.status,
      };
    });

    return ledgerWithBalances;
  }, [currentMaterial, currentLocation, goodsReceipts, goodsIssues, stockTransfers, stockOpnames]);

  // Apply Date and Search Filters
  const filteredLedger = useMemo(() => {
    return ledgerData.filter((row) => {
      const matchDate = (!startDate || row.date >= startDate) && (!endDate || row.date <= endDate);
      const matchSearch =
        !searchDoc ||
        row.transactionNumber.toLowerCase().includes(searchDoc.toLowerCase()) ||
        row.referenceDoc.toLowerCase().includes(searchDoc.toLowerCase()) ||
        row.actor.toLowerCase().includes(searchDoc.toLowerCase()) ||
        row.notes.toLowerCase().includes(searchDoc.toLowerCase());

      return matchDate && matchSearch;
    });
  }, [ledgerData, startDate, endDate, searchDoc]);

  // Aggregate stats in current filtered range
  const totalIn = filteredLedger.reduce((sum, r) => sum + r.qtyIn, 0);
  const totalOut = filteredLedger.reduce((sum, r) => sum + r.qtyOut, 0);
  const finalLedgerBalance = ledgerData.length > 0 ? ledgerData[ledgerData.length - 1].runningBalance : 0;
  const isReconciled = finalLedgerBalance === liveInventoryBalance;

  // Export handlers
  const handleExportCSV = () => {
    if (!currentMaterial || !currentLocation) return;
    const matCode = currentMaterial.materialCode || currentMaterial.itemCode || 'SKU';
    const filename = `Kartu_Stok_${matCode}_${currentLocation.code}_${new Date().toISOString().slice(0, 10)}.csv`;
    const exportData = filteredLedger.map((r) => ({
      'Tanggal': r.date,
      'No Transaksi': r.transactionNumber,
      'Tipe Mutasi': r.typeLabel,
      'Referensi': r.referenceDoc,
      'Keterangan': `${r.originDest} - ${r.notes}`,
      'Masuk (+)': r.qtyIn,
      'Keluar (-)': r.qtyOut,
      'Saldo Berjalan': r.runningBalance,
      'Petugas': r.actor,
    }));
    exportToCsvFile(exportData, filename);
  };

  const handleExportExcel = () => {
    if (!currentMaterial || !currentLocation) return;
    const matCode = currentMaterial.materialCode || currentMaterial.itemCode || 'SKU';
    const filename = `Kartu_Stok_${matCode}_${currentLocation.code}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const data = filteredLedger.map((r) => ({
      'Tanggal': r.date,
      'No Transaksi': r.transactionNumber,
      'Tipe Mutasi': r.typeLabel,
      'Referensi Dokumen': r.referenceDoc,
      'Detail / Lokasi': r.originDest,
      'Masuk (+)': r.qtyIn,
      'Keluar (-)': r.qtyOut,
      'Saldo Berjalan': r.runningBalance,
      'Petugas / Pemohon': r.actor,
      'Catatan': r.notes,
    }));
    exportToExcelFile(data, filename, 'Kartu Stok');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner - Blue Corporate Theme */}
      <div className="bg-gradient-to-r from-[#123B66] via-[#1F5FAF] to-[#3182CE] rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-white/15 text-[#EFF6FF] text-xs font-semibold backdrop-blur-xs mb-2">
              <FileText className="w-3.5 h-3.5" />
              <span>Buku Besar Mutasi Inventaris</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              KARTU STOK ELEKTRONIK (STOCK CARD LEDGER)
            </h1>
            <p className="text-[#EFF6FF]/90 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
              Pelacakan historis kronologis seluruh mutasi masuk, keluar, transfer antar gudang, dan penyesuaian stock opname per gudang dan per SKU.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2 rounded-xl bg-white text-[#123B66] hover:bg-[#EFF6FF] font-bold text-xs sm:text-sm shadow-sm transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>Export Excel</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white font-semibold text-xs sm:text-sm border border-white/30 transition flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>
            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-white/20 hover:bg-white/30 text-white transition no-print"
              title="Cetak Kartu Stok"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Filter Control Ribbon */}
      <div className="bg-white rounded-2xl p-5 border border-[#D9E2EF] shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#D9E2EF] pb-3">
          <div className="flex items-center gap-2 text-[#123B66] font-bold text-sm">
            <Filter className="w-4 h-4 text-[#1F5FAF]" />
            <span>Parameter Kartu Stok</span>
          </div>
          <span className="text-xs text-[#64748B]">
            Pilih gudang & barang untuk memuat riwayat mutasi
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Gudang Selector */}
          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1">
              Gudang / Lokasi <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Warehouse className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
              <select
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl text-xs sm:text-sm font-medium text-[#1F2937] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF]"
              >
                {activeLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.code} — {loc.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Barang / SKU Selector */}
          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1">
              Barang / Material SKU <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Package className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
              <select
                value={selectedMaterialId}
                onChange={(e) => setSelectedMaterialId(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl text-xs sm:text-sm font-medium text-[#1F2937] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF]"
              >
                {activeMaterials.map((mat) => (
                  <option key={mat.id} value={mat.id}>
                    [{mat.materialCode || mat.itemCode}] {mat.materialName || mat.name} ({mat.unit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Range: Start */}
          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1">
              Dari Tanggal
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl text-xs sm:text-sm font-medium text-[#1F2937] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF]"
              />
            </div>
          </div>

          {/* Date Range: End */}
          <div>
            <label className="block text-xs font-bold text-[#1F2937] mb-1">
              Sampai Tanggal
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl text-xs sm:text-sm font-medium text-[#1F2937] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF]"
              />
            </div>
          </div>
        </div>

        {/* Free text search inside results */}
        <div className="pt-1 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#64748B] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nomor dokumen, referensi, atau nama petugas..."
              value={searchDoc}
              onChange={(e) => setSearchDoc(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#F7F9FC] border border-[#D9E2EF] rounded-xl text-xs sm:text-sm font-medium text-[#1F2937] focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-[#1F5FAF]"
            />
          </div>
          {searchDoc && (
            <button
              onClick={() => setSearchDoc('')}
              className="px-3 py-2 text-xs font-semibold text-[#64748B] hover:text-[#1F2937] bg-slate-100 rounded-xl"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Summary KPI Cards & Reconciliation Status */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Item & Location Summary */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-2xs">
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
            SKU & Lokasi
          </span>
          <div className="mt-1 font-extrabold text-[#123B66] text-sm truncate" title={currentMaterial?.materialName || currentMaterial?.name}>
            {currentMaterial?.materialName || currentMaterial?.name || 'Semua Item'}
          </div>
          <div className="text-xs text-[#64748B] font-mono mt-0.5 truncate">
            {currentMaterial?.materialCode || currentMaterial?.itemCode} • {currentLocation?.name}
          </div>
        </div>

        {/* Total Inflow */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-2xs">
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
            Total Masuk (+)
          </span>
          <div className="mt-1 text-xl font-extrabold text-blue-700 font-mono">
            +{totalIn.toLocaleString()} <span className="text-xs font-normal text-[#64748B]">{currentMaterial?.unit}</span>
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            Penerimaan & Transfer Masuk
          </div>
        </div>

        {/* Total Outflow */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-2xs">
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
            Total Keluar (-)
          </span>
          <div className="mt-1 text-xl font-extrabold text-amber-700 font-mono">
            -{totalOut.toLocaleString()} <span className="text-xs font-normal text-[#64748B]">{currentMaterial?.unit}</span>
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            Barang Keluar & Transfer Keluar
          </div>
        </div>

        {/* Current Balance in Ledger */}
        <div className="bg-white p-4 rounded-2xl border border-[#D9E2EF] shadow-2xs">
          <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
            Saldo Kartu Stok
          </span>
          <div className="mt-1 text-xl font-extrabold text-[#123B66] font-mono">
            {finalLedgerBalance.toLocaleString()} <span className="text-xs font-normal text-[#64748B]">{currentMaterial?.unit}</span>
          </div>
          <div className="text-[11px] text-[#64748B] mt-0.5">
            Saldo akhir kalkulasi mutasi
          </div>
        </div>

        {/* Reconciliation Status with Inventory Table */}
        <div
          className={`p-4 rounded-2xl border shadow-2xs ${
            isReconciled
              ? 'bg-blue-50/50 border-blue-200 text-blue-900'
              : 'bg-amber-50/50 border-amber-200 text-amber-900'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Rekonsiliasi
            </span>
            {isReconciled ? (
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            )}
          </div>
          <div className="mt-1 text-sm font-extrabold">
            {isReconciled ? 'Sinkron 100%' : 'Ada Selisih Fisik'}
          </div>
          <div className="text-[11px] mt-0.5 font-mono">
            Fisik: {liveInventoryBalance.toLocaleString()} {currentMaterial?.unit}
          </div>
        </div>
      </div>

      {/* Main Ledger Table */}
      <div className="bg-white rounded-2xl border border-[#D9E2EF] shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-[#D9E2EF] flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-[#F7F9FC]">
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-[#123B66]">
              Buku Mutasi Barang — [{currentMaterial?.materialCode || currentMaterial?.itemCode}] {currentMaterial?.materialName || currentMaterial?.name}
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
              Lokasi: {currentLocation?.code} - {currentLocation?.name} | Menampilkan {filteredLedger.length} baris transaksi
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-lg bg-[#EFF6FF] text-[#1F5FAF] font-bold border border-[#D9E2EF]">
              Satuan: {currentMaterial?.unit || 'PCS'}
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#F7F9FC] text-[#64748B] border-b border-[#D9E2EF] font-bold uppercase text-[11px] tracking-wider">
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">No. Transaksi</th>
                <th className="py-3 px-4">Tipe Mutasi</th>
                <th className="py-3 px-4">Referensi Dokumen</th>
                <th className="py-3 px-4">Keterangan / Tujuan</th>
                <th className="py-3 px-4 text-right text-blue-700">Masuk (+)</th>
                <th className="py-3 px-4 text-right text-amber-700">Keluar (-)</th>
                <th className="py-3 px-4 text-right text-[#123B66] font-extrabold">Saldo Berjalan</th>
                <th className="py-3 px-4">Petugas / PIC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9E2EF]">
              {filteredLedger.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-[#64748B]">
                    <FileText className="w-8 h-8 text-[#64748B]/40 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-[#1F2937]">Tidak ada mutasi transaksi pada periode ini</p>
                    <p className="text-xs text-[#64748B] mt-1">
                      Silakan sesuaikan filter tanggal atau pilih barang & gudang lain.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLedger.map((row) => (
                  <tr key={row.id} className="hover:bg-[#EFF6FF]/40 transition">
                    <td className="py-3 px-4 font-mono text-xs text-[#1F2937] whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-[#1F5FAF] whitespace-nowrap">
                      {row.transactionNumber}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold ${
                          row.type === 'BARANG_MASUK' || row.type === 'TRANSFER_MASUK'
                            ? 'bg-blue-100 text-blue-800'
                            : row.type === 'BARANG_KELUAR' || row.type === 'TRANSFER_KELUAR'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-purple-100 text-purple-800'
                        }`}
                      >
                        {row.typeLabel}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-[#64748B] whitespace-nowrap">
                      {row.referenceDoc}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#1F2937] max-w-xs truncate" title={row.originDest + ' - ' + row.notes}>
                      <span className="font-medium text-[#123B66]">{row.originDest}</span>
                      {row.notes && <span className="text-[#64748B] ml-1">({row.notes})</span>}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-blue-700">
                      {row.qtyIn > 0 ? `+${row.qtyIn.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-700">
                      {row.qtyOut > 0 ? `-${row.qtyOut.toLocaleString()}` : '-'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-[#123B66] bg-[#EFF6FF]/30">
                      {row.runningBalance.toLocaleString()} {currentMaterial?.unit}
                    </td>
                    <td className="py-3 px-4 text-xs text-[#64748B] whitespace-nowrap">
                      {row.actor}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filteredLedger.length > 0 && (
              <tfoot>
                <tr className="bg-[#F7F9FC] font-extrabold text-xs sm:text-sm text-[#123B66] border-t-2 border-[#D9E2EF]">
                  <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider text-[11px] text-[#64748B]">
                    Total Mutasi Terfilter:
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-blue-700 font-bold">
                    +{totalIn.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-amber-700 font-bold">
                    -{totalOut.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-[#123B66] font-extrabold bg-[#EFF6FF]/60">
                    {finalLedgerBalance.toLocaleString()} {currentMaterial?.unit}
                  </td>
                  <td className="py-3 px-4 text-xs text-[#64748B]">
                    Status: {isReconciled ? 'Match OK' : 'Check Variance'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};
