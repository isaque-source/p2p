import React from 'react';
import { ArrowUpRight, ArrowDownLeft, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { ActiveTransfer } from '../types';
import { formatBytes, formatSpeed, formatTimeRemaining } from '../utils/device';

interface TransferDrawerProps {
  transfers: ActiveTransfer[];
  onCancelTransfer: (transferId: string) => void;
  onDismissTransfer: (transferId: string) => void;
}

export const TransferDrawer: React.FC<TransferDrawerProps> = ({
  transfers,
  onCancelTransfer,
  onDismissTransfer,
}) => {
  if (transfers.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-96 z-40 flex flex-col gap-2.5 max-h-[80vh] overflow-y-auto pointer-events-none">
      {transfers.map((transfer) => {
        const isSend = transfer.direction === 'send';
        const isCompleted = transfer.status === 'completed';
        const isError = transfer.status === 'error' || transfer.status === 'cancelled' || transfer.status === 'declined';
        const isTransferring = transfer.status === 'transferring';
        const isWaiting = transfer.status === 'waiting_approval' || transfer.status === 'connecting';

        return (
          <div
            key={transfer.id}
            className="pointer-events-auto p-4 rounded-2xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-xl animate-slide-up flex flex-col gap-2.5 relative overflow-hidden"
          >
            {/* Top row: Direction, file name, and dismiss/cancel */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs shrink-0 font-bold ${
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
                  <p className="text-xs font-bold text-white truncate" title={transfer.fileInfo.name}>
                    {transfer.fileInfo.name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {isSend ? `Para: ${transfer.peerName}` : `De: ${transfer.peerName}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isTransferring || isWaiting ? (
                  <button
                    onClick={() => onCancelTransfer(transfer.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                    title="Cancelar transferência"
                  >
                    <X className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={() => onDismissTransfer(transfer.id)}
                    className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                    title="Fechar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden relative">
              <div
                className={`h-full transition-all duration-150 rounded-full ${
                  isCompleted
                    ? 'bg-emerald-400'
                    : isError
                    ? 'bg-rose-500'
                    : 'bg-gradient-to-r from-cyan-500 to-blue-500'
                }`}
                style={{ width: `${transfer.progress}%` }}
              />
            </div>

            {/* Bottom details row: Percentage, bytes, speed, remaining */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-1.5">
                {isWaiting && (
                  <span className="flex items-center gap-1 text-amber-400">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {transfer.status === 'waiting_approval' ? 'Aguardando aceite...' : 'Conectando P2P...'}
                  </span>
                )}
                {isTransferring && (
                  <span className="text-cyan-300 font-semibold">
                    {transfer.progress}% ({formatBytes(transfer.bytesTransferred)} / {formatBytes(transfer.fileInfo.size)})
                  </span>
                )}
                {isCompleted && (
                  <span className="flex items-center gap-1 text-emerald-400 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Concluído com sucesso!
                  </span>
                )}
                {isError && (
                  <span className="flex items-center gap-1 text-rose-400 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {transfer.errorMessage || 'Transferência cancelada/recusada'}
                  </span>
                )}
              </div>

              {isTransferring && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-300">{formatSpeed(transfer.speedBps)}</span>
                  <span>•</span>
                  <span>{formatTimeRemaining(transfer.remainingSeconds)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
