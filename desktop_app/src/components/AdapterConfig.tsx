/**
 * Adapter Configuration Component
 * 
 * This component provides configuration interface for adapters.
 */

import React, { useState, useEffect } from 'react';
import { AdapterService, AdapterMetadata } from '../services/adapter';

interface AdapterConfigProps {
  adapterId: string;
  onClose?: () => void;
}

export const AdapterConfig: React.FC<AdapterConfigProps> = ({ adapterId, onClose }) => {
  const [adapterDetails, setAdapterDetails] = useState<AdapterMetadata | null>(null);
  const [config, setConfig] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Load adapter details and configuration
  useEffect(() => {
    loadAdapterData();
  }, [adapterId]);

  const loadAdapterData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [details, currentConfig] = await Promise.all([
        AdapterService.getAdapterDetails(adapterId),
        AdapterService.getAdapterConfig(adapterId),
      ]);
      
      setAdapterDetails(details);
      setConfig(currentConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load adapter data');
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSaveConfig = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      
      await AdapterService.updateAdapterConfig({
        adapter_id: adapterId,
        config,
        merge: true,
      });
      
      setSuccess('Configuration saved successfully');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleResetConfig = () => {
    if (adapterDetails) {
      setConfig(adapterDetails.default_config);
    }
  };

  const renderConfigField = (key: string, schema: any, value: any) => {
    const fieldType = schema.type || 'string';
    const fieldTitle = schema.title || key;
    const fieldDescription = schema.description || '';
    const fieldDefault = schema.default;

    switch (fieldType) {
      case 'boolean':
        return (
          <div key={key} className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={value || false}
                onChange={(e) => handleConfigChange(key, e.target.checked)}
                className="mr-2"
              />
              <span className="font-medium">{fieldTitle}</span>
            </label>
            {fieldDescription && (
              <p className="text-sm text-gray-600">{fieldDescription}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={key} className="space-y-2">
            <label className="block">
              <span className="font-medium">{fieldTitle}</span>
              {fieldDescription && (
                <p className="text-sm text-gray-600">{fieldDescription}</p>
              )}
            </label>
            <input
              type="number"
              value={value || fieldDefault || ''}
              onChange={(e) => handleConfigChange(key, parseFloat(e.target.value) || 0)}
              min={schema.minimum}
              max={schema.maximum}
              step={schema.multipleOf || 1}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        );

      case 'integer':
        return (
          <div key={key} className="space-y-2">
            <label className="block">
              <span className="font-medium">{fieldTitle}</span>
              {fieldDescription && (
                <p className="text-sm text-gray-600">{fieldDescription}</p>
              )}
            </label>
            <input
              type="number"
              value={value || fieldDefault || ''}
              onChange={(e) => handleConfigChange(key, parseInt(e.target.value) || 0)}
              min={schema.minimum}
              max={schema.maximum}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            />
          </div>
        );

      case 'select':
        return (
          <div key={key} className="space-y-2">
            <label className="block">
              <span className="font-medium">{fieldTitle}</span>
              {fieldDescription && (
                <p className="text-sm text-gray-600">{fieldDescription}</p>
              )}
            </label>
            <select
              value={value || fieldDefault || ''}
              onChange={(e) => handleConfigChange(key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
            >
              {schema.enum?.map((option: any) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        );

      case 'array':
        return (
          <div key={key} className="space-y-2">
            <label className="block">
              <span className="font-medium">{fieldTitle}</span>
              {fieldDescription && (
                <p className="text-sm text-gray-600">{fieldDescription}</p>
              )}
            </label>
            <textarea
              value={Array.isArray(value) ? value.join('\n') : ''}
              onChange={(e) => handleConfigChange(key, e.target.value.split('\n').filter(Boolean))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              placeholder="Enter each item on a new line"
            />
          </div>
        );

      default: // string, textarea
        const isTextarea = fieldDescription.length > 100 || key.includes('description') || key.includes('prompt');
        return (
          <div key={key} className="space-y-2">
            <label className="block">
              <span className="font-medium">{fieldTitle}</span>
              {fieldDescription && (
                <p className="text-sm text-gray-600">{fieldDescription}</p>
              )}
            </label>
            {isTextarea ? (
              <textarea
                value={value || fieldDefault || ''}
                onChange={(e) => handleConfigChange(key, e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            ) : (
              <input
                type="text"
                value={value || fieldDefault || ''}
                onChange={(e) => handleConfigChange(key, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Loading adapter configuration...</span>
      </div>
    );
  }

  if (error && !adapterDetails) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="text-sm text-red-700">{error}</div>
        <button
          onClick={loadAdapterData}
          className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded-md hover:bg-red-200"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!adapterDetails) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold">{adapterDetails.name}</h2>
          <p className="text-gray-600">Version {adapterDetails.version}</p>
          {adapterDetails.description && (
            <p className="text-sm text-gray-500 mt-1">{adapterDetails.description}</p>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="px-3 py-1 text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="text-sm text-green-700">{success}</div>
        </div>
      )}

      {/* Adapter Information */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="font-medium mb-2">Adapter Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Type:</span> {adapterDetails.adapter_type}
          </div>
          <div>
            <span className="font-medium">Author:</span> {adapterDetails.author || 'Unknown'}
          </div>
          <div>
            <span className="font-medium">License:</span> {adapterDetails.license || 'Unknown'}
          </div>
          <div>
            <span className="font-medium">Tags:</span> {adapterDetails.tags.join(', ')}
          </div>
        </div>
      </div>

      {/* Configuration */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">Configuration</h3>
          <div className="space-x-2">
            <button
              onClick={handleResetConfig}
              disabled={saving}
              className="px-3 py-1 text-gray-600 hover:text-gray-800 disabled:opacity-50"
            >
              Reset to Default
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {Object.keys(adapterDetails.config_schema).length > 0 ? (
            Object.entries(adapterDetails.config_schema).map(([key, schema]) =>
              renderConfigField(key, schema, config[key])
            )
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No configuration options available for this adapter</p>
            </div>
          )}
        </div>
      </div>

      {/* Capabilities */}
      {adapterDetails.capabilities.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-4">Capabilities</h3>
          <div className="grid gap-3">
            {adapterDetails.capabilities.map((capability, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{capability.name}</h4>
                    <p className="text-sm text-gray-600">{capability.description}</p>
                    <div className="mt-2">
                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                        {capability.level}
                      </span>
                    </div>
                  </div>
                </div>
                {capability.required_params.length > 0 && (
                  <div className="mt-2 text-sm">
                    <span className="font-medium">Required:</span> {capability.required_params.join(', ')}
                  </div>
                )}
                {capability.optional_params.length > 0 && (
                  <div className="mt-1 text-sm">
                    <span className="font-medium">Optional:</span> {capability.optional_params.join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resource Requirements */}
      <div>
        <h3 className="text-lg font-medium mb-4">Resource Requirements</h3>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {adapterDetails.resource_requirements.min_memory_mb && (
              <div>
                <span className="font-medium">Min Memory:</span> {adapterDetails.resource_requirements.min_memory_mb} MB
              </div>
            )}
            {adapterDetails.resource_requirements.min_cpu_cores && (
              <div>
                <span className="font-medium">Min CPU Cores:</span> {adapterDetails.resource_requirements.min_cpu_cores}
              </div>
            )}
            <div>
              <span className="font-medium">GPU Required:</span> {adapterDetails.resource_requirements.gpu_required ? 'Yes' : 'No'}
            </div>
            {adapterDetails.resource_requirements.python_version && (
              <div>
                <span className="font-medium">Python Version:</span> {adapterDetails.resource_requirements.python_version}
              </div>
            )}
          </div>
          {adapterDetails.resource_requirements.dependencies.length > 0 && (
            <div className="mt-3">
              <span className="font-medium">Dependencies:</span>
              <ul className="mt-1 list-disc list-inside">
                {adapterDetails.resource_requirements.dependencies.map((dep, index) => (
                  <li key={index} className="text-sm">{dep}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdapterConfig;
