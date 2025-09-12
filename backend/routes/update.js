const express = require('express');
const axios = require('axios');
const { defaultLogger } = require('../utils/logger');
const packageInfo = require('../../package.json');

const router = express.Router();
const logger = defaultLogger.child('UpdateRoute');

/**
 * 获取当前版本信息
 */
router.get('/current-version', (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        version: packageInfo.version,
        name: packageInfo.name,
        description: packageInfo.description
      }
    });
  } catch (error) {
    logger.error('获取当前版本失败', error);
    res.status(500).json({
      success: false,
      error: '获取当前版本失败',
      message: error.message
    });
  }
});

/**
 * 检查最新版本
 */
router.get('/check-latest', async (req, res) => {
  try {
    logger.info('检查最新版本...');
    
    // 获取GitHub发行版信息
    const response = await axios.get('https://api.github.com/repos/kjqwer/pixiv-D/releases/latest', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Pixiv-Manager-Update-Checker'
      }
    });

    const latestRelease = response.data;
    const currentVersion = packageInfo.version;
    const latestVersion = latestRelease.tag_name.replace(/^v/, ''); // 移除v前缀

    // 版本比较
    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    const result = {
      current: currentVersion,
      latest: latestVersion,
      hasUpdate,
      releaseInfo: {
        name: latestRelease.name,
        body: latestRelease.body,
        publishedAt: latestRelease.published_at,
        htmlUrl: latestRelease.html_url,
        downloadUrl: latestRelease.assets.find(asset => 
          asset.name.includes('pixiv-manager-portable.rar')
        )?.browser_download_url || latestRelease.html_url
      }
    };

    logger.info(`版本检查完成: 当前版本 ${currentVersion}, 最新版本 ${latestVersion}, 有更新: ${hasUpdate}`);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('检查最新版本失败', error);
    
    // 如果是网络错误，返回友好的错误信息
    let errorMessage = '检查更新失败';
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      errorMessage = '无法连接到GitHub，请检查网络连接';
    } else if (error.response?.status === 404) {
      errorMessage = '未找到发行版信息';
    } else if (error.response?.status === 403) {
      errorMessage = 'GitHub API访问限制，请稍后再试';
    }

    res.status(500).json({
      success: false,
      error: errorMessage,
      message: error.message
    });
  }
});

/**
 * 版本比较函数
 * @param {string} version1 版本1
 * @param {string} version2 版本2  
 * @returns {number} 1: version1 > version2, 0: 相等, -1: version1 < version2
 */
function compareVersions(version1, version2) {
  const v1Parts = version1.split('.').map(Number);
  const v2Parts = version2.split('.').map(Number);
  
  const maxLength = Math.max(v1Parts.length, v2Parts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
}

module.exports = router; 