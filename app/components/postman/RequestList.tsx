'use client';

import { useState } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { HttpRequest, RequestCollection, METHOD_COLORS, createEmptyRequest, createEmptyCollection } from './types';
import DeleteConfirmDialog from '../../components/common/DeleteConfirmDialog';

interface RequestListProps {
  collections: RequestCollection[];
  allRequests: Record<string, HttpRequest>;
  activeRequestId: string | null;
  onSelectRequest: (request: HttpRequest) => void;
  onCreateRequest: (collectionId: string) => void;
  onCreateCollection: () => void;
  onDeleteRequest: (collectionId: string, requestId: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onRenameRequest: (collectionId: string, requestId: string, newName: string) => void;
  onRenameCollection: (collectionId: string, newName: string) => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

export default function RequestList({
  collections,
  allRequests,
  activeRequestId,
  onSelectRequest,
  onCreateRequest,
  onCreateCollection,
  onDeleteRequest,
  onDeleteCollection,
  onRenameRequest,
  onRenameCollection,
  onShowToast,
}: RequestListProps) {
  const { t } = useLanguage();
  const [expandedCollections, setExpandedCollections] = useState<Set<string>>(
    new Set(collections.map(c => c.id))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'collection' | 'request';
    collectionId: string;
    requestId?: string;
    name: string;
  }>({ open: false, type: 'collection', collectionId: '', name: '' });

  const toggleCollection = (collectionId: string) => {
    const newExpanded = new Set(expandedCollections);
    if (newExpanded.has(collectionId)) {
      newExpanded.delete(collectionId);
    } else {
      newExpanded.add(collectionId);
    }
    setExpandedCollections(newExpanded);
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditingName(currentName);
  };

  const finishEditing = (type: 'collection' | 'request', collectionId: string, requestId?: string) => {
    if (editingName.trim()) {
      if (type === 'collection') {
        onRenameCollection(collectionId, editingName.trim());
      } else if (requestId) {
        onRenameRequest(collectionId, requestId, editingName.trim());
      }
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: 'collection' | 'request', collectionId: string, requestId?: string) => {
    if (e.key === 'Enter') {
      finishEditing(type, collectionId, requestId);
    } else if (e.key === 'Escape') {
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleDeleteClick = (type: 'collection' | 'request', collectionId: string, requestId?: string, name?: string) => {
    setDeleteDialog({
      open: true,
      type,
      collectionId,
      requestId,
      name: name || '',
    });
  };

  const handleDeleteConfirm = () => {
    if (deleteDialog.type === 'collection') {
      onDeleteCollection(deleteDialog.collectionId);
      if (onShowToast) {
        onShowToast(t('postman.collectionDeleted', { name: deleteDialog.name }), 'success');
      }
    } else if (deleteDialog.requestId) {
      onDeleteRequest(deleteDialog.collectionId, deleteDialog.requestId);
      if (onShowToast) {
        onShowToast(t('postman.requestDeleted', { name: deleteDialog.name }), 'success');
      }
    }
    setDeleteDialog({ open: false, type: 'collection', collectionId: '', name: '' });
  };

  const handleDeleteCancel = () => {
    setDeleteDialog({ open: false, type: 'collection', collectionId: '', name: '' });
  };

  return (
    <div className="h-full flex flex-col bg-white border-r border-gray-200">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-800">{t('postman.requestCollections')}</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={onCreateCollection}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title={t('postman.newCollection')}
          >
            <i className="fas fa-folder-plus text-xs text-gray-600"></i>
          </button>
        </div>
      </div>

      {/* 集合列表 */}
      <div className="flex-1 overflow-y-auto p-1">
        {collections.length === 0 ? (
          <div className="text-center py-8">
            <i className="fas fa-folder-open text-4xl text-gray-300 mb-3"></i>
            <p className="text-sm text-gray-500 mb-3">{t('postman.noCollections')}</p>
            <button
              onClick={onCreateCollection}
              className="text-sm text-[#007acc] hover:underline"
            >
              {t('postman.newCollection')}
            </button>
          </div>
        ) : (
          <div className="space-y-0.5">
            {collections.map((collection) => {
              const isExpanded = expandedCollections.has(collection.id);
              const isEditingCollection = editingId === collection.id;

              return (
                <div key={collection.id} className="rounded overflow-hidden">
                  {/* 集合头部 */}
                  <div
                    className="flex items-center justify-between px-2 py-1 cursor-pointer hover:bg-gray-100 transition-colors rounded group"
                    onClick={() => toggleCollection(collection.id)}
                  >
                    <div className="flex items-center gap-1.5 flex-grow min-w-0">
                      <i className={`fas fa-caret-${isExpanded ? 'down' : 'right'} text-xs text-gray-500`}></i>
                      <i className={`fas ${isExpanded ? 'fa-folder-open' : 'fa-folder'} text-sm text-yellow-500`}></i>
                      {isEditingCollection ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={() => finishEditing('collection', collection.id)}
                          onKeyDown={(e) => handleKeyDown(e, 'collection', collection.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 text-sm px-1 py-0.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc]"
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-medium truncate text-gray-800">{collection.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateRequest(collection.id);
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title={t('postman.newRequest')}
                      >
                        <i className="fas fa-plus text-xs text-gray-600"></i>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(collection.id, collection.name);
                        }}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title={t('postman.rename')}
                      >
                        <i className="fas fa-edit text-xs text-gray-600"></i>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteClick('collection', collection.id, undefined, collection.name);
                        }}
                        className="p-1 hover:bg-[#F53F3F] hover:text-white rounded transition-colors"
                        title={t('postman.deleteCollection')}
                      >
                        <i className="fas fa-trash text-xs"></i>
                      </button>
                    </div>
                  </div>

                  {/* 请求列表 */}
                  {isExpanded && (
                    <div className="pl-6">
                      {(!collection.requestIds || collection.requestIds.length === 0) ? (
                        <div className="px-2 py-1 text-center text-xs text-gray-400">
                          {t('postman.noRequests')}
                        </div>
                      ) : (
                        collection.requestIds.map((requestId) => {
                          const request = allRequests[requestId];
                          if (!request) return null;

                          const isActive = activeRequestId === request.id;
                          const isEditingRequest = editingId === request.id;

                          return (
                            <div
                              key={request.id}
                              className={`flex items-center justify-between px-2 py-0.5 cursor-pointer transition-all group rounded ${
                                isActive ? 'bg-[#e6f4ff]' : 'hover:bg-gray-100'
                              }`}
                              onClick={() => onSelectRequest(request)}
                            >
                              <div className="flex items-center gap-1 flex-grow min-w-0">
                                <span
                                  className="text-[10px] font-bold px-1 py-0.5 rounded"
                                  style={{
                                    color: METHOD_COLORS[request.method],
                                    backgroundColor: `${METHOD_COLORS[request.method]}15`,
                                  }}
                                >
                                  {request.method}
                                </span>
                                {isEditingRequest ? (
                                  <input
                                    type="text"
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    onBlur={() => finishEditing('request', collection.id, request.id)}
                                    onKeyDown={(e) => handleKeyDown(e, 'request', collection.id, request.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 text-sm px-1 py-0.5 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc]"
                                    autoFocus
                                  />
                                ) : (
                                  <span className="text-sm truncate text-gray-700">{request.name}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(request.id, request.name);
                                  }}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                  title={t('postman.rename')}
                                >
                                  <i className="fas fa-edit text-[10px] text-gray-600"></i>
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick('request', collection.id, request.id, request.name);
                                  }}
                                  className="p-1 hover:bg-[#F53F3F] hover:text-white rounded transition-colors"
                                  title={t('postman.deleteRequest')}
                                >
                                  <i className="fas fa-trash text-[10px]"></i>
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        open={deleteDialog.open}
        title={deleteDialog.type === 'collection' ? t('postman.collection') : t('postman.request')}
        content={deleteDialog.name}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    </div>
  );
}
