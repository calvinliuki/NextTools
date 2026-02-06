const fs = require('fs');
const path = require('path');

/**
 * 生成 NextTools 的高清图标 (SVG 格式)
 * 这是一个矢量格式，可以无限放大，效果与 UI 中完全一致。
 */
function generateIcon() {
  const iconPath = path.join(__dirname, '..', 'public', 'logo.svg');
  
  // 确保目录存在
  const publicDir = path.dirname(iconPath);
  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // SVG 内容：蓝色渐变圆角背景 + 白色扳手图标
  const svgContent = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="paint0_linear" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop stop-color="#165DFF"/>
      <stop offset="1" stop-color="#007ACC"/>
    </linearGradient>
  </defs>
  <!-- 圆角矩形背景 (符合 macOS 风格) -->
  <rect width="1024" height="1024" rx="200" fill="url(#paint0_linear)"/>
  <!-- 扳手图标路径 (Font Awesome 样式) -->
  <path d="M784.7 239.2C712.3 166.8 616.5 128 514.1 128C311.4 128 147 292.4 147 495.1C147 558.1 162.9 617.4 191.1 669.1L45.4 814.8C35.2 825 35.2 841.6 45.4 851.8L172.2 978.6C182.4 988.8 199 988.8 209.2 978.6L354.9 832.9C406.6 861.1 465.9 877 528.9 877C731.6 877 896 712.6 896 509.9C896 407.5 857.1 311.7 784.7 239.2ZM521.5 735.1C474.1 735.1 435.6 696.6 435.6 649.2C435.6 601.8 474.1 563.3 521.5 563.3C568.9 563.3 607.4 601.8 607.4 649.2C607.4 696.6 568.9 735.1 521.5 735.1Z" fill="white" transform="scale(0.7) translate(220, 220)"/>
</svg>`;

  try {
    fs.writeFileSync(iconPath, svgContent);
    console.log(`✅ 成功生成高清图标: ${iconPath}`);
    console.log(`提示: 你可以直接在浏览器打开此文件查看，它是 1024x1024 的矢量图，非常清晰。`);
  } catch (err) {
    console.error('❌ 生成图标失败:', err);
  }
}

generateIcon();
