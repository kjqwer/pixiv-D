const axios = require('axios');
const { stringify } = require('qs');

class ArtworkService {
  constructor(auth) {
    this.auth = auth;
    this.baseURL = 'https://app-api.pixiv.net';
  }

  /**
   * 获取作品详情
   */
  async getArtworkDetail(artworkId, options = {}) {
    try {
      const { include_user = true, include_series = false } = options;

      const params = {
        include_user,
        include_series,
      };

      const response = await this.makeRequest('GET', `/v1/illust/detail?${stringify(params)}`, { illust_id: artworkId });

      return {
        success: true,
        data: response.illust,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取作品预览信息
   */
  async getArtworkPreview(artworkId) {
    try {
      const response = await this.makeRequest('GET', '/v1/illust/detail', { illust_id: artworkId });

      const artwork = response.illust;

      // 构建预览信息
      const preview = {
        id: artwork.id,
        title: artwork.title,
        description: artwork.caption,
        user: {
          id: artwork.user.id,
          name: artwork.user.name,
          account: artwork.user.account,
        },
        image_urls: artwork.image_urls,
        tags: artwork.tags.map(tag => tag.name),
        create_date: artwork.create_date,
        update_date: artwork.update_date,
        type: artwork.type,
        width: artwork.width,
        height: artwork.height,
        page_count: artwork.page_count,
        is_bookmarked: artwork.is_bookmarked,
        total_bookmarks: artwork.total_bookmarks,
        total_view: artwork.total_view,
        is_muted: artwork.is_muted,
        meta_single_page: artwork.meta_single_page,
        meta_pages: artwork.meta_pages,
      };

      return {
        success: true,
        data: preview,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取作品图片URL
   */
  async getArtworkImages(artworkId, size = 'medium') {
    try {
      const response = await this.makeRequest('GET', '/v1/illust/detail', { illust_id: artworkId });

      const artwork = response.illust;
      const images = [];

      if (artwork.meta_single_page && artwork.meta_single_page.original_image_url) {
        // 单页作品
        images.push({
          page: 1,
          original: artwork.meta_single_page.original_image_url,
          large: artwork.meta_single_page.large_image_url,
          medium: artwork.image_urls.medium,
          square_medium: artwork.image_urls.square_medium,
        });
      } else if (artwork.meta_pages && artwork.meta_pages.length > 0) {
        // 多页作品
        artwork.meta_pages.forEach((page, index) => {
          images.push({
            page: index + 1,
            original: page.image_urls.original,
            large: page.image_urls.large,
            medium: page.image_urls.medium,
            square_medium: page.image_urls.square_medium,
          });
        });
      }

      return {
        success: true,
        data: {
          artwork_id: artworkId,
          total_pages: artwork.page_count,
          images: images,
          selected_size: size,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 搜索作品
   */
  async searchArtworks(searchOptions) {
    try {
      const { keyword, tags, type = 'all', sort = 'date_desc', duration = 'all', offset = 0, limit = 30 } = searchOptions;

      // 验证搜索参数
      if ((!keyword || keyword.trim() === '') && (!tags || tags.length === 0)) {
        return {
          success: false,
          error: 'Search keyword or tags are required',
        };
      }

      // 映射搜索参数到Pixiv API格式
      const searchTargetMap = {
        all: 'partial_match_for_tags',
        art: 'partial_match_for_tags',
        manga: 'partial_match_for_tags',
        novel: 'partial_match_for_tags',
      };

      const sortMap = {
        date_desc: 'date_desc',
        date_asc: 'date_asc',
        popular_desc: 'popular_desc',
      };

      const durationMap = {
        all: null, // 不传递duration参数表示全部时间
        within_last_day: 'within_last_day',
        within_last_week: 'within_last_week',
        within_last_month: 'within_last_month',
      };

      // 构建搜索关键词
      let searchWord = '';
      if (keyword && keyword.trim()) {
        searchWord = keyword.trim();
      } else if (tags && tags.length > 0) {
        // 将标签数组转换为搜索关键词，用空格分隔
        searchWord = tags.join(' ');
      }

      const params = {
        word: searchWord,
        search_target: searchTargetMap[type] || 'partial_match_for_tags',
        sort: sortMap[sort] || 'date_desc',
        offset: parseInt(offset) || 0,
        filter: 'for_ios',
      };

      // 只有当duration不是'all'时才添加duration参数
      if (durationMap[duration] && durationMap[duration] !== null) {
        params.duration = durationMap[duration];
      }

      // 搜索参数已设置

      const response = await this.makeRequest('GET', `/v1/search/illust?${stringify(params)}`);

      return {
        success: true,
        data: {
          artworks: response.illusts || [],
          next_url: response.next_url,
          search_span_limit: response.search_span_limit,
          total: response.illusts ? response.illusts.length : 0,
        },
      };
    } catch (error) {
      console.error('Search error:', error.message);
      console.error('Search error details:', error.response?.data);

      return {
        success: false,
        error: error.message || 'Search failed',
      };
    }
  }

  /**
   * 获取推荐作品
   */
  async getRecommendedArtworks(options = {}) {
    try {
      const { offset = 0, limit = 30, include_ranking_illusts = true, include_privacy_policy = false } = options;

      const params = {
        offset,
        include_ranking_illusts,
        include_privacy_policy,
        filter: 'for_ios',
      };

      const response = await this.makeRequest('GET', `/v1/illust/recommended?${stringify(params)}`);

      return {
        success: true,
        data: {
          artworks: response.illusts,
          next_url: response.next_url,
          ranking_illusts: response.ranking_illusts || [],
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取排行榜作品
   */
  async getRankingArtworks(options = {}) {
    try {
      const { mode = 'day', content = 'illust', filter = 'for_ios', offset = 0, limit = 30 } = options;

      const params = {
        mode,
        content,
        filter,
        offset,
        limit,
      };

      const response = await this.makeRequest('GET', `/v1/illust/ranking?${stringify(params)}`);

      return {
        success: true,
        data: {
          artworks: response.illusts,
          next_url: response.next_url,
          mode,
          date: response.date,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 发送API请求
   */
  async makeRequest(method, endpoint, data = null) {
    try {
      if (!this.auth || !this.auth.accessToken) {
        throw new Error('No access token available');
      }

      const headers = {
        Authorization: `Bearer ${this.auth.accessToken}`,
        'Accept-Language': 'en-us',
        'App-OS': 'android',
        'App-OS-Version': '9.0',
        'App-Version': '5.0.234',
        'User-Agent': 'PixivAndroidApp/5.0.234 (Android 9.0; Pixel 3)',
      };

      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers,
        timeout: 60000, // 增加到60秒
      };

      if (data) {
        if (method === 'GET') {
          config.params = data;
        } else {
          config.data = data;
        }
      }

      // 发送API请求

      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('API request failed:', {
        method,
        endpoint,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data,
      });
      throw error;
    }
  }
}

module.exports = ArtworkService;
