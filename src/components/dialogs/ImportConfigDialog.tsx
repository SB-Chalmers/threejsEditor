import React, { useState, useRef } from 'react';
import { Upload, X, FileText } from 'lucide-react';

interface ImportConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (config: unknown) => void;
}

export const ImportConfigDialog: React.FC<ImportConfigDialogProps> = ({
  isOpen,
  onClose,
  onImport
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setError('Please select a valid JSON file');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const config = JSON.parse(text);
      
      // Basic validation - check if it has the expected structure
      if (!Array.isArray(config) && !config.buildings) {
        throw new Error('Invalid configuration format. Expected an array of buildings or an object with a buildings property.');
      }

      onImport(config);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse JSON file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/15 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h2 className="text-[13px] font-semibold text-slate-900">Import configuration</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            disabled={isLoading}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <div
            className={`rounded-lg border border-dashed p-6 text-center transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-300 hover:border-slate-400'
            } ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
          >
            <div className="flex flex-col items-center space-y-4">
              {isLoading ? (
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100">
                  <FileText className="h-5 w-5 text-slate-500" />
                </div>
              )}
              
              <div>
                <div className="mb-1 text-[12px] font-semibold text-slate-800">
                  {isLoading ? 'Processing...' : 'Drop JSON file here'}
                </div>
                <div className="mb-3 text-[11px] text-slate-500">
                  or click to browse
                </div>
                <button
                  onClick={handleBrowseClick}
                  disabled={isLoading}
                  className="mx-auto flex h-8 items-center gap-1.5 rounded-md bg-blue-600 px-3 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Upload className="w-4 h-4" />
                  <span>Browse Files</span>
                </button>
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 p-2.5">
              <div className="text-[11px] text-rose-700">{error}</div>
            </div>
          )}

          <div className="mt-3 text-[10px] leading-4 text-slate-500">
            <div className="font-medium mb-1">Supported formats:</div>
            <ul className="space-y-1">
              <li>• Exported building configurations (JSON)</li>
              <li>• Array of building objects</li>
              <li>• Single building configuration</li>
            </ul>
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>
    </div>
  );
};
