const axios = require('axios');
const { stringify } = require('qs');

class ArtistService {
  constructor(auth) {
    this.auth = auth;
    this.baseURL = 'https://app-api.pixiv.net';
  }

  /**
   * 获取作者信息
   */
  async getArtistInfo(artistId) {
    try {
      const response = await this.makeRequest(
        'GET',
        '/v1/user/detail',
        { user_id: artistId }
      );

      return {
        success: true,
        data: response.user
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取作者作品列表
   */
  async getArtistArtworks(artistId, options = {}) {
    try {
      const {
        type = 'art',
        filter = 'for_ios',
        offset = 0,
        limit = 30
      } = options;

      const params = {
        user_id: artistId,
        type,
        filter,
        offset
      };

      const response = await this.makeRequest(
        'GET',
        `/v1/user/illusts?${stringify(params)}`
      );

      console.log('Artworks response keys:', Object.keys(response));
      console.log('Artworks count:', response.illusts?.length || 0);
      console.log('Next URL:', response.next_url);

      return {
        success: true,
        data: {
          artworks: response.illusts,
          next_url: response.next_url
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取作者关注列表
   */
  async getArtistFollowing(artistId, options = {}) {
    try {
      const {
        restrict = 'public',
        offset = 0,
        limit = 30
      } = options;

      const params = {
        user_id: artistId,
        restrict,
        offset
      };

      const response = await this.makeRequest(
        'GET',
        `/v1/user/following?${stringify(params)}`
      );

      return {
        success: true,
        data: {
          users: response.user_previews,
          next_url: response.next_url,
          total: response.user_previews.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取作者粉丝列表
   */
  async getArtistFollowers(artistId, options = {}) {
    try {
      const {
        offset = 0,
        limit = 30
      } = options;

      const params = {
        user_id: artistId,
        offset
      };

      const response = await this.makeRequest(
        'GET',
        `/v1/user/follower?${stringify(params)}`
      );

      return {
        success: true,
        data: {
          users: response.user_previews,
          next_url: response.next_url,
          total: response.user_previews.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取当前用户关注的作者列表
   */
  async getFollowingArtists(options = {}) {
    try {
      const {
        offset = 0,
        limit = 30
      } = options;

      // 检查认证状态
      if (!this.auth || !this.auth.accessToken) {
        return {
          success: false,
          error: '未登录或认证已过期'
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
          error: '无法获取当前用户信息，请重新登录'
        };
      }

      const params = {
        user_id: currentUserId,
        restrict: 'public',
        offset,
        limit
      };

      console.log('获取关注作者列表，参数:', params);

      const response = await this.makeRequest(
        'GET',
        `/v1/user/following?${stringify(params)}`
      );

      // 转换数据格式以匹配前端期望
      const artists = (response.user_previews || []).map(user => ({
        id: user.user.id,
        name: user.user.name,
        account: user.user.account,
        profile_image_urls: user.user.profile_image_urls,
        total_illusts: 0, // 这些信息需要通过 /v1/user/detail 获取
        total_manga: 0,
        total_followers: 0,
        is_followed: user.user.is_followed || false
      }));

      // 为前5个用户获取详细信息（避免API调用过多）
      const artistsToFetch = artists.slice(0, 5);
      const detailedArtists = await Promise.all(
        artistsToFetch.map(async (artist) => {
          try {
            const detailResponse = await this.getArtistInfo(artist.id);
            if (detailResponse.success) {
              return {
                ...artist,
                total_illusts: detailResponse.data.total_illusts || 0,
                total_manga: detailResponse.data.total_manga || 0,
                total_followers: detailResponse.data.total_followers || 0
              };
            }
          } catch (error) {
            console.error(`获取用户 ${artist.id} 详细信息失败:`, error.message);
          }
          return artist;
        })
      );

      // 合并详细信息和基本信息
      const finalArtists = [
        ...detailedArtists,
        ...artists.slice(5) // 其余用户保持基本信息
      ];

      return {
        success: true,
        data: {
          artists: finalArtists,
          total: finalArtists.length
        }
      };

    } catch (error) {
      console.error('获取关注作者列表失败:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 关注/取消关注作者
   */
  async followArtist(artistId, action = 'follow') {
    try {
      const data = {
        user_id: artistId,
        restrict: 'public'
      };

      const endpoint = action === 'follow' ? '/v1/user/follow/add' : '/v1/user/follow/delete';
      
      const response = await this.makeRequest(
        'POST',
        endpoint,
        data
      );

      return {
        success: true,
        data: response
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 搜索作者
   */
  async searchArtists(searchOptions) {
    try {
      const {
        keyword,
        sort = 'date_desc',
        duration = 'all',
        offset = 0,
        limit = 30
      } = searchOptions;

      const params = {
        word: keyword,
        sort,
        duration,
        offset,
        filter: 'for_ios'
      };

      const response = await this.makeRequest(
        'GET',
        `/v1/search/user?${stringify(params)}`
      );

      return {
        success: true,
        data: {
          users: response.user_previews,
          next_url: response.next_url,
          search_span_limit: response.search_span_limit,
          total: response.user_previews.length
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取推荐作者
   */
  async getRecommendedArtists(options = {}) {
    try {
      const {
        offset = 0,
        limit = 30
      } = options;

      const params = {
        offset,
        filter: 'for_ios'
      };

      const response = await this.makeRequest(
        'GET',
        `/v1/user/recommended?${stringify(params)}`
      );

      return {
        success: true,
        data: {
          users: response.user_previews,
          next_url: response.next_url
        }
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取作者统计信息
   */
  async getArtistStats(artistId) {
    try {
      const response = await this.makeRequest(
        'GET',
        '/v1/user/detail',
        { user_id: artistId }
      );

      const user = response.user;
      
      const stats = {
        user_id: user.id,
        total_illusts: user.total_illusts,
        total_manga: user.total_manga,
        total_novels: user.total_novels,
        total_bookmarked_illust: user.total_bookmarked_illust,
        total_following: user.total_following,
        total_followers: user.total_followers,
        total_illust_bookmarks_public: user.total_illust_bookmarks_public,
        total_illust_series: user.total_illust_series,
        total_novel_series: user.total_novel_series,
        background: user.background,
        twitter_account: user.twitter_account,
        twitter_url: user.twitter_url,
        pawoo_url: user.pawoo_url,
        is_followed: user.is_followed,
        is_following: user.is_following,
        is_friend: user.is_friend,
        is_blocking: user.is_blocking,
        is_blocked: user.is_blocked,
        accept_request: user.accept_request
      };

      return {
        success: true,
        data: stats
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 发送API请求
   */
  async makeRequest(method, endpoint, data = null) {
    const headers = {
      'Authorization': `Bearer ${this.auth.accessToken}`,
      'Accept-Language': 'en-us',
      'App-OS': 'android',
      'App-OS-Version': '9.0',
      'App-Version': '5.0.234',
      'User-Agent': 'PixivAndroidApp/5.0.234 (Android 9.0; Pixel 3)'
    };

          const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers,
        timeout: 60000 // 增加到60秒
      };

    if (data) {
      if (method === 'GET') {
        config.params = data;
      } else {
        config.data = data;
      }
    }

    try {
      console.log(`发送API请求: ${method} ${endpoint}`);
      const response = await axios(config);
      return response.data;
    } catch (error) {
      console.error('API请求失败:', {
        method,
        endpoint,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      throw error;
    }
  }
}

module.exports = ArtistService; 