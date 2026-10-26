import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  ArrowRight,
  FileText,
  RefreshCw,
  Layers,
  HelpCircle,
} from 'lucide-react';
import {
  ImportModuleType,
  MODULE_FIELD_DEFINITIONS,
  downloadModuleTemplate,
  exportToExcelFile,
  exportToCsvFile,
  parseUploadedFile,
} from '../utils/excelUtils';
import { ExcelImportValidationError } from '../types';

interface Props {
  initialModule?: ImportModuleType;
  isOpen: boolean;
  onClose: () => void;
}

export const ExcelImportExportModal: React.FC<Props> = ({ initialModule = 'MATERIAL_MASTER', isOpen, onClose }) => {
  const {
    materials,
    locations,
    categories,
    units,
    inventory,
    goodsReceipts,
    goodsIssues,
    consumptions,
    morganTrolleys,
    stockOpnames,
    executeExcelImport,
    showToast,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'IMPORT' | 'EXPORT'>('IMPORT');
  const [selectedModule, setSelectedModule] = useState<ImportModuleType>(initialModule);
  const [importMode, setImportMode] = useState<
    'INSERT_ONLY' | 'UPDATE_EXISTING' | 'INSERT_OR_UPDATE' | 'HISTORICAL_TRANSACTION' | 'OPENING_BALANCE'
  >('INSERT_OR_UPDATE');

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<{ name: string; data: Record<string, any>[] }[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);

  // Column mapping: application field key -> excel header name
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [previewStep, setPreviewStep] = useState<boolean>(false);
  const [validationErrors, setValidationErrors] = useState<ExcelImportValidationError[]>([]);
  const [mappedRows, setMappedRows] = useState<Record<string, any>[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  if (!isOpen) return null;

  const currentDef = MODULE_FIELD_DEFINITIONS[selectedModule];

  // Handle File Selection & Parse
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadedFile(file);
      const parsed = await parseUploadedFile(file);
      setSheets(parsed.sheets);
      setSelectedSheetIndex(0);

      // Initialize automatic column mapping by name similarity
      if (parsed.sheets.length > 0 && parsed.sheets[0].data.length > 0) {
        const firstRow = parsed.sheets[0].data[0];
        const excelCols = Object.keys(firstRow);
        const autoMap: Record<string, string> = {};

        currentDef.fields.forEach((f) => {
          // Exact or substring match
          const matchedCol = excelCols.find(
            (col) =>
              col.toLowerCase().replace(/[^a-z0-9]/g, '') === f.key.toLowerCase().replace(/[^a-z0-9]/g, '') ||
              col.toLowerCase().includes(f.label.toLowerCase()) ||
              f.label.toLowerCase().includes(col.toLowerCase())
          );
          if (matchedCol) {
            autoMap[f.key] = matchedCol;
          }
        });
        setColumnMapping(autoMap);
      }
      setPreviewStep(false);
      setValidationErrors([]);
    } catch (err: any) {
      showToast('error', 'Gagal Membaca File', 'Pastikan format file .xlsx atau .csv valid.');
    }
  };

  // Preview & Validate Rows
  const handleProceedToPreview = () => {
    const currentSheetData = sheets[selectedSheetIndex]?.data || [];
    if (currentSheetData.length === 0) {
      showToast('error', 'Lembar Kosong', 'Worksheet yang dipilih tidak memiliki data baris.');
      return;
    }

    const errors: ExcelImportValidationError[] = [];
    const transformed: Record<string, any>[] = [];

    currentSheetData.forEach((row, idx) => {
      const rowNum = idx + 2;
      const transformedRow: Record<string, any> = {};

      currentDef.fields.forEach((field) => {
        const excelCol = columnMapping[field.key];
        const val = excelCol ? row[excelCol] : undefined;

        if (field.required && (val === undefined || val === null || String(val).trim() === '')) {
          errors.push({
            rowNumber: rowNum,
            field: field.label,
            value: val,
            message: `Kolom wajib '${field.label}' tidak boleh kosong.`,
          });
        }

        if (field.type === 'number' && val !== undefined && val !== null && String(val).trim() !== '') {
          const num = Number(val);
          if (isNaN(num)) {
            errors.push({
              rowNumber: rowNum,
              field: field.label,
              value: val,
              message: `Nilai '${val}' bukan angka valid.`,
            });
          } else {
            transformedRow[field.key] = num;
          }
        } else {
          transformedRow[field.key] = val !== undefined ? String(val).trim() : '';
        }
      });

      transformed.push(transformedRow);
    });

    setMappedRows(transformed);
    setValidationErrors(errors);
    setPreviewStep(true);
  };

  // Confirm Import
  const handleConfirmImport = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const result = executeExcelImport(selectedModule, mappedRows, importMode);
      setIsProcessing(false);
      if (result.successCount > 0) {
        onClose();
      }
    }, 300);
  };

  // Download Error Report
  const handleDownloadErrors = () => {
    if (validationErrors.length === 0) return;
    const errorData = validationErrors.map((err) => ({
      'Baris Excel': err.rowNumber,
      'Kolom / Field': err.field,
      'Nilai Terbaca': err.value ?? '',
      'Pesan Kesalahan': err.message,
    }));
    exportToCsvFile(errorData, `Laporan_Kesalahan_Import_${selectedModule}`);
  };

  // Export handler
  const handleExecuteExport = (format: 'xlsx' | 'csv') => {
    let exportData: Record<string, any>[] = [];
    const dateStr = new Date().toISOString().slice(0, 10);

    if (selectedModule === 'MATERIAL_MASTER') {
      exportData = materials.map((m) => ({
        'Material Code': m.materialCode,
        'Material Name': m.materialName,
        'Category': m.categoryName,
        'Unit': m.unit,
        'Minimum Stock': m.minimumStock,
        'Reorder Point': m.reorderPoint,
        'Default Location': m.defaultLocationName || '-',
        'Variant Attributes': m.variantAttributes || '-',
        'Unit Cost': m.unitCost || 0,
        'Status': m.isActive ? 'Active' : 'Inactive',
      }));
    } else if (selectedModule === 'LOCATION_MASTER') {
      exportData = locations.map((l) => ({
        'Location Code': l.code,
        'Location Name': l.name,
        'Type': l.type,
        'Parent Location': l.parentLocationName || '-',
        'Person In Charge': l.picName,
        'Capacity (m2)': l.capacityM2 || 0,
        'Address': l.address || '-',
        'Status': l.isActive ? 'Active' : 'Inactive',
      }));
    } else if (selectedModule === 'INVENTORY_OPENING') {
      exportData = inventory.map((b) => ({
        'Material Code': b.materialCode,
        'Material Name': b.materialName,
        'Location': b.locationName,
        'Variant': b.variantValue || '-',
        'Opening Stock': b.openingStock,
        'Qty IN': b.qtyIn,
        'Qty OUT': b.qtyOut,
        'Available Stock': b.availableStock,
        'Unit': b.unit,
        'Status': b.availableStock <= b.minimumStock ? 'Kritis' : b.availableStock <= b.reorderPoint ? 'Menipis' : 'Normal',
      }));
    } else if (selectedModule === 'CONSUMPTION') {
      exportData = consumptions.map((c) => ({
        'Date': c.date,
        'Location': c.locationName,
        'Area / Toilet': c.areaOrToilet,
        'Shift': c.shift,
        'Material Code': c.materialCode,
        'Material Name': c.materialName,
        'Quantity Used': c.quantityUsed,
        'Unit': c.unit,
        'Operator': c.operator,
        'Notes': c.notes || '-',
      }));
    } else if (selectedModule === 'MORGAN_TROLLEY') {
      exportData = morganTrolleys.map((t) => ({
        'Location': t.locationName,
        'Area': t.area,
        'Placement': t.placement,
        'Quantity': t.quantity,
        'Condition': t.condition,
        'PIC': t.personInCharge,
        'Last Check': t.lastCheckDate,
        'Notes': t.notes || '-',
      }));
    } else {
      exportData = inventory.map((i) => ({
        'Code': i.materialCode,
        'Name': i.materialName,
        'Stock': i.availableStock,
        'Unit': i.unit,
      }));
    }

    const filename = `${selectedModule}_PT_IAS_${dateStr}`;
    if (format === 'xlsx') {
      exportToExcelFile(exportData, `${filename}.xlsx`, selectedModule);
    } else {
      exportToCsvFile(exportData, `${filename}.csv`);
    }
    showToast('success', 'Ekspor Berhasil', `${exportData.length} baris data diekspor ke ${format.toUpperCase()}.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 my-auto max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-[#064e3b]">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                Pusat Integrasi Excel (.xlsx / .csv)
              </h3>
              <p className="text-[11px] text-slate-500">
                Import dan Export data terstruktur PT IAS Support Logistics Control Tower
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-3 pt-3 shrink-0">
          <button
            onClick={() => {
              setActiveTab('IMPORT');
              setPreviewStep(false);
            }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'IMPORT'
                ? 'bg-[#064e3b] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>Import Data Excel</span>
          </button>

          <button
            onClick={() => setActiveTab('EXPORT')}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'EXPORT'
                ? 'bg-[#064e3b] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Export Data Excel / CSV</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 text-xs pr-1">
          {/* Target Module Selector */}
          <div>
            <label className="text-slate-700 font-bold block mb-1">Pilih Entitas Target</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedModule}
                onChange={(e) => {
                  setSelectedModule(e.target.value as ImportModuleType);
                  setUploadedFile(null);
                  setSheets([]);
                  setPreviewStep(false);
                }}
                className="flex-1 px-3 py-2 border border-slate-200 rounded-xl font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#064e3b] bg-white text-xs"
              >
                {Object.entries(MODULE_FIELD_DEFINITIONS).map(([key, def]) => (
                  <option key={key} value={key}>
                    {def.title}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => downloadModuleTemplate(selectedModule)}
                className="px-3 py-2 rounded-xl bg-emerald-50 text-[#064e3b] hover:bg-emerald-100 border border-emerald-200 font-bold text-xs flex items-center gap-1.5 shrink-0 transition"
                title="Unduh format template Excel resmi untuk entitas ini"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh Template</span>
              </button>
            </div>
          </div>

          {activeTab === 'IMPORT' ? (
            <>
              {!previewStep ? (
                <>
                  {/* Import Mode Selector */}
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <label className="text-slate-700 font-bold block">Mode Import (Kebijakan Duplikasi):</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'INSERT_OR_UPDATE'}
                          onChange={() => setImportMode('INSERT_OR_UPDATE')}
                          className="text-[#064e3b]"
                        />
                        <div>
                          <div className="font-bold text-slate-800">Insert & Update</div>
                          <div className="text-[10px] text-slate-400">Tambahkan baru & perbarui yang cocok</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'INSERT_ONLY'}
                          onChange={() => setImportMode('INSERT_ONLY')}
                          className="text-[#064e3b]"
                        />
                        <div>
                          <div className="font-bold text-slate-800">Insert Only</div>
                          <div className="text-[10px] text-slate-400">Tolak atau lewati jika kode duplikat</div>
                        </div>
                      </label>

                      <label className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200 cursor-pointer">
                        <input
                          type="radio"
                          name="importMode"
                          checked={importMode === 'UPDATE_EXISTING'}
                          onChange={() => setImportMode('UPDATE_EXISTING')}
                          className="text-[#064e3b]"
                        />
                        <div>
                          <div className="font-bold text-slate-800">Update Existing</div>
                          <div className="text-[10px] text-slate-400">Hanya ubah data yang sudah ada</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* File Upload Zone */}
                  <div>
                    <label className="text-slate-700 font-bold block mb-1">Upload File (.xlsx / .csv)</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-[#064e3b] transition bg-slate-50/50">
                      <input
                        type="file"
                        accept=".xlsx, .xls, .csv"
                        onChange={handleFileChange}
                        className="hidden"
                        id="excel-file-upload"
                      />
                      <label htmlFor="excel-file-upload" className="cursor-pointer flex flex-col items-center">
                        <Upload className="w-8 h-8 text-emerald-700 mb-2" />
                        <span className="font-bold text-slate-800">
                          {uploadedFile ? uploadedFile.name : 'Klik untuk memilih file Excel atau CSV'}
                        </span>
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          Mendukung format .xlsx, .xls, .csv (Maksimal 10 MB)
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Sheet Selector if multi-sheet */}
                  {sheets.length > 1 && (
                    <div>
                      <label className="text-slate-700 font-bold block mb-1">Pilih Worksheet Excel</label>
                      <select
                        value={selectedSheetIndex}
                        onChange={(e) => {
                          const idx = Number(e.target.value);
                          setSelectedSheetIndex(idx);
                        }}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                      >
                        {sheets.map((s, idx) => (
                          <option key={s.name} value={idx}>
                            {s.name} ({s.data.length} baris)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Column Mapping Table */}
                  {sheets.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">Pemetaan Kolom (Field Mapping)</span>
                        <span className="text-[11px] text-slate-500">
                          {sheets[selectedSheetIndex]?.data.length || 0} baris data terbaca
                        </span>
                      </div>

                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 divide-y divide-slate-200">
                        {currentDef.fields.map((f) => {
                          const excelCols = sheets[selectedSheetIndex]?.data[0]
                            ? Object.keys(sheets[selectedSheetIndex].data[0])
                            : [];
                          return (
                            <div key={f.key} className="py-2 flex items-center justify-between gap-3 text-xs">
                              <div className="flex-1">
                                <div className="font-semibold text-slate-800">
                                  {f.label} {f.required && <span className="text-rose-600">*</span>}
                                </div>
                                <div className="text-[10px] text-slate-400">{f.description}</div>
                              </div>

                              <div className="w-56 shrink-0">
                                <select
                                  value={columnMapping[f.key] || ''}
                                  onChange={(e) =>
                                    setColumnMapping({ ...columnMapping, [f.key]: e.target.value })
                                  }
                                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-xs"
                                >
                                  <option value="">-- Lewati Kolom --</option>
                                  {excelCols.map((c) => (
                                    <option key={c} value={c}>
                                      {c}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Preview and Validation Step */
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center w-full">
                      <div>
                        <div className="text-[11px] text-slate-500">Total Baris</div>
                        <div className="text-lg font-extrabold text-slate-900">{mappedRows.length}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-emerald-700 font-bold">Baris Valid</div>
                        <div className="text-lg font-extrabold text-emerald-700">
                          {mappedRows.length - Array.from(new Set(validationErrors.map((e) => e.rowNumber))).length}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-rose-700 font-bold">Baris Bermasalah</div>
                        <div className="text-lg font-extrabold text-rose-700">
                          {Array.from(new Set(validationErrors.map((e) => e.rowNumber))).length}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">Mode Eksekusi</div>
                        <div className="text-xs font-bold text-[#064e3b] mt-1">{importMode}</div>
                      </div>
                    </div>
                  </div>

                  {/* Validation Error Alerts */}
                  {validationErrors.length > 0 && (
                    <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-rose-900 font-bold">
                          <AlertTriangle className="w-4 h-4 text-rose-600" />
                          <span>Ditemukan {validationErrors.length} Kesalahan Validasi</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadErrors}
                          className="text-xs text-rose-700 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Unduh Laporan Error</span>
                        </button>
                      </div>

                      <div className="max-h-36 overflow-y-auto space-y-1 text-[11px] divide-y divide-rose-100">
                        {validationErrors.slice(0, 10).map((err, i) => (
                          <div key={i} className="pt-1 text-rose-800">
                            <strong>Baris {err.rowNumber}:</strong> [{err.field}] {err.message}
                          </div>
                        ))}
                        {validationErrors.length > 10 && (
                          <div className="pt-1 text-slate-500 italic">
                            ... dan {validationErrors.length - 10} kesalahan lainnya (unduh laporan lengkap).
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Data Preview Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                    <table className="w-full text-left text-[11px] border-collapse">
                      <thead className="bg-slate-100 sticky top-0 text-slate-700 font-bold">
                        <tr>
                          <th className="py-2 px-3">#</th>
                          {currentDef.fields.slice(0, 5).map((f) => (
                            <th key={f.key} className="py-2 px-3 whitespace-nowrap">
                              {f.label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mappedRows.slice(0, 8).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-1.5 px-3 font-mono text-slate-400">{i + 1}</td>
                            {currentDef.fields.slice(0, 5).map((f) => (
                              <td key={f.key} className="py-1.5 px-3 truncate max-w-[150px]">
                                {r[f.key] !== undefined && r[f.key] !== null ? String(r[f.key]) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* EXPORT TAB */
            <div className="space-y-4 py-2">
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2">
                <h4 className="font-bold text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                  <span>Siap Mengekspor Data {currentDef.title}</span>
                </h4>
                <p className="text-xs text-emerald-900/80 leading-relaxed">
                  Ekspor akan menyertakan seluruh rekaman aktif sesuai izin hak akses Anda. Hasil ekspor memiliki header rapi dan siap dibuka langsung di Microsoft Excel atau Google Sheets.
                </p>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleExecuteExport('xlsx')}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>Download Format Excel (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleExecuteExport('csv')}
                  className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm transition flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  <span>Download Format CSV (.csv)</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {activeTab === 'IMPORT' && (
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0 text-xs">
            {previewStep ? (
              <>
                <button
                  type="button"
                  onClick={() => setPreviewStep(false)}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                >
                  Kembali ke Pemetaan
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmImport}
                  className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold shadow-2xs flex items-center gap-2 disabled:opacity-50"
                >
                  <span>{isProcessing ? 'Memproses...' : 'Konfirmasi & Simpan ke Database'}</span>
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-700 font-semibold hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={!uploadedFile || sheets.length === 0}
                  onClick={handleProceedToPreview}
                  className="px-4 py-2 rounded-xl bg-[#064e3b] hover:bg-[#065f46] text-white font-bold shadow-2xs flex items-center gap-2 disabled:opacity-50"
                >
                  <span>Preview & Validasi Data</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
