import { useState, useEffect } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { parseFullKey } from '../utils';
import { DeleteConfirmDialog } from '../dialogs';

interface StreamKeyDetailProps {
  keyDetails: any;
  onKeyUpdate?: (key: string | null) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const StreamKeyDetail = ({ keyDetails, onKeyUpdate, showToast }: StreamKeyDetailProps) => {
  const { t } = useLanguage();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Array<any> | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{ entryId: string; data: Record<string, string> } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingMessage, setIsAddingMessage] = useState(false);
  const [newMessageFields, setNewMessageFields] = useState<Record<string, string>>({});
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteEntryId, setPendingDeleteEntryId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setSearchKeyword('');
    setSearchResults(null);
    setEditingEntry(null);
  }, [keyDetails.key]);

  const handleClearSearch = () => { setSearchKeyword(''); setSearchResults(null); };
  const handleSearch = async () => {
    if (!searchKeyword.trim()) { setSearchResults(null); return; }
    setIsSearching(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/stream/search', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          connectionId,
          dbIndex,
          key: actualKey, 
          keyword: searchKeyword, 
          limit: 100 
        }) 
      });
      const result = await response.json();
      if (result.code === 200) setSearchResults(result.data.results); 
      else { showToast?.(t('streamKeyDetail.searchFailed', { message: result.message }), 'error'); setSearchResults([]); }
    } catch (error) { 
      console.error(error); 
      showToast?.(t('streamKeyDetail.searchFailed', { message: (error as Error).message }), 'error');
      setSearchResults([]); 
    } finally { 
      setIsSearching(false); 
    }
  };
  
  const handleEdit = (entryId: string, data: Record<string, string>) => setEditingEntry({ entryId, data: { ...data } });
  const handleCancelEdit = () => setEditingEntry(null);
  const handleSaveEdit = async () => {
    if (!editingEntry || Object.keys(editingEntry.data).length === 0) return;
    setIsSaving(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/stream/update', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          connectionId,
          dbIndex,
          key: actualKey, 
          entryId: editingEntry.entryId, 
          fields: editingEntry.data 
        }) 
      });
      const result = await response.json();
      if (result.code === 200) { 
        setEditingEntry(null); 
        showToast?.(t('listKeyDetail.saveSuccess'), 'success'); 
        handleReload(); 
      } else showToast?.(t('streamKeyDetail.editFailed', { message: result.message }), 'error');
    } catch (error) { 
      console.error(error); 
      showToast?.(t('streamKeyDetail.editFailed', { message: (error as Error).message }), 'error');
    } finally { 
      setIsSaving(false); 
    }
  };
  
  const handleDeleteEntry = (entryId: string) => {
    setPendingDeleteEntryId(entryId);
    setDeleteConfirmOpen(true);
  };

  const executeDeleteEntry = async () => {
    if (!pendingDeleteEntryId) return;
    
    setIsDeleting(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/stream/delete', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          connectionId,
          dbIndex,
          key: actualKey, 
          entryId: pendingDeleteEntryId
        }) 
      });
      const result = await response.json();
      if (result.code === 200) {
        setDeleteConfirmOpen(false);
        setPendingDeleteEntryId(null);
        showToast?.(t('streamKeyDetail.deleteSuccess'), 'success');
        handleReload();
      } else {
        showToast?.(t('streamKeyDetail.deleteFailed', { message: result.message || t('common.unknownError') }), 'error');
      }
    } catch (error) { 
      console.error(error);
      showToast?.(t('streamKeyDetail.deleteFailed', { message: (error as Error).message }), 'error');
    } finally {
      setIsDeleting(false);
    }
  };
  
  const handleOpenAddMessage = () => { 
    setIsAddingMessage(true); 
    setNewMessageFields({}); 
    setNewFieldKey(''); 
    setNewFieldValue(''); 
  };
  const handleCloseAddMessage = () => { 
    setIsAddingMessage(false); 
    setNewMessageFields({}); 
    setNewFieldKey(''); 
    setNewFieldValue(''); 
  };
  const handleAddField = () => { 
    if (!newFieldKey.trim()) return; 
    setNewMessageFields({ ...newMessageFields, [newFieldKey]: newFieldValue }); 
    setNewFieldKey(''); 
    setNewFieldValue(''); 
  };
  const handleRemoveField = (fieldKey: string) => { 
    const updated = { ...newMessageFields }; 
    delete updated[fieldKey]; 
    setNewMessageFields(updated); 
  };
  const handleAddMessage = async () => {
    if (newFieldKey.trim()) {
      setNewMessageFields({ ...newMessageFields, [newFieldKey]: newFieldValue });
      setNewFieldKey('');
      setNewFieldValue('');
      return;
    }
    
    if (Object.keys(newMessageFields).length === 0) return;
    
    setIsSaving(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/stream/add', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ 
          connectionId,
          dbIndex,
          key: actualKey, 
          fields: newMessageFields 
        }) 
      });
      const result = await response.json();
      if (result.code === 200) { 
        handleCloseAddMessage(); 
        showToast?.(t('streamKeyDetail.addSuccess'), 'success'); 
        handleReload(); 
      }
      else { 
        showToast?.(t('streamKeyDetail.addFailed', { message: result.message }), 'error'); 
      }
    } catch (error) { 
      console.error(error); 
      showToast?.(t('streamKeyDetail.addFailed', { message: (error as Error).message }), 'error');
    } finally { 
      setIsSaving(false); 
    }
  };
  const handleReload = () => { 
    setSearchResults(null); 
    setSearchKeyword(''); 
    setEditingEntry(null); 
    if (onKeyUpdate) onKeyUpdate(keyDetails.key); 
  };
  
  const displayData = searchResults !== null ? searchResults : (keyDetails.list || []);
  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            <input 
              type="text" 
              value={searchKeyword} 
              onChange={(e) => setSearchKeyword(e.target.value)} 
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()} 
              placeholder={t('streamKeyDetail.searchMessagePlaceholder')}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent" 
            />
            <button 
              onClick={handleSearch} 
              disabled={isSearching} 
              className="px-3 py-1.5 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors disabled:opacity-50"
            >
              <i className="fas fa-search mr-1"></i>
              {isSearching ? t('streamKeyDetail.searching') : t('streamKeyDetail.search')}
            </button>
            {searchResults !== null && 
              <button 
                onClick={handleClearSearch} 
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
              >
                <i className="fas fa-times mr-1"></i>{t('streamKeyDetail.clear')}
              </button>
            }
          </div>
        </div>
        <div className="border-b border-gray-200">
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">
            <div className="col-span-2">{t('streamKeyDetail.index')}</div>
            <div className="col-span-4">{t('streamKeyDetail.messageId')}</div>
            <div className="col-span-5">{t('streamKeyDetail.content')}</div>
            <div className="col-span-1">{t('streamKeyDetail.actions')}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {displayData.length === 0 ? 
            <div className="text-center py-8 text-gray-500">
              {searchResults ? t('streamKeyDetail.noResults') : t('streamKeyDetail.noMessages')}
            </div> : 
            displayData.map((item: any) => {
              const preview = Object.entries(item.data).slice(0, 2).map(([k, v]) => `${k}:${String(v).substring(0, 20)}`).join(', ');
              return (
                <div 
                  key={item.id} 
                  className={`grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-100 text-sm cursor-pointer ${
                    editingEntry?.entryId === item.entryId ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`} 
                  onClick={() => handleEdit(item.entryId, item.data)}
                >
                  <div className="col-span-2 font-mono text-gray-800 truncate">{item.id}</div>
                  <div className="col-span-4 font-mono text-gray-800 truncate">{item.entryId}</div>
                  <div className="col-span-5 font-mono text-gray-600 truncate">{preview}</div>
                  <div className="col-span-1 flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <button 
                      onClick={() => handleEdit(item.entryId, item.data)} 
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <i className="fas fa-edit"></i>
                    </button>
                    <button 
                      onClick={() => handleDeleteEntry(item.entryId)} 
                      className="text-red-500 hover:text-red-700"
                    >
                      <i className="fas fa-trash"></i>
                    </button>
                  </div>
                </div>
              );
            })
          }
        </div>
        <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">{t('streamKeyDetail.totalCount', { count: keyDetails.length })}</div>
          <div className="flex gap-2">
            <button 
              onClick={handleOpenAddMessage} 
              className="px-3 py-1.5 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e]"
            >
              <i className="fas fa-plus mr-1"></i>{t('streamKeyDetail.add')}
            </button>
            <button 
              onClick={handleReload} 
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              {t('streamKeyDetail.reload')}
            </button>
          </div>
        </div>
      </div>
      {isAddingMessage && 
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold">{t('streamKeyDetail.addMessage')}</h3>
              <button 
                onClick={handleCloseAddMessage} 
                className="text-gray-400 hover:text-gray-600"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            {Object.keys(newMessageFields).length > 0 && 
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">{t('streamKeyDetail.field')}</label>
                <div className="space-y-2 max-h-24 overflow-y-auto">
                  {Object.entries(newMessageFields).map(([key, value]) => 
                    <div key={key} className="flex items-center gap-2 bg-gray-50 p-2 rounded">
                      <div className="flex-1 text-sm">
                        <span className="font-medium">{key}</span>: {String(value).substring(0, 30)}
                      </div>
                      <button 
                        onClick={() => handleRemoveField(key)} 
                        className="text-red-500 text-xs"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            }
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">{t('streamKeyDetail.fieldName')}</label>
              <input 
                type="text" 
                value={newFieldKey} 
                onChange={(e) => setNewFieldKey(e.target.value)} 
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc]" 
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">{t('streamKeyDetail.fieldValue')}</label>
              <textarea 
                value={newFieldValue} 
                onChange={(e) => setNewFieldValue(e.target.value)} 
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] resize-none font-mono h-24" 
              />
            </div>
            <div className="flex gap-2">
              <button 
                onClick={handleAddMessage} 
                disabled={isSaving || (newFieldKey.trim() === '' && Object.keys(newMessageFields).length === 0)} 
                className="flex-1 px-4 py-2 bg-[#007acc] text-white rounded hover:bg-[#005a9e] disabled:opacity-50"
              >
                {isSaving ? t('streamKeyDetail.adding') : newFieldKey.trim() ? t('streamKeyDetail.addField') : t('streamKeyDetail.confirm')}
              </button>
              <button 
                onClick={handleCloseAddMessage} 
                disabled={isSaving} 
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
              >
                {t('streamKeyDetail.cancel')}
              </button>
            </div>
          </div>
        </div>
      }
      {editingEntry && 
        <div className="w-96 bg-white border-l border-gray-200 p-4 overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold">{t('streamKeyDetail.editMessage')}</h3>
            <button 
              onClick={handleCancelEdit} 
              className="text-gray-400 hover:text-gray-600"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
          <div className="mb-4 pb-3 border-b border-gray-200">
            <label className="block text-sm font-medium mb-1">{t('streamKeyDetail.messageId')}</label>
            <div className="font-mono text-sm text-gray-600">{editingEntry.entryId}</div>
          </div>
          <div className="flex-1 overflow-y-auto mb-4">
            <label className="block text-sm font-medium mb-2">{t('streamKeyDetail.field')}</label>
            <div className="space-y-3">
              {Object.entries(editingEntry.data).map(([key, value]) => 
                <div key={key}>
                  <label className="block text-xs text-gray-600 mb-1">{key}</label>
                  <textarea 
                    value={value} 
                    onChange={(e) => setEditingEntry({ ...editingEntry, data: { ...editingEntry.data, [key]: e.target.value } })} 
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] resize-none font-mono h-16" 
                  />
                </div>
              )}
            </div>
          </div>
          <div className="flex gap-2 mt-4 border-t border-gray-200 pt-4">
            <button 
              onClick={handleSaveEdit} 
              disabled={isSaving} 
              className="flex-1 px-4 py-2 bg-[#007acc] text-white rounded hover:bg-[#005a9e] disabled:opacity-50"
            >
              {isSaving ? t('streamKeyDetail.saving') : t('streamKeyDetail.save')}
            </button>
            <button 
              onClick={handleCancelEdit} 
              disabled={isSaving} 
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50"
            >
              {t('streamKeyDetail.cancel')}
            </button>
          </div>
        </div>
      }

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        title={t('streamKeyDetail.entries')}
        content={pendingDeleteEntryId || ''}
        onConfirm={executeDeleteEntry}
        onCancel={() => setDeleteConfirmOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default StreamKeyDetail;
