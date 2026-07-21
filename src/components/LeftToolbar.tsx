import React, { useEffect, useRef } from 'react';
import { Settings, Pencil, Download, Trash2, Sun, Moon, Save, Upload, CloudSun } from 'lucide-react';
import { ToolbarButton } from './ToolbarButton';

interface LeftToolbarProps {
  isDrawing: boolean;
  isInitialized: boolean;
  hasBuildings: boolean;
  onStartDrawing: () => void;
  onShowConfig: () => void;
  onExport: () => void;
  onClearAll: () => void;
  onSaveConfiguration: () => void;
  onImportConfiguration: () => void;
  onToggleSunController: () => void;
  onToggleTheme: () => void;
}

export const LeftToolbar: React.FC<LeftToolbarProps> = ({
  isDrawing,
  isInitialized,
  hasBuildings,
  onStartDrawing,
  onShowConfig,
  onExport,
  onClearAll,
  onSaveConfiguration,
  onImportConfiguration,
  onToggleSunController,
  onToggleTheme
}) => {
  const [isDarkTheme, setIsDarkTheme] = React.useState(
    () => document.documentElement.classList.contains('dark-theme')
  );
  
  const toolbarRef = useRef<HTMLDivElement>(null);
  
  // Add animation-complete class after initial animation
  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (toolbar) {
      const animDuration = 300; // 0.3s animation duration in ms
      const timer = setTimeout(() => {
        toolbar.classList.add('animation-complete');
      }, animDuration);
      
      return () => clearTimeout(timer);
    }
  }, []);

  // Listen for theme changes to update the icon
  useEffect(() => {
    const handleThemeChange = () => {
      setIsDarkTheme(document.documentElement.classList.contains('dark-theme'));
    };

    // Listen for our custom theme change event
    window.addEventListener('threejs-theme-update', handleThemeChange);
    
    return () => {
      window.removeEventListener('threejs-theme-update', handleThemeChange);
    };
  }, []);
  
  return (
    <div ref={toolbarRef} className="fixed left-4 top-1/2 -translate-y-1/2 z-40 transform-gpu">
      <div className="bg-gray-900/90 backdrop-blur-sm rounded-2xl border border-gray-700/50 shadow-2xl p-2">
        <div className="flex flex-col space-y-2">
          {/* Building Config */}
          <ToolbarButton
            icon={Settings}
            tooltip="Building Config"
            onClick={onShowConfig}
            disabled={!isInitialized}
            variant="default"
            keyboardShortcut="Ctrl+C"
          />

          {/* Draw Building */}
          <ToolbarButton
            icon={Pencil}
            tooltip={isDrawing ? "Currently Drawing" : "Draw Building"}
            onClick={onStartDrawing}
            disabled={!isInitialized || isDrawing}
            variant={isDrawing ? "active" : "primary"}
            keyboardShortcut="D"
          />

          {/* Divider */}
          <div className="h-px bg-gray-700/50 mx-2 my-1" />

          {/* Save and Run Configuration */}
          <ToolbarButton
            icon={Save}
            tooltip="Save and Run Configuration"
            onClick={onSaveConfiguration}
            disabled={!isInitialized}
            variant="default"
            keyboardShortcut="Ctrl+S"
          />

          {/* Import Configuration */}
          <ToolbarButton
            icon={Upload}
            tooltip="Import Configuration"
            onClick={onImportConfiguration}
            disabled={!isInitialized}
            variant="default"
            keyboardShortcut="I"
          />

          {/* Divider */}
          <div className="h-px bg-gray-700/50 mx-2 my-1" />

          {/* Export */}
          <ToolbarButton
            icon={Download}
            tooltip="Export Buildings"
            onClick={onExport}
            disabled={!hasBuildings}
            variant="success"
            keyboardShortcut="Ctrl+E"
          />

          {/* Clear All */}
          <ToolbarButton
            icon={Trash2}
            tooltip="Clear All Buildings"
            onClick={onClearAll}
            disabled={!hasBuildings}
            variant="danger"
            keyboardShortcut="Del"
          />

          {/* Divider */}
          <div className="h-px bg-gray-700/50 mx-2 my-1" />

          {/* Sun Controller */}
          <ToolbarButton
            icon={CloudSun}
            tooltip="Sun Controller"
            onClick={onToggleSunController}
            disabled={!isInitialized}
            variant="default"
            keyboardShortcut="R"
          />

            {/* Theme Toggle */}
          <div className="h-px bg-gray-700/50 mx-2 my-1" />
          <ToolbarButton
            icon={isDarkTheme ? Sun : Moon}
            tooltip={isDarkTheme ? "Light Theme" : "Dark Theme"}
            onClick={onToggleTheme}
            variant={isDarkTheme ? "success" : "default"}
            keyboardShortcut="T"
          />
        </div>
      </div>
    </div>
  );
};