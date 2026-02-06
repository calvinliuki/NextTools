'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import RequestList from './RequestList';
import RequestEditor from './RequestEditor';
import ResponseViewer from './ResponseViewer';
import ToastContainer from '../../components/common/ToastContainer';
import {
  HttpRequest,
  HttpResponse,
  RequestCollection,
  RequestHistory,
  createEmptyRequest,
  createEmptyCollection,
} from './types';
import {
  buildFullUrl,
  buildHeaders,
  saveCollectionsToStorage,
  loadCollectionsFromStorage,
  saveHistoryToStorage,
  loadHistoryFromStorage,
  saveCollectionsToServer,
  loadCollectionsFromServer,
  saveHistoryToServer,
  loadHistoryFromServer,
  generateId,
} from './utils';

interface PostmanTabProps {
  connectionId: string;
  connectionName: string;
}

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function PostmanTab({ connectionId, connectionName }: PostmanTabProps) {
  const { t } = useLanguage();
  const [allRequests, setAllRequests] = useState<Record<string, HttpRequest>>({});
  const [activeRequest, setActiveRequest] = useState<HttpRequest | null>(null);
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [history, setHistory] = useState<RequestHistory[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 添加吐司通知
  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    const id = generateId('toast');
    const newToast = { id, message, type };
    setToasts(prev => [...prev, newToast]);
    
    // 3秒后自动移除
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  // 加载保存的数据
  useEffect(() => {
    const loadData = async () => {
      let currentAllRequests: Record<string, HttpRequest> = {};
      
      // 1. 加载所有连接以获取所有的 HTTP 请求
      try {
        const connResponse = await fetch('/api/connections/all');
        const connResult = await connResponse.json();
        if (connResult.code === 200 && connResult.data.http) {
          const requestMap: Record<string, HttpRequest> = {};
          connResult.data.http.forEach((conn: any) => {
            requestMap[conn.id] = {
              ...conn,
              method: conn.method || 'GET',
              headers: conn.headers || [],
              queryParams: conn.queryParams || [],
              bodyType: conn.bodyType || 'none',
              rawType: conn.rawType || 'JSON',
              body: conn.body || '',
              formData: conn.formData || [],
            };
          });
          currentAllRequests = requestMap;
          setAllRequests(requestMap);
        }
      } catch (e) {
        console.error('Failed to load HTTP connections:', e);
      }

      // 2. 加载数据
      if (connectionId && connectionId !== 'http-workspace' && currentAllRequests[connectionId]) {
        setActiveRequest(currentAllRequests[connectionId]);
      }

      // 3. 加载历史记录
      let savedHistory = await loadHistoryFromServer();
      setHistory(savedHistory);
    };
    
    loadData();
  }, [connectionId]);

  // 选择请求
  const handleSelectRequest = useCallback((request: HttpRequest) => {
    setActiveRequest(request);
    setResponse(null);
    setError(null);
  }, []);

  // 更新当前请求（仅本地更新）
  const handleRequestChange = useCallback((updatedRequest: HttpRequest) => {
    setActiveRequest(updatedRequest);
    setHasUnsavedChanges(true);
    
    // 更新本地请求池
    setAllRequests(prev => ({
      ...prev,
      [updatedRequest.id]: updatedRequest
    }));
  }, []);

  // 手动保存当前请求到服务器
  const handleSaveRequest = useCallback(async () => {
    if (!activeRequest) return;
    
    setIsLoading(true);
    try {
      await fetch('/api/http/connections/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeRequest.id,
          name: activeRequest.name,
          config: {
            ...activeRequest,
            clientType: 'HTTP'
          }
        }),
      });
      setHasUnsavedChanges(false);
      showToast(t('postman.saveSuccess'), 'success');
    } catch (e) {
      console.error('Failed to save HTTP request:', e);
      showToast(t('elasticTab.errorSaving'), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeRequest, showToast]);

  // 创建新请求
  const handleCreateRequest = useCallback(async () => {
    const newRequest = createEmptyRequest();
    
    // 1. 保存到 connections 表
    try {
      await fetch('/api/http/connections/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newRequest.id,
          name: newRequest.name,
          config: {
            ...newRequest,
            clientType: 'HTTP'
          }
        }),
      });
      
      // 2. 更新本地请求池
      setAllRequests(prev => ({
        ...prev,
        [newRequest.id]: newRequest
      }));

      setActiveRequest(newRequest);
      setResponse(null);
      setError(null);
    } catch (e) {
      console.error('Failed to create new HTTP request:', e);
      showToast(t('postman.createRequestFailed'), 'error');
    }
  }, [showToast]);

  // 删除请求
  const handleDeleteRequest = useCallback(async (requestId: string) => {
    // 1. 从 connections 表中删除
    try {
      await fetch('/api/http/connections/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: requestId }),
      });

      // 2. 更新本地请求池
      setAllRequests(prev => {
        const next = { ...prev };
        delete next[requestId];
        return next;
      });
      
      if (activeRequest?.id === requestId) {
        setActiveRequest(null);
        setResponse(null);
        setError(null);
      }
    } catch (e) {
      console.error('Failed to delete HTTP request:', e);
      showToast(t('postman.deleteRequestFailed'), 'error');
    }
  }, [activeRequest, showToast]);

  // 重命名请求
  const handleRenameRequest = useCallback(async (requestId: string, newName: string) => {
    const request = allRequests[requestId];
    if (!request) return;

    const updatedRequest = { ...request, name: newName, updatedAt: Date.now() };

    // 1. 保存到 connections 表
    try {
      await fetch('/api/http/connections/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: requestId,
          name: newName,
          config: {
            ...updatedRequest,
            clientType: 'HTTP'
          }
        }),
      });

      // 2. 更新本地请求池
      setAllRequests(prev => ({
        ...prev,
        [requestId]: updatedRequest
      }));

      if (activeRequest?.id === requestId) {
        setActiveRequest(updatedRequest);
      }
      setIsEditingName(false);
    } catch (e) {
      console.error('Failed to rename HTTP request:', e);
      showToast(t('postman.renameFailed'), 'error');
    }
  }, [allRequests, activeRequest, showToast]);

  // 发送请求
  const handleSend = useCallback(async () => {
    if (!activeRequest || !activeRequest.url) return;
    
    setIsLoading(true);
    setError(null);
    setResponse(null);
    
    try {
      // 由于 RequestEditor 中已经实现了 URL 和 queryParams 的双向同步，
      // activeRequest.url 已经是包含所有已启用参数的完整 URL。
      const fullUrl = activeRequest.url;
      const headers = buildHeaders(activeRequest.headers);
      
      // 构建请求体
      let body: string | undefined;
      if (activeRequest.method !== 'GET' && activeRequest.method !== 'HEAD') {
        if (activeRequest.bodyType === 'raw') {
          body = activeRequest.body;
        } else if (activeRequest.bodyType === 'x-www-form-urlencoded') {
          const params = new URLSearchParams();
          activeRequest.formData.filter(f => f.enabled && f.key).forEach(f => {
            params.append(f.key, f.value);
          });
          body = params.toString();
        } else if (activeRequest.bodyType === 'form-data') {
          // form-data 需要在后端处理，传递包含类型的信息
          body = JSON.stringify(activeRequest.formData.filter(f => f.enabled && f.key));
        }
      }
      
      // 发送到后端 API
      const apiResponse = await fetch('/api/http/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          method: activeRequest.method,
          url: fullUrl,
          headers,
          body,
          bodyType: activeRequest.bodyType,
        }),
      });
      
      let result;
      if (apiResponse.ok) {
        result = await apiResponse.json();
      } else {
        // 如果响应不是 2xx，尝试解析错误信息，但如果失败则使用默认错误
        try {
          result = await apiResponse.json();
        } catch {
          result = {
            code: apiResponse.status,
            message: `HTTP Error: ${apiResponse.status} ${apiResponse.statusText}`
          };
        }
      }
      
      if (result.code === 200) {
        setResponse(result.data);
        
        // 添加到历史记录
        const historyEntry: RequestHistory = {
          id: generateId('hist'),
          request: activeRequest,
          response: result.data,
          error: null,
          timestamp: Date.now(),
        };
        const newHistory = [historyEntry, ...history].slice(0, 50);
        setHistory(newHistory);
        await saveHistoryToServer(historyEntry);
        saveHistoryToStorage(newHistory);
      } else {
        setError(result.message || t('postman.requestFailed'));
        
        // 添加到历史记录
        const historyEntry: RequestHistory = {
          id: generateId('hist'),
          request: activeRequest,
          response: null,
          error: result.message || t('postman.requestFailed'),
          timestamp: Date.now(),
        };
        const newHistory = [historyEntry, ...history].slice(0, 50);
        setHistory(newHistory);
        await saveHistoryToServer(historyEntry);
        saveHistoryToStorage(newHistory);
      }
    } catch (err: any) {
      setError(err.message || t('postman.requestFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [activeRequest, history]);

  return (
    <div className="h-full flex bg-[#F9FAFB] relative">
      {/* 右侧主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        {activeRequest ? (
          <>
            {/* 顶部工具栏 */}
            <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreateRequest}
                  className="px-3 py-1.5 text-xs font-medium bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors flex items-center gap-2"
                >
                  <i className="fas fa-plus"></i>
                  {t('postman.newRequest')}
                </button>
                
                <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                
                <button
                  onClick={handleSaveRequest}
                  disabled={!hasUnsavedChanges || isLoading}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-2 ${
                    hasUnsavedChanges && !isLoading
                      ? 'bg-[#00B42A] text-white hover:bg-[#009A29] shadow-sm'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <i className={`fas ${isLoading ? 'fa-spinner fa-spin' : 'fa-save'}`}></i>
                  {t('postman.saveRequest')}
                  {hasUnsavedChanges && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>}
                </button>

                <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameRequest(activeRequest.id, editingName);
                        if (e.key === 'Escape') setIsEditingName(false);
                      }}
                      className="px-2 py-1 text-sm border border-[#007acc] rounded focus:outline-none focus:ring-1 focus:ring-[#007acc] min-w-[200px]"
                      autoFocus
                    />
                    <button
                      onClick={() => handleRenameRequest(activeRequest.id, editingName)}
                      className="p-1.5 text-[#00B42A] hover:bg-green-50 rounded"
                      title={t('postman.save')}
                    >
                      <i className="fas fa-check text-xs"></i>
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="p-1.5 text-[#F53F3F] hover:bg-red-50 rounded"
                      title={t('postman.cancel')}
                    >
                      <i className="fas fa-times text-xs"></i>
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <span className="text-sm font-bold text-gray-800">{activeRequest.name}</span>
                    <button
                      onClick={() => {
                        setEditingName(activeRequest.name);
                        setIsEditingName(true);
                      }}
                      className="p-1 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-[#007acc] hover:bg-blue-50 rounded transition-all"
                      title={t('postman.editName')}
                    >
                      <i className="fas fa-edit text-xs"></i>
                    </button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 font-mono">ID: {activeRequest.id}</span>
              </div>
            </div>

            {/* 请求编辑器 */}
            <div className="h-1/2 border-b border-gray-200">
              <RequestEditor
                request={activeRequest}
                isLoading={isLoading}
                onRequestChange={handleRequestChange}
                onSend={handleSend}
              />
            </div>

            {/* 响应查看器 */}
            <div className="h-1/2">
              <ResponseViewer
                response={response}
                error={error}
                isLoading={isLoading}
              />
            </div>
          </>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <i className="fas fa-paper-plane text-6xl text-gray-300 mb-4"></i>
              <h3 className="text-xl font-medium text-gray-700 mb-2">{t('postman.httpDetails')}</h3>
              <p className="text-gray-500 mb-4">{t('postman.selectRequestPrompt')}</p>
              <button
                onClick={handleCreateRequest}
                className="px-4 py-2 bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors"
              >
                <i className="fas fa-plus mr-2"></i>
                {t('postman.createNewRequest')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 吐司通知容器 */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts(prev => prev.filter(t => t.id !== id))} />
    </div>
  );
}
