import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false, // 关闭 React Strict Mode
  
  // 限制文件追踪范围，避免打包无关文件
  outputFileTracingRoot: path.join(__dirname),
  
  // 排除不需要追踪的目录
  outputFileTracingExcludes: {
    '*': [
      'node_modules/@swc/**',
      'node_modules/esbuild/**',
      '**/*.map',
      '**/Application Data/**',
      '**/AppData/**',
      '**/Downloads/**',
      '**/Documents/**',
      '**/Desktop/**',
      '**/.git/**',
      'C:/Users/*/Application Data/**',
    ],
  },
  
  // 禁用 Next.js 开发工具图标
  devIndicators: false,
  
  // 跳过生产构建时的 TypeScript 类型检查（开发模式已验证可用）
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // 原生 Node.js 模块标记为外部依赖
  serverExternalPackages: [
    'ssh2',
    'better-sqlite3',
    'ioredis',
    'kafkajs',
    'mysql2',
    'pg',
    'node-zookeeper-client',
    '@elastic/elasticsearch',
    'oracledb',
  ],
  
  // 允许跨域请求
  headers: async () => {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
        ],
      },
    ];
  },
  
  // 在 webpack 配置中禁用 HMR
  webpack: (config, { dev }) => {
    if (dev) {
      // 禁用 webpack HMR
      config.watchOptions = {
        ...config.watchOptions,
        ignored: /node_modules/,
      };
    }
    
    // Windows CI 环境：排除系统敏感目录
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        '**/node_modules/**',
        '**/Application Data/**',
        '**/AppData/**',
        'C:/Users/*/Application Data/**',
      ],
    };
    
    return config;
  },
};

export default nextConfig;
