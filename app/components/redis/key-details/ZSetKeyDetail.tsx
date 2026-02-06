import { useState, useEffect } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { parseFullKey } from '../utils';
import { DeleteConfirmDialog } from '../dialogs';

interface ZSetKeyDetailProps {
  keyDetails: any;
  onKeyUpdate?: (key: string | null) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ZSetKeyDetail = ({ keyDetails, onKeyUpdate, showToast }: ZSetKeyDetailProps) => {
  const { t } = useLanguage();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; value: string; score: number }> | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [editingItem, setEditingItem] = useState<{ value: string; originalValue: string; score: number } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInsertingItem, setIsInsertingItem] = useState(false);
  const [newItemValue, setNewItemValue] = useState('');
  const [newItemScore, setNewItemScore] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteValue, setPendingDeleteValue] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setSearchKeyword('');
    setSearchResults(null);
    setEditingItem(null);
  }, [keyDetails.key]);

  const handleClearSearch = () => {
    setSearchKeyword('');
    setSearchResults(null);
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      setSearchResults(null);
      return;
    }

    setIsSearching(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/zset/search', {
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
      if (result.code === 200 && result.data) {
        setSearchResults(result.data.results);
      } else {
        showToast?.(t('zSetKeyDetail.searchFailed') + ' ' + (result.message || t('common.unknownError')), 'error');
        setSearchResults([]);
      }
    } catch (error) {
      console.error(t('zSetKeyDetail.searchFailed'), error);
      showToast?.(t('zSetKeyDetail.searchFailed', { message: (error as Error).message }), 'error');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleEdit = (value: string, score: number) => {
    setEditingItem({
      value,
      originalValue: value,
      score,
    });
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    if (!editingItem.value.trim()) {
      showToast?.(t('zSetKeyDetail.valueRequired'), 'info');
      return;
    }

    if (isNaN(editingItem.score)) {
      showToast?.(t('zSetKeyDetail.scoreRequired'), 'info');
      return;
    }

    setIsSaving(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/zset/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          dbIndex,
          key: actualKey,
          oldValue: editingItem.originalValue,
          newValue: editingItem.value,
          newScore: editingItem.score,
        }),
      });

      const result = await response.json();
      if (result.code === 200 && result.data?.updated) {
        showToast?.(t('zSetKeyDetail.saveSuccess'), 'success');
        setEditingItem(null);
        handleReload();
      } else {
        showToast?.(t('zSetKeyDetail.saveFailed', { message: result.message || t('common.unknownError') }), 'error');
      }
    } catch (error) {
      console.error(t('zSetKeyDetail.saveFailed'), error);
      showToast?.(t('zSetKeyDetail.saveFailed', { message: (error as Error).message }), 'error');
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
      const response = await fetch('/api/redis/connections/key/zset/delete', {
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
        showToast?.(t('zSetKeyDetail.deleteSuccess'), 'success');
        setDeleteConfirmOpen(false);
        setPendingDeleteValue(null);
        handleReload();
      } else {
        showToast?.(t('zSetKeyDetail.deleteFailed', { message: result.message || t('common.unknownError') }), 'error');
      }
    } catch (error) {
      console.error(t('zSetKeyDetail.deleteFailed'), error);
      showToast?.(t('zSetKeyDetail.deleteFailed', { message: (error as Error).message }), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenInsert = () => {
    setIsInsertingItem(true);
    setNewItemValue('');
    setNewItemScore('0');
  };

  const handleCloseInsert = () => {
    setIsInsertingItem(false);
    setNewItemValue('');
    setNewItemScore('0');
  };

  const handleInsert = async () => {
    if (!newItemValue.trim()) {
      showToast?.(t('zSetKeyDetail.valueRequired'), 'info');
      return;
    }

    if (isNaN(parseFloat(newItemScore))) {
      showToast?.(t('zSetKeyDetail.scoreRequired'), 'info');
      return;
    }

    setIsSaving(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/zset/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          dbIndex,
          key: actualKey,
          value: newItemValue,
          score: parseFloat(newItemScore),
        }),
      });

      const result = await response.json();
      if (result.code === 200 && result.data?.inserted) {
        showToast?.(t('zSetKeyDetail.insertSuccess'), 'success');
        handleCloseInsert();
        handleReload();
      } else {
        showToast?.(t('zSetKeyDetail.insertFailed', { message: result.message || t('common.unknownError') }), 'error');
      }
    } catch (error) {
      console.error(t('zSetKeyDetail.insertFailed'), error);
      showToast?.(t('zSetKeyDetail.insertFailed', { message: (error as Error).message }), 'error');
    } finally {
      setIsSaving(false);
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
      <div className="flex-1 flex flex-col">
        <div className="p-3 border-b border-gray-200 bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('zSetKeyDetail.searchMemberOrScore')}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-3 py-1.5 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1"></i>{t('zSetKeyDetail.searching')}
                </>
              ) : (
                <>
                  <i className="fas fa-search mr-1"></i>{t('zSetKeyDetail.search')}
                </>
              )}
            </button>
            {searchResults !== null && (
              <button
                onClick={handleClearSearch}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                <i className="fas fa-times mr-1"></i>{t('zSetKeyDetail.clear')}
              </button>
            )}
          </div>
          {searchResults !== null && (
            <div className="mt-2 text-sm text-gray-600">
              {t('zSetKeyDetail.foundResults', { count: searchResults.length })}
            </div>
          )}
        </div>

        <div className="border-b border-gray-200">
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">
            <div className="col-span-1">{t('zSetKeyDetail.index')}</div>
            <div className="col-span-5">{t('zSetKeyDetail.value')}</div>
            <div className="col-span-5">{t('zSetKeyDetail.score')}</div>
            <div className="col-span-1">{t('zSetKeyDetail.actions')}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {displayData.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchResults !== null ? t('zSetKeyDetail.noMatchingData') : t('zSetKeyDetail.noData')}
            </div>
          ) : (
            displayData.map((item: any) => (
              <div
                key={item.id}
                className={`grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-100 text-sm cursor-pointer ${
                  editingItem?.originalValue === item.value ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleEdit(item.value, item.score)}
              >
                <div className="col-span-1 font-mono text-gray-800 truncate" title={item.id}>{item.id}</div>
                <div className="col-span-5 font-mono text-gray-800 truncate" title={item.value}>{item.value}</div>
                <div className="col-span-5 font-mono text-gray-800 truncate" title={item.score}>{item.score}</div>
                <div className="col-span-1 flex gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(item.value, item.score);
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
            {t('zSetKeyDetail.totalRecords', { count: keyDetails.length })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenInsert}
              className="px-3 py-1.5 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors"
            >
              <i className="fas fa-plus mr-1"></i>{t('zSetKeyDetail.insertRow')}
            </button>
            <button
              onClick={handleReload}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              {t('zSetKeyDetail.reload')}
            </button>
          </div>
        </div>
      </div>

      {isInsertingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{t('zSetKeyDetail.insertMember')}</h3>
              <button
                onClick={handleCloseInsert}
                className="text-gray-400 hover:text-gray-600 text-lg"
                title={t('streamKeyDetail.close')}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('zSetKeyDetail.memberValue')}</label>
              <textarea
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent resize-none font-mono h-24"
                placeholder={t('streamKeyDetail.enterMemberValue')}
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('zSetKeyDetail.score')}</label>
              <input
                type="text"
                value={newItemScore}
                onChange={(e) => setNewItemScore(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isSaving && handleInsert()}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent"
                placeholder={t('streamKeyDetail.enterScore')}
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
                    <i className="fas fa-spinner fa-spin mr-1"></i>{t('zSetKeyDetail.inserting')}
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-1"></i>{t('zSetKeyDetail.insert')}
                  </>
                )}
              </button>
              <button
                onClick={handleCloseInsert}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <i className="fas fa-times mr-1"></i>{t('zSetKeyDetail.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">{t('zSetKeyDetail.editMember')}</h3>
            <button
              onClick={handleCancelEdit}
              className="text-gray-400 hover:text-gray-600 text-lg"
              title={t('streamKeyDetail.close')}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('zSetKeyDetail.memberValue')}</label>
            <textarea
              value={editingItem.value}
              onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent resize-none font-mono h-32"
              placeholder={t('streamKeyDetail.enterMemberValue')}
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('zSetKeyDetail.score')}</label>
            <input
              type="text"
              value={editingItem.score}
              onChange={(e) => setEditingItem({ ...editingItem, score: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent"
              placeholder={t('streamKeyDetail.enterScore')}
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
                  <i className="fas fa-spinner fa-spin mr-1"></i>{t('zSetKeyDetail.saving')}
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-1"></i>{t('zSetKeyDetail.save')}
                </>
              )}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              <i className="fas fa-times mr-1"></i>{t('zSetKeyDetail.cancel')}
            </button>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        title={t('zSetKeyDetail.member')}
        content={pendingDeleteValue || ''}
        onConfirm={executeDeleteItem}
        onCancel={() => setDeleteConfirmOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default ZSetKeyDetail;
