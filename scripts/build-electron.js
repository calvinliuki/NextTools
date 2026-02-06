#!/usr/bin/env node
/**
 * Electron 打包脚本
 * 1. 获取实际 Electron 版本
 * 2. 为该版本重新编译原生模块
 * 3. 执行 electron-builder
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('=== Electron 打包脚本 ===\n');

// 1. 获取实际安装的 Electron 版本
let electronVersion;
try {
  electronVersion = execSync('npx electron --version', { encoding: 'utf8' }).trim().replace('v', '');
  console.log(`1. 检测到 Electron 版本: ${electronVersion}`);
} catch (err) {
  console.error('无法获取 Electron 版本，使用默认值');
  electronVersion = '28.3.3';
}

// 2. 构建 Next.js（不加载 Electron）
console.log('\n2. 构建 Next.js 应用...');
const env = { ...process.env, SKIP_ELECTRON_LOAD: 'true' };
execSync('npm run build', { stdio: 'inherit', env });

// 3. 为 Electron 重新编译原生模块
console.log(`\n3. 为 Electron ${electronVersion} 重新编译原生模块...`);

try {
  // 使用 @electron/rebuild
  execSync(
    `npx @electron/rebuild --version ${electronVersion} --module-dir . --force`,
    { stdio: 'inherit' }
  );
  console.log('   原生模块重新编译完成 ✓');
} catch (err) {
  console.error('   @electron/rebuild 失败，尝试备用方案...');
  try {
    execSync(
      `npx electron-rebuild -v ${electronVersion} -f`,
      { stdio: 'inherit' }
    );
    console.log('   原生模块重新编译完成 ✓');
  } catch (err2) {
    console.error('   警告: 原生模块重新编译失败!');
    console.error('   请手动执行: npx @electron/rebuild');
    process.exit(1);
  }
}

// 4. 执行 electron-builder
console.log('\n4. 执行 electron-builder...');
const platform = process.argv[2] || '--mac';
execSync(`electron-builder ${platform}`, { stdio: 'inherit' });

console.log('\n=== 打包完成 ===');
console.log('注意: 如需继续开发，请执行: npm rebuild better-sqlite3');
