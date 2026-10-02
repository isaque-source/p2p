import React, { useEffect, useState } from 'react';
import { Download, X, Check, FileText, Image as ImageIcon, Video, Music, Archive, File } from 'lucide-react';
import { IncomingTransferRequest } from '../types';
import { formatBytes, getFileCategoryIcon } from '../utils/device';

interface IncomingModalProps {
  request: IncomingTransferRequest;
  onAccept: (request: IncomingTransferRequest) => void;
  onDecline: (request: IncomingTransferRequest) => void;
}

export const IncomingModal: React.FC<IncomingModalProps> = ({
  request,
  onAccept,
  onDecline,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(45);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDecline(request);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [request, onDecline]);

  const category = getFileCategoryIcon(request.fileInfo.type, request.fileInfo.name);

  const renderFileIcon = () => {
    switch (category) {
      case 'image':
        return <ImageIcon className="w-8 h-8 text-cyan-400" />;
      case 'video':
        return <Video className="w-8 h-8 text-purple-400" />;
      case 'audio':
        return <Music className="w-8 h-8 text-pink-400" />;
      case 'archive':
        return <Archive className="w-8 h-8 text-amber-400" />;
      case 'document':
        return <FileText className="w-8 h-8 text-blue-400" />;
      default:
        return <File className="w-8 h-8 text-slate-300" />;
    }
  };

  const progressPercent = (secondsLeft / 45) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 relative overflow-hidden animate-scale-up">
        {/* Barra de tempo restante no topo */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-800">
          <div
            className="h-full bg-cyan-400 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Cabeçalho com dados do remetente */}
        <div className="flex items-center gap-3.5 mb-5 pb-4 border-b border-slate-800">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shadow-lg ring-2 ring-white/10"
            style={{ backgroundColor: request.sender.avatarColor }}
          >
            {request.sender.avatarEmoji}
          </div>
          <div>
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider">
              Solicitação de Arquivo AirDrop
            </span>
            <h3 className="text-base font-bold text-white leading-tight">
              {request.sender.deviceName}
            </h3>
            <p className="text-xs text-slate-400">
              {request.sender.os} • Na mesma rede
            </p>
          </div>
        </div>

        {/* Cartão de Detalhes do Arquivo */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/70 border border-slate-700/60 mb-6">
          <div className="w-14 h-14 rounded-xl bg-slate-900/90 border border-slate-700 flex items-center justify-center shrink-0">
            {renderFileIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white truncate" title={request.fileInfo.name}>
              {request.fileInfo.name}
            </h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-cyan-300 font-medium">
                {formatBytes(request.fileInfo.size)}
              </span>
              <span className="text-slate-600">•</span>
              <span className="text-[11px] text-slate-400 truncate uppercase">
                {request.fileInfo.type.split('/')[1] || 'Arquivo'}
              </span>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => onDecline(request)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold text-sm transition-colors border border-slate-700"
          >
            <X className="w-4 h-4" />
            Recusar
          </button>

          <button
            onClick={() => onAccept(request)}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-cyan-500/25"
          >
            <Download className="w-4 h-4" />
            Aceitar ({secondsLeft}s)
          </button>
        </div>
      </div>
    </div>
  );
};
