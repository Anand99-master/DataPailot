import React, { useState } from 'react';
import { X, Save, Download, ShieldCheck, CheckCircle2, Sparkles, Layers } from 'lucide-react';
import { ImportedDataset, ExportFormat } from '../../types/import';
import { TransformStep } from '../../types/cleaning';

interface SaveCleanedDatasetModalProps {
  dataset: ImportedDataset;
  pipeline: TransformStep[];
  onClose: () => void;
  onSave: (newName: string) => Promise<void>;
  onExport: (format: ExportFormat, customName?: string) => Promise<void>;
}

export const SaveCleanedDatasetModal: React.FC<SaveCleanedDatasetModalProps> = ({
  dataset,
  pipeline,
  onClose,
  onSave,
  onExport
}) => {
  const [activeTab, setActiveTab] = useState<'save' | 'export'>('save');
  const [datasetName, setDatasetName] = useState(`${dataset.name}_cleaned`);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSave = async () => {
    if (!datasetName.trim()) {
      setErrorMsg('Please provide a valid dataset name.');
      return;
    }
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      await onSave(datasetName.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save dataset.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async () => {
    setErrorMsg(null);
    setIsProcessing(true);
    try {
      await onExport(exportFormat, datasetName.trim());
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Export failed.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-semibold text-white">Save / Export Cleaned Dataset</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-800 bg-slate-950/40">
          <button
            onClick={() => setActiveTab('save')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'save'
                ? 'border-indigo-500 text-white bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Save className="w-4 h-4" />
            <span>Save to Unified Data Layer</span>
          </button>
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2.5 text-xs font-semibold flex items-center justify-center space-x-2 border-b-2 transition-colors ${
              activeTab === 'export'
                ? 'border-indigo-500 text-white bg-slate-900/50'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>Direct File Export</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-950/40 border border-rose-900 text-xs text-rose-300 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Safety Guarantee Banner */}
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-900/40 flex items-start space-x-2.5 text-xs text-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block text-emerald-300">Non-Destructive Guarantee</span>
              Original dataset <strong className="font-mono text-white">"{dataset.name}"</strong> will remain 100% untouched. A brand new versioned dataset will be created.
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1.5">
              {activeTab === 'save' ? 'New Cleaned Dataset Name' : 'Export File Base Name'}
            </label>
            <input
              type="text"
              value={datasetName}
              onChange={e => setDatasetName(e.target.value)}
              placeholder="e.g. sales_data_cleaned"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white font-mono focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {activeTab === 'save' ? (
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-slate-950/50 border border-slate-800 text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>Source Dataset:</span>
                  <span className="font-mono text-white">{dataset.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Active Cleaning Steps:</span>
                  <span className="font-mono text-indigo-400">{pipeline.filter(s => s.enabled).length} steps</span>
                </div>
                <div className="flex justify-between">
                  <span>Storage Engine:</span>
                  <span className="font-mono text-slate-300">Unified SQLite Data Layer</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <label className="text-xs font-medium text-slate-300 block mb-1.5">Export Format</label>
              <div className="grid grid-cols-3 gap-2">
                {(['csv', 'xlsx', 'json'] as ExportFormat[]).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold uppercase transition-all ${
                      exportFormat === fmt
                        ? 'bg-indigo-600/20 border-indigo-500 text-white ring-1 ring-indigo-500'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    .{fmt}
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-500">
                Formula injection protection is automatically enforced on all exported values.
              </p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950/80 border-t border-slate-800 flex justify-end space-x-2">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium transition-colors"
          >
            Cancel
          </button>
          {activeTab === 'save' ? (
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs text-white font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Registering Dataset...' : 'Save Cleaned Dataset'}</span>
            </button>
          ) : (
            <button
              onClick={handleExport}
              disabled={isProcessing}
              className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs text-white font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isProcessing ? 'Generating File...' : `Export as .${exportFormat.toUpperCase()}`}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
