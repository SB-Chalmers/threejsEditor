import React, { useState } from 'react';
import { Save, X } from 'lucide-react';

interface SaveConfigurationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => Promise<void>;
}

export const SaveConfigurationDialog: React.FC<SaveConfigurationDialogProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [configName, setConfigName] = useState('');

  const handleSave = () => {
    if (!configName.trim()) return;
    const name = configName.trim();
    setConfigName('');
    onClose();
    void onSave(name).catch((error) => {
      console.error('Failed to save and run configuration:', error);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/15 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-slate-900">Save and run studies</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 p-4">
          <div>
            <label className="mb-1.5 block text-[11px] font-medium text-slate-600">
              Design name
            </label>
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a name for this design..."
              className="h-8 w-full rounded-md border border-slate-300 bg-white px-2.5 text-[12px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              autoFocus
            />
          </div>

          <div className="text-[11px] leading-4 text-slate-500">
            Daylight and energy run in parallel. Each result appears as soon as it is ready.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            onClick={onClose}
            className="h-8 rounded-md px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!configName.trim()}
            className="flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save and run</span>
          </button>
        </div>
      </div>
    </div>
  );
};
