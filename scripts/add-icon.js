const fs = require('fs');
const path = require('path');
const fsExtra = require('fs-extra');
const resedit = require('resedit');
const { defaultLogger } = require('../backend/utils/logger');

// 创建logger实例
const logger = defaultLogger.child('AddIcon');

async function addIconToExe() {
  const distDir = path.join(__dirname, '..', 'dist');
  const exeName = 'pixiv-manager.exe';
  const exePath = path.join(distDir, exeName);
  const iconPath = path.join(__dirname, '..', 'ui', 'public', 'favicon.ico');
  
  try {
    // 检查exe文件是否存在
    if (!await fsExtra.pathExists(exePath)) {
      logger.error(`❌ EXE文件不存在: ${exePath}`);
      logger.info('请先运行构建命令: npm run build');
      return;
    }
    
    // 检查图标文件是否存在
    if (!await fsExtra.pathExists(iconPath)) {
      logger.error(`❌ 图标文件不存在: ${iconPath}`);
      return;
    }
    
    logger.info('正在添加图标到EXE文件...');
    
    // 读取exe文件和图标文件
    const exeBuf = await fsExtra.readFile(exePath);
    const iconBuf = await fsExtra.readFile(iconPath);
    
    logger.info(`EXE文件大小: ${exeBuf.length} 字节`);
    logger.info(`图标文件大小: ${iconBuf.length} 字节`);
    
    try {
      // 使用resedit加载exe（忽略证书和深度签名检查）
      const exe = resedit.NtExecutable.from(exeBuf, {
        ignoreCert: true,
        deepSign: false
      });
      const res = resedit.NtExecutableResource.from(exe);
      logger.info('成功加载EXE文件');
      
      // 读取图标组
      const iconFile = resedit.Data.IconFile.from(iconBuf);
      logger.info(`图标文件包含 ${iconFile.icons.length} 个图标`);
      
      // 添加新的图标资源
      resedit.Resource.IconGroupEntry.replaceIconsForResource(
        res.entries,
        1, // icon group id
        1033, // lang (en-US)
        iconFile.icons.map(item => item.data)
      );
      
      logger.info('图标资源替换完成');
      
      // 更新资源并写回文件
      res.outputResource(exe);
      const newExeBuf = Buffer.from(exe.generate());
      await fsExtra.writeFile(exePath, newExeBuf);
      
      logger.info('✅ 成功添加图标到EXE文件');
      
      // 验证图标是否正确添加
      try {
        const verifyExe = resedit.NtExecutable.from(newExeBuf);
        const verifyRes = resedit.NtExecutableResource.from(verifyExe);
        const iconGroupEntries = verifyRes.entries.filter(e => e.type === 14 && e.id === 1);
        if (iconGroupEntries.length > 0) {
          logger.info('✅ 图标验证成功');
        } else {
          logger.warn('⚠️ 图标验证失败：未找到图标资源');
        }
      } catch (verifyError) {
        logger.warn('⚠️ 图标验证时出错:', verifyError.message);
      }
    } catch (parseError) {
      logger.warn('使用ResEdit处理图标时出错:', parseError.message);
      logger.error('错误堆栈:', parseError.stack);
      
      // 如果ResEdit方法失败，只记录日志，不中断构建过程
      logger.info('⚠️ 图标添加跳过，继续构建过程');
    }
  } catch (error) {
    logger.error('❌ 添加图标失败', error);
    logger.error('错误详情:', error.message);
    // 即使添加图标失败，也不要中断构建过程
    logger.info('⚠️ 图标添加失败，继续构建过程');
  }
}

// 如果直接运行此脚本，则执行函数
if (require.main === module) {
  addIconToExe();
}

module.exports = { addIconToExe };