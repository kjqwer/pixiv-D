// 基础响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  code?: string;
  timestamp?: string;
}

// 分页响应类型
export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// 用户信息
export interface User {
  id: number;
  name: string;
  account: string;
  profile_image_urls: {
    medium: string;
  };
  is_followed: boolean;
}

// 作品信息
export interface Artwork {
  id: number;
  title: string;
  description: string;
  caption: string;
  user: User;
  image_urls: {
    square_medium: string;
    medium: string;
    large: string;
    original: string;
  };
  tags: Array<{
    name: string;
    translated_name?: string;
  }>;
  create_date: string;
  update_date: string;
  type: string;
  width: number;
  height: number;
  page_count: number;
  is_bookmarked: boolean;
  total_bookmarks: number;
  total_view: number;
  is_muted: boolean;
  meta_single_page?: {
    original_image_url?: string;
    large_image_url?: string;
  };
  meta_pages?: Array<{
    image_urls: {
      square_medium: string;
      medium: string;
      large: string;
      original: string;
    };
  }>;
}

// 作者信息
export interface Artist {
  id: number;
  name: string;
  account: string;
  profile_image_urls: {
    medium: string;
  };
  comment: string;
  is_followed: boolean;
  total_illusts: number;
  total_manga: number;
  total_novels: number;
  total_bookmarked_illust: number;
  total_following: number;
  total_followers: number;
}

// 登录状态
export interface LoginStatus {
  isLoggedIn: boolean;
  username?: string;
  user_id?: number;
}

// 下载任务
export interface DownloadTask {
  id: string;
  type: 'artwork' | 'batch' | 'artist';
  status: 'downloading' | 'completed' | 'failed' | 'partial' | 'cancelled' | 'paused';
  progress: number;
  total_files: number;
  completed_files: number;
  failed_files: number;
  artwork_id?: number;
  artist_name?: string;
  artwork_title?: string;
  task_description?: string;
  task_title?: string;
  mode?: string;
  start_time: string;
  end_time?: string;
  error?: string;
  results?: any[];
  recent_completed?: Array<{
    artwork_id: number;
    artwork_title?: string;
    artist_name?: string;
  }>;
}

// 搜索参数
export interface SearchParams {
  keyword?: string;
  tags?: string[];
  type?: 'all' | 'art' | 'manga' | 'novel';
  sort?: 'date_desc' | 'date_asc' | 'popular_desc';
  duration?: 'all' | 'within_last_day' | 'within_last_week' | 'within_last_month';
  offset?: number;
  limit?: number;
}

// 下载参数
export interface DownloadParams {
  size?: 'original' | 'large' | 'medium' | 'square_medium';
  quality?: 'high' | 'medium' | 'low';
  format?: 'auto' | 'jpg' | 'png';
  concurrent?: number;
}