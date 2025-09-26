/**
 * 静态文件服务中间件
 */
const express = require('express');
const path = require('path');

function staticFilesMiddleware() {
  return [
    // 下载文件静态服务
    express.static(path.join(__dirname, '../../downloads')),
    
    // 前端静态文件服务
    express.static(path.join(__dirname, '../../ui/dist'))
  ];
}

module.exports = { staticFilesMiddleware };