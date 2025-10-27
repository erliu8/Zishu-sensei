/**
 * Adapter Management Page
 * 
 * This is the main page for managing adapters in the desktop application.
 */

import React, { useState } from 'react';
import AdapterList from '../components/AdapterList';
import AdapterSearch from '../components/AdapterSearch';
import AdapterConfig from '../components/AdapterConfig';
import { AdapterInfo } from '../services/adapter';

type TabType = 'installed' | 'marketplace' | 'config';

export const AdapterManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('installed');
  const [selectedAdapter, setSelectedAdapter] = useState<AdapterInfo | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const handleAdapterSelect = (adapter: AdapterInfo) => {
    setSelectedAdapter(adapter);
    setShowConfig(true);
  };

  const handleCloseConfig = () => {
    setShowConfig(false);
    setSelectedAdapter(null);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'installed':
        return (
          <AdapterList 
            onAdapterSelect={handleAdapterSelect}
          />
        );
      case 'marketplace':
        return (
          <AdapterSearch 
            onAdapterSelect={handleAdapterSelect}
          />
        );
      case 'config':
        return selectedAdapter ? (
          <AdapterConfig 
            adapterId={selectedAdapter.name}
            onClose={handleCloseConfig}
          />
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Select an adapter to configure</p>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Adapter Management</h1>
            <p className="text-gray-600">Manage and configure AI adapters for your applications</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('installed')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'installed'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Installed
            </button>
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'marketplace'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Marketplace
            </button>
            <button
              onClick={() => setActiveTab('config')}
              className={`px-4 py-2 rounded-md font-medium ${
                activeTab === 'config'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Configuration
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {showConfig && selectedAdapter ? (
          <div className="h-full flex">
            {/* Sidebar with adapter list */}
            <div className="w-1/3 bg-gray-50 border-r border-gray-200 p-4">
              <h3 className="font-medium mb-4">Installed Adapters</h3>
              <AdapterList 
                onAdapterSelect={(adapter: AdapterInfo) => {
                  setSelectedAdapter(adapter);
                  setActiveTab('config');
                }}
              />
            </div>
            
            {/* Main configuration area */}
            <div className="flex-1 p-6 overflow-y-auto">
              <AdapterConfig 
                adapterId={selectedAdapter.name}
                onClose={handleCloseConfig}
              />
            </div>
          </div>
        ) : (
          <div className="h-full p-6 overflow-y-auto">
            {renderTabContent()}
          </div>
        )}
      </div>

      {/* Footer with system info */}
      <div className="bg-gray-50 border-t border-gray-200 px-6 py-3">
        <div className="flex justify-between items-center text-sm text-gray-600">
          <div>
            <span className="font-medium">System Status:</span> All systems operational
          </div>
          <div>
            <span className="font-medium">Active Adapters:</span> {selectedAdapter ? '1' : '0'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdapterManagement;
