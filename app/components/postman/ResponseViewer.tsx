'use client';

import { useState, useMemo } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { HttpResponse } from './types';
import { formatSize, formatTime, getStatusColor, parseContentType, autoFormatContent } from './utils';

interface ResponseViewerProps {
  response: HttpResponse | null;
  error: string | null;
  isLoading: boolean;
}

type ViewMode = 'pretty' | 'raw' | 'preview';

export default function ResponseViewer({
  response,
  error,
  isLoading,
}: ResponseViewerProps) {
  const { t } = useLanguage();
  const [activeTab, setActiveTab] = useState<'body' | 'headers' | 'timing'>('body');
  const [viewMode, setViewMode] = useState<ViewMode>('pretty');

  // Automatically format response content
  const { formattedBody, contentType } = useMemo(() => {
    if (!response) return { formattedBody: '', contentType: 'text' };
    const result = autoFormatContent(response.body, response.contentType);
    return { formattedBody: result.formatted, contentType: result.type };
  }, [response]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-[#007acc] mb-4"></i>
          <p className="text-gray-600">{t('postman.sendingRequest')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <i className="fas fa-exclamation-circle text-4xl text-[#F53F3F] mb-4"></i>
          <p className="text-[#F53F3F] font-medium mb-2">{t('postman.requestFailed')}</p>
          <p className="text-sm text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <i className="fas fa-paper-plane text-4xl text-gray-300 mb-4"></i>
          <p className="text-gray-500">{t('postman.inputUrlPrompt')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('postman.quickSendHint')}</p>
        </div>
      </div>
    );
  }

  // 获取内容类型图标和标签
  const getContentTypeInfo = () => {
    switch (contentType) {
      case 'json':
        return { icon: 'fa-code', label: 'JSON', color: '#F7BA1E' };
      case 'xml':
        return { icon: 'fa-file-code', label: 'XML', color: '#722ED1' };
      case 'html':
        return { icon: 'fa-file-code', label: 'HTML', color: '#F53F3F' };
      case 'javascript':
        return { icon: 'fa-js', label: 'JavaScript', color: '#F7DF1E' };
      case 'css':
        return { icon: 'fa-css3', label: 'CSS', color: '#264DE4' };
      default:
        return { icon: 'fa-file-alt', label: 'Text', color: '#86909C' };
    }
  };

  const contentTypeInfo = getContentTypeInfo();

  return (
    <div className="h-full flex flex-col bg-white">
      {/* 响应状态栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-4">
          <span
            className="px-2 py-1 text-sm font-medium rounded"
            style={{
              color: getStatusColor(response.status),
              backgroundColor: `${getStatusColor(response.status)}15`,
            }}
          >
            {response.status} {response.statusText}
          </span>
          <span className="text-sm text-gray-600">
            <i className="fas fa-clock mr-1"></i>
            {formatTime(response.timing.total)}
          </span>
          <span className="text-sm text-gray-600">
            <i className="fas fa-file mr-1"></i>
            {formatSize(response.size)}
          </span>
          {/* Content type label */}
          <span
            className="px-2 py-0.5 text-xs font-medium rounded flex items-center gap-1"
            style={{
              color: contentTypeInfo.color,
              backgroundColor: `${contentTypeInfo.color}15`,
            }}
          >
            <i className={`fas ${contentTypeInfo.icon}`}></i>
            {contentTypeInfo.label}
          </span>
        </div>
      </div>

      {/* 标签页 */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('body')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'body'
                ? 'text-[#007acc] border-b-2 border-[#007acc]'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t('postman.responseBody')}
          </button>
          <button
            onClick={() => setActiveTab('headers')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'headers'
                ? 'text-[#007acc] border-b-2 border-[#007acc]'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t('postman.responseHeaders')}
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-gray-200 rounded-full">
              {Object.keys(response.headers).length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('timing')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === 'timing'
                ? 'text-[#007acc] border-b-2 border-[#007acc]'
                : 'text-gray-600 hover:text-gray-800'
            }`}
          >
            {t('postman.timingAnalysis')}
          </button>
        </div>

        {/* View mode toggle (only displayed when response body tab is selected and content is JSON/XML) */}
        {activeTab === 'body' && (contentType === 'json' || contentType === 'xml') && (
          <div className="flex items-center gap-1 pr-4">
            <button
              onClick={() => setViewMode('pretty')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'pretty'
                  ? 'bg-[#007acc] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title={t('postman.formattedDisplay')}
            >
              Pretty
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-2 py-1 text-xs rounded transition-colors ${
                viewMode === 'raw'
                  ? 'bg-[#007acc] text-white'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
              title={t('postman.rawContent')}
            >
              Raw
            </button>
          </div>
        )}
      </div>

      {/* 标签页内容 */}
      <div className="flex-1 overflow-auto p-3">
        {/* Response body */}
        {activeTab === 'body' && (
          <div className="relative">
            <pre 
              className="text-sm font-mono whitespace-pre-wrap break-all bg-gray-50 p-3 rounded border border-gray-200 min-h-full overflow-auto"
            >
              {(contentType === 'json' || contentType === 'xml') && viewMode === 'pretty' 
                ? (formattedBody || t('postman.emptyResponse')) 
                : (response.body || t('postman.emptyResponse'))}
            </pre>
            {/* Copy button */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(response.body);
              }}
              className="absolute top-2 right-2 px-2 py-1 text-xs bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
              title={t('postman.copyContent')}
            >
              <i className="fas fa-copy mr-1"></i>
              {t('postman.copy')}
            </button>
          </div>
        )}

        {/* Response headers */}
        {activeTab === 'headers' && (
          <div className="space-y-1">
            {Object.entries(response.headers).map(([key, value]) => (
              <div key={key} className="flex items-start gap-2 py-1 border-b border-gray-100">
                <span className="text-sm font-medium text-gray-800 min-w-[200px]">{key}:</span>
                <span className="text-sm text-gray-600 break-all">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* 时间分析 */}
        {activeTab === 'timing' && (
          <div>
            <div className="mb-4">
              <h4 className="text-sm font-medium text-gray-800 mb-2">{t('postman.requestTimingAnalysis')}</h4>
              <p className="text-xs text-gray-500 mb-4">
                {t('postman.timingDetails')}
              </p>
            </div>

            {/* 时间条形图 */}
            <div className="space-y-3">
              <TimingBar
                label={t('postman.dnsLookup')}
                value={response.timing.dns}
                total={response.timing.total}
                color="#165DFF"
                icon="fa-globe"
              />
              <TimingBar
                label={t('postman.tcpConnection')}
                value={response.timing.tcp}
                total={response.timing.total}
                color="#00B42A"
                icon="fa-plug"
              />
              <TimingBar
                label={t('postman.tlsHandshake')}
                value={response.timing.tls}
                total={response.timing.total}
                color="#722ED1"
                icon="fa-lock"
              />
              <TimingBar
                label={t('postman.requestSend')}
                value={response.timing.request}
                total={response.timing.total}
                color="#FF7D00"
                icon="fa-paper-plane"
              />
              <TimingBar
                label={t('postman.timeToFirstByte')}
                value={response.timing.firstByte}
                total={response.timing.total}
                color="#F53F3F"
                icon="fa-hourglass-half"
              />
              <TimingBar
                label={t('postman.contentDownload')}
                value={response.timing.download}
                total={response.timing.total}
                color="#14C9C9"
                icon="fa-download"
              />
            </div>

            {/* Total time */}
            <div className="mt-6 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">
                  <i className="fas fa-stopwatch mr-2 text-[#007acc]"></i>
                  {t('postman.totalTime')}
                </span>
                <span className="text-lg font-bold text-[#007acc]">
                  {formatTime(response.timing.total)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Timing bar component
function TimingBar({
  label,
  value,
  total,
  color,
  icon,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
  icon: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className="w-36 flex items-center gap-2">
        <i className={`fas ${icon} text-xs`} style={{ color }}></i>
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.max(percentage, 1)}%`,
            backgroundColor: color,
          }}
        />
      </div>
      <div className="w-20 text-right">
        <span className="text-sm font-medium" style={{ color }}>
          {formatTime(value)}
        </span>
      </div>
    </div>
  );
}
