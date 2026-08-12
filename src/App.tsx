import React, { useState } from 'react';
import { SimpleBuildingCreator } from './components/SimpleBuildingCreator';
import ThemeColorDebugger from './components/ThemeColorDebugger';

function App() {
  const [showDebugger, setShowDebugger] = useState(false);

  // Add keyboard shortcut to open debugger (Ctrl + Shift + D)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setShowDebugger(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);
  return (
    <div className="w-full h-screen bg-[#F4F6F8] text-slate-800">
      <SimpleBuildingCreator />
      <ThemeColorDebugger 
        isVisible={showDebugger} 
        onClose={() => setShowDebugger(false)} 
      />
    </div>
  );
}

export default App;
