import apiService from './api';
import type { ApiResponse, Artist, User } from '@/types';

export interface ArtistArtworksOptions {
  type?: 'art' | 'manga' | 'novel';
  filter?: 'for_ios' | 'for_android';
  offset?: number;
  limit?: number;
}

export interface ArtistFollowingOptions {
  restrict?: 'public' | 'private';
  offset?: number;
  limit?: number;
}

export interface ArtistFollowersOptions {
  offset?: number;
  limit?: number;
}

class ArtistService {
  /**
   * 获取作者信息
   */
  async getArtistInfo(id: number): Promise<ApiResponse<Artist>> {
    return apiService.get<Artist>(`/api/artist/${id}`);
  }

  /**
   * 获取作者作品列表
   */
  async getArtistArtworks(id: number, options: ArtistArtworksOptions = {}): Promise<ApiResponse<{ artworks: any[]; next_url?: string; total: number }>> {
    const params = new URLSearchParams();
    if (options.type) params.append('type', options.type);
    if (options.filter) params.append('filter', options.filter);
    if (options.offset !== undefined) params.append('offset', options.offset.toString());
    if (options.limit !== undefined) params.append('limit', options.limit.toString());

    const query = params.toString();
    const url = query ? `/api/artist/${id}/artworks?${query}` : `/api/artist/${id}/artworks`;
    return apiService.get<{ artworks: any[]; next_url?: string; total: number }>(url);
  }

  /**
   * 获取作者关注列表
   */
  async getArtistFollowing(id: number, options: ArtistFollowingOptions = {}): Promise<ApiResponse<{ users: User[]; next_url?: string; total: number }>> {
    const params = new URLSearchParams();
    if (options.restrict) params.append('restrict', options.restrict);
    if (options.offset !== undefined) params.append('offset', options.offset.toString());
    if (options.limit !== undefined) params.append('limit', options.limit.toString());

    const query = params.toString();
    const url = query ? `/api/artist/${id}/following?${query}` : `/api/artist/${id}/following`;
    return apiService.get<{ users: User[]; next_url?: string; total: number }>(url);
  }

  /**
   * 获取作者粉丝列表
   */
  async getArtistFollowers(id: number, options: ArtistFollowersOptions = {}): Promise<ApiResponse<{ users: User[]; next_url?: string; total: number }>> {
    const params = new URLSearchParams();
    if (options.offset !== undefined) params.append('offset', options.offset.toString());
    if (options.limit !== undefined) params.append('limit', options.limit.toString());

    const query = params.toString();
    const url = query ? `/api/artist/${id}/followers?${query}` : `/api/artist/${id}/followers`;
    return apiService.get<{ users: User[]; next_url?: string; total: number }>(url);
  }

  /**
   * 关注/取消关注作者
   */
  async followArtist(id: number, action: 'follow' | 'unfollow'): Promise<ApiResponse> {
    return apiService.post(`/api/artist/${id}/follow`, { action });
  }
}

export const artistService = new ArtistService();
export default artistService; 