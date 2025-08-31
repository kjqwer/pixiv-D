const axios = require('axios');
const { stringify } = require('qs');
const ApiCacheService = require('./api-cache');
const { defaultLogger } = require('../utils/logger');

// 创建logger实例
const logger = defaultLogger.child('ArtistService');


class ArtistService {
  constructor(auth) {
    this.auth = auth;
    this.baseURL = 'https://app-api.pixiv.net';
    
    // 创建API缓存服务实例
    this.apiCache = new ApiCacheService();
  }

  /**
   * 获取作者详细信息（用于作者详情页面）
   */
  async getArtistInfo(artistId) {
    try {
      const response = await this.makeRequest('GET', '/v1/user/detail', { user_id: artistId });

      return {
        success: true,
        data: response.user,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取作者简单信息（用于列表页面）
   */
  async getArtistBasicInfo(artistId) {
    try {
      const response = await this.makeRequest('GET', '/v1/user/detail', { user_id: artistId });

      // 只返回基本信息，不包含统计信息
      const basicInfo = {
        id: response.user.id,
        name: response.user.name,
        account: response.user.account,
        profile_image_urls: response.user.profile_image_urls,
        comment: response.user.comment,
        is_followed: response.user.is_followed || false,
      };

      return {
        success: true,
        data: basicInfo,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取作者作品列表
   */
  async getArtistArtworks(artistId, options = {}) {
    try {
      const { type = 'art', filter = 'for_ios', offset = 0, limit = 30 } = options;

      const params = {
        user_id: artistId,
        type,
        filter,
        offset,
      };

      const response = await this.makeRequest('GET', `/v1/user/illusts?${stringify(params)}`);

      // 获取作者作品列表

      return {
        success: true,
        data: {
          artworks: response.illusts,
          next_url: response.next_url,
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
   * 获取作者关注列表
   */
  async getArtistFollowing(artistId, options = {}) {
    try {
      const { restrict = 'public', offset = 0, limit = 100 } = options;

      const params = {
        user_id: artistId,
        restrict,
        offset,
      };

      const response = await this.makeRequest('GET', `/v1/user/following?${stringify(params)}`);

      return {
        success: true,
        data: {
          users: response.user_previews,
          next_url: response.next_url,
          total: response.user_previews.length,
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
   * 获取作者粉丝列表
   */
  async getArtistFollowers(artistId, options = {}) {
    try {
      const { offset = 0, limit = 100 } = options;

      const params = {
        user_id: artistId,
        offset,
      };

      const response = await this.makeRequest('GET', `/v1/user/follower?${stringify(params)}`);

      return {
        success: true,
        data: {
          users: response.user_previews,
          next_url: response.next_url,
          total: response.user_previews.length,
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
   * 获取当前用户关注的作者列表
   */
  async getFollowingArtists(options = {}) {
    try {
      const { offset = 0, limit = 30, restrict = 'public' } = options;

      // 检查认证状态
      if (!this.auth || !this.auth.accessToken) {
        return {
          success: false,
          error: '未登录或认证已过期',
        };
      }

      // 尝试从认证实例获取当前用户ID
      let currentUserId = this.auth.user?.id;

      // 如果认证实例中没有用户信息，尝试从状态中获取
      if (!currentUserId) {
        const status = this.auth.getStatus();
        currentUserId = status.user?.id;
      }

      if (!currentUserId) {
        return {
          success: false,
          error: '无法获取当前用户信息，请重新登录',
        };
      }

      let allArtists = [];
      let currentOffset = offset;
      let hasMore = true;

      // 循环获取所有关注的作者
      while (hasMore) {
        const params = {
          user_id: currentUserId,
          restrict,
          offset: currentOffset,
          limit,
        };

        logger.info(`请求关注列表: offset=${currentOffset}, limit=${limit}`);
        const response = await this.makeRequest('GET', `/v1/user/following?${stringify(params)}`);

        // 转换数据格式以匹配前端期望
        const artists = (response.user_previews || []).map(user => ({
          id: user.user.id,
          name: user.user.name,
          account: user.user.account,
          profile_image_urls: user.user.profile_image_urls,
          is_followed: user.user.is_followed || false,
        }));

        allArtists.push(...artists);
        logger.info(`本次获取到 ${artists.length} 个作者，累计 ${allArtists.length} 个`);

        // 如果返回的数量少于limit，说明已经获取完所有数据
        if (artists.length < limit) {
          hasMore = false;
          logger.info('已获取完所有关注的作者');
        } else {
          currentOffset += artists.length;
        }
      }

      return {
        success: true,
        data: {
          artists: allArtists,
          total: allArtists.length,
        },
      };
    } catch (error) {
      logger.error('获取关注作者列表失败:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 关注/取消关注作者
   */
  async followArtist(artistId, action = 'follow') {
    try {
      const data = {
        user_id: String(artistId),
        restrict: 'public',
      };

      const endpoint = action === 'follow' ? '/v1/user/follow/add' : '/v1/user/follow/delete';

      const response = await this.makeRequest('POST', endpoint, data);

      return {
        success: true,
        data: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 搜索作者
   */
  async searchArtists(searchOptions) {
    try {
      const { keyword, sort = 'date_desc', duration = 'all', offset = 0, limit = 30 } = searchOptions;

      const params = {
        word: keyword,
        sort,
        duration,
        offset,
        filter: 'for_ios',
      };

      const response = await this.makeRequest('GET', `/v1/search/user?${stringify(params)}`);

      return {
        success: true,
        data: {
          users: response.user_previews,
          next_url: response.next_url,
          search_span_limit: response.search_span_limit,
          total: response.user_previews.length,
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
   * 获取推荐作者
   */
  async getRecommendedArtists(options = {}) {
    try {
      const { offset = 0, limit = 30 } = options;

      const params = {
        offset,
        filter: 'for_ios',
      };

      const response = await this.makeRequest('GET', `/v1/user/recommended?${stringify(params)}`);

      return {
        success: true,
        data: {
          users: response.user_previews,
          next_url: response.next_url,
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
    // 对于GET请求，尝试从缓存获取
    if (method === 'GET') {
      try {
        const cachedData = await this.apiCache.get(method, endpoint, data || {});
        if (cachedData) {
          // logger.info(`API缓存命中: ${method} ${endpoint}`);
          return cachedData;
        }
      } catch (error) {
        logger.error('读取API缓存失败:', error);
      }
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
        // 对于POST请求，使用form-urlencoded格式
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
        config.data = stringify(data);
      }
    }

    try {
      // 使用auth实例的axiosInstance发送请求，这样可以利用自动token刷新机制
      const response = await this.auth.axiosInstance(config);
      const responseData = response.data;
      
      // 对于GET请求，将响应数据缓存
      if (method === 'GET') {
        try {
          await this.apiCache.set(method, endpoint, data || {}, responseData);
          logger.info(`API缓存已保存: ${method} ${endpoint}`);
        } catch (error) {
          logger.error('保存API缓存失败:', error);
        }
      }
      
      return responseData;
    } catch (error) {
      logger.error('API请求失败:', {
        method,
        endpoint,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
      });
      throw error;
    }
  }
}

module.exports = ArtistService;
