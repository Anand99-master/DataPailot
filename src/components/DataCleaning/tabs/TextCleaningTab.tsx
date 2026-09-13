import React, { useState, useMemo } from 'react';
import { Type, Sparkles, Plus, Trash2, ArrowRight, Check } from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';

interface TextCleaningTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

export const TextCleaningTab: React.FC<TextCleaningTabProps> = ({ dataset, onAddStep }) => {
  const textCols = useMemo(() => {
    return dataset.columns.filter(c => c.dataType === 'text' || c.dataType === 'unknown');
  }, [dataset.columns]);

  const [selectedColumn, setSelectedColumn] = useState<string>(textCols[0]?.name || dataset.columns[0]?.name || '');
  const [trim, setTrim] = useState(true);
  const [collapseSpaces, setCollapseSpaces] = useState(true);
  const [caseTransform, setCaseTransform] = useState<'none' | 'upper' | 'lower' | 'title'>('none');

  // Find and replace list
  const [findReplaceList, setFindReplaceList] = useState<{ find: string; replace: string; matchCase: boolean }[]>([]);
  const [newFind, setNewFind] = useState('');
  const [newReplace, setNewReplace] = useState('');
  const [newMatchCase, setNewMatchCase] = useState(false);

  // Inconsistent value standardization (clusters of near-duplicates)
  const inconsistentClusters = useMemo(() => {
    if (!selectedColumn) return [];
    const rows = dataset.previewRows || [];
    const counts = new Map<string, number>();

    rows.forEach(r => {
      const val = r[selectedColumn];
      if (typeof val === 'string' && val.trim()) {
        counts.set(val, (counts.get(val) || 0) + 1);
      }
    });

    // Group by lower + trimmed
    const grouped = new Map<string, string[]>();
    for (const raw of counts.keys()) {
      const normalized = raw.trim().toLowerCase();
      if (!grouped.has(normalized)) grouped.set(normalized, []);
      grouped.get(normalized)!.push(raw);
    }

    const clusters: { key: string; variants: string[]; canonical: string; count: number }[] = [];
    for (const [key, variants] of grouped.entries()) {
      if (variants.length > 1) {
        // Pick the most common variant as canonical or title-cased
        let bestVar = variants[0];
        let maxC = 0;
        variants.forEach(v => {
          const c = counts.get(v) || 0;
          if (c > maxC) {
            maxC = c;
            bestVar = v;
          }
        });
        clusters.push({
          key,
          variants,
          canonical: bestVar.trim(),
          count: variants.reduce((acc, v) => acc + (counts.get(v) || 0), 0)
        });
      }
    }

    return clusters;
  }, [dataset.previewRows, selectedColumn]);

  const [approvedClusters, setApprovedClusters] = useState<Record<string, string>>({});

  const handleAddFindReplace = () => {
    if (!newFind) return;
    setFindReplaceList(prev => [...prev, { find: newFind, replace: newReplace, matchCase: newMatchCase }]);
    setNewFind('');
    setNewReplace('');
  };

  const handleRemoveFindReplace = (idx: number) => {
    setFindReplaceList(prev => prev.filter((_, i) => i !== idx));
  };

  const handleAddStep = () => {
    if (!selectedColumn) return;

    const stdValues: { from: string[]; to: string }[] = [];
    for (const cluster of inconsistentClusters) {
      const target = approvedClusters[cluster.key] || cluster.canonical;
      stdValues.push({
        from: cluster.variants,
        to: target
      });
    }

    const descParts: string[] = [];
    if (trim) descParts.push('trim whitespace');
    if (collapseSpaces) descParts.push('collapse multi-spaces');
    if (caseTransform !== 'none') descParts.push(`convert to ${caseTransform} case`);
    if (findReplaceList.length > 0) descParts.push(`${findReplaceList.length} find/replace rules`);
    if (stdValues.length > 0) descParts.push(`standardize ${stdValues.length} inconsistent groups`);

    const step: TransformStep = {
      id: `step_${Date.now()}_text_clean`,
      type: 'TEXT_CLEAN',
      column: selectedColumn,
      description: `Text clean on "${selectedColumn}": ${descParts.join(', ')}`,
      params: {
        column: selectedColumn,
        trim,
        collapseSpaces,
        caseTransform,
        findReplace: findReplaceList,
        standardizeValues: stdValues.length > 0 ? stdValues : undefined
      },
      enabled: true,
      createdAt: new Date().toISOString()
    };

    onAddStep(step);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-5">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <Type className="w-4 h-4 text-indigo-400" />
          <span>Configure Text Normalization</span>
        </h4>

        {/* Column Selection */}
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1.5">Target Text Column</label>
          <select
            value={selectedColumn}
            onChange={e => setSelectedColumn(e.target.value)}
            className="w-full max-w-md px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 font-mono focus:outline-hidden"
          >
            {dataset.columns.map(c => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.dataType})
              </option>
            ))}
          </select>
        </div>

        {/* Basic String Operations */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-lg bg-slate-950/60 border border-slate-800">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">Whitespace Handling</label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={trim}
                  onChange={e => setTrim(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Trim Leading & Trailing Spaces</span>
              </label>
              <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={collapseSpaces}
                  onChange={e => setCollapseSpaces(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Collapse Multiple Consecutive Spaces</span>
              </label>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-2">Letter Case Transformation</label>
            <select
              value={caseTransform}
              onChange={e => setCaseTransform(e.target.value as any)}
              className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-hidden"
            >
              <option value="none">No case change (preserve)</option>
              <option value="title">Title Case (e.g. John Doe)</option>
              <option value="lower">lowercase (e.g. john doe)</option>
              <option value="upper">UPPERCASE (e.g. JOHN DOE)</option>
            </select>
          </div>
        </div>

        {/* Inconsistent Value Standardization Clusters */}
        {inconsistentClusters.length > 0 && (
          <div className="p-4 rounded-lg bg-indigo-950/20 border border-indigo-900/40 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Detected Inconsistent Value Variants ({inconsistentClusters.length} clusters)</span>
              </span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {inconsistentClusters.map(cluster => (
                <div
                  key={cluster.key}
                  className="p-2.5 rounded bg-slate-950/80 border border-slate-800 text-xs flex items-center justify-between space-x-3"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span className="text-slate-400">Variants:</span>
                    <div className="flex flex-wrap gap-1">
                      {cluster.variants.map(v => (
                        <span key={v} className="px-1.5 py-0.5 rounded bg-slate-800 font-mono text-[11px] text-amber-300">
                          &quot;{v}&quot;
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                    <span className="text-slate-400 text-[11px]">Map to:</span>
                    <input
                      type="text"
                      value={approvedClusters[cluster.key] ?? cluster.canonical}
                      onChange={e => {
                        const val = e.target.value;
                        setApprovedClusters(prev => ({ ...prev, [cluster.key]: val }));
                      }}
                      className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-emerald-400 focus:outline-hidden w-28"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Find and Replace Sub-Form */}
        <div className="p-4 rounded-lg bg-slate-950/60 border border-slate-800 space-y-3">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
            Find & Replace Rules
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Find text..."
              value={newFind}
              onChange={e => setNewFind(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-hidden font-mono"
            />
            <input
              type="text"
              placeholder="Replace with..."
              value={newReplace}
              onChange={e => setNewReplace(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder-slate-600 focus:outline-hidden font-mono"
            />
            <label className="flex items-center space-x-1.5 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={newMatchCase}
                onChange={e => setNewMatchCase(e.target.checked)}
                className="rounded text-indigo-600"
              />
              <span>Match Case</span>
            </label>
            <button
              onClick={handleAddFindReplace}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
            >
              + Add Rule
            </button>
          </div>

          {findReplaceList.length > 0 && (
            <div className="space-y-1.5 pt-2">
              {findReplaceList.map((fr, idx) => (
                <div
                  key={idx}
                  className="px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-xs flex items-center justify-between font-mono"
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-amber-300">&quot;{fr.find}&quot;</span>
                    <ArrowRight className="w-3 h-3 text-slate-600" />
                    <span className="text-emerald-400">&quot;{fr.replace}&quot;</span>
                    {fr.matchCase && <span className="text-[10px] text-slate-500">(Case-sensitive)</span>}
                  </div>
                  <button
                    onClick={() => handleRemoveFindReplace(idx)}
                    className="text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleAddStep}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Text Cleaning Step to Pipeline</span>
          </button>
        </div>
      </div>
    </div>
  );
};
