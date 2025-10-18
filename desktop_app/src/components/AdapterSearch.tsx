/**
 * Adapter Search Component
 * 
 * This component provides search functionality for adapters in the marketplace.
 */

import React, { useState, useEffect } from 'react';
import { 
  AdapterService, 
  AdapterSearchRequest, 
  AdapterType,
  PaginatedResponse 
} from '../services/adapter';

interface AdapterSearchProps {
  onAdapterSelect?: (adapter: any) => void;
}

export const AdapterSearch: React.FC<AdapterSearchProps> = ({ onAdapterSelect }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PaginatedResponse<any>>({
    items: [],
    total: 0,
    page: 1,
    page_size: 20,
    has_next: false,
    has_prev: false,
    total_pages: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    adapter_type: undefined as AdapterType | undefined,
    category: '',
    free_only: false,
    featured_only: false,
    sort_by: 'created_at',
    sort_order: 'desc' as 'asc' | 'desc',
  });

  // Perform search when query or filters change
  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    }
  }, [searchQuery, filters]);

  const performSearch = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const searchRequest: AdapterSearchRequest = {
        query: searchQuery,
        adapter_type: filters.adapter_type,
        category: filters.category || undefined,
        free_only: filters.free_only || undefined,
        featured_only: filters.featured_only || undefined,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
        page: 1,
        page_size: 20,
      };

      const results = await AdapterService.searchAdapters(searchRequest);
      setSearchResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch();
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
      // Optionally refresh search results or show success message
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (pricing: any): string => {
    if (!pricing) return 'Free';
    
    if (pricing.pricing_model === 'free') {
      return 'Free';
    }
    
    const price = pricing.sale_price || pricing.base_price;
    if (price) {
      return `${price.amount} ${price.currency}`;
    }
    
    return 'Price not available';
  };

  const formatRating = (rating: number): string => {
    return '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex space-x-4">
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search adapters..."
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !searchQuery.trim()}
            className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <select
            value={filters.adapter_type || ''}
            onChange={(e) => setFilters(prev => ({ 
              ...prev, 
              adapter_type: e.target.value as AdapterType || undefined 
            }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            <option value={AdapterType.Soft}>Soft Adapters</option>
            <option value={AdapterType.Hard}>Hard Adapters</option>
            <option value={AdapterType.Intelligent}>Intelligent Adapters</option>
          </select>

          <input
            type="text"
            value={filters.category}
            onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
            placeholder="Category"
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          />

          <select
            value={filters.sort_by}
            onChange={(e) => setFilters(prev => ({ ...prev, sort_by: e.target.value }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="created_at">Newest</option>
            <option value="rating">Rating</option>
            <option value="downloads">Downloads</option>
            <option value="price">Price</option>
          </select>

          <select
            value={filters.sort_order}
            onChange={(e) => setFilters(prev => ({ 
              ...prev, 
              sort_order: e.target.value as 'asc' | 'desc' 
            }))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>

        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.free_only}
              onChange={(e) => setFilters(prev => ({ ...prev, free_only: e.target.checked }))}
              className="mr-2"
            />
            Free Only
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={filters.featured_only}
              onChange={(e) => setFilters(prev => ({ ...prev, featured_only: e.target.checked }))}
              className="mr-2"
            />
            Featured Only
          </label>
        </div>
      </form>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Search Results */}
      {loading && searchResults.items.length === 0 ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-2">Searching...</span>
        </div>
      ) : searchResults.items.length > 0 ? (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              Search Results ({searchResults.total} found)
            </h3>
          </div>

          <div className="grid gap-4">
            {searchResults.items.map((adapter) => (
              <div
                key={adapter.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <h4 className="text-lg font-medium">{adapter.name}</h4>
                      {adapter.is_featured && (
                        <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                          Featured
                        </span>
                      )}
                      {adapter.is_verified && (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                          Verified
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-600 mt-1">{adapter.short_description}</p>
                    
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span>Category: {adapter.category}</span>
                      <span>Vendor: {adapter.vendor_name}</span>
                      <span>Downloads: {adapter.download_count}</span>
                      <span>Rating: {formatRating(adapter.average_rating)} ({adapter.rating_count})</span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2">
                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        {formatPrice(adapter.pricing)}
                      </div>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleInstallAdapter(adapter.id)}
                        disabled={loading}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                      >
                        Install
                      </button>
                      
                      {onAdapterSelect && (
                        <button
                          onClick={() => onAdapterSelect(adapter)}
                          className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                        >
                          View Details
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {searchResults.total_pages > 1 && (
            <div className="flex justify-center space-x-2">
              <button
                disabled={!searchResults.has_prev}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-1">
                Page {searchResults.page} of {searchResults.total_pages}
              </span>
              <button
                disabled={!searchResults.has_next}
                className="px-3 py-1 border border-gray-300 rounded-md disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : searchQuery ? (
        <div className="text-center py-8 text-gray-500">
          <p>No adapters found for "{searchQuery}"</p>
          <p className="text-sm">Try adjusting your search terms or filters</p>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          <p>Enter a search term to find adapters</p>
        </div>
      )}
    </div>
  );
};

export default AdapterSearch;
