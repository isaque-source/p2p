import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Download, CheckCircle2, Eye, X, FileCheck, Share2 } from 'lucide-react';
import { FileMetadata } from '../types';
import { formatBytes } from '../utils/device';

interface SuccessModalProps {
  fileMeta: FileMetadata;
  blobUrl: string;
  senderName: string;
  onClose: () => void;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({
  fileMeta,
  blobUrl,
  senderName,
  onClose,
}) => {
  useEffect(() => {
    // Efeito de confetes festivo ao receber o arquivo
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#06b6d4', '#3b82f6', '#10b981', '#f59e0b'],
      });
    } catch {}
  }, []);

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = fileMeta.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isImage = fileMeta.type.startsWith('image/');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-emerald-500/40 shadow-2xl p-6 relative overflow-hidden text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto mb-4 text-3xl shadow-lg shadow-emerald-500/20">
          <FileCheck className="w-8 h-8 text-emerald-400" />
        </div>

        <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
          Transferência Concluída
        </span>

        <h3 className="text-lg font-bold text-white mt-2 mb-1">
          Arquivo Recebido!
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Enviado diretamente por <strong>{senderName}</strong> via P2P
        </p>

        {/* Prévia da imagem se for imagem */}
        {isImage && (
          <div className="w-full max-h-48 rounded-xl overflow-hidden mb-4 border border-slate-700 bg-slate-950 flex items-center justify-center">
            <img
              src={blobUrl}
              alt={fileMeta.name}
              className="max-h-48 object-contain"
            />
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-left mb-6">
          <p className="text-xs font-semibold text-white truncate" title={fileMeta.name}>
            {fileMeta.name}
          </p>
          <p className="text-[11px] text-cyan-300 font-mono mt-0.5">
            {formatBytes(fileMeta.size)} • {fileMeta.type || 'Binário'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs border border-slate-700 transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={handleDownload}
            className="flex-2 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all"
          >
            <Download className="w-4 h-4" />
            Salvar / Baixar Arquivo
          </button>
        </div>
      </div>
    </div>
  );
};
