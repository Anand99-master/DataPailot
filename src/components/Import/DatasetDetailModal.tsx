import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  FileText,
  FileCode,
  Calendar,
  Layers,
  Download,
  Trash2,
  Edit2,
  Check,
  BarChart2,
  Eye,
  RefreshCw,
  Sparkles,
  Info,
  Wand2
} from 'lucide-react';
import { ImportedDataset, ExportFormat } from '../../types/import';
import { ImportApiClient } from '../../services/importApi';

interface DatasetDetailModalProps {
  dataset: ImportedDataset | null;
  isOpen: boolean;
  onClose: () => void;
  onDatasetDeleted: (datasetId: string) => void;
  onDatasetRenamed: (dataset: ImportedDataset) => void;
  onAnalyzeDataset?: (dataset: ImportedDataset) => void;
  onCleanDataset?: (dataset: ImportedDataset) => void;
}

export const DatasetDetailModal: React.FC<DatasetDetailModalProps> = ({
  dataset,
  isOpen,
  onClose,
  onDatasetDeleted,
  onDatasetRenamed,
  onAnalyzeDataset,
  onCleanDataset
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'profile'>('preview');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !dataset) return null;

  const handleStartRename = () => {
    setEditedName(dataset.name);
    setIsEditingName(true);
  };

  const handleSaveRename = async () => {
    if (!editedName.trim() || editedName === dataset.name) {
      setIsEditingName(false);
      return;
    }
    try {
      const updated = await ImportApiClient.renameDataset(dataset.datasetId, editedName.trim());
      onDatasetRenamed(updated);
      setIsEditingName(false);
    } catch (err: any) {
      alert(err.message || 'Failed to rename dataset');
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete dataset '${dataset.name}'? This will remove its table and profile.`)) {
      return;
    }
    setIsDeleting(true);
    try {
      await ImportApiClient.removeDataset(dataset.datasetId);
      onDatasetDeleted(dataset.datasetId);
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to delete dataset');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      await ImportApiClient.exportDataset(dataset.datasetId, format);
    } catch (err: any) {
      alert(err.message || 'Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const getFormatIcon = () => {
    switch (dataset.fileType) {
      case 'CSV':
        return <FileText className="w-5 h-5 text-emerald-400" />;
      case 'XLSX':
        return <FileSpreadsheet className="w-5 h-5 text-green-400" />;
      case 'JSON':
        return <FileCode className="w-5 h-5 text-amber-400" />;
    }
  };

  return (
    <div
      id="modal-dataset-details"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden text-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center">
              {getFormatIcon()}
            </div>
            <div>
              {isEditingName ? (
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={editedName}
                    onChange={e => setEditedName(e.target.value)}
                    className="px-2 py-0.5 text-sm bg-slate-950 border border-emerald-500 rounded text-white font-medium focus:outline-hidden"
                    autoFocus
                  />
                  <button
                    onClick={handleSaveRename}
                    className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-500"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setIsEditingName(false)}
                    className="p-1 rounded bg-slate-800 text-slate-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-base text-white">{dataset.name}</h3>
                  <button
                    onClick={handleStartRename}
                    className="text-slate-500 hover:text-slate-300 p-0.5"
                    title="Rename dataset"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center space-x-3">
                <span>Table: <strong className="text-emerald-400">{dataset.tableName}</strong></span>
                <span>•</span>
                <span>Format: {dataset.fileType}</span>
                <span>•</span>
                <span>{dataset.rowCount.toLocaleString()} rows</span>
                <span>•</span>
                <span>{dataset.columns.length} columns</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Export Menu */}
            <div className="flex items-center rounded-lg bg-slate-800 border border-slate-700 overflow-hidden text-xs">
              <span className="px-2 py-1 text-slate-400 flex items-center gap-1 border-r border-slate-700">
                <Download className="w-3 h-3" />
                <span>Export:</span>
              </span>
              <button
                onClick={() => handleExport('csv')}
                disabled={isExporting}
                className="px-2.5 py-1 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              >
                CSV
              </button>
              <button
                onClick={() => handleExport('xlsx')}
                disabled={isExporting}
                className="px-2.5 py-1 hover:bg-slate-700 text-slate-300 hover:text-white border-l border-slate-700 transition-colors"
              >
                Excel
              </button>
              <button
                onClick={() => handleExport('json')}
                disabled={isExporting}
                className="px-2.5 py-1 hover:bg-slate-700 text-slate-300 hover:text-white border-l border-slate-700 transition-colors"
              >
                JSON
              </button>
            </div>

            {onCleanDataset && (
              <button
                onClick={() => {
                  onCleanDataset(dataset);
                  onClose();
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
                title="Open Data Cleaning Workspace"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Clean & Transform</span>
              </button>
            )}

            {onAnalyzeDataset && (
              <button
                onClick={() => {
                  onAnalyzeDataset(dataset);
                  onClose();
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg flex items-center gap-1.5 shadow-sm transition-colors"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analyze</span>
              </button>
            )}

            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 transition-colors"
              title="Delete dataset"
            >
              <Trash2 className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-slate-800 flex items-center space-x-6 bg-slate-900/50">
          <button
            onClick={() => setActiveTab('preview')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'preview'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Data Preview ({dataset.previewRows?.length || 0} Rows)</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span>Data Profile &amp; Statistics</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'preview' && (
            <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950 shadow-inner">
              <div className="max-h-[55vh] overflow-x-auto overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse font-mono">
                  <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800 z-10">
                    <tr>
                      <th className="px-3 py-2 text-[10px] uppercase text-slate-500 w-10">#</th>
                      {dataset.columns.map(col => (
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
                    {dataset.previewRows?.map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/50">
                        <td className="px-3 py-1.5 text-[10px] text-slate-600 select-none">{idx + 1}</td>
                        {dataset.columns.map(col => {
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

          {activeTab === 'profile' && dataset.profile && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(dataset.profile.columns).map(cp => (
                  <div
                    key={cp.columnName}
                    className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/70 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-white truncate max-w-[160px]">
                          {cp.columnName}
                        </span>
                        <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {cp.dataType}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-slate-300 font-mono">
                        <div className="flex justify-between">
                          <span className="text-slate-400">Nulls:</span>
                          <span className={cp.nullCount > 0 ? 'text-amber-400' : 'text-slate-400'}>
                            {cp.nullCount} ({cp.nullPercentage}%)
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-400">Distinct Values:</span>
                          <span>{cp.uniqueCount} ({cp.uniquePercentage}%)</span>
                        </div>

                        {cp.min !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Min:</span>
                            <span className="truncate max-w-[120px]">{String(cp.min)}</span>
                          </div>
                        )}
                        {cp.max !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Max:</span>
                            <span className="truncate max-w-[120px]">{String(cp.max)}</span>
                          </div>
                        )}
                        {cp.average !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Average:</span>
                            <span>{cp.average}</span>
                          </div>
                        )}
                        {cp.median !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Median:</span>
                            <span>{cp.median}</span>
                          </div>
                        )}
                        {cp.standardDeviation !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Std Dev:</span>
                            <span>{cp.standardDeviation}</span>
                          </div>
                        )}
                        {cp.shortestLength !== undefined && (
                          <div className="flex justify-between">
                            <span className="text-slate-400">Length (min / max):</span>
                            <span>{cp.shortestLength} / {cp.longestLength}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {cp.sampleValues && cp.sampleValues.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-700/60 text-[11px] text-slate-400">
                        <span className="text-slate-500">Samples: </span>
                        <span className="truncate font-mono">{cp.sampleValues.slice(0, 3).map(String).join(', ')}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex items-center justify-between bg-slate-900/90 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            <span>Exports feature automatic CSV/Excel formula injection sanitization</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
