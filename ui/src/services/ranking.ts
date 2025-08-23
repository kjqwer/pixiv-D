import api from './api';

export interface RankingParams {
  mode: 'day' | 'week' | 'month';
  type: 'art' | 'manga' | 'novel';
  offset?: number;
  limit?: number;
}

export interface RankingResponse {
  artworks: any[];
  next_url?: string;
}

class RankingService {
  /**
   * 获取排行榜数据
   */
  async getRanking(params: RankingParams) {
    try {
      const response = await api.get('/api/ranking', { params });
      return {
        success: true,
        data: response.data
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.error || error.message || '获取排行榜失败'
      };
    }
  }
}

export default new RankingService(); 