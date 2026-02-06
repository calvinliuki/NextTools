import { HttpRequest, HttpHeader, QueryParam } from './types';

// 构建完整 URL（包含查询参数）
export function buildFullUrl(baseUrl: string, queryParams: QueryParam[]): string {
  if (!baseUrl) return '';
  
  const enabledParams = queryParams.filter(p => p.enabled && p.key);
  if (enabledParams.length === 0) return baseUrl;

  try {
    const url = new URL(baseUrl);
    enabledParams.forEach(param => {
      url.searchParams.append(param.key, param.value);
    });
    return url.toString();
  } catch {
    // 如果 URL 解析失败，手动构建
    const queryString = enabledParams
      .map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`)
      .join('&');
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}${queryString}`;
  }
}

// 构建请求头对象
export function buildHeaders(headers: HttpHeader[]): Record<string, string> {
  const result: Record<string, string> = {};
  headers.filter(h => h.enabled && h.key).forEach(h => {
    result[h.key] = h.value;
  });
  return result;
}

// 格式化文件大小
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 格式化时间（毫秒）
export function formatTime(ms: number): string {
  if (ms < 1) return '< 1 ms';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

// 解析响应内容类型
export function parseContentType(contentType: string | null): string {
  if (!contentType) return 'text';
  if (contentType.includes('json')) return 'json';
  if (contentType.includes('xml')) return 'xml';
  if (contentType.includes('html')) return 'html';
  if (contentType.includes('javascript')) return 'javascript';
  if (contentType.includes('css')) return 'css';
  return 'text';
}

// 尝试格式化 JSON
export function tryFormatJson(text: string): string {
  try {
    const parsed = JSON.parse(text);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return text;
  }
}

// 格式化 XML
export function formatXml(xml: string): string {
  try {
    let formatted = '';
    let indent = '';
    const tab = '  ';
    
    // 移除现有的空白和换行
    xml = xml.replace(/>\s*</g, '><').trim();
    
    xml.split(/(<[^>]+>)/g).forEach((node) => {
      if (!node.trim()) return;
      
      // 自闭合标签
      if (node.match(/^<[^>]+\/\s*>$/)) {
        formatted += indent + node + '\n';
      }
      // 结束标签
      else if (node.match(/^<\//)) {
        indent = indent.substring(tab.length);
        formatted += indent + node + '\n';
      }
      // 开始标签
      else if (node.match(/^</)) {
        formatted += indent + node + '\n';
        indent += tab;
      }
      // 文本内容
      else {
        formatted += indent + node + '\n';
      }
    });
    
    return formatted.trim();
  } catch {
    return xml;
  }
}

// 检测内容类型并自动格式化（仅 JSON 和 XML）
export function autoFormatContent(content: string, contentType: string): { formatted: string; type: string } {
  const type = parseContentType(contentType);
  
  switch (type) {
    case 'json':
      return { formatted: tryFormatJson(content), type: 'json' };
    case 'xml':
      return { formatted: formatXml(content), type: 'xml' };
    default:
      return { formatted: content, type };
  }
}

// 获取状态码对应的颜色
export function getStatusColor(status: number): string {
  if (status >= 200 && status < 300) return '#00B42A'; // 成功 - 绿色
  if (status >= 300 && status < 400) return '#165DFF'; // 重定向 - 蓝色
  if (status >= 400 && status < 500) return '#FF7D00'; // 客户端错误 - 橙色
  if (status >= 500) return '#F53F3F'; // 服务器错误 - 红色
  return '#86909C'; // 其他 - 灰色
}

// 验证 URL 格式
export function isValidUrl(url: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// 从 URL 中提取查询参数
export function extractQueryParams(url: string): QueryParam[] {
  try {
    // 尝试直接解析
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch {
      // 如果失败，尝试补全协议再解析
      if (!url.includes('://') && url.length > 0) {
        urlObj = new URL('http://' + url);
      } else {
        throw new Error('Invalid URL');
      }
    }

    const params: QueryParam[] = [];
    urlObj.searchParams.forEach((value, key) => {
      params.push({ key, value, enabled: true });
    });
    return params;
  } catch {
    // 最后的退路：正则解析
    const queryString = url.split('?')[1];
    if (!queryString) return [];
    
    return queryString.split('&').filter(Boolean).map(part => {
      const [key, value] = part.split('=');
      return {
        key: decodeURIComponent(key || ''),
        value: decodeURIComponent(value || ''),
        enabled: true
      };
    });
  }
}

// 从 URL 中移除查询参数，返回基础 URL
export function getBaseUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch {
    if (!url.includes('://') && url.length > 0) {
      try {
        const urlObj = new URL('http://' + url);
        const fullBase = `${urlObj.origin}${urlObj.pathname}`;
        return fullBase.replace('http://', '');
      } catch {
        return url.split('?')[0];
      }
    }
    return url.split('?')[0];
  }
}

// 生成唯一 ID
export function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// 深拷贝请求对象
export function cloneRequest(request: HttpRequest): HttpRequest {
  return JSON.parse(JSON.stringify(request));
}

// 保存集合到服务器
export async function saveCollectionsToServer(collections: any[]): Promise<void> {
  try {
    await fetch('/api/http/collections', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(collections),
    });
  } catch (e) {
    console.error('Failed to save collections to server:', e);
  }
}

// 从服务器加载集合
export async function loadCollectionsFromServer(): Promise<any[]> {
  try {
    const response = await fetch('/api/http/collections');
    const result = await response.json();
    return result.code === 200 ? result.data : [];
  } catch (e) {
    console.error('Failed to load collections from server:', e);
    return [];
  }
}

// 保存历史记录到服务器
export async function saveHistoryToServer(entry: any): Promise<void> {
  try {
    await fetch('/api/http/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch (e) {
    console.error('Failed to save history to server:', e);
  }
}

// 从服务器加载历史记录
export async function loadHistoryFromServer(): Promise<any[]> {
  try {
    const response = await fetch('/api/http/history');
    const result = await response.json();
    return result.code === 200 ? result.data : [];
  } catch (e) {
    console.error('Failed to load history from server:', e);
    return [];
  }
}

// 本地存储 key (保留作为备用或清理)
const STORAGE_KEY_COLLECTIONS = 'postman_collections';
const STORAGE_KEY_HISTORY = 'postman_history';

// 保存集合到本地存储
export function saveCollectionsToStorage(collections: any[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_COLLECTIONS, JSON.stringify(collections));
  } catch (e) {
    console.error('Failed to save collections:', e);
  }
}

// 从本地存储加载集合
export function loadCollectionsFromStorage(): any[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_COLLECTIONS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load collections:', e);
    return [];
  }
}

// 保存历史记录到本地存储
export function saveHistoryToStorage(history: any[]): void {
  try {
    // 只保留最近50条记录
    let trimmedHistory = history.slice(0, 50);
    
    // 限制每条记录的响应体大小，避免存储过多数据
    trimmedHistory = trimmedHistory.map(item => {
      if (item.response && item.response.body) {
        // 如果响应体太大（超过10KB），截断它
        if (typeof item.response.body === 'string' && item.response.body.length > 10240) {
          return {
            ...item,
            response: {
              ...item.response,
              body: item.response.body.substring(0, 10240) + '... [TRUNCATED]',
            }
          };
        }
      }
      return item;
    });
    
    const serialized = JSON.stringify(trimmedHistory);
    
    // 检查序列化后的数据大小
    const size = new Blob([serialized]).size;
    if (size > 4 * 1024 * 1024) { // 4MB 限制
      // 如果仍然太大，进一步减少记录数量
      trimmedHistory = trimmedHistory.slice(0, 10);
      // 再次检查并截断响应体
      trimmedHistory = trimmedHistory.map(item => {
        if (item.response && item.response.body && typeof item.response.body === 'string') {
          if (item.response.body.length > 2048) { // 更严格的限制
            return {
              ...item,
              response: {
                ...item.response,
                body: item.response.body.substring(0, 2048) + '... [TRUNCATED]',
              }
            };
          }
        }
        return item;
      });
      
      const finalSerialized = JSON.stringify(trimmedHistory);
      localStorage.setItem(STORAGE_KEY_HISTORY, finalSerialized);
    } else {
      localStorage.setItem(STORAGE_KEY_HISTORY, serialized);
    }
  } catch (e) {
    console.error('Failed to save history:', e);
  }
}

// 从本地存储加载历史记录
export function loadHistoryFromStorage(): any[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error('Failed to load history:', e);
    return [];
  }
}
