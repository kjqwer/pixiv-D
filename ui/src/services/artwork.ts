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
   * 搜索作品
   */
  async searchArtworks(params: SearchParams): Promise<ApiResponse<{ artworks: Artwork[]; next_url?: string; total: number }>> {
    const queryParams = new URLSearchParams();
    queryParams.append('keyword', params.keyword);
    if (params.type) queryParams.append('type', params.type);
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.duration) queryParams.append('duration', params.duration);
    if (params.offset !== undefined) queryParams.append('offset', params.offset.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());

    return apiService.get<{ artworks: Artwork[]; next_url?: string; total: number }>(`/api/artwork/search?${queryParams.toString()}`);
  }
}

export const artworkService = new ArtworkService();
export default artworkService; 