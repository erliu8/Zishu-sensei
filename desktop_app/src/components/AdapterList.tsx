/**
 * Adapter Service Integration Test
 * 
 * This file demonstrates how to use the adapter service in a React component.
 */

import React, { useState, useEffect } from 'react';
import { AdapterService, AdapterInfo, AdapterStatus, AdapterType } from '../services/adapter';

interface AdapterListProps {
  onAdapterSelect?: (adapter: AdapterInfo) => void;
}

export const AdapterList: React.FC<AdapterListProps> = ({ onAdapterSelect }) => {
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load adapters on component mount
  useEffect(() => {
    loadAdapters();
  }, []);

  const loadAdapters = async () => {
    try {
      setLoading(true);
      setError(null);
      const adapterList = await AdapterService.getAdapters();
      setAdapters(adapterList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load adapters');
    } finally {
      setLoading(false);
    }
  };

  const handleInstallAdapter = async (adapterId: string) => {
    try {
      setLoading(true);
      await AdapterService.installAdapter({
        adapter_id: adapterId,
        source: 'market',
        force: false,
        options: {},
      });
      await loadAdapters(); // Reload the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to install adapter');
    } finally {
      setLoading(false);
    }
  };

  const handleUninstallAdapter = async (adapterId: string) => {
    try {
      setLoading(true);
      await AdapterService.uninstallAdapter(adapterId);
      await loadAdapters(); // Reload the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to uninstall adapter');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadAdapter = async (adapterId: string) => {
    try {
      setLoading(true);
      await AdapterService.loadAdapter(adapterId);
      await loadAdapters(); // Reload the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load adapter');
    } finally {
      setLoading(false);
    }
  };

  const handleUnloadAdapter = async (adapterId: string) => {
    try {
      setLoading(true);
      await AdapterService.unloadAdapter(adapterId);
      await loadAdapters(); // Reload the list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unload adapter');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: AdapterStatus): string => {
    return AdapterService.getStatusColor(status);
  };

  const formatStatus = (status: AdapterStatus): string => {
    return AdapterService.formatStatus(status);
  };

  const formatSize = (size?: number): string => {
    return AdapterService.formatSize(size);
  };

  if (loading && adapters.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading adapters...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error</h3>
            <div className="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div className="mt-4">
              <button
                onClick={loadAdapters}
                className="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Installed Adapters</h2>
        <button
          onClick={loadAdapters}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {adapters.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No adapters installed</p>
          <p className="text-sm">Install adapters from the marketplace to get started</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {adapters.map((adapter) => (
            <div
              key={adapter.name}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-medium">{adapter.name}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded-full bg-${getStatusColor(adapter.status)}-100 text-${getStatusColor(adapter.status)}-800`}
                    >
                      {formatStatus(adapter.status)}
                    </span>
                  </div>
                  
                  {adapter.description && (
                    <p className="text-gray-600 mt-1">{adapter.description}</p>
                  )}
                  
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                    {adapter.version && (
                      <span>Version: {adapter.version}</span>
                    )}
                    {adapter.size && (
                      <span>Size: {formatSize(adapter.size)}</span>
                    )}
                    {adapter.memory_usage && (
                      <span>Memory: {formatSize(adapter.memory_usage)}</span>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2">
                  {adapter.status === AdapterStatus.Unloaded ? (
                    <button
                      onClick={() => handleLoadAdapter(adapter.name)}
                      disabled={loading}
                      className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600 disabled:opacity-50"
                    >
                      Load
                    </button>
                  ) : (
                    <button
                      onClick={() => handleUnloadAdapter(adapter.name)}
                      disabled={loading}
                      className="px-3 py-1 bg-yellow-500 text-white text-sm rounded hover:bg-yellow-600 disabled:opacity-50"
                    >
                      Unload
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleUninstallAdapter(adapter.name)}
                    disabled={loading}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600 disabled:opacity-50"
                  >
                    Uninstall
                  </button>
                  
                  {onAdapterSelect && (
                    <button
                      onClick={() => onAdapterSelect(adapter)}
                      className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                    >
                      Configure
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdapterList;
