import { useState, useEffect } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { parseFullKey } from '../utils';
import { DeleteConfirmDialog } from '../dialogs';

interface ListKeyDetailProps {
  keyDetails: any;
  onKeyUpdate?: (key: string | null) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const ListKeyDetail = ({ keyDetails, onKeyUpdate, showToast }: ListKeyDetailProps) => {
  const { t } = useLanguage();
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: number; value: string }> | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [editingItem, setEditingItem] = useState<{ index: number; value: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInsertingItem, setIsInsertingItem] = useState(false);
  const [newItemValue, setNewItemValue] = useState('');
  const [insertPosition, setInsertPosition] = useState<'head' | 'tail'>('tail');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setSearchKeyword('');
    setSearchResults(null);
  }, [keyDetails.key]);

  const displayedData = searchResults !== null ? searchResults : (keyDetails.list || []);
  const totalLength = keyDetails.length || 0;

  const handleReload = () => {
    if (onKeyUpdate && keyDetails.key) {
      onKeyUpdate(keyDetails.key);
    }
  };

  const handleEditItem = (index: number, value: string) => {
    setEditingItem({
      index,
      value,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingItem) return;

    setIsSaving(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/list/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          dbIndex,
          key: actualKey,
          index: editingItem.index - 1,
          value: editingItem.value,
        }),
      });

      const result = await response.json();
      if (result.code === 200) {
        setEditingItem(null);
        showToast?.(t('listKeyDetail.saveSuccess'), 'success');
        handleReload();
      } else {
        showToast?.(t('listKeyDetail.saveFailed', { message: result.message || t('common.unknownError') }), 'error');
      }
    } catch (error) {
      console.error('保存失败:', error);
      showToast?.('保存失败: ' + (error as Error).message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
  };

  const handleOpenInsertDialog = () => {
    setNewItemValue('');
    setInsertPosition('tail');
    setIsInsertingItem(true);
  };

  const handleSaveInsertItem = async () => {
    if (!newItemValue.trim()) {
      showToast?.(t('listKeyDetail.valueRequired'), 'info');
      return;
    }

    setIsSaving(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/list/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          dbIndex,
          key: actualKey,
          value: newItemValue.trim(),
          position: insertPosition,
        }),
      });

      const result = await response.json();
      if (result.code === 200) {
        setIsInsertingItem(false);
        setNewItemValue('');
        showToast?.(t('listKeyDetail.insertSuccess'), 'success');
        handleReload();
      } else {
        showToast?.(t('listKeyDetail.insertFailed', { message: result.message || t('common.unknownError') }), 'error');
      }
    } catch (error) {
      console.error('插入失败:', error);
      showToast?.('插入失败: ' + (error as Error).message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelInsert = () => {
    setIsInsertingItem(false);
    setNewItemValue('');
  };

  const handleDeleteItem = (index: number) => {
    setPendingDeleteIndex(index);
    setDeleteConfirmOpen(true);
  };

  const executeDeleteItem = async () => {
    if (pendingDeleteIndex === null) return;

    setIsDeleting(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/list/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          dbIndex,
          key: actualKey,
          index: pendingDeleteIndex - 1,
        }),
      });

      const result = await response.json();
      if (result.code === 200 && result.data?.deleted) {
        showToast?.(t('listKeyDetail.deleteSuccess'), 'success');
        setDeleteConfirmOpen(false);
        setPendingDeleteIndex(null);
        handleReload();
      } else {
        showToast?.(t('listKeyDetail.deleteFailed', { message: result.message || t('common.unknownError') }), 'error');
      }
    } catch (error) {
      console.error('删除失败:', error);
      showToast?.('删除失败: ' + (error as Error).message, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      showToast?.(t('listKeyDetail.searchKeywordRequired'), 'info');
      return;
    }

    setIsSearching(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/list/search', {
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
        showToast?.(t('listKeyDetail.searchFailed', { message: result.message || t('common.unknownError') }), 'error');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      showToast?.('搜索失败: ' + (error as Error).message, 'error');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleClearSearch = () => {
    setSearchKeyword('');
    setSearchResults(null);
  };

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
              placeholder={t('streamKeyDetail.searchValue')}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-3 py-1.5 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1"></i>搜索中...
                </>
              ) : (
                <>
                  <i className="fas fa-search mr-1"></i>搜索
                </>
              )}
            </button>
            {searchResults !== null && (
              <button
                onClick={handleClearSearch}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                <i className="fas fa-times mr-1"></i>清除
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
            <div className="col-span-1">{t('listKeyDetail.rowNumber')}</div>
            <div className="col-span-10">{t('streamKeyDetail.value')}</div>
            <div className="col-span-1">{t('streamKeyDetail.action')}</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {displayedData && displayedData.length > 0 ? (
            displayedData.map((item: any) => (
              <div
                key={item.id}
                className={`grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-100 text-sm cursor-pointer ${
                  editingItem?.index === item.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleEditItem(item.id, item.value)}
              >
                <div className="col-span-1 font-mono text-gray-800 truncate">{item.id}</div>
                <div className="col-span-10 font-mono text-gray-800 truncate" title={item.value}>{item.value}</div>
                <div className="col-span-1 flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleEditItem(item.id, item.value)}
                    className="text-blue-500 hover:text-blue-700 text-sm cursor-pointer"
                    title={t('streamKeyDetail.edit')}
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={() => handleDeleteItem(item.id)}
                    className="text-red-500 hover:text-red-700 text-sm cursor-pointer"
                    title={t('streamKeyDetail.delete')}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              {searchKeyword ? t('listKeyDetail.noMatchingRecords') : t('listKeyDetail.noData')}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {t('listKeyDetail.maxDataInfo', { count: totalLength })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenInsertDialog}
              className="px-3 py-1.5 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors"
            >
              <i className="fas fa-plus mr-1"></i>{t('listKeyDetail.insertRow')}
            </button>
            <button
              onClick={handleReload}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              {t('listKeyDetail.reload')}
            </button>
          </div>
        </div>
      </div>

      {isInsertingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{t('listKeyDetail.insertNewData')}</h3>
              <button
                onClick={handleCancelInsert}
                className="text-gray-400 hover:text-gray-600 text-lg"
                title={t('streamKeyDetail.close')}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('listKeyDetail.insertPosition')}</label>
              <select
                value={insertPosition}
                onChange={(e) => setInsertPosition(e.target.value as 'head' | 'tail')}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent"
              >
                <option value="tail">{t('listKeyDetail.tail')}</option>
                <option value="head">{t('listKeyDetail.head')}</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('listKeyDetail.dataValue')}</label>
              <textarea
                value={newItemValue}
                onChange={(e) => setNewItemValue(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isSaving && handleSaveInsertItem()}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent resize-none font-mono h-24"
                placeholder={t('streamKeyDetail.enterDataValue')}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveInsertItem}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {isSaving ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-1"></i>插入中...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-1"></i>插入
                  </>
                )}
              </button>
              <button
                onClick={handleCancelInsert}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <i className="fas fa-times mr-1"></i>{t('listKeyDetail.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto flex flex-col">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">{t('listKeyDetail.editData', { index: editingItem.index })}</h3>
            <button
              onClick={handleCancelEdit}
              className="text-gray-400 hover:text-gray-600 text-lg"
              title={t('streamKeyDetail.close')}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          <div className="mb-4 flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('listKeyDetail.dataValue')}</label>
            <textarea
              value={editingItem.value}
              onChange={(e) => setEditingItem({ ...editingItem, value: e.target.value })}
              className="w-full h-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent resize-none font-mono"
              placeholder={t('streamKeyDetail.enterDataValue')}
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
                  <i className="fas fa-spinner fa-spin mr-1"></i>保存中...
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-1"></i>保存
                </>
              )}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              <i className="fas fa-times mr-1"></i>{t('listKeyDetail.cancel')}
            </button>
          </div>
        </div>
      )}

      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        title={t('streamKeyDetail.entries')}
        content={pendingDeleteIndex !== null ? t('listKeyDetail.entryNumber', { index: pendingDeleteIndex }) : ''}
        onConfirm={executeDeleteItem}
        onCancel={() => setDeleteConfirmOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default ListKeyDetail;
