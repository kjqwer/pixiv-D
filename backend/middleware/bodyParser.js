/**
 * Body Parser中间件
 * 处理JSON和URL编码的请求体
 */
const express = require('express');

function bodyParserMiddleware() {
  return [
    // JSON 解析中间件
    express.json({ limit: '20mb' }),
    // URL编码解析中间件
    express.urlencoded({ extended: true, limit: '20mb' })
  ];
}

module.exports = { bodyParserMiddleware };