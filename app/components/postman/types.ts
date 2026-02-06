// HTTP 请求方法类型
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

// 请求头
export interface HttpHeader {
  key: string;
  value: string;
  enabled: boolean;
}

// 查询参数
export interface QueryParam {
  key: string;
  value: string;
  enabled: boolean;
}

// 请求体类型
export type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary';

// Raw 请求体子类型
export type RawType = 'Text' | 'JavaScript' | 'JSON' | 'HTML' | 'XML';

// 表单数据项
export interface FormDataItem {
  key: string;
  value: string;
  type: 'text' | 'file';
  enabled: boolean;
  fileName?: string;
  fileContent?: string; // Base64 or local path representation
}

// HTTP 请求配置
export interface HttpRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: HttpHeader[];
  queryParams: QueryParam[];
  bodyType: BodyType;
  rawType: RawType;
  body: string;
  formData: FormDataItem[];
  createdAt: number;
  updatedAt: number;
}

// 时间统计（多阶段）
export interface TimingInfo {
  // DNS 解析时间
  dns: number;
  // TCP 连接时间
  tcp: number;
  // TLS 握手时间（如果是 HTTPS）
  tls: number;
  // 请求发送时间（从连接建立到发送完请求）
  request: number;
  // 首字节时间（TTFB - Time To First Byte）
  firstByte: number;
  // 内容下载时间
  download: number;
  // 总耗时
  total: number;
}

// HTTP 响应
export interface HttpResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  size: number;
  timing: TimingInfo;
  contentType: string;
}

// 请求历史记录
export interface RequestHistory {
  id: string;
  request: HttpRequest;
  response: HttpResponse | null;
  error: string | null;
  timestamp: number;
}

// 请求集合（文件夹）
export interface RequestCollection {
  id: string;
  name: string;
  requestIds: string[];
  createdAt: number;
  updatedAt: number;
}

// Postman 工作空间状态
export interface PostmanState {
  collections: RequestCollection[];
  activeRequestId: string | null;
  history: RequestHistory[];
}

// 方法对应的颜色
export const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#00B42A',
  POST: '#FF7D00',
  PUT: '#165DFF',
  DELETE: '#F53F3F',
  PATCH: '#722ED1',
  HEAD: '#86909C',
  OPTIONS: '#86909C',
};

// 创建空请求
export function createEmptyRequest(): HttpRequest {
  return {
    id: `http_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: 'New Request',
    method: 'GET',
    url: '',
    headers: [
      { key: 'User-Agent', value: 'Devtools/1.0.0', enabled: true },
      { key: 'Accept', value: '*/*', enabled: true },
      { key: 'Accept-Encoding', value: 'gzip, deflate, br', enabled: true },
      { key: 'Connection', value: 'keep-alive', enabled: true },
    ],
    queryParams: [],
    bodyType: 'none',
    rawType: 'JSON',
    body: '',
    formData: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// 创建空集合
export function createEmptyCollection(name: string = 'New Collection'): RequestCollection {
  return {
    id: `col_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    requestIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}
