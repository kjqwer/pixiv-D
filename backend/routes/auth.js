const express = require('express');
const router = express.Router();

/**
 * 获取登录状态
 * GET /api/auth/status
 */
router.get('/status', (req, res) => {
  try {
    const status = req.backend.getLoginStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取登录URL
 * GET /api/auth/login-url
 */
router.get('/login-url', (req, res) => {
  try {
    const loginData = req.backend.getLoginUrl();
    res.json({
      success: true,
      data: loginData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 处理登录回调
 * POST /api/auth/callback
 */
router.post('/callback', async (req, res) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        error: 'Authorization code is required'
      });
    }
    
    const result = await req.backend.handleLoginCallback(code);
    
    if (result.success) {
      res.json({
        success: true,
        data: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 重新登录
 * POST /api/auth/relogin
 */
router.post('/relogin', async (req, res) => {
  try {
    const result = await req.backend.relogin();
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Relogin successful'
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 登出
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  try {
    const result = req.backend.logout();
    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router; 