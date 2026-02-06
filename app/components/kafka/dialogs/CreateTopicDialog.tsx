'use client';

import { useLanguage } from '../../../../i18n/LanguageContext';

interface CreateTopicDialogProps {
  isOpen: boolean;
  newTopicName: string;
  setNewTopicName: (value: string) => void;
  newTopicPartitions: number;
  setNewTopicPartitions: (value: number) => void;
  newTopicReplication: number;
  setNewTopicReplication: (value: number) => void;
  creatingTopic: boolean;
  onClose: () => void;
  onCreate: () => void;
}

export default function CreateTopicDialog({
  isOpen,
  newTopicName,
  setNewTopicName,
  newTopicPartitions,
  setNewTopicPartitions,
  newTopicReplication,
  setNewTopicReplication,
  creatingTopic,
  onClose,
  onCreate,
}: CreateTopicDialogProps) {
  const { t } = useLanguage();
  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 transition-opacity bg-black/30"
        onClick={onClose}
      ></div>

      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-[0_20px_60px_-12px_rgba(0,0,0,0.25)] w-[500px] h-[420px] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-white rounded-t-lg">
            <h2 className="text-base font-semibold text-gray-900">{t('kafka.createTopicDialogTitle')}</h2>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-md transition-all"
              title="关闭"
            >
              <i className="fas fa-times text-xs"></i>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5 bg-gray-50 min-h-[250px]">
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {t('kafka.topicNameLabel')} *
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] text-gray-900 placeholder:text-gray-400 transition-all"
                  placeholder={t('kafka.topicExamplePlaceholder') || '例如：user-events'}
                  value={newTopicName}
                  onChange={(e) => setNewTopicName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {t('kafka.partitionsLabel')}
                </label>
                <div className="flex items-center border border-gray-200 rounded-md bg-white overflow-hidden w-40">
                  <button
                    onClick={() => setNewTopicPartitions(Math.max(1, newTopicPartitions - 1))}
                    className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                  >
                    <i className="fas fa-minus text-xs"></i>
                  </button>
                  <input
                    type="number"
                    min="1"
                    className="w-20 px-2 py-2 text-sm text-center border-0 focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900 bg-transparent"
                    value={newTopicPartitions}
                    onChange={(e) => setNewTopicPartitions(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                  <button
                    onClick={() => setNewTopicPartitions(newTopicPartitions + 1)}
                    className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                  >
                    <i className="fas fa-plus text-xs"></i>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  {t('kafka.replicationFactorLabel')}
                </label>
                <div className="flex items-center border border-gray-200 rounded-md bg-white overflow-hidden w-40">
                  <button
                    onClick={() => setNewTopicReplication(Math.max(1, Math.min(3, newTopicReplication - 1)))}
                    className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                    disabled={newTopicReplication <= 1}
                  >
                    <i className="fas fa-minus text-xs"></i>
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="3"
                    className="w-20 px-2 py-2 text-sm text-center border-0 focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 text-gray-900 bg-transparent"
                    value={newTopicReplication}
                    onChange={(e) => setNewTopicReplication(Math.max(1, Math.min(3, parseInt(e.target.value) || 1)))}
                  />
                  <button
                    onClick={() => setNewTopicReplication(Math.min(3, newTopicReplication + 1))}
                    className="px-2.5 py-2 text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
                    disabled={newTopicReplication >= 3}
                  >
                    <i className="fas fa-plus text-xs"></i>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end px-5 py-3.5 border-t border-gray-100 bg-white rounded-b-lg">
            <div className="flex items-center gap-2.5">
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-sm text-gray-700 hover:bg-gray-50 rounded-md transition-all"
              >
                {t('kafka.cancelButton')}
              </button>
              <button
                className="px-4 py-1.5 text-sm font-medium bg-[#007acc] text-white rounded-md hover:bg-[#005a9e] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm hover:shadow flex items-center gap-2"
                onClick={onCreate}
                disabled={creatingTopic}
              >
                {creatingTopic && <i className="fas fa-spinner fa-spin text-xs"></i>}
                {creatingTopic ? t('kafka.creating') : t('kafka.createButton')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
