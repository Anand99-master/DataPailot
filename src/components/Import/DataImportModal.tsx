import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  FileText,
  FileCode,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  ArrowRight,
  Eye,
  BarChart2,
  Table as TableIcon,
  RefreshCw,
  Sparkles,
  Download,
  Info
} from 'lucide-react';
import {
  FileType,
  ImportStatus,
  ImportValidationResult,
  ImportedDataset,
  DataProfile,
  ColumnMetadata
} from '../../types/import';
import { ImportApiClient } from '../../services/importApi';

interface DataImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (dataset: ImportedDataset, navigateTo?: 'analysis' | 'visualization' | 'sql' | 'dashboard') => void;
}

export const DataImportModal: React.FC<DataImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [datasetName, setDatasetName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'preview' | 'profile'>('preview');
  const [importedDataset, setImportedDataset] = useState<ImportedDataset | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetState = () => {
    setSelectedFile(null);
    setStatus('idle');
    setStatusMessage('');
    setValidationResult(null);
    setSelectedSheet('');
    setDatasetName('');
    setImportedDataset(null);
    setErrorMessage(null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processSelectedFile(e.target.files[0]);
    }
  };

  const processSelectedFile = async (file: File, sheetOverride?: string) => {
    setSelectedFile(file);
    setErrorMessage(null);
    setStatus('validating');
    setStatusMessage('Validating file format and parsing preview...');

    try {
      const result = await ImportApiClient.validateAndPreview(file, {
        selectedSheet: sheetOverride
      });

      setValidationResult(result);
      if (result.sheets && result.sheets.length > 0) {
        setSelectedSheet(sheetOverride || result.selectedSheet || result.sheets[0]);
      }
      if (!datasetName) {
        setDatasetName(result.fileName.replace(/\.[^/.]+$/, ''));
      }
      setStatus('idle');
      setStatusMessage('');
    } catch (err: any) {
      setStatus('failed');
      setErrorMessage(err.message || 'Validation failed.');
    }
  };

  const handleSheetChange = (sheet: string) => {
    setSelectedSheet(sheet);
    if (selectedFile) {
      processSelectedFile(selectedFile, sheet);
    }
  };

  const handleConfirmImport = async () => {
    if (!selectedFile || !validationResult) return;

    setStatus('processing');
    setStatusMessage('Ingesting dataset, generating analytical profile, and registering in Unified Data Layer...');
    setErrorMessage(null);

    try {
      const dataset = await ImportApiClient.confirmImport({
        fileName: selectedFile.name,
        datasetName: datasetName.trim() || selectedFile.name,
        fileType: validationResult.fileType,
        file: selectedFile,
        selectedSheet
      });

      setImportedDataset(dataset);
      setStatus('ready');
      setStatusMessage('Dataset successfully imported and ready for analysis!');
    } catch (err: any) {
      setStatus('failed');
      setErrorMessage(err.message || 'Failed to import dataset.');
    }
  };

  const getFileTypeIcon = (type?: FileType) => {
    switch (type) {
      case 'CSV':
        return <FileText className="w-5 h-5 text-emerald-400" />;
      case 'XLSX':
        return <FileSpreadsheet className="w-5 h-5 text-green-400" />;
      case 'JSON':
        return <FileCode className="w-5 h-5 text-amber-400" />;
      default:
        return <Upload className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div
      id="modal-data-import"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white flex items-center gap-2">
                Import Analytical Data
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded">
                  Unified Data Layer
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Import CSV, Excel (XLSX), or JSON files for instant analysis, charts, and dashboards
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              resetState();
              onClose();
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* If successfully imported */}
          {status === 'ready' && importedDataset ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-emerald-300">
                    Dataset Successfully Imported!
                  </h4>
                  <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed">
                    <strong>{importedDataset.name}</strong> is now registered in the Unified Data Layer.
                    You can execute SQL queries, build visualizations, create dashboards, and inspect data quality with the same workflows used for SQL database tables.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs font-mono">
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      Table: <strong className="text-white">{importedDataset.tableName}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      Format: <strong className="text-emerald-400">{importedDataset.fileType}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      Rows: <strong className="text-white">{importedDataset.rowCount.toLocaleString()}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      Columns: <strong className="text-white">{importedDataset.columns.length}</strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Destinations */}
              <div className="space-y-3">
                <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  What would you like to do next?
                </h5>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    id="btn-goto-analysis"
                    onClick={() => {
                      onImportSuccess(importedDataset, 'analysis');
                      onClose();
                    }}
                    className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 text-left transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-semibold text-white group-hover:text-emerald-300">
                      Analysis Studio
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Run filters, aggregations, cohort &amp; retention analysis
                    </p>
                  </button>

                  <button
                    id="btn-goto-visualization"
                    onClick={() => {
                      onImportSuccess(importedDataset, 'visualization');
                      onClose();
                    }}
                    className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 text-left transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                      <BarChart2 className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-semibold text-white group-hover:text-indigo-300">
                      Create Visualization
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Build bar, line, pie, scatter charts and KPI metrics
                    </p>
                  </button>

                  <button
                    id="btn-goto-sql"
                    onClick={() => {
                      onImportSuccess(importedDataset, 'sql');
                      onClose();
                    }}
                    className="p-4 rounded-xl bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800 text-left transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform">
                      <FileCode className="w-4 h-4" />
                    </div>
                    <div className="text-xs font-semibold text-white group-hover:text-sky-300">
                      SQL Editor
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Execute analytical SQL queries with SQLite dialect
                    </p>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: File Drop Zone */}
              {!validationResult ? (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                    dragActive
                      ? 'border-emerald-400 bg-emerald-950/20'
                      : 'border-slate-700 hover:border-slate-500 bg-slate-950/40 hover:bg-slate-800/30'
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.json,text/csv,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={handleFileChange}
                    className="hidden"
                  />

                  <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center mx-auto mb-3 shadow-inner text-emerald-400">
                    <Upload className="w-7 h-7" />
                  </div>

                  <h4 className="text-sm font-semibold text-slate-200 mb-1">
                    Drag and drop your dataset file here, or click to browse
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                    Supports <strong>CSV</strong> (auto-detects delimiters), <strong>Excel (.xlsx, .xls)</strong> with worksheet selection, and <strong>JSON</strong> (tabular object arrays). Maximum file size: 25MB.
                  </p>

                  <div className="flex items-center justify-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-emerald-300 border border-slate-700">
                      .csv
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-green-300 border border-slate-700">
                      .xlsx / .xls
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono text-amber-300 border border-slate-700">
                      .json
                    </span>
                  </div>
                </div>
              ) : (
                /* Step 2: Selected File Info and Configuration */
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-slate-800/70 border border-slate-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center">
                        {getFileTypeIcon(validationResult.fileType)}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-white truncate max-w-xs">
                            {selectedFile?.name}
                          </span>
                          <span className="px-1.5 py-0.2 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                            {validationResult.fileType}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                          {(validationResult.fileSize / 1024).toFixed(1)} KB • {validationResult.rowCount?.toLocaleString()} rows • {validationResult.columnCount} columns
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={resetState}
                      className="text-xs text-slate-400 hover:text-rose-400 px-2.5 py-1 rounded hover:bg-slate-800 border border-slate-700 transition-colors"
                    >
                      Choose Different File
                    </button>
                  </div>

                  {/* Worksheet selector if XLSX has multiple sheets */}
                  {validationResult.sheets && validationResult.sheets.length > 1 && (
                    <div className="p-3.5 rounded-lg bg-slate-800/40 border border-slate-700/60 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                        <span>Workbook contains multiple worksheets. Select sheet to import:</span>
                      </div>
                      <select
                        value={selectedSheet}
                        onChange={e => handleSheetChange(e.target.value)}
                        className="px-2.5 py-1 text-xs bg-slate-900 border border-slate-700 rounded text-slate-200 font-medium focus:outline-hidden focus:border-emerald-500"
                      >
                        {validationResult.sheets.map(s => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Dataset Name Input */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                        Dataset Name in Workspace
                      </label>
                      <input
                        type="text"
                        value={datasetName}
                        onChange={e => setDatasetName(e.target.value)}
                        placeholder="e.g. Sales Q3 2024"
                        className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-600 focus:outline-hidden focus:border-emerald-500 font-medium"
                      />
                    </div>
                  </div>

                  {/* Tabs: Data Preview vs Data Profiling */}
                  <div className="border-b border-slate-800 flex items-center space-x-4">
                    <button
                      onClick={() => setActiveTab('preview')}
                      className={`pb-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                        activeTab === 'preview'
                          ? 'border-emerald-500 text-emerald-400'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Data Preview (First {validationResult.previewRows?.length || 0} Rows)</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('profile')}
                      className={`pb-2 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
                        activeTab === 'profile'
                          ? 'border-emerald-500 text-emerald-400'
                          : 'border-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <BarChart2 className="w-3.5 h-3.5" />
                      <span>Column Types &amp; Profiling ({validationResult.columns?.length || 0})</span>
                    </button>
                  </div>

                  {/* Preview Tab Content */}
                  {activeTab === 'preview' && (
                    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                      <div className="max-h-60 overflow-x-auto overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse font-mono">
                          <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800 z-10">
                            <tr>
                              <th className="px-3 py-2 text-[10px] uppercase text-slate-500 w-10">#</th>
                              {validationResult.columns?.map(col => (
                                <th key={col.name} className="px-3 py-2 text-[11px] font-medium text-slate-300">
                                  <div className="flex items-center space-x-1.5">
                                    <span>{col.name}</span>
                                    <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 font-normal">
                                      {col.dataType}
                                    </span>
                                  </div>
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300">
                            {validationResult.previewRows?.map((row, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/50">
                                <td className="px-3 py-1.5 text-[10px] text-slate-600 select-none">
                                  {idx + 1}
                                </td>
                                {validationResult.columns?.map(col => {
                                  const val = row[col.name];
                                  const isNull = val === null || val === undefined;
                                  return (
                                    <td key={col.name} className="px-3 py-1.5 whitespace-nowrap text-xs">
                                      {isNull ? (
                                        <span className="text-[10px] text-amber-500/70 italic">null</span>
                                      ) : typeof val === 'boolean' ? (
                                        <span className={val ? 'text-emerald-400' : 'text-rose-400'}>
                                          {String(val)}
                                        </span>
                                      ) : (
                                        String(val)
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Profiling Tab Content */}
                  {activeTab === 'profile' && (
                    <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                      <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-left text-xs border-collapse font-mono">
                          <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800">
                            <tr>
                              <th className="px-3 py-2 text-[11px]">Column Name</th>
                              <th className="px-3 py-2 text-[11px]">Inferred Type</th>
                              <th className="px-3 py-2 text-[11px]">Null Count</th>
                              <th className="px-3 py-2 text-[11px]">Distinct Samples</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-850 text-slate-300">
                            {validationResult.columns?.map(col => (
                              <tr key={col.name} className="hover:bg-slate-900/50">
                                <td className="px-3 py-2 font-medium text-white">{col.name}</td>
                                <td className="px-3 py-2">
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px]">
                                    {col.dataType}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-slate-400">
                                  {col.nullCount > 0 ? (
                                    <span className="text-amber-400 font-semibold">{col.nullCount} nulls</span>
                                  ) : (
                                    <span className="text-slate-500">0</span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-slate-400 truncate max-w-xs">
                                  {col.sampleValues && col.sampleValues.length > 0
                                    ? col.sampleValues.slice(0, 3).map(String).join(', ')
                                    : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Status / Error Banner */}
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {statusMessage && status !== 'ready' && (
            <div className="p-3.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300 flex items-center gap-2.5">
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin flex-shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="text-xs text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>Formulas are parsed safely as raw data without execution</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                resetState();
                onClose();
              }}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
            >
              {status === 'ready' ? 'Close' : 'Cancel'}
            </button>

            {validationResult && status !== 'ready' && (
              <button
                id="btn-confirm-import"
                onClick={handleConfirmImport}
                disabled={status === 'processing' || status === 'validating'}
                className="px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg shadow-sm transition-all disabled:opacity-50 flex items-center gap-1.5"
              >
                {status === 'processing' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Import Dataset</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
