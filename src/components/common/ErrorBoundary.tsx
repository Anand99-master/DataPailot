import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RefreshCw, RotateCcw, Copy, Check, ShieldAlert } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
      copied: false
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('DataPilot React Error Boundary caught an unhandled rendering error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  private handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      copied: false
    });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleCopyDebug = (): void => {
    const details = [
      `DataPilot Error: ${this.state.error?.message || 'Unknown Error'}`,
      `Component Stack: ${this.state.errorInfo?.componentStack || 'None'}`,
      `Error Stack: ${this.state.error?.stack || 'None'}`,
      `User Agent: ${navigator.userAgent}`,
      `Timestamp: ${new Date().toISOString()}`
    ].join('\n\n');

    navigator.clipboard.writeText(details).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2500);
    });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          id="datapilot-error-boundary"
          className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-6 text-slate-100 font-sans"
        >
          <div className="max-w-xl w-full bg-slate-900 border border-red-500/30 rounded-xl p-6 shadow-2xl shadow-red-950/20">
            {/* Header */}
            <div className="flex items-center space-x-3 text-red-400 mb-4 pb-4 border-b border-slate-800">
              <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                <AlertOctagon className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {this.props.fallbackTitle || 'Something went wrong in the workspace'}
                </h2>
                <p className="text-xs text-slate-400">
                  A rendering error was safely intercepted to protect your application session.
                </p>
              </div>
            </div>

            {/* Error Message */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 mb-5 font-mono text-xs text-red-300 overflow-x-auto max-h-40">
              <div className="font-semibold text-red-400 mb-1 flex items-center space-x-1.5">
                <ShieldAlert className="w-3.5 h-3.5" />
                <span>Error details:</span>
              </div>
              <p className="whitespace-pre-wrap break-words">
                {this.state.error?.message || 'Unknown runtime error'}
              </p>
            </div>

            {/* Recovery Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                id="btn-error-reset-view"
                onClick={this.handleReset}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset View & Continue</span>
              </button>

              <button
                id="btn-error-reload-page"
                onClick={this.handleReload}
                className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload Page</span>
              </button>

              <button
                id="btn-error-copy-debug"
                onClick={this.handleCopyDebug}
                className="flex items-center space-x-1.5 px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg border border-slate-700/60 transition-colors ml-auto"
              >
                {this.state.copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                    <span>Copy Diagnostics</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
