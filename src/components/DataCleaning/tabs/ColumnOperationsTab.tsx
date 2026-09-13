import React, { useState, useMemo } from 'react';
import {
  Columns,
  Edit2,
  Trash2,
  Copy,
  ArrowUpDown,
  Split,
  Merge,
  Scissors,
  Plus,
  CheckCircle2,
  Eye,
  AlertCircle
} from 'lucide-react';
import { ImportedDataset } from '../../../types/import';
import { TransformStep } from '../../../types/cleaning';

interface ColumnOperationsTabProps {
  dataset: ImportedDataset;
  onAddStep: (step: TransformStep) => void;
}

type SubOperation = 'rename' | 'drop' | 'duplicate' | 'reorder' | 'split' | 'merge' | 'extract';

export const ColumnOperationsTab: React.FC<ColumnOperationsTabProps> = ({ dataset, onAddStep }) => {
  const [activeSubOp, setActiveSubOp] = useState<SubOperation>('rename');

  // 1. Rename
  const [renameCol, setRenameCol] = useState(dataset.columns[0]?.name || '');
  const [newName, setNewName] = useState('');

  // 2. Drop
  const [dropCols, setDropCols] = useState<string[]>([]);

  // 3. Duplicate
  const [dupCol, setDupCol] = useState(dataset.columns[0]?.name || '');
  const [dupNewName, setDupNewName] = useState(`${dataset.columns[0]?.name || 'col'}_copy`);

  // 4. Reorder
  const [orderedCols, setOrderedCols] = useState<string[]>(dataset.columns.map(c => c.name));

  // 5. Split
  const [splitCol, setSplitCol] = useState(dataset.columns[0]?.name || '');
  const [splitDelim, setSplitDelim] = useState(' ');
  const [splitCol1, setSplitCol1] = useState('Part_1');
  const [splitCol2, setSplitCol2] = useState('Part_2');
  const [splitKeepOriginal, setSplitKeepOriginal] = useState(true);

  // 6. Merge
  const [mergeCols, setMergeCols] = useState<string[]>(
    dataset.columns.length >= 2 ? [dataset.columns[0].name, dataset.columns[1].name] : []
  );
  const [mergeDelim, setMergeDelim] = useState(' ');
  const [mergeNewName, setMergeNewName] = useState('Merged_Column');
  const [mergeKeepOriginal, setMergeKeepOriginal] = useState(true);

  // 7. Extract
  const [extractCol, setExtractCol] = useState(dataset.columns[0]?.name || '');
  const [extractMode, setExtractMode] = useState<'substring' | 'prefix' | 'suffix' | 'regex'>('prefix');
  const [extractStart, setExtractStart] = useState(0);
  const [extractLength, setExtractLength] = useState(5);
  const [extractDelim, setExtractDelim] = useState('-');
  const [extractCount, setExtractCount] = useState(3);
  const [extractRegex, setExtractRegex] = useState('([A-Za-z0-9]+)');
  const [extractNewName, setExtractNewName] = useState(`${dataset.columns[0]?.name || 'col'}_extracted`);

  const sampleRows = useMemo(() => dataset.previewRows || [], [dataset]);

  // Handler for Rename
  const handleAddRename = () => {
    if (!renameCol || !newName.trim()) return;
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'RENAME_COLUMN',
      column: renameCol,
      description: `Rename column "${renameCol}" → "${newName.trim()}"`,
      params: { oldName: renameCol, newName: newName.trim() },
      enabled: true,
      createdAt: new Date().toISOString()
    });
    setNewName('');
  };

  // Handler for Drop
  const handleAddDrop = () => {
    if (dropCols.length === 0) return;
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'DROP_COLUMN',
      description: `Drop column(s): ${dropCols.map(c => `"${c}"`).join(', ')}`,
      params: { columns: dropCols },
      enabled: true,
      createdAt: new Date().toISOString()
    });
    setDropCols([]);
  };

  // Handler for Duplicate
  const handleAddDuplicate = () => {
    if (!dupCol || !dupNewName.trim()) return;
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'DUPLICATE_COLUMN',
      column: dupCol,
      description: `Duplicate column "${dupCol}" as "${dupNewName.trim()}"`,
      params: { sourceColumn: dupCol, newColumnName: dupNewName.trim() },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  // Handler for Reorder
  const handleMoveCol = (idx: number, dir: 'up' | 'down') => {
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= orderedCols.length) return;
    const copy = [...orderedCols];
    const item = copy[idx];
    copy[idx] = copy[targetIdx];
    copy[targetIdx] = item;
    setOrderedCols(copy);
  };

  const handleAddReorder = () => {
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'REORDER_COLUMNS',
      description: `Reorder columns layout (${orderedCols.length} columns)`,
      params: { orderedColumns: orderedCols },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  // Handler for Split
  const handleAddSplit = () => {
    if (!splitCol || !splitCol1.trim() || !splitCol2.trim()) return;
    const newNames = [splitCol1.trim(), splitCol2.trim()];
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'SPLIT_COLUMN',
      column: splitCol,
      description: `Split column "${splitCol}" by "${splitDelim}" → [${newNames.join(', ')}]`,
      params: {
        column: splitCol,
        delimiter: splitDelim,
        newColumnNames: newNames,
        keepOriginal: splitKeepOriginal
      },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  // Handler for Merge
  const handleAddMerge = () => {
    if (mergeCols.length < 2 || !mergeNewName.trim()) return;
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'MERGE_COLUMNS',
      description: `Merge [${mergeCols.join(' + ')}] with delimiter "${mergeDelim}" → "${mergeNewName.trim()}"`,
      params: {
        columns: mergeCols,
        delimiter: mergeDelim,
        newColumnName: mergeNewName.trim(),
        keepOriginal: mergeKeepOriginal
      },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  // Handler for Extract
  const handleAddExtract = () => {
    if (!extractCol || !extractNewName.trim()) return;
    onAddStep({
      id: `step_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      type: 'EXTRACT_TEXT',
      column: extractCol,
      description: `Extract ${extractMode} from "${extractCol}" → "${extractNewName.trim()}"`,
      params: {
        column: extractCol,
        mode: extractMode,
        start: extractStart,
        length: extractLength,
        delimiter: extractDelim,
        count: extractCount,
        regexPattern: extractRegex,
        newColumnName: extractNewName.trim()
      },
      enabled: true,
      createdAt: new Date().toISOString()
    });
  };

  return (
    <div className="space-y-6" id="column-operations-tab">
      {/* Sub-tabs header */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900/80 rounded-xl border border-slate-800">
        <button
          id="btn-subop-rename"
          onClick={() => setActiveSubOp('rename')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeSubOp === 'rename'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Edit2 className="w-3.5 h-3.5" />
          Rename
        </button>
        <button
          id="btn-subop-drop"
          onClick={() => setActiveSubOp('drop')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeSubOp === 'drop'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
          Drop
        </button>
        <button
          id="btn-subop-duplicate"
          onClick={() => setActiveSubOp('duplicate')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeSubOp === 'duplicate'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Copy className="w-3.5 h-3.5" />
          Duplicate
        </button>
        <button
          id="btn-subop-reorder"
          onClick={() => setActiveSubOp('reorder')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeSubOp === 'reorder'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          Reorder
        </button>
        <button
          id="btn-subop-split"
          onClick={() => setActiveSubOp('split')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeSubOp === 'split'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Split className="w-3.5 h-3.5" />
          Split
        </button>
        <button
          id="btn-subop-merge"
          onClick={() => setActiveSubOp('merge')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeSubOp === 'merge'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Merge className="w-3.5 h-3.5" />
          Merge
        </button>
        <button
          id="btn-subop-extract"
          onClick={() => setActiveSubOp('extract')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeSubOp === 'extract'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Scissors className="w-3.5 h-3.5" />
          Extract Text
        </button>
      </div>

      {/* 1. Rename Column */}
      {activeSubOp === 'rename' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Edit2 className="w-5 h-5 text-blue-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Rename Column</h4>
              <p className="text-xs text-slate-400">Change a column header without modifying the underlying records.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Select Column</label>
              <select
                value={renameCol}
                onChange={e => setRenameCol(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                {dataset.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name} ({c.dataType})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">New Column Name</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="e.g. Total_Revenue"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              id="btn-add-rename-step"
              onClick={handleAddRename}
              disabled={!renameCol || !newName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Rename Step
            </button>
          </div>
        </div>
      )}

      {/* 2. Drop Column */}
      {activeSubOp === 'drop' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-rose-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Drop / Remove Columns</h4>
              <p className="text-xs text-slate-400">Select one or more unnecessary columns to remove from the analytical workspace.</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto p-2 bg-slate-950/60 rounded-xl border border-slate-800">
            {dataset.columns.map(c => {
              const isSelected = dropCols.includes(c.name);
              return (
                <button
                  key={c.name}
                  onClick={() => {
                    if (isSelected) setDropCols(dropCols.filter(x => x !== c.name));
                    else setDropCols([...dropCols, c.name]);
                  }}
                  className={`flex items-center justify-between p-2 rounded-lg text-xs font-mono text-left border transition-all ${
                    isSelected
                      ? 'bg-rose-950/40 border-rose-500/60 text-rose-300'
                      : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="truncate">{c.name}</span>
                  {isSelected && <Trash2 className="w-3 h-3 text-rose-400 ml-1 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-400">
              {dropCols.length} column(s) selected for removal
            </span>
            <button
              id="btn-add-drop-step"
              onClick={handleAddDrop}
              disabled={dropCols.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Drop Step
            </button>
          </div>
        </div>
      )}

      {/* 3. Duplicate Column */}
      {activeSubOp === 'duplicate' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Copy className="w-5 h-5 text-indigo-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Duplicate Column</h4>
              <p className="text-xs text-slate-400">Create an exact replica of an existing column to preserve raw values while applying experiments.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Source Column</label>
              <select
                value={dupCol}
                onChange={e => {
                  setDupCol(e.target.value);
                  setDupNewName(`${e.target.value}_copy`);
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                {dataset.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">New Duplicated Name</label>
              <input
                type="text"
                value={dupNewName}
                onChange={e => setDupNewName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              id="btn-add-dup-step"
              onClick={handleAddDuplicate}
              disabled={!dupCol || !dupNewName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Duplicate Step
            </button>
          </div>
        </div>
      )}

      {/* 4. Reorder Columns */}
      {activeSubOp === 'reorder' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-5 h-5 text-amber-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Reorder Columns</h4>
              <p className="text-xs text-slate-400">Rearrange the column sequence in dataset tables and exported files.</p>
            </div>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto p-2 bg-slate-950/60 rounded-xl border border-slate-800">
            {orderedCols.map((colName, idx) => (
              <div
                key={colName}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200"
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-slate-500 w-5">#{idx + 1}</span>
                  <span className="font-mono font-medium">{colName}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    disabled={idx === 0}
                    onClick={() => handleMoveCol(idx, 'up')}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded disabled:opacity-20"
                  >
                    ↑
                  </button>
                  <button
                    disabled={idx === orderedCols.length - 1}
                    onClick={() => handleMoveCol(idx, 'down')}
                    className="p-1 hover:bg-slate-800 text-slate-400 hover:text-white rounded disabled:opacity-20"
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              id="btn-add-reorder-step"
              onClick={handleAddReorder}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Reorder Step
            </button>
          </div>
        </div>
      )}

      {/* 5. Split Column */}
      {activeSubOp === 'split' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Split className="w-5 h-5 text-emerald-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Split Column into Multiple Columns</h4>
              <p className="text-xs text-slate-400">Divide composite string columns (e.g. "First Last" or "City, State") using a delimiter.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Column to Split</label>
              <select
                value={splitCol}
                onChange={e => setSplitCol(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                {dataset.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Delimiter (Separator)</label>
              <input
                type="text"
                value={splitDelim}
                onChange={e => setSplitDelim(e.target.value)}
                placeholder="Space, comma, hyphen, etc."
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Output Column 1 Name</label>
              <input
                type="text"
                value={splitCol1}
                onChange={e => setSplitCol1(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Output Column 2 Name</label>
              <input
                type="text"
                value={splitCol2}
                onChange={e => setSplitCol2(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={splitKeepOriginal}
              onChange={e => setSplitKeepOriginal(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-emerald-500 focus:ring-0"
            />
            Keep original source column after splitting
          </label>

          <div className="flex justify-end">
            <button
              id="btn-add-split-step"
              onClick={handleAddSplit}
              disabled={!splitCol || !splitCol1.trim() || !splitCol2.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Split Step
            </button>
          </div>
        </div>
      )}

      {/* 6. Merge Columns */}
      {activeSubOp === 'merge' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Merge className="w-5 h-5 text-cyan-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Merge / Concatenate Columns</h4>
              <p className="text-xs text-slate-400">Combine multiple columns into one with a custom delimiter separator.</p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-2">Select Columns to Merge (in order)</label>
            <div className="flex flex-wrap gap-2 p-2 bg-slate-950/60 rounded-xl border border-slate-800">
              {dataset.columns.map(c => {
                const isSelected = mergeCols.includes(c.name);
                const orderIdx = mergeCols.indexOf(c.name);
                return (
                  <button
                    key={c.name}
                    onClick={() => {
                      if (isSelected) setMergeCols(mergeCols.filter(x => x !== c.name));
                      else setMergeCols([...mergeCols, c.name]);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                      isSelected
                        ? 'bg-cyan-950/50 border-cyan-500 text-cyan-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isSelected && <span className="text-[10px] bg-cyan-600 text-white rounded-full px-1.5">#{orderIdx + 1}</span>}
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Delimiter (Separator)</label>
              <input
                type="text"
                value={mergeDelim}
                onChange={e => setMergeDelim(e.target.value)}
                placeholder="e.g. Space, comma, hyphen"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">New Merged Column Name</label>
              <input
                type="text"
                value={mergeNewName}
                onChange={e => setMergeNewName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={mergeKeepOriginal}
              onChange={e => setMergeKeepOriginal(e.target.checked)}
              className="rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0"
            />
            Keep source columns after merging
          </label>

          <div className="flex justify-end">
            <button
              id="btn-add-merge-step"
              onClick={handleAddMerge}
              disabled={mergeCols.length < 2 || !mergeNewName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Merge Step
            </button>
          </div>
        </div>
      )}

      {/* 7. Extract Text */}
      {activeSubOp === 'extract' && (
        <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
          <div className="flex items-center gap-2">
            <Scissors className="w-5 h-5 text-purple-400" />
            <div>
              <h4 className="text-sm font-semibold text-white">Extract Substring / Prefix / Suffix</h4>
              <p className="text-xs text-slate-400">Extract targeted components from text columns using positions, delimiters, or regex.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Source Column</label>
              <select
                value={extractCol}
                onChange={e => {
                  setExtractCol(e.target.value);
                  setExtractNewName(`${e.target.value}_extracted`);
                }}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                {dataset.columns.map(c => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Extraction Mode</label>
              <select
                value={extractMode}
                onChange={e => setExtractMode(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              >
                <option value="prefix">Prefix (first characters / before delimiter)</option>
                <option value="suffix">Suffix (last characters / after delimiter)</option>
                <option value="substring">Substring by Index</option>
                <option value="regex">Regular Expression Match</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">New Column Name</label>
              <input
                type="text"
                value={extractNewName}
                onChange={e => setExtractNewName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
              />
            </div>
          </div>

          {extractMode === 'substring' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Start Index (0-based)</label>
                <input
                  type="number"
                  min="0"
                  value={extractStart}
                  onChange={e => setExtractStart(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Length (characters)</label>
                <input
                  type="number"
                  min="1"
                  value={extractLength}
                  onChange={e => setExtractLength(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
            </div>
          )}

          {(extractMode === 'prefix' || extractMode === 'suffix') && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Delimiter (optional)</label>
                <input
                  type="text"
                  value={extractDelim}
                  onChange={e => setExtractDelim(e.target.value)}
                  placeholder="e.g. - or @"
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Character Count (if no delimiter)</label>
                <input
                  type="number"
                  min="1"
                  value={extractCount}
                  onChange={e => setExtractCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white"
                />
              </div>
            </div>
          )}

          {extractMode === 'regex' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Regex Pattern</label>
              <input
                type="text"
                value={extractRegex}
                onChange={e => setExtractRegex(e.target.value)}
                placeholder="e.g. ([A-Z]{2,3})"
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono"
              />
            </div>
          )}

          <div className="flex justify-end">
            <button
              id="btn-add-extract-step"
              onClick={handleAddExtract}
              disabled={!extractCol || !extractNewName.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-sm transition-all"
            >
              <Plus className="w-4 h-4" />
              Add Extract Step
            </button>
          </div>
        </div>
      )}

      {/* Live Sample Preview Section */}
      <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-semibold text-slate-300">Raw Sample Values (First 5 Rows)</span>
          </div>
          <span className="text-[11px] text-slate-500">{sampleRows.length} total sample rows loaded</span>
        </div>
        <div className="overflow-x-auto max-h-48 border border-slate-800/60 rounded-lg">
          <table className="w-full text-left text-xs text-slate-300 border-collapse font-mono">
            <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
              <tr>
                {dataset.columns.map(c => (
                  <th key={c.name} className="p-2 whitespace-nowrap">{c.name}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950">
              {sampleRows.slice(0, 5).map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-900/50">
                  {dataset.columns.map(c => (
                    <td key={c.name} className="p-2 whitespace-nowrap text-slate-400">
                      {String(row[c.name] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
