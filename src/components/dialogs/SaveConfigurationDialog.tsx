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
  const [isLoading, setIsLoading] = useState(false);

  const handleSave = async () => {
    if (!configName.trim()) return;
    
    setIsLoading(true);
    try {
      await onSave(configName.trim());
      setConfigName('');
      onClose();
    } catch (error) {
      console.error('Failed to save and run configuration:', error);
    } finally {
      setIsLoading(false);
    }
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
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-gray-900 rounded-2xl border border-gray-700/50 shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
          <h2 className="text-lg font-semibold text-white">Save And Run Configuration</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Configuration Name
            </label>
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter a name for this design..."
              className="w-full px-3 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>

          <div className="text-sm text-gray-400">
            This will save the current building configuration, run daylight simulation, and plot sensor results on your model.
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-700/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!configName.trim() || isLoading}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Save className="w-4 h-4" />
            <span>{isLoading ? 'Running Daylight...' : 'Save And Run Configuration'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
