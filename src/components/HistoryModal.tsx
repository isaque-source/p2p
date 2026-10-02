import React from 'react';
import { X, ArrowUpRight, ArrowDownLeft, Download, Trash2, History } from 'lucide-react';
import { TransferHistoryItem } from '../types';
import { formatBytes } from '../utils/device';

interface HistoryModalProps {
  history: TransferHistoryItem[];
  onClearHistory: () => void;
  onClose: () => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  history,
  onClearHistory,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 relative flex flex-col max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Histórico da Sessão
              </h3>
              <p className="text-xs text-slate-400">
                Arquivos transferidos durante a aba atual
              </p>
            </div>
          </div>

          {history.length > 0 && (
            <button
              onClick={onClearHistory}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 text-xs flex items-center gap-1 transition-colors"
              title="Limpar histórico"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Limpar</span>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
          {history.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Nenhuma transferência registrada nesta sessão ainda.
            </div>
          ) : (
            history.map((item) => {
              const isSend = item.direction === 'send';
              return (
                <div
                  key={item.id}
                  className="p-3 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                        isSend
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {isSend ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate" title={item.fileName}>
                        {item.fileName}
                      </p>
                      <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                        <span>{formatBytes(item.fileSize)}</span>
                        <span>•</span>
                        <span>{isSend ? `Para: ${item.peerName}` : `De: ${item.peerName}`}</span>
                        <span>•</span>
                        <span className="font-mono text-[10px]">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </p>
                    </div>
                  </div>

                  {item.blobUrl && (
                    <a
                      href={item.blobUrl}
                      download={item.fileName}
                      className="p-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-cyan-300 hover:text-white transition-colors shrink-0"
                      title="Baixar arquivo novamente"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
