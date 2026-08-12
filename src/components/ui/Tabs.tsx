import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onTabChange, className = '' }) => {
  return (
    <div className={`fixed top-0 left-0 right-0 h-12 bg-white border-b border-slate-200 z-50 ${className}`}>
      <div className="flex h-full space-x-1 px-3">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex items-center space-x-2 px-3 text-[12px] font-medium transition-colors
              ${
                activeTab === tab.id
                  ? 'text-blue-700 border-b-2 border-blue-600 bg-blue-50/60'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }
            `}
          >
            {tab.icon && <span className="text-sm">{tab.icon}</span>}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

interface TabContentProps {
  children: React.ReactNode;
  className?: string;
}

export const TabContent: React.FC<TabContentProps> = ({ children, className = '' }) => {
  return (
    <div className={`flex-1 pt-12 ${className}`}>
      {children}
    </div>
  );
};
