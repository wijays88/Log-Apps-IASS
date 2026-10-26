import * as XLSX from 'xlsx';
import { ExcelImportPreview, ExcelImportValidationError } from '../types';

export type ImportModuleType =
  | 'MATERIAL_MASTER'
  | 'LOCATION_MASTER'
  | 'MATERIAL_CATEGORY'
  | 'UNIT_OF_MEASURE'
  | 'INVENTORY_OPENING'
  | 'GOODS_RECEIPT'
  | 'GOODS_ISSUE'
  | 'CONSUMPTION'
  | 'MORGAN_TROLLEY'
  | 'STOCK_OPNAME';

export interface ImportFieldDef {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date';
  description: string;
  sampleValue: string | number;
}

export const MODULE_FIELD_DEFINITIONS: Record<ImportModuleType, { title: string; fields: ImportFieldDef[] }> = {
  MATERIAL_MASTER: {
    title: 'Material Master',
    fields: [
      { key: 'materialCode', label: 'Material Code', required: true, type: 'string', description: 'Kode unik material', sampleValue: 'MAT-TIS-HT09' },
      { key: 'materialName', label: 'Material Name', required: true, type: 'string', description: 'Nama lengkap barang/material', sampleValue: 'Hand Towel Premium 2-Ply' },
      { key: 'categoryCode', label: 'Category Code / Name', required: true, type: 'string', description: 'Kode kategori (Tissue, Plastic, Chemical, dll)', sampleValue: 'Tissue' },
      { key: 'subcategory', label: 'Subcategory (Opsional)', required: false, type: 'string', description: 'Subkategori material (misal: Dispensers, Janitorial)', sampleValue: 'Janitorial' },
      { key: 'unitSymbol', label: 'Unit of Measure', required: true, type: 'string', description: 'Satuan (Pack, Roll, Pcs, Ltr, Box)', sampleValue: 'Pack' },
      { key: 'minimumStock', label: 'Minimum Stock', required: false, type: 'number', description: 'Batas stok minimum', sampleValue: 50 },
      { key: 'reorderPoint', label: 'Reorder Point (ROP)', required: false, type: 'number', description: 'Batas pemesanan kembali', sampleValue: 100 },
      { key: 'defaultLocationCode', label: 'Default Location', required: false, type: 'string', description: 'Kode lokasi default', sampleValue: 'LOC-T1B' },
      { key: 'variantAttributes', label: 'Variant Attributes', required: false, type: 'string', description: 'Spesifikasi ukuran (misal: Size: L, 60x100)', sampleValue: 'Ukuran: 60x100' },
      { key: 'unitCost', label: 'Unit Cost (IDR)', required: false, type: 'number', description: 'Estimasi harga per satuan', sampleValue: 15000 },
      { key: 'description', label: 'Description', required: false, type: 'string', description: 'Keterangan spesifikasi', sampleValue: 'Tissue pengering tangan dispenser toilet' },
    ],
  },
  LOCATION_MASTER: {
    title: 'Location Master',
    fields: [
      { key: 'locationCode', label: 'Location Code', required: true, type: 'string', description: 'Kode unik lokasi gudang', sampleValue: 'LOC-T1B-LT2' },
      { key: 'locationName', label: 'Location Name', required: true, type: 'string', description: 'Nama lokasi operasional', sampleValue: 'Gudang Kebersihan Lantai 2 T1B' },
      { key: 'locationType', label: 'Location Type', required: true, type: 'string', description: 'Tipe (Terminal, Warehouse, Toilet Area, Gedung)', sampleValue: 'Toilet Area' },
      { key: 'parentLocationCode', label: 'Parent Location Code', required: false, type: 'string', description: 'Kode lokasi induk (misal: LOC-T1B)', sampleValue: 'LOC-T1B' },
      { key: 'personInCharge', label: 'Person In Charge (PIC)', required: false, type: 'string', description: 'Nama penanggung jawab', sampleValue: 'Budi Santoso' },
      { key: 'capacityM2', label: 'Capacity (m2)', required: false, type: 'number', description: 'Kapasitas area m2', sampleValue: 150 },
      { key: 'address', label: 'Address / Area', required: false, type: 'string', description: 'Alamat / detail penempatan', sampleValue: 'Airside Gate 4 T1B' },
      { key: 'description', label: 'Description', required: false, type: 'string', description: 'Catatan operasional', sampleValue: 'Titik konsumsi harian toilet' },
    ],
  },
  MATERIAL_CATEGORY: {
    title: 'Material Category Master',
    fields: [
      { key: 'code', label: 'Category Code', required: true, type: 'string', description: 'Kode unik kategori', sampleValue: 'CAT-DISINFECT' },
      { key: 'name', label: 'Category Name', required: true, type: 'string', description: 'Nama kategori', sampleValue: 'Disinfectant & Sanitizer' },
      { key: 'description', label: 'Description', required: false, type: 'string', description: 'Keterangan kategori', sampleValue: 'Cairan sanitasi apron dan toilet' },
    ],
  },
  UNIT_OF_MEASURE: {
    title: 'Unit of Measure Master',
    fields: [
      { key: 'code', label: 'Unit Code', required: true, type: 'string', description: 'Kode satuan', sampleValue: 'DRUM' },
      { key: 'name', label: 'Unit Name', required: true, type: 'string', description: 'Nama lengkap satuan', sampleValue: 'Drum Industri 200L' },
      { key: 'symbol', label: 'Symbol', required: true, type: 'string', description: 'Singkatan simbol satuan', sampleValue: 'Drum' },
      { key: 'description', label: 'Description', required: false, type: 'string', description: 'Keterangan penggunaan', sampleValue: 'Kemasan pelumas drum' },
    ],
  },
  INVENTORY_OPENING: {
    title: 'Saldo Awal Inventaris (Opening Balance)',
    fields: [
      { key: 'materialCode', label: 'Material Code', required: true, type: 'string', description: 'Kode material yang sudah terdaftar', sampleValue: 'MAT-TIS-HT01' },
      { key: 'locationCode', label: 'Location Code', required: true, type: 'string', description: 'Kode lokasi gudang tujuan', sampleValue: 'LOC-T1B' },
      { key: 'openingStock', label: 'Opening Stock', required: true, type: 'number', description: 'Jumlah fisik saldo awal disetujui', sampleValue: 300 },
      { key: 'minimumStock', label: 'Minimum Stock', required: false, type: 'number', description: 'Batas min stok', sampleValue: 150 },
      { key: 'reorderPoint', label: 'Reorder Point', required: false, type: 'number', description: 'Batas ROP', sampleValue: 250 },
      { key: 'variantValue', label: 'Variant Value', required: false, type: 'string', description: 'Ukuran jika ada (S, M, L / 60x100)', sampleValue: '' },
    ],
  },
  GOODS_RECEIPT: {
    title: 'Penerimaan Barang (Goods Receipt)',
    fields: [
      { key: 'receiptDate', label: 'Receipt Date', required: true, type: 'date', description: 'Format: YYYY-MM-DD', sampleValue: '2026-10-21' },
      { key: 'sourceSupplier', label: 'Supplier / Source', required: true, type: 'string', description: 'Nama pemasok / vendor', sampleValue: 'CV Multi Sarana Logistik Bandara' },
      { key: 'referenceDocument', label: 'Ref. Document (PO/DO)', required: true, type: 'string', description: 'Nomor PO atau Surat Jalan', sampleValue: 'PO-2026/TIS/1101' },
      { key: 'materialCode', label: 'Material Code', required: true, type: 'string', description: 'Kode material', sampleValue: 'MAT-TIS-HT01' },
      { key: 'destinationLocationCode', label: 'Destination Location Code', required: true, type: 'string', description: 'Kode gudang penerima', sampleValue: 'LOC-T1B' },
      { key: 'quantity', label: 'Quantity', required: true, type: 'number', description: 'Jumlah masuk > 0', sampleValue: 100 },
      { key: 'notes', label: 'Notes', required: false, type: 'string', description: 'Catatan kondisi barang', sampleValue: 'Segel pabrik utuh' },
    ],
  },
  GOODS_ISSUE: {
    title: 'Pengeluaran Barang (Goods Issue)',
    fields: [
      { key: 'requestDate', label: 'Request Date', required: true, type: 'date', description: 'Format: YYYY-MM-DD', sampleValue: '2026-10-21' },
      { key: 'requestingUnit', label: 'Requesting Unit', required: true, type: 'string', description: 'Nama divisi pemohon', sampleValue: 'Divisi Kebersihan Toilet Terminal 1B' },
      { key: 'destination', label: 'Destination Area', required: true, type: 'string', description: 'Area penempatan kerja', sampleValue: 'Toilet Kedatangan Gate 1B' },
      { key: 'materialCode', label: 'Material Code', required: true, type: 'string', description: 'Kode material', sampleValue: 'MAT-TIS-HT01' },
      { key: 'quantity', label: 'Quantity', required: true, type: 'number', description: 'Jumlah yang diminta', sampleValue: 40 },
      { key: 'purpose', label: 'Purpose', required: true, type: 'string', description: 'Keperluan operasional', sampleValue: 'Refill harian dispenser tissue' },
      { key: 'notes', label: 'Notes', required: false, type: 'string', description: 'Catatan tambahan', sampleValue: 'Prioritas shift pagi' },
    ],
  },
  CONSUMPTION: {
    title: 'Pemakaian Harian / Shift (Tissue & Plastik)',
    fields: [
      { key: 'date', label: 'Date', required: true, type: 'date', description: 'Format: YYYY-MM-DD', sampleValue: '2026-10-21' },
      { key: 'locationCode', label: 'Location Code', required: true, type: 'string', description: 'Kode lokasi (misal: LOC-T1B)', sampleValue: 'LOC-T1B' },
      { key: 'areaOrToilet', label: 'Area / Toilet Spot', required: true, type: 'string', description: 'Nama area toilet/spot', sampleValue: 'Area Toilet Kedatangan Gate 1B' },
      { key: 'shift', label: 'Shift (Shift 1 / Shift 2 / Shift 3)', required: true, type: 'string', description: 'Shift kerja operasional', sampleValue: 'Shift 1' },
      { key: 'materialCode', label: 'Material Code', required: true, type: 'string', description: 'Kode material yang dipakai', sampleValue: 'MAT-TIS-HT01' },
      { key: 'quantityUsed', label: 'Quantity Used', required: true, type: 'number', description: 'Jumlah pemakaian fisik', sampleValue: 20 },
      { key: 'operator', label: 'Operator Name', required: true, type: 'string', description: 'Nama petugas pelaksana', sampleValue: 'Budi Santoso' },
      { key: 'notes', label: 'Notes', required: false, type: 'string', description: 'Catatan pemakaian', sampleValue: 'Kondisi traffic penumpang ramai' },
    ],
  },
  MORGAN_TROLLEY: {
    title: 'Data Morgan Trolley',
    fields: [
      { key: 'quantity', label: 'Quantity (Unit)', required: true, type: 'number', description: 'Jumlah unit troli', sampleValue: 5 },
      { key: 'locationCode', label: 'Location Code', required: true, type: 'string', description: 'Kode lokasi terminal', sampleValue: 'LOC-T1B' },
      { key: 'area', label: 'Area / Zona', required: true, type: 'string', description: 'Zona penempatan', sampleValue: 'Curbside Pintu 1-4' },
      { key: 'placement', label: 'Placement Spot', required: true, type: 'string', description: 'Titik stanby janitor', sampleValue: 'Pos Janitor Timur 1B' },
      { key: 'condition', label: 'Condition', required: true, type: 'string', description: 'Baik (Good) / Perbaikan Ringan (Minor) / Rusak Berat (Damaged)', sampleValue: 'Baik (Good)' },
      { key: 'personInCharge', label: 'PIC Name', required: true, type: 'string', description: 'Petugas penanggung jawab', sampleValue: 'Suryo Wibowo' },
      { key: 'lastCheckDate', label: 'Last Check Date', required: true, type: 'date', description: 'Format: YYYY-MM-DD', sampleValue: '2026-10-21' },
      { key: 'notes', label: 'Notes', required: false, type: 'string', description: 'Catatan kondisi troli', sampleValue: 'Roda lancar, kantong vinyl utuh' },
    ],
  },
  STOCK_OPNAME: {
    title: 'Stock Opname Fisik',
    fields: [
      { key: 'opnameDate', label: 'Opname Date', required: true, type: 'date', description: 'Format: YYYY-MM-DD', sampleValue: '2026-10-21' },
      { key: 'locationCode', label: 'Location Code', required: true, type: 'string', description: 'Kode lokasi gudang', sampleValue: 'LOC-T1B' },
      { key: 'materialCode', label: 'Material Code', required: true, type: 'string', description: 'Kode material fisik', sampleValue: 'MAT-TIS-HT01' },
      { key: 'physicalQuantity', label: 'Physical Quantity', required: true, type: 'number', description: 'Hasil hitung aktual', sampleValue: 338 },
      { key: 'varianceReason', label: 'Variance Reason', required: false, type: 'string', description: 'Alasan jika ada selisih', sampleValue: '2 pack kemasan sobek' },
      { key: 'notes', label: 'Notes', required: false, type: 'string', description: 'Catatan auditor', sampleValue: 'Audit berkala minggu ke-3' },
    ],
  },
};

/**
 * Export data array to Excel (.xlsx) file with professional formatting
 */
export function exportToExcelFile(
  data: Record<string, any>[],
  fileName: string,
  sheetName: string = 'PT_IAS_Support'
): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Set column widths based on longest string in each column
  if (data.length > 0) {
    const keys = Object.keys(data[0]);
    worksheet['!cols'] = keys.map((key) => {
      let maxLen = key.length;
      for (let i = 0; i < Math.min(data.length, 50); i++) {
        const val = String(data[i][key] ?? '');
        if (val.length > maxLen) maxLen = val.length;
      }
      return { wch: Math.min(Math.max(maxLen + 3, 12), 40) };
    });
  }

  XLSX.writeFile(workbook, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`);
}

/**
 * Export data array to CSV file
 */
export function exportToCsvFile(data: Record<string, any>[], fileName: string): void {
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csvOutput = XLSX.utils.sheet_to_csv(worksheet);

  const blob = new Blob([csvOutput], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate and download import template for a module
 */
export function downloadModuleTemplate(moduleType: ImportModuleType): void {
  const def = MODULE_FIELD_DEFINITIONS[moduleType];
  if (!def) return;

  const headerRow: Record<string, any> = {};
  const sampleRow1: Record<string, any> = {};
  const sampleRow2: Record<string, any> = {};

  def.fields.forEach((f) => {
    headerRow[f.key] = `${f.label}${f.required ? ' *' : ''}`;
    sampleRow1[f.key] = f.sampleValue;
    // slightly varied second row
    if (typeof f.sampleValue === 'number') {
      sampleRow2[f.key] = f.sampleValue * 2;
    } else {
      sampleRow2[f.key] = `${f.sampleValue} (Contoh 2)`;
    }
  });

  const templateRows = [sampleRow1, sampleRow2];
  const worksheet = XLSX.utils.json_to_sheet(templateRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'TEMPLATE');

  // Add field reference guide sheet
  const guideRows = def.fields.map((f) => ({
    'Field Key': f.key,
    'Field Label': f.label,
    'Wajib (Required)': f.required ? 'YA' : 'TIDAK',
    'Tipe Data': f.type,
    'Keterangan & Format': f.description,
    'Contoh Nilai': f.sampleValue,
  }));
  const guideSheet = XLSX.utils.json_to_sheet(guideRows);
  XLSX.utils.book_append_sheet(workbook, guideSheet, 'PANDUAN_KOLOM');

  XLSX.writeFile(workbook, `Template_Import_${moduleType}_PT_IAS.xlsx`);
}

/**
 * Parse an uploaded Excel or CSV file and return sheet names & raw JSON data per sheet
 */
export async function parseUploadedFile(file: File): Promise<{
  sheets: { name: string; data: Record<string, any>[] }[];
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'binary', cellDates: true });
        const sheets = workbook.SheetNames.map((name) => {
          const ws = workbook.Sheets[name];
          const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
          return { name, data: rawData };
        });
        resolve({ sheets });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
}
