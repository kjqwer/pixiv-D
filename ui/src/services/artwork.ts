import apiService from './api';
import type { ApiResponse, Artwork, SearchParams, PaginatedResponse } from '@/types';

export interface ArtworkDetailOptions {
  include_user?: boolean;
  include_series?: boolean;
}

export interface ArtworkImagesResponse {
  artwork_id: number;
  total_pages: number;
  images: Array<{
    page: number;
    original: string;
    large: string;
    medium: string;
    square_medium: string;
  }>;
  selected_size: string;
}

class ArtworkService {
  /**
   * 获取作品详情
   */
  async getArtworkDetail(id: number, options: ArtworkDetailOptions = {}): Promise<ApiResponse<Artwork>> {
    const params = new URLSearchParams();
    if (options.include_user !== undefined) {
      params.append('include_user', options.include_user.toString());
    }
    if (options.include_series !== undefined) {
      params.append('include_series', options.include_series.toString());
    }
    
    const query = params.toString();
    const url = query ? `/api/artwork/${id}?${query}` : `/api/artwork/${id}`;
    return apiService.get<Artwork>(url);
  }

  /**
   * 获取作品预览信息
   */
  async getArtworkPreview(id: number): Promise<ApiResponse<Artwork>> {
    return apiService.get<Artwork>(`/api/artwork/${id}/preview`);
  }

  /**
   * 获取作品图片URL
   */
  async getArtworkImages(id: number, size: string = 'medium'): Promise<ApiResponse<ArtworkImagesResponse>> {
    return apiService.get<ArtworkImagesResponse>(`/api/artwork/${id}/images?size=${size}`);
  }

  /**
   * 获取Ugoira元数据（包含zip_urls和frames）
   */
  async getUgoiraMeta(id: number): Promise<ApiResponse<{ artwork_id: number; zip_urls: { medium?: string; original?: string }; frames: { file: string; delay: number }[] }>> {
    return apiService.get(`/api/artwork/${id}/ugoira`);
  }

  /**
   * 搜索作品
   */
  async searchArtworks(params: SearchParams): Promise<ApiResponse<{ artworks: Artwork[]; next_url?: string; total: number }>> {
    const queryParams = new URLSearchParams();
    
    // 处理关键词搜索
    if (params.keyword) {
      queryParams.append('keyword', params.keyword);
    }
    
    // 处理标签搜索
    if (params.tags && params.tags.length > 0) {
      params.tags.forEach(tag => {
        queryParams.append('tags', tag);
      });
    }
    
    if (params.type) queryParams.append('type', params.type);
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.duration) queryParams.append('duration', params.duration);
    if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());

    return apiService.get<{ artworks: Artwork[]; next_url?: string; total: number }>(`/api/artwork/search?${queryParams.toString()}`);
  }

  /**
   * 收藏/取消收藏作品
   */
  async toggleBookmark(artworkId: number, action: 'add' | 'remove'): Promise<ApiResponse<{ artwork_id: number; is_bookmarked: boolean; message: string }>> {
    return apiService.post<{ artwork_id: number; is_bookmarked: boolean; message: string }>(`/api/artwork/${artworkId}/bookmark`, { action });
  }

  /**
   * 获取用户收藏的作品列表
   */
  async getBookmarks(params: { type?: string; offset?: number; limit?: number } = {}): Promise<ApiResponse<{ artworks: Artwork[]; next_url?: string; total: number }>> {
    const queryParams = new URLSearchParams();
    
    if (params.type) queryParams.append('type', params.type);
    if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());

    return apiService.get<{ artworks: Artwork[]; next_url?: string; total: number }>(`/api/artwork/bookmarks?${queryParams.toString()}`);
  }

  /**
   * 获取相关推荐作品
   */
  async getRelatedArtworks(artworkId: number, params: { offset?: number; limit?: number } = {}): Promise<ApiResponse<{ artworks: Artwork[]; next_url?: string; total: number; source_artwork_id: number }>> {
    const queryParams = new URLSearchParams();
    
    if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());

    return apiService.get<{ artworks: Artwork[]; next_url?: string; total: number; source_artwork_id: number }>(`/api/artwork/${artworkId}/related?${queryParams.toString()}`);
  }
}

export const artworkService = new ArtworkService();
export default artworkService;