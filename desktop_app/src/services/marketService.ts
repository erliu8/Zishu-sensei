/**
 * 市场服务
 * 
 * 提供适配器和主题商店的客户端功能
 */

import { invoke } from '@tauri-apps/api/tauri';
import { CommandResponse, PaginatedResponse } from './types';

// ================================
// 类型定义
// ================================

export enum MarketProductType {
  Adapter = 'Adapter',
  Theme = 'Theme',
  Workflow = 'Workflow',
}

export interface MarketAuthor {
  id: string;
  name: string;
  avatar_url?: string;
  verified: boolean;
}

export interface ProductVersion {
  version: string;
  released_at: string;
  changelog?: string;
  download_url: string;
  file_size: number;
  checksum?: string;
}

export interface ProductDependency {
  product_id: string;
  product_name: string;
  version_requirement: string;
  required: boolean;
}

export interface ProductRequirements {
  operating_systems: string[];
  min_memory_mb?: number;
  min_disk_space_mb?: number;
  other?: string;
}

export interface MarketProduct {
  id: string;
  product_type: MarketProductType;
  name: string;
  display_name: string;
  description: string;
  author: MarketAuthor;
  version: string;
  versions: ProductVersion[];
  download_url: string;
  icon_url?: string;
  screenshots: string[];
  tags: string[];
  category: string;
  rating: number;
  rating_count: number;
  download_count: number;
  file_size: number;
  license: string;
  homepage_url?: string;
  documentation_url?: string;
  repository_url?: string;
  is_featured: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
  dependencies: ProductDependency[];
  requirements: ProductRequirements;
}

export interface MarketSearchRequest {
  query: string;
  product_type?: MarketProductType;
  category?: string;
  tags?: string[];
  featured_only?: boolean;
  verified_only?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: string;
  sort_order?: string;
}

export interface ProductReview {
  id: string;
  user: MarketAuthor;
  rating: number;
  content: string;
  likes: number;
  created_at: string;
  updated_at: string;
}

export interface ProductUpdateInfo {
  product_id: string;
  product_name: string;
  current_version: string;
  latest_version: string;
  has_update: boolean;
  changelog?: string;
  download_url?: string;
}

export interface MarketCategory {
  id: string;
  name: string;
  description?: string;
  product_count: number;
  icon?: string;
}

// ================================
// 市场服务类
// ================================

export class MarketService {
  /**
   * 搜索市场产品
   */
  static async searchProducts(request: MarketSearchRequest): Promise<PaginatedResponse<MarketProduct>> {
    try {
      const response = await invoke<CommandResponse<PaginatedResponse<MarketProduct>>>(
        'search_market_products',
        { request }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '搜索失败');
    } catch (error) {
      console.error('搜索市场产品失败:', error);
      throw error;
    }
  }

  /**
   * 获取产品详情
   */
  static async getProduct(productId: string): Promise<MarketProduct> {
    try {
      const response = await invoke<CommandResponse<MarketProduct>>(
        'get_market_product',
        { productId }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '获取产品详情失败');
    } catch (error) {
      console.error('获取产品详情失败:', error);
      throw error;
    }
  }

  /**
   * 获取推荐产品
   */
  static async getFeaturedProducts(
    productType?: MarketProductType,
    limit?: number
  ): Promise<MarketProduct[]> {
    try {
      const response = await invoke<CommandResponse<MarketProduct[]>>(
        'get_featured_products',
        { productType, limit }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '获取推荐产品失败');
    } catch (error) {
      console.error('获取推荐产品失败:', error);
      throw error;
    }
  }

  /**
   * 获取产品评论
   */
  static async getProductReviews(
    productId: string,
    page?: number,
    pageSize?: number
  ): Promise<PaginatedResponse<ProductReview>> {
    try {
      const response = await invoke<CommandResponse<PaginatedResponse<ProductReview>>>(
        'get_product_reviews',
        { productId, page, pageSize }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '获取评论失败');
    } catch (error) {
      console.error('获取产品评论失败:', error);
      throw error;
    }
  }

  /**
   * 下载产品
   */
  static async downloadProduct(
    productId: string,
    version?: string
  ): Promise<string> {
    try {
      const response = await invoke<CommandResponse<string>>(
        'download_market_product',
        { productId, version }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '下载失败');
    } catch (error) {
      console.error('下载产品失败:', error);
      throw error;
    }
  }

  /**
   * 检查产品更新
   */
  static async checkUpdates(productIds: string[]): Promise<ProductUpdateInfo[]> {
    try {
      const response = await invoke<CommandResponse<ProductUpdateInfo[]>>(
        'check_product_updates',
        { productIds }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '检查更新失败');
    } catch (error) {
      console.error('检查产品更新失败:', error);
      throw error;
    }
  }

  /**
   * 获取市场类别
   */
  static async getCategories(productType?: MarketProductType): Promise<MarketCategory[]> {
    try {
      const response = await invoke<CommandResponse<MarketCategory[]>>(
        'get_market_categories',
        { productType }
      );
      
      if (response.success && response.data) {
        return response.data;
      }
      
      throw new Error(response.error || '获取类别失败');
    } catch (error) {
      console.error('获取市场类别失败:', error);
      throw error;
    }
  }

  // ================================
  // 工具方法
  // ================================

  /**
   * 检查产品更新
   */
  static async checkProductUpdates(): Promise<Array<{
    product_id: string;
    product_name: string;
    current_version: string;
    latest_version: string;
    has_update: boolean;
    changelog?: string;
  }>> {
    try {
      const response = await invoke<CommandResponse<Array<{
        product_id: string;
        product_name: string;
        current_version: string;
        latest_version: string;
        has_update: boolean;
        changelog?: string;
      }>>>('check_product_updates');
      
      if (!response.success) {
        throw new Error(response.error || '检查更新失败');
      }
      
      return response.data || [];
    } catch (error) {
      console.error('Failed to check product updates:', error);
      throw error;
    }
  }

  /**
   * 创建默认搜索请求
   */
  static createDefaultSearchRequest(query: string = ''): MarketSearchRequest {
    return {
      query,
      page: 1,
      page_size: 20,
      sort_by: 'download_count',
      sort_order: 'desc',
    };
  }

  /**
   * 格式化产品类型
   */
  static formatProductType(type: MarketProductType): string {
    const typeMap: Record<MarketProductType, string> = {
      [MarketProductType.Adapter]: '适配器',
      [MarketProductType.Theme]: '主题',
      [MarketProductType.Workflow]: '工作流',
    };
    return typeMap[type] || '未知';
  }

  /**
   * 检查版本是否需要更新
   */
  static needsUpdate(currentVersion: string, latestVersion: string): boolean {
    const parseCurrent = currentVersion.split('.').map(Number);
    const parseLatest = latestVersion.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parseCurrent.length, parseLatest.length); i++) {
      const current = parseCurrent[i] || 0;
      const latest = parseLatest[i] || 0;
      
      if (latest > current) return true;
      if (latest < current) return false;
    }
    
    return false;
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes: number): string {
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  }

  /**
   * 格式化数字
   */
  static formatNumber(num: number): string {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  }

  /**
   * 格式化评分
   */
  static formatRating(rating: number): string {
    return rating.toFixed(1);
  }

  /**
   * 获取评分颜色
   */
  static getRatingColor(rating: number): string {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-blue-600';
    if (rating >= 2.5) return 'text-yellow-600';
    return 'text-red-600';
  }

  /**
   * 检查产品是否兼容当前系统
   */
  static isCompatibleWithCurrentOS(product: MarketProduct): boolean {
    const currentOS = navigator.platform.toLowerCase();
    return product.requirements.operating_systems.some(os =>
      currentOS.includes(os.toLowerCase())
    );
  }
}

export default MarketService;

