import React, { useState, useEffect } from 'react';
import { ShieldAlert, AlertTriangle, Info, Download, Loader2, Table2, Search, FileSpreadsheet, RefreshCw, BarChart, Database, Activity, Type, Hash, ShieldCheck, ShieldX, Copy } from 'lucide-react';
import { DatabaseApiClient } from '../../services/databaseApi';
import { DiscoveredTable, SanitizedConnectionInfo } from '../../types/database';
import { DataProfile, ColumnProfile, QualityIssue } from '../../types/import';
import { ExcelExportService } from '../../services/excelExportService';

interface DataQualityWorkspaceProps {
  selectedTable: DiscoveredTable | null;
  connection: SanitizedConnectionInfo | null;
  onSelectTable: (table: DiscoveredTable) => void;
  tables: DiscoveredTable[];
}

export const DataQualityWorkspace: React.FC<DataQualityWorkspaceProps> = ({
  selectedTable,
  connection,
  onSelectTable,
  tables
}) => {
  const [profile, setProfile] = useState<DataProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'columns' | 'issues'>('overview');
  const [searchQuery, setSearchQuery] = useState('');

  const loadProfile = async (schema: string, name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await DatabaseApiClient.getDataQualityProfile(schema, name);
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load data quality profile.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedTable) {
      loadProfile(selectedTable.schema, selectedTable.name);
    } else {
      setProfile(null);
    }
  }, [selectedTable]);

  const handleExport = () => {
    if (!profile) return;
    const columns = [
      { name: 'Column Name', dataType: 'varchar' },
      { name: 'Data Type', dataType: 'varchar' },
      { name: 'Null Count', dataType: 'integer' },
      { name: 'Null Percentage', dataType: 'numeric' },
      { name: 'Missing Count', dataType: 'integer' },
      { name: 'Missing Percentage', dataType: 'numeric' },
      { name: 'Unique Count', dataType: 'integer' },
      { name: 'Unique Percentage', dataType: 'numeric' },
      { name: 'Duplicate Count', dataType: 'integer' },
      { name: 'Duplicate Percentage', dataType: 'numeric' },
      { name: 'Outlier Count', dataType: 'integer' },
      { name: 'Outlier Percentage', dataType: 'numeric' },
      { name: 'Zero Count', dataType: 'integer' },
      { name: 'Negative Count', dataType: 'integer' },
      { name: 'Type Consistency %', dataType: 'numeric' },
      { name: 'Quality Status', dataType: 'varchar' }
    ];
    
    const rows = Object.values(profile.columns).map(col => ({
      'Column Name': col.columnName,
      'Data Type': col.dataType,
      'Null Count': col.nullCount,
      'Null Percentage': col.nullPercentage,
      'Missing Count': col.missingCount || 0,
      'Missing Percentage': col.missingPercentage || 0,
      'Unique Count': col.uniqueCount,
      'Unique Percentage': col.uniquePercentage,
      'Duplicate Count': col.duplicateCount || 0,
      'Duplicate Percentage': col.duplicatePercentage || 0,
      'Outlier Count': col.outlierCount || 0,
      'Outlier Percentage': col.outlierPercentage || 0,
      'Zero Count': col.zeroCount || 0,
      'Negative Count': col.negativeCount || 0,
      'Type Consistency %': col.typeConsistencyPercentage || 100,
      'Quality Status': col.qualityStatus || 'Good'
    }));

    try {
      ExcelExportService.exportQueryResultToExcel(columns, rows, {
        filename: `${profile.datasetName}_data_quality.xlsx`,
        sheetName: 'Column Profile',
        sourceName: profile.datasetName
      });
    } catch (err) {
      console.error('Failed to export:', err);
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-rose-500" />
          <p>Profiling data quality (may take a moment for large datasets)...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-rose-400 space-y-2">
          <ShieldX className="w-12 h-12 mb-2 opacity-50" />
          <p className="font-semibold text-lg">Profiling Failed</p>
          <p className="text-sm opacity-80">{error}</p>
          <button 
            onClick={() => selectedTable && loadProfile(selectedTable.schema, selectedTable.name)}
            className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors text-sm flex items-center space-x-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry</span>
          </button>
        </div>
      );
    }

    if (!profile) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-500">
          <ShieldAlert className="w-12 h-12 mb-4 opacity-50" />
          <p>Select a table or imported dataset from the sidebar to view its Data Quality profile.</p>
        </div>
      );
    }

    const filteredColumns = Object.values(profile.columns).filter(c => 
      c.columnName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getScoreColor = (score?: number) => {
      if (score === undefined) return 'text-slate-400';
      if (score >= 90) return 'text-emerald-400';
      if (score >= 75) return 'text-amber-400';
      if (score >= 60) return 'text-orange-400';
      return 'text-rose-400';
    };

    return (
      <div className="h-full overflow-y-auto p-6 space-y-6">
        {/* Score Card Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="col-span-1 md:col-span-1 bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center">
            <div className={`text-5xl font-bold ${getScoreColor(profile.overallQualityScore)}`}>
              {profile.overallQualityScore ?? '--'}
            </div>
            <div className="text-sm font-semibold text-slate-300 mt-2 uppercase tracking-wider">
              {profile.qualityScoreCategory || 'Unknown'} Quality
            </div>
            <div className="text-xs text-slate-500 mt-1 text-center">Overall Health Score</div>
          </div>
          
          <div className="col-span-1 md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
              <div className="flex items-center space-x-2 text-slate-400 mb-2">
                <Hash className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Total Rows</span>
              </div>
              <div className="text-2xl font-bold text-white">{profile.totalRows.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
              <div className="flex items-center space-x-2 text-slate-400 mb-2">
                <Table2 className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Columns</span>
              </div>
              <div className="text-2xl font-bold text-white">{profile.totalColumns.toLocaleString()}</div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
              <div className="flex items-center space-x-2 text-slate-400 mb-2">
                <Copy className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Duplicated Rows</span>
              </div>
              <div className={`text-2xl font-bold ${profile.duplicateRowCount ? 'text-rose-400' : 'text-emerald-400'}`}>
                {profile.duplicateRowCount?.toLocaleString() || '0'}
                <span className="text-sm ml-1 opacity-70">({profile.duplicateRowPercentage || 0}%)</span>
              </div>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-center">
              <div className="flex items-center space-x-2 text-slate-400 mb-2">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase">Critical Issues</span>
              </div>
              <div className="text-2xl font-bold text-rose-400">
                {profile.issues?.filter(i => i.severity === 'Critical').length || 0}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-800">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'overview' ? 'border-rose-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Column Profile
          </button>
          <button
            onClick={() => setActiveTab('issues')}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center space-x-2 ${
              activeTab === 'issues' ? 'border-rose-500 text-white' : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Issues</span>
            {profile.issues && profile.issues.length > 0 && (
              <span className="bg-rose-500/20 text-rose-400 py-0.5 px-2 rounded-full text-[10px]">
                {profile.issues.length}
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search columns..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-rose-500 w-64 transition-colors"
                />
              </div>
              <button
                onClick={handleExport}
                className="flex items-center space-x-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium rounded-lg border border-slate-700 transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>Export Profile to Excel</span>
              </button>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Column</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Missing %</th>
                      <th className="px-4 py-3 font-semibold">Unique %</th>
                      <th className="px-4 py-3 font-semibold">Outlier %</th>
                      <th className="px-4 py-3 font-semibold">Type Consist.</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredColumns.map(col => (
                      <tr key={col.columnName} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-4 py-3 font-mono text-emerald-300">{col.columnName}</td>
                        <td className="px-4 py-3 text-slate-300">{col.dataType}</td>
                        <td className="px-4 py-3">
                          <span className={`${(col.missingPercentage || 0) > 5 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {col.missingPercentage || 0}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-400">{col.uniquePercentage}%</td>
                        <td className="px-4 py-3">
                          <span className={`${(col.outlierPercentage || 0) > 2 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {col.outlierPercentage || 0}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`${(col.typeConsistencyPercentage || 100) < 100 ? 'text-rose-400' : 'text-slate-400'}`}>
                            {col.typeConsistencyPercentage || 100}%
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            col.qualityStatus === 'Good' ? 'bg-emerald-500/10 text-emerald-400' :
                            col.qualityStatus === 'Warning' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-rose-500/10 text-rose-400'
                          }`}>
                            {col.qualityStatus || 'Good'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'issues' && (
          <div className="space-y-4">
            {!profile.issues || profile.issues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-500 border border-slate-800 rounded-xl bg-slate-900 border-dashed">
                <ShieldCheck className="w-12 h-12 mb-3 text-emerald-500/50" />
                <p className="font-semibold text-white">No Issues Detected</p>
                <p className="text-sm mt-1">This dataset appears to have excellent data quality.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {profile.issues.map((issue, idx) => (
                  <div key={idx} className={`p-4 rounded-xl border flex items-start space-x-4 ${
                    issue.severity === 'Critical' ? 'bg-rose-950/20 border-rose-900/50' :
                    issue.severity === 'Warning' ? 'bg-amber-950/20 border-amber-900/50' :
                    'bg-slate-900 border-slate-800'
                  }`}>
                    {issue.severity === 'Critical' && <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />}
                    {issue.severity === 'Warning' && <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />}
                    {issue.severity === 'Info' && <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />}
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-white">{issue.column}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          issue.severity === 'Critical' ? 'bg-rose-500/20 text-rose-400' :
                          issue.severity === 'Warning' ? 'bg-amber-500/20 text-amber-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {issue.severity}
                        </span>
                      </div>
                      <p className="text-slate-300 mt-1">{issue.issue}</p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-slate-400">
                        <span>Affected: {issue.affectedRowCount?.toLocaleString()} rows ({issue.affectedPercentage}%)</span>
                        <span>Recommendation: {issue.recommendedAction}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full bg-slate-950 overflow-hidden">
      {/* Sidebar selection handled by App.tsx generally, but we assume table is selected */}
      <div className="flex-1 flex flex-col min-w-0 h-full relative">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <ShieldAlert className="w-6 h-6 text-rose-400" />
              <div>
                <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                  <span>Data Quality</span>
                  <span className="text-slate-600">/</span>
                  <span className="text-emerald-400 font-mono text-base">{selectedTable?.name || 'No Source Selected'}</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Automated profiling, anomaly detection, and data health scoring.
                </p>
              </div>
            </div>
            {selectedTable && (
              <button
                onClick={() => loadProfile(selectedTable.schema, selectedTable.name)}
                disabled={isLoading}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-50"
                title="Refresh Profile"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>
        </div>
        
        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden relative">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};
