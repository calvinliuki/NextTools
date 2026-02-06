import { useState, useEffect } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { parseFullKey } from '../utils';
import { DeleteConfirmDialog } from '../dialogs';

interface SetKeyDetailProps {
  keyDetails: any;
  onKeyUpdate?: (key: string | null) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const SetKeyDetail = ({ keyDetails, onKeyUpdate, showToast }: SetKeyDetailProps) => {
  const { t } = useLanguage();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; value: string }> | null>(null);
  const [editingItem, setEditingItem] = useState<{ value: string; originalValue: string } | null>(null);
  const [isInsertingItem, setIsInsertingItem] = useState(false);
  const [newItemValue, setNewItemValue] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteValue, setPendingDeleteValue] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setSearchKeyword('');
    setSearchResults(null);
    setEditingItem(null);
  }, [keyDetails.key]);

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      showToast?.(t('listKeyDetail.searchKeywordRequired'), 'info');
      return;
    }

    setIsSearching(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/set/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          dbIndex,
          key: actualKey,
          keyword: searchKeyword,
          limit: 100,
        }),
      });

      const result = await response.json();
      if (result.code === 200) {
        setSearchResults(result.data.results);
      } else {
        showToast?.(`${t('listKeyDetail.searchFailed', { message: result.message })}`, 'error');
      }
    } catch (error) {
      console.error('Search failed:', error);
      showToast?.(`${t('listKeyDetail.searchFailed', { message: (error as Error).message })}`, 'error');
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchKeyword('');
    setSearchResults(null);
  };

  const handleEdit = (value: string) => {
    setEditingItem({ value, originalValue: value });
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    if (!editingItem.value.trim()) {
      showToast?.(t('listKeyDetail.valueRequired'), 'info');
      return;
    }

    setIsSaving(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/set/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          dbIndex,
          key: actualKey,
          oldValue: editingItem.originalValue,
          newValue: editingItem.value,
        }),
      });

      const result = await response.json();
      if (result.code === 200 && result.data?.updated) {
        showToast?.(t('listKeyDetail.saveSuccess'), 'success');
        setEditingItem(null);
        handleReload();
      } else {
        showToast?.(`${t('listKeyDetail.saveFailed', { message: result.message || t('common.unknownError') })}`, 'error');
      }
    } catch (error) {
      console.error('Edit failed:', error);
      showToast?.(`${t('listKeyDetail.saveFailed', { message: (error as Error).message })}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteItem = (value: string) => {
    setPendingDeleteValue(value);
    setDeleteConfirmOpen(true);
  };

  const executeDeleteItem = async () => {
    if (!pendingDeleteValue) return;

    setIsDeleting(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/set/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          dbIndex,
          key: actualKey,
          member: pendingDeleteValue,
        }),
      });

      const result = await response.json();
      if (result.code === 200 && result.data?.deleted) {
        showToast?.(t('listKeyDetail.deleteSuccess'), 'success');
        setDeleteConfirmOpen(false);
        setPendingDeleteValue(null);
        handleReload();
      } else {
        showToast?.(`${t('listKeyDetail.deleteFailed', { message: result.message || t('common.unknownError') })}`, 'error');
      }
    } catch (error) {
      console.error('Delete failed:', error);
      showToast?.(`${t('listKeyDetail.deleteFailed', { message: (error as Error).message })}`, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenInsert = () => {
    setIsInsertingItem(true);
    setNewItemValue('');
  };

  const handleCloseInsert = () => {
    setIsInsertingItem(false);
    setNewItemValue('');
  };

  const handleInsert = async () => {
    if (!newItemValue.trim()) {
      showToast?.(t('listKeyDetail.valueRequired'), 'info');
      return;
    }

    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/set/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          dbIndex,
          key: actualKey,
          member: newItemValue,
        }),
      });

      const result = await response.json();
      if (result.code === 200 && result.data?.inserted) {
        showToast?.(t('listKeyDetail.insertSuccess'), 'success');
        handleCloseInsert();
        handleReload();
      } else {
        showToast?.(`${t('listKeyDetail.insertFailed', { message: result.message || t('common.unknownError') })}`, 'error');
      }
    } catch (error) {
      console.error('Insert failed:', error);
      showToast?.(`${t('listKeyDetail.insertFailed', { message: (error as Error).message })}`, 'error');
    }
  };

  const handleReload = () => {
    setSearchResults(null);
    setSearchKeyword('');
    setEditingItem(null);
    if (onKeyUpdate) {
      onKeyUpdate(keyDetails.key);
    }
  };

  const displayData = searchResults !== null ? searchResults : (keyDetails.list || []);

  return (
    <div className="flex h-full">
      <div className={editingItem ? "flex-1 flex flex-col overflow-hidden border-r border-gray-200" : "flex-1 flex flex-col overflow-hidden"}>
        <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('streamKeyDetail.searchMemberValue')}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-3 py-1.5 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1"></i>{t('streamKeyDetail.searching')}
                </>
              ) : (
                <>
                  <i className="fas fa-search mr-1"></i>{t('streamKeyDetail.search')}
                </>
              )}
            </button>
            {searchResults !== null && (
              <button
                onClick={handleClearSearch}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                <i className="fas fa-times mr-1"></i>{t('streamKeyDetail.clear')}
              </button>
            )}
          </div>
          {searchResults !== null && (
            <div className="mt-2 text-sm text-gray-600">
              {t('listKeyDetail.foundResults', { count: searchResults.length })}
            </div>
          )}
        </div>

        <div className="border-b border-gray-200">
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">
            <div className="col-span-1">{t('streamKeyDetail.index')}</div>
            <div className="col-span-10">{t('streamKeyDetail.content')}</div>
            <div className="col-span-1">{t('streamKeyDetail.actions')}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {displayData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchResults !== null ? t('listKeyDetail.noMatchingRecords') : t('redis.noData')}
            </div>
          ) : (
            displayData.map((item: any) => (
              <div
                key={item.id}
                className={`grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-100 text-sm cursor-pointer ${
                  editingItem?.originalValue === item.value ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleEdit(item.value)}
              >
                <div className="col-span-1 font-mono text-gray-800 truncate" title={item.id}>{item.id}</div>
                <div className="col-span-10 font-mono text-gray-800 truncate" title={item.value}>{item.value}</div>
                <div className="col-span-1 flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(item.value);
                    }}
                    className="text-blue-500 hover:text-blue-700 text-sm cursor-pointer"
                    title={t('streamKeyDetail.edit')}
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(item.value);
                    }}
                    className="text-red-500 hover:text-red-700 text-sm cursor-pointer"
                    title={t('streamKeyDetail.delete')}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {t('streamKeyDetail.totalCount', { count: keyDetails.length })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenInsert}
              className="px-3 py-1.5 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors"
            >
              <i className="fas fa-plus mr-1"></i>{t('streamKeyDetail.addMember')}
            </button>
            <button
              onClick={handleReload}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              <i className="fas fa-sync-alt mr-1"></i>{t('listKeyDetail.reload')}
            </button>
          </div>
        </div>
      </div>

      {editingItem && (
        <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">{t('streamKeyDetail.editMember')}</h3>
            <button
              onClick={handleCancelEdit}
              className="text-gray-400 hover:text-gray-600 text-lg"
              title={t('streamKeyDetail.close')}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="mb-4 flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('streamKeyDetail.memberValue')}</label>
            <textarea
              value={editingItem.value}
              onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
              className="w-full h-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent resize-none font-mono"
              placeholder={t('streamKeyDetail.enterMemberValueField')}
            />
          </div>

          <div className="flex gap-2 mt-4 border-t border-gray-200 pt-4">
            <button
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isSaving ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1"></i>{t('streamKeyDetail.saving')}
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-1"></i>{t('streamKeyDetail.save')}
                </>
              )}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              <i className="fas fa-times mr-1"></i>{t('streamKeyDetail.cancel')}
            </button>
          </div>
        </div>
      )}

      {isInsertingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{t('streamKeyDetail.insertNewMember')}</h3>
              <button
                onClick={handleCloseInsert}
                className="text-gray-400 hover:text-gray-600 text-lg"
                title={t('streamKeyDetail.close')}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('streamKeyDetail.memberValue')}</label>
              <textarea
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isSaving && handleInsert()}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent resize-none font-mono h-24"
                placeholder={t('streamKeyDetail.enterMemberValueField')}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleInsert}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {isSaving ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-1"></i>{t('streamKeyDetail.inserting')}
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-1"></i>{t('streamKeyDetail.insert')}
                  </>
                )}
              </button>
              <button
                onClick={handleCloseInsert}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <i className="fas fa-times mr-1"></i>{t('streamKeyDetail.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        title={t('streamKeyDetail.memberTitle')}
        content={pendingDeleteValue || ''}
        onConfirm={executeDeleteItem}
        onCancel={() => setDeleteConfirmOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default SetKeyDetail;
