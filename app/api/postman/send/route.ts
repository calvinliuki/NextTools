import { NextRequest, NextResponse } from 'next/server';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import dns from 'dns';
import zlib from 'zlib';
import { promisify } from 'util';

const dnsLookup = promisify(dns.lookup);
const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);
const brotliDecompress = promisify(zlib.brotliDecompress);

interface TimingInfo {
  dns: number;
  tcp: number;
  tls: number;
  request: number;
  firstByte: number;
  download: number;
  total: number;
}

interface RequestBody {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  bodyType?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: RequestBody = await request.json();
    const { method, url, headers, body: requestBody, bodyType } = body;

    if (!url) {
      return NextResponse.json({
        code: 400,
        message: 'URL 不能为空',
      });
    }

    // 验证 URL 格式
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return NextResponse.json({
        code: 400,
        message: '无效的 URL 格式',
      });
    }

    // 时间统计
    const timing: TimingInfo = {
      dns: 0,
      tcp: 0,
      tls: 0,
      request: 0,
      firstByte: 0,
      download: 0,
      total: 0,
    };

    const startTime = performance.now();
    let dnsStart = 0;
    let dnsEnd = 0;
    let tcpStart = 0;
    let tcpEnd = 0;
    let tlsStart = 0;
    let tlsEnd = 0;
    let requestStart = 0;
    let firstByteTime = 0;
    let downloadStart = 0;

    // DNS 解析
    dnsStart = performance.now();
    try {
      await dnsLookup(parsedUrl.hostname);
    } catch {
      // DNS 解析失败时继续，让后续请求处理错误
    }
    dnsEnd = performance.now();
    timing.dns = dnsEnd - dnsStart;

    // 选择 http 或 https 模块
    const isHttps = parsedUrl.protocol === 'https:';
    const httpModule = isHttps ? https : http;

    // 构建请求选项
    const options: http.RequestOptions | https.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (isHttps ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: method.toUpperCase(),
      headers: {
        'User-Agent': 'PostmanRuntime/7.28.4',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        ...headers,
      },
      timeout: 30000,
    };

    // 发送请求
    const result = await new Promise<{
      status: number;
      statusText: string;
      headers: Record<string, string>;
      body: string;
      size: number;
    }>((resolve, reject) => {
      tcpStart = performance.now();
      
      const req = httpModule.request(options, (res) => {
        // 首字节时间
        firstByteTime = performance.now();
        timing.firstByte = firstByteTime - requestStart;
        
        downloadStart = performance.now();
        
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        res.on('end', async () => {
          const downloadEnd = performance.now();
          timing.download = downloadEnd - downloadStart;
          
          let bodyBuffer = Buffer.concat(chunks);
          const responseHeaders: Record<string, string> = {};
          
          // 转换响应头
          for (const [key, value] of Object.entries(res.headers)) {
            if (value) {
              responseHeaders[key] = Array.isArray(value) ? value.join(', ') : value;
            }
          }

          // 处理解压缩
          const contentEncoding = responseHeaders['content-encoding'];
          try {
            if (contentEncoding === 'gzip') {
              bodyBuffer = await gunzip(bodyBuffer);
            } else if (contentEncoding === 'deflate') {
              bodyBuffer = await inflate(bodyBuffer);
            } else if (contentEncoding === 'br') {
              bodyBuffer = await brotliDecompress(bodyBuffer);
            }
          } catch (e) {
            console.error('解压缩失败:', e);
            // 如果解压失败，保留原始 buffer，后续 toString 可能会乱码但不会崩
          }
          
          resolve({
            status: res.statusCode || 0,
            statusText: res.statusMessage || '',
            headers: responseHeaders,
            body: bodyBuffer.toString('utf-8'),
            size: bodyBuffer.length,
          });
        });
      });

      // 连接事件
      req.on('socket', (socket) => {
        socket.on('connect', () => {
          tcpEnd = performance.now();
          timing.tcp = tcpEnd - tcpStart;
          
          if (isHttps) {
            tlsStart = performance.now();
          }
        });
        
        if (isHttps) {
          socket.on('secureConnect', () => {
            tlsEnd = performance.now();
            timing.tls = tlsEnd - tlsStart;
          });
        }
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });

      // 发送请求体
      requestStart = performance.now();
      if (requestBody && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
        req.write(requestBody);
      }
      req.end();
      
      const requestEnd = performance.now();
      timing.request = requestEnd - requestStart;
    });

    const endTime = performance.now();
    timing.total = endTime - startTime;

    // 获取 Content-Type
    const contentType = result.headers['content-type'] || '';

    return NextResponse.json({
      code: 200,
      message: '请求成功',
      data: {
        status: result.status,
        statusText: result.statusText,
        headers: result.headers,
        body: result.body,
        size: result.size,
        timing,
        contentType,
      },
    });
  } catch (error: any) {
    console.error('HTTP 请求失败:', error);
    
    return NextResponse.json({
      code: 500,
      message: error.message || '请求失败',
    });
  }
}
