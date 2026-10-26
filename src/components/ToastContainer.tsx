import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full px-4 pointer-events-none">
      {toasts.map((toast) => {
        let bgBorder = 'bg-white border-slate-200 text-slate-800';
        let Icon = Info;
        let iconColor = 'text-blue-600';

        if (toast.type === 'success') {
          bgBorder = 'bg-emerald-50/95 border-emerald-300 text-emerald-950 shadow-emerald-900/10';
          Icon = CheckCircle2;
          iconColor = 'text-emerald-600';
        } else if (toast.type === 'error') {
          bgBorder = 'bg-rose-50/95 border-rose-300 text-rose-950 shadow-rose-900/10';
          Icon = XCircle;
          iconColor = 'text-rose-600';
        } else if (toast.type === 'warning') {
          bgBorder = 'bg-amber-50/95 border-amber-300 text-amber-950 shadow-amber-900/10';
          Icon = AlertTriangle;
          iconColor = 'text-amber-600';
        } else {
          bgBorder = 'bg-slate-50/95 border-slate-300 text-slate-900 shadow-slate-900/10';
          Icon = Info;
          iconColor = 'text-blue-600';
        }

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-200 animate-in fade-in slide-in-from-bottom-2 ${bgBorder}`}
          >
            <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
            <div className="flex-1 text-sm">
              <div className="font-semibold">{toast.title}</div>
              <div className="text-xs mt-0.5 opacity-90 leading-relaxed">{toast.message}</div>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-slate-400 hover:text-slate-700 transition p-0.5 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
