'use client';

import { KafkaToast } from './tab/types';

interface ToastContainerProps {
  toasts: KafkaToast[];
  onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`min-w-[300px] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${
            toast.type === 'success' ? 'bg-green-500 text-white' :
            toast.type === 'error' ? 'bg-red-500 text-white' :
            'bg-blue-500 text-white'
          }`}
          style={{
            animation: 'slideIn 0.3s ease-out'
          }}
        >
          <i className={`fas ${
            toast.type === 'success' ? 'fa-check-circle' :
            toast.type === 'error' ? 'fa-times-circle' :
            'fa-info-circle'
          } text-xl`}></i>
          <span className="flex-1 text-sm font-medium">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            className="text-white/80 hover:text-white transition-colors"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      ))}
    </div>
  );
}
