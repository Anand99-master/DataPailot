import React from 'react';
import { Loader2, XCircle, CheckCircle, Clock, Zap, Database, AlertCircle } from 'lucide-react';
import { PerformanceJobProgress } from '../../services/performanceApi';

interface PerformanceProgressModalProps {
  job: PerformanceJobProgress | null;
  isOpen: boolean;
  title?: string;
  onCancel?: () => void;
  onClose?: () => void;
}

export const PerformanceProgressModal: React.FC<PerformanceProgressModalProps> = ({
  job,
  isOpen,
  title = 'Processing Dataset',
  onCancel,
  onClose
}) => {
  if (!isOpen || !job) return null;

  const isCompleted = job.status === 'completed';
  const isFailed = job.status === 'failed';
  const isCancelling = job.status === 'cancelling';
  const isProcessing = job.status === 'processing' || job.status === 'preparing';

  const formatNumber = (num: number) => (num ? num.toLocaleString() : '0');
  const formatTime = (ms: number) => {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    const remSec = sec % 60;
    return `${min}m ${remSec}s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden transition-all animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              isCompleted
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                : isFailed
                ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
            }`}>
              {isCompleted ? (
                <CheckCircle className="w-5 h-5" />
              ) : isFailed ? (
                <AlertCircle className="w-5 h-5" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {job.currentStepName || (isCompleted ? 'Operation Complete' : 'Processing rows...')}
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
              <span>{job.stepNumber && job.totalSteps ? `Step ${job.stepNumber} of ${job.totalSteps}` : 'Overall Progress'}</span>
              <span>{job.percent}%</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : isFailed
                    ? 'bg-rose-500'
                    : 'bg-indigo-600 dark:bg-indigo-500'
                }`}
                style={{ width: `${Math.max(2, job.percent)}%` }}
              />
            </div>
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <Database className="w-3.5 h-3.5" />
                <span>Rows Processed</span>
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {formatNumber(job.rowsProcessed)} <span className="text-xs font-normal text-slate-500">/ {formatNumber(job.totalRows)}</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <Zap className="w-3.5 h-3.5" />
                <span>Processing Speed</span>
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {formatNumber(job.speedRowsPerSec)} <span className="text-xs font-normal text-slate-500">rows/sec</span>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Elapsed Time</span>
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {formatTime(job.elapsedMs)}
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-lg p-3 border border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Estimated Remaining</span>
              </div>
              <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {isCompleted ? '0s' : job.etaSeconds > 0 ? `${job.etaSeconds}s` : 'Calculating...'}
              </div>
            </div>
          </div>

          {/* Status / Error Message */}
          {job.error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300">
              {job.error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
          {isProcessing && onCancel && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg border border-rose-200 dark:border-rose-900 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <XCircle className="w-3.5 h-3.5" />
              {isCancelling ? 'Cancelling...' : 'Cancel Operation'}
            </button>
          )}

          {(isCompleted || isFailed) && onClose && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-100 dark:hover:bg-slate-200 dark:text-slate-900 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
