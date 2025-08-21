/**
 * 统一API响应格式工具类
 */
class ResponseUtil {
  /**
   * 成功响应
   */
  static success(data = null, message = 'Success') {
    return {
      success: true,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 错误响应
   */
  static error(message = 'Error', code = null, details = null) {
    return {
      success: false,
      message,
      code,
      details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 分页响应
   */
  static paginated(data, page, limit, total) {
    return {
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 列表响应
   */
  static list(data, total = null) {
    return {
      success: true,
      data,
      total: total || (Array.isArray(data) ? data.length : 0),
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ResponseUtil; 