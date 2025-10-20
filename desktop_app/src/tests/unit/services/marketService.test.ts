/**
 * 市场服务测试
 * 
 * 测试适配器和主题商店功能
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  MarketService,
  MarketProductType,
  type MarketProduct,
  type MarketSearchRequest,
  type ProductReview,
} from '../../../services/marketService';
import { createMockApiResponse, createMockErrorResponse } from '../../mocks/factories';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('MarketService', () => {
  const mockInvoke = invoke as unknown as ReturnType<typeof vi.fn>;

  const createMockProduct = (overrides?: Partial<MarketProduct>): MarketProduct => ({
    id: 'product-1',
    product_type: MarketProductType.Adapter,
    name: 'test-adapter',
    display_name: '测试适配器',
    description: '这是一个测试适配器',
    author: {
      id: 'author-1',
      name: 'Test Author',
      verified: true,
    },
    version: '1.0.0',
    versions: [],
    download_url: 'https://example.com/download',
    icon_url: 'https://example.com/icon.png',
    screenshots: [],
    tags: ['test', 'demo'],
    category: 'tools',
    rating: 4.5,
    rating_count: 100,
    download_count: 1000,
    file_size: 1024000,
    license: 'MIT',
    is_featured: false,
    is_verified: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    dependencies: [],
    requirements: {
      operating_systems: ['linux', 'windows', 'macos'],
    },
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ================================
  // 搜索产品测试
  // ================================
  describe('searchProducts', () => {
    it('应该成功搜索产品', async () => {
      const request: MarketSearchRequest = {
        query: 'test',
        page: 1,
        page_size: 10,
      };

      const mockResults = {
        items: [createMockProduct()],
        total: 1,
        page: 1,
        page_size: 10,
        total_pages: 1,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockResults));

      const result = await MarketService.searchProducts(request);

      expect(mockInvoke).toHaveBeenCalledWith('search_market_products', { request });
      expect(result).toEqual(mockResults);
      expect(result.items).toHaveLength(1);
    });

    it('应该支持高级搜索', async () => {
      const request: MarketSearchRequest = {
        query: 'adapter',
        product_type: MarketProductType.Adapter,
        category: 'tools',
        tags: ['ai', 'nlp'],
        featured_only: true,
        verified_only: true,
        page: 1,
        page_size: 20,
        sort_by: 'rating',
        sort_order: 'desc',
      };

      const mockResults = {
        items: [],
        total: 0,
        page: 1,
        page_size: 20,
        total_pages: 0,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockResults));

      await MarketService.searchProducts(request);

      expect(mockInvoke).toHaveBeenCalledWith('search_market_products', { request });
    });

    it('应该处理搜索失败', async () => {
      const request: MarketSearchRequest = {
        query: 'test',
      };

      mockInvoke.mockResolvedValue(createMockErrorResponse('搜索失败'));

      await expect(MarketService.searchProducts(request)).rejects.toThrow('搜索失败');
    });
  });

  // ================================
  // 获取产品详情测试
  // ================================
  describe('getProduct', () => {
    it('应该成功获取产品详情', async () => {
      const mockProduct = createMockProduct({ id: 'product-1' });

      mockInvoke.mockResolvedValue(createMockApiResponse(mockProduct));

      const result = await MarketService.getProduct('product-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_market_product', {
        productId: 'product-1',
      });
      expect(result).toEqual(mockProduct);
    });

    it('应该处理产品不存在', async () => {
      mockInvoke.mockResolvedValue(createMockErrorResponse('产品不存在'));

      await expect(MarketService.getProduct('nonexistent')).rejects.toThrow('产品不存在');
    });
  });

  // ================================
  // 下载产品测试
  // ================================
  describe('downloadProduct', () => {
    it('应该成功下载产品', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse(true));

      const result = await MarketService.downloadProduct('product-1', '1.0.0');

      expect(mockInvoke).toHaveBeenCalledWith('download_market_product', {
        productId: 'product-1',
        version: '1.0.0',
      });
      expect(result).toBe(true);
    });

    it('应该处理下载失败', async () => {
      mockInvoke.mockResolvedValue(createMockErrorResponse('下载失败'));

      await expect(
        MarketService.downloadProduct('product-1', '1.0.0')
      ).rejects.toThrow('下载失败');
    });
  });

  // ================================
  // 获取产品评论测试
  // ================================
  describe('getProductReviews', () => {
    it('应该成功获取产品评论', async () => {
      const mockReviews: ProductReview[] = [
        {
          id: 'review-1',
          user: {
            id: 'user-1',
            name: 'User 1',
            verified: false,
          },
          rating: 5,
          content: 'Great product!',
          likes: 10,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ];

      const mockResults = {
        items: mockReviews,
        total: 1,
        page: 1,
        page_size: 10,
        total_pages: 1,
      };

      mockInvoke.mockResolvedValue(createMockApiResponse(mockResults));

      const result = await MarketService.getProductReviews('product-1');

      expect(mockInvoke).toHaveBeenCalledWith('get_product_reviews', {
        productId: 'product-1',
        page: undefined,
        pageSize: undefined,
      });
      expect(result).toEqual(mockResults);
    });
  });

  // ================================
  // 获取市场分类测试
  // ================================
  describe('getCategories', () => {
    it('应该成功获取分类列表', async () => {
      const mockCategories = [
        {
          id: 'cat-1',
          name: '工具',
          description: '工具类适配器',
          product_count: 10,
        },
      ];

      mockInvoke.mockResolvedValue(createMockApiResponse(mockCategories));

      const result = await MarketService.getCategories();

      expect(mockInvoke).toHaveBeenCalledWith('get_market_categories');
      expect(result).toEqual(mockCategories);
    });
  });

  // ================================
  // 检查更新测试
  // ================================
  describe('checkProductUpdates', () => {
    it('应该成功检查产品更新', async () => {
      const mockUpdates = [
        {
          product_id: 'product-1',
          product_name: 'Test Product',
          current_version: '1.0.0',
          latest_version: '2.0.0',
          has_update: true,
          changelog: 'New features',
        },
      ];

      mockInvoke.mockResolvedValue(createMockApiResponse(mockUpdates));

      const result = await MarketService.checkProductUpdates();

      expect(mockInvoke).toHaveBeenCalledWith('check_product_updates');
      expect(result).toEqual(mockUpdates);
      expect(result[0].has_update).toBe(true);
    });

    it('应该处理无更新情况', async () => {
      mockInvoke.mockResolvedValue(createMockApiResponse([]));

      const result = await MarketService.checkProductUpdates();

      expect(result).toEqual([]);
    });
  });

  // ================================
  // 获取特色产品测试
  // ================================
  describe('getFeaturedProducts', () => {
    it('应该成功获取特色产品', async () => {
      const mockProducts = [createMockProduct({ is_featured: true })];

      mockInvoke.mockResolvedValue(createMockApiResponse(mockProducts));

      const result = await MarketService.getFeaturedProducts();

      expect(mockInvoke).toHaveBeenCalledWith('get_featured_products');
      expect(result).toEqual(mockProducts);
      expect(result[0].is_featured).toBe(true);
    });
  });

  // ================================
  // 工具方法测试
  // ================================
  describe('Utility Methods', () => {
    it('应该正确格式化产品类型', () => {
      expect(MarketService.formatProductType(MarketProductType.Adapter)).toBe('适配器');
      expect(MarketService.formatProductType(MarketProductType.Theme)).toBe('主题');
      expect(MarketService.formatProductType(MarketProductType.Workflow)).toBe('工作流');
    });

    it('应该正确格式化文件大小', () => {
      expect(MarketService.formatFileSize(1024)).toBe('1.0 KB');
      expect(MarketService.formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(MarketService.formatFileSize(1024 * 1024 * 1024)).toBe('1.0 GB');
    });

    it('应该正确格式化评分', () => {
      expect(MarketService.formatRating(4.5)).toBe('4.5');
      expect(MarketService.formatRating(3)).toBe('3.0');
    });

    it('应该检查产品是否需要更新', () => {
      expect(MarketService.needsUpdate('1.0.0', '2.0.0')).toBe(true);
      expect(MarketService.needsUpdate('2.0.0', '1.0.0')).toBe(false);
      expect(MarketService.needsUpdate('1.0.0', '1.0.0')).toBe(false);
    });
  });
});

