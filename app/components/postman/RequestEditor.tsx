'use client';

import { useState } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { HttpRequest, HttpMethod, HttpHeader, QueryParam, BodyType, RawType, FormDataItem, METHOD_COLORS } from './types';
import { extractQueryParams, getBaseUrl, buildFullUrl } from './utils';

interface RequestEditorProps {
  request: HttpRequest;
  isLoading: boolean;
  onRequestChange: (request: HttpRequest) => void;
  onSend: () => void;
}

const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'];

export default function RequestEditor({
  request,
  isLoading,
  onRequestChange,
  onSend,
}: RequestEditorProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('params');

  const updateRequest = (updates: Partial<HttpRequest>) => {
    onRequestChange({ ...request, ...updates, updatedAt: Date.now() });
  };

  const handleUrlChange = (newUrl: string) => {
    const params = extractQueryParams(newUrl);
    onRequestChange({
      ...request,
      url: newUrl,
      queryParams: params,
      updatedAt: Date.now()
    });
  };

  const syncParamsToUrl = (newParams: QueryParam[]) => {
    const baseUrl = getBaseUrl(request.url);
    const newUrl = buildFullUrl(baseUrl, newParams);
    onRequestChange({
      ...request,
      url: newUrl,
      queryParams: newParams,
      updatedAt: Date.now()
    });
  };

  const addQueryParam = () => {
    const newParams = [...request.queryParams, { key: '', value: '', enabled: true }];
    syncParamsToUrl(newParams);
  };

  const updateQueryParam = (index: number, updates: Partial<QueryParam>) => {
    const newParams = [...request.queryParams];
    newParams[index] = { ...newParams[index], ...updates };
    syncParamsToUrl(newParams);
  };

  const removeQueryParam = (index: number) => {
    const newParams = request.queryParams.filter((_, i) => i !== index);
    syncParamsToUrl(newParams);
  };

  const setBodyType = (type: BodyType) => {
    const newHeaders = getUpdatedHeaders(request.headers, type, request.rawType);
    updateRequest({ bodyType: type, headers: newHeaders });
  };

  const setRawType = (type: RawType) => {
    const newHeaders = getUpdatedHeaders(request.headers, request.bodyType, type);
    updateRequest({ rawType: type, headers: newHeaders });
  };

  const getUpdatedHeaders = (headers: HttpHeader[], bodyType: BodyType, rawType: RawType): HttpHeader[] => {
    const newHeaders = [...headers];
    const contentTypeIndex = newHeaders.findIndex(h => h.key.toLowerCase() === 'content-type');
    
    let contentTypeValue = '';
    if (bodyType === 'raw') {
      switch (rawType) {
        case 'JSON': contentTypeValue = 'application/json'; break;
        case 'Text': contentTypeValue = 'text/plain'; break;
        case 'JavaScript': contentTypeValue = 'application/javascript'; break;
        case 'HTML': contentTypeValue = 'text/html'; break;
        case 'XML': contentTypeValue = 'application/xml'; break;
      }
    } else if (bodyType === 'form-data') {
      contentTypeValue = 'multipart/form-data';
    } else if (bodyType === 'x-www-form-urlencoded') {
      contentTypeValue = 'application/x-www-form-urlencoded';
    }
    
    if (contentTypeValue) {
      if (contentTypeIndex > -1) {
        newHeaders[contentTypeIndex] = { ...newHeaders[contentTypeIndex], value: contentTypeValue, enabled: true };
      } else {
        newHeaders.push({ key: 'Content-Type', value: contentTypeValue, enabled: true });
      }
    } else if (bodyType === 'none') {
      // 如果选了 none，且存在 Content-Type 且是我们管理的类型，可以考虑移除或禁用
      // 这里简单起见，如果存在就将其禁用，或者让用户手动处理。
      // Postman 选中 none 时通常不发送 Content-Type。
      if (contentTypeIndex > -1) {
        const currentHeader = newHeaders[contentTypeIndex];
        // 只有当它是常见的几种类型时才自动禁用，避免误伤用户自定义的
        const autoManagedTypes = ['application/json', 'text/plain', 'application/javascript', 'text/html', 'application/xml', 'multipart/form-data', 'application/x-www-form-urlencoded'];
        if (autoManagedTypes.includes(currentHeader.value)) {
           newHeaders[contentTypeIndex] = { ...currentHeader, enabled: false };
        }
      }
    }
    
    return newHeaders;
  };

  const addHeader = () => {
    updateRequest({
      headers: [...request.headers, { key: '', value: '', enabled: true }],
    });
  };

  const updateHeader = (index: number, updates: Partial<HttpHeader>) => {
    const newHeaders = [...request.headers];
    newHeaders[index] = { ...newHeaders[index], ...updates };
    updateRequest({ headers: newHeaders });
  };

  const removeHeader = (index: number) => {
    updateRequest({
      headers: request.headers.filter((_, i) => i !== index),
    });
  };

  const addFormData = () => {
    updateRequest({
      formData: [...request.formData, { key: '', value: '', type: 'text', enabled: true }],
    });
  };

  const updateFormData = (index: number, updates: Partial<FormDataItem>) => {
    const newFormData = [...request.formData];
    newFormData[index] = { ...newFormData[index], ...updates };
    updateRequest({ formData: newFormData });
  };

  const removeFormData = (index: number) => {
    updateRequest({
      formData: request.formData.filter((_, i) => i !== index),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      onSend();
    }
  };

  return (
    <div className="flex flex-col h-full" onKeyDown={handleKeyDown}>
      {/* URL 输入区域 */}
      <div className="flex items-center gap-2 p-3 border-b border-gray-200">
        {/* 方法选择 */}
        <select
          value={request.method}
          onChange={(e) => updateRequest({ method: e.target.value as HttpMethod })}
          className="px-3 py-2 text-sm font-medium border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc]"
          style={{ color: METHOD_COLORS[request.method] }}
        >
          {HTTP_METHODS.map((method) => (
            <option key={method} value={method} style={{ color: METHOD_COLORS[method] }}>
              {method}
            </option>
          ))}
        </select>

        {/* URL 输入框 */}
        <input
          type="text"
          value={request.url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder={t('postman.inputUrl')}
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc]"
        />

        {/* 发送按钮 */}
        <button
          onClick={onSend}
          disabled={isLoading || !request.url}
          className={`px-6 py-2 text-sm font-medium text-white rounded transition-colors flex items-center gap-2 ${
            isLoading || !request.url
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-[#007acc] hover:bg-[#005a9e]'
          }`}
        >
          {isLoading ? (
            <>
              <i className="fas fa-spinner fa-spin"></i>
              {t('postman.sending')}
            </>
          ) : (
            <>
              <i className="fas fa-paper-plane"></i>
              {t('postman.send')}
            </>
          )}
        </button>
      </div>

      {/* 标签页 */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('params')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'params'
              ? 'text-[#007acc] border-b-2 border-[#007acc]'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {t('postman.params')}
          {request.queryParams.filter(p => p.enabled).length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 rounded-full">
              {request.queryParams.filter(p => p.enabled).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('headers')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'headers'
              ? 'text-[#007acc] border-b-2 border-[#007acc]'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {t('postman.headers')}
          {request.headers.filter(h => h.enabled).length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 rounded-full">
              {request.headers.filter(h => h.enabled).length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('body')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'body'
              ? 'text-[#007acc] border-b-2 border-[#007acc]'
              : 'text-gray-600 hover:text-gray-800'
          }`}
        >
          {t('postman.body')}
        </button>
      </div>

      {/* 标签页内容 */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* 参数标签页 */}
        {activeTab === 'params' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{t('postman.queryParameters')}</span>
              <button
                onClick={addQueryParam}
                className="text-xs text-[#007acc] hover:underline"
              >
                + {t('postman.addParameter')}
              </button>
            </div>
            <div className="space-y-2">
              {request.queryParams.map((param, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={param.enabled}
                    onChange={(e) => updateQueryParam(index, { enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <input
                    type="text"
                    value={param.key}
                    onChange={(e) => updateQueryParam(index, { key: e.target.value })}
                    placeholder={t('postman.paramKey')}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc]"
                  />
                  <input
                    type="text"
                    value={param.value}
                    onChange={(e) => updateQueryParam(index, { value: e.target.value })}
                    placeholder={t('postman.paramValue')}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc]"
                  />
                  <button
                    onClick={() => removeQueryParam(index)}
                    className="p-1.5 text-gray-400 hover:text-[#F53F3F] transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
              {request.queryParams.length === 0 && (
                <div className="text-center py-4 text-sm text-gray-400">
                  {t('postman.noQueryParams')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 请求头标签页 */}
        {activeTab === 'headers' && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-500">{t('postman.customHeaders')}</span>
              <button
                onClick={addHeader}
                className="text-xs text-[#007acc] hover:underline"
              >
                + {t('postman.addHeader')}
              </button>
            </div>
            <div className="space-y-2">
              {request.headers.map((header, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={header.enabled}
                    onChange={(e) => updateHeader(index, { enabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <input
                    type="text"
                    value={header.key}
                    onChange={(e) => updateHeader(index, { key: e.target.value })}
                    placeholder={t('postman.headerName')}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc]"
                  />
                  <input
                    type="text"
                    value={header.value}
                    onChange={(e) => updateHeader(index, { value: e.target.value })}
                    placeholder={t('postman.headerValue')}
                    className="flex-1 px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc]"
                  />
                  <button
                    onClick={() => removeHeader(index)}
                    className="p-1.5 text-gray-400 hover:text-[#F53F3F] transition-colors"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>
              ))}
              {request.headers.length === 0 && (
                <div className="text-center py-4 text-sm text-gray-400">
                  {t('postman.noCustomHeaders')}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 请求体标签页 */}
        {activeTab === 'body' && (
          <div>
            {/* 请求体类型选择 */}
            <div className="flex items-center gap-4 mb-3">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="bodyType"
                  checked={request.bodyType === 'none'}
                  onChange={() => setBodyType('none')}
                />
                none
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="bodyType"
                  checked={request.bodyType === 'form-data'}
                  onChange={() => setBodyType('form-data')}
                />
                form-data
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="bodyType"
                  checked={request.bodyType === 'x-www-form-urlencoded'}
                  onChange={() => setBodyType('x-www-form-urlencoded')}
                />
                x-www-form-urlencoded
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="bodyType"
                  checked={request.bodyType === 'raw'}
                  onChange={() => setBodyType('raw')}
                />
                raw
                {request.bodyType === 'raw' && (
                  <select
                    value={request.rawType}
                    onChange={(e) => {
                      e.stopPropagation();
                      setRawType(e.target.value as RawType);
                    }}
                    className="ml-1 text-xs border border-gray-200 rounded px-1 py-0.5 focus:outline-none text-[#007acc] font-medium bg-transparent"
                  >
                    <option value="Text">Text</option>
                    <option value="JavaScript">JavaScript</option>
                    <option value="JSON">JSON</option>
                    <option value="HTML">HTML</option>
                    <option value="XML">XML</option>
                  </select>
                )}
              </label>
            </div>

            {/* 请求体内容 */}
            {request.bodyType === 'none' && (
              <div className="text-center py-8 text-sm text-gray-400">
                {t('postman.noRequestBody')}
              </div>
            )}

            {(request.bodyType === 'raw') && (
              <textarea
                value={request.body}
                onChange={(e) => updateRequest({ body: e.target.value })}
                placeholder={request.rawType === 'JSON' ? '{\n  "key": "value"\n}' : t('postman.enterContent', { type: request.rawType })}
                className="w-full h-48 px-3 py-2 text-sm font-mono border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc] resize-none"
              />
            )}

            {(request.bodyType === 'form-data' || request.bodyType === 'x-www-form-urlencoded') && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-500">{t('postman.formData')}</span>
                  <button
                    onClick={addFormData}
                    className="text-xs text-[#007acc] hover:underline"
                  >
                    + {t('postman.addField')}
                  </button>
                </div>
                <div className="space-y-2">
                  {request.formData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={(e) => updateFormData(index, { enabled: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <div className="flex-1 flex items-center border border-gray-300 rounded overflow-hidden focus-within:ring-1 focus-within:ring-[#007acc]">
                        <input
                          type="text"
                          value={item.key}
                          onChange={(e) => updateFormData(index, { key: e.target.value })}
                          placeholder={t('postman.key')}
                          className="flex-1 px-2 py-1.5 text-sm border-r border-gray-200 focus:outline-none"
                        />
                        <select
                          value={item.type}
                          onChange={(e) => updateFormData(index, { type: e.target.value as 'text' | 'file', value: '' })}
                          className="bg-gray-50 text-[10px] px-1 border-r border-gray-200 focus:outline-none h-full"
                        >
                          <option value="text">Text</option>
                          <option value="file">File</option>
                        </select>
                        {item.type === 'text' ? (
                          <input
                            type="text"
                            value={item.value}
                            onChange={(e) => updateFormData(index, { value: e.target.value })}
                            placeholder={t('postman.value')}
                            className="flex-[2] px-2 py-1.5 text-sm focus:outline-none"
                          />
                        ) : (
                          <div className="flex-[2] px-2 py-1.5 text-sm text-gray-400 italic flex items-center justify-between">
                            <span>{item.fileName || t('postman.selectFilePrompt')}</span>
                            <label className="cursor-pointer text-[#007acc] not-italic font-medium hover:underline">
                              {t('postman.selectFile')}
                              <input
                                type="file"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) {
                                    // 模拟文件选择，存储名称。实际发送需流式或Base64
                                    updateFormData(index, { fileName: file.name, value: '[File Content]' });
                                  }
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => removeFormData(index)}
                        className="p-1.5 text-gray-400 hover:text-[#F53F3F] transition-colors"
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                  {request.formData.length === 0 && (
                    <div className="text-center py-4 text-sm text-gray-400">
                      {t('postman.noFormData')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
