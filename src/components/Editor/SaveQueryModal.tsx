import React, { useState, useEffect } from 'react';
import { X, Save, Tag } from 'lucide-react';
import { SavedQuery } from '../../types/database';

interface SaveQueryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, description: string, tags: string[]) => void;
  initialData?: Partial<SavedQuery>;
}

export const SaveQueryModal: React.FC<SaveQueryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setName(initialData?.name || '');
      setDescription(initialData?.description || '');
      setTags(initialData?.tags || []);
      setTagInput('');
    }
  }, [isOpen, initialData]);

  const handleAddTag = () => {
    const newTag = tagInput.trim();
    if (newTag && !tags.includes(newTag)) {
      setTags(prev => [...prev, newTag]);
    }
    setTagInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(t => t !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), description.trim(), tags);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center space-x-2">
            <Save className="w-5 h-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-white">Save Query</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Query Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Monthly Sales Report"
              className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded-md px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief description of what this query does..."
              rows={3}
              className="w-full bg-slate-950 border border-slate-700 text-sm text-white rounded-md px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Tags</label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Add tag and press Enter"
                className="flex-1 bg-slate-950 border border-slate-700 text-sm text-white rounded-md px-3 py-2 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-3 py-2 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition-colors text-sm font-medium border border-slate-700"
              >
                Add
              </button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {tags.map(tag => (
                  <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    <Tag className="w-3 h-3 mr-1" />
                    {tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1.5 hover:text-indigo-100"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors border border-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center shadow-lg shadow-indigo-500/20"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Query
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
