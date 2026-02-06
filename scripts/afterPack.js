/**
 * electron-builder afterPack 钩子
 * 用于在打包后进行额外处理
 */

const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
  const { appOutDir, packager } = context;
  
  console.log('[afterPack] 开始后处理...');
  console.log('[afterPack] 输出目录:', appOutDir);
  console.log('[afterPack] 平台:', packager.platform.name);
  console.log('[afterPack] 产品名:', packager.appInfo.productFilename);

  // 确定 resources 路径
  let resourcesPath;
  if (packager.platform.name === 'mac') {
    resourcesPath = path.join(appOutDir, `${packager.appInfo.productFilename}.app`, 'Contents', 'Resources');
  } else {
    resourcesPath = path.join(appOutDir, 'resources');
  }
  
  console.log('[afterPack] Resources 路径:', resourcesPath);
  
  // 确保 server 目录存在
  const serverDir = path.join(resourcesPath, 'server');
  if (!fs.existsSync(serverDir)) {
    fs.mkdirSync(serverDir, { recursive: true });
    console.log('[afterPack] 创建 server 目录:', serverDir);
  }

  // 确保 data 目录存在
  const serverDataDir = path.join(serverDir, 'data');
  if (!fs.existsSync(serverDataDir)) {
    fs.mkdirSync(serverDataDir, { recursive: true });
    console.log('[afterPack] 创建 data 目录:', serverDataDir);
  }

  // server.js 已经通过 extraResources 复制
  const serverJsPath = path.join(serverDir, 'server.js');
  console.log('[afterPack] 检查 server.js:', serverJsPath);
  
  if (fs.existsSync(serverJsPath)) {
    console.log('[afterPack] server.js 存在 ✓');
  } else {
    console.error('[afterPack] 警告: server.js 不存在!');
  }

  // 列出 server 目录内容以便调试
  try {
    const serverContents = fs.readdirSync(serverDir);
    console.log('[afterPack] server 目录内容:', serverContents);
  } catch (e) {
    console.error('[afterPack] 无法读取 server 目录:', e.message);
  }

  console.log('[afterPack] 后处理完成');
};
