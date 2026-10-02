import React, { useState } from 'react';
import { X, Wifi, QrCode, Copy, Check, Hash, Sparkles, RefreshCw } from 'lucide-react';

interface RoomModalProps {
  currentRoom: string;
  isCustom: boolean;
  ipHash: string;
  onSetRoom: (roomName: string | null) => void;
  onClose: () => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  currentRoom,
  isCustom,
  ipHash,
  onSetRoom,
  onClose,
}) => {
  const [customInput, setCustomInput] = useState(
    isCustom ? currentRoom.replace('custom_', '') : ''
  );
  const [copied, setCopied] = useState(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (customInput.trim()) {
      onSetRoom(customInput.trim());
    } else {
      onSetRoom(null);
    }
    onClose();
  };

  const handleResetToAuto = () => {
    setCustomInput('');
    onSetRoom(null);
    onClose();
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    currentUrl
  )}&bgcolor=0f172a&color=38bdf8`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Wifi className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Rede & Sala de Conexão
            </h3>
            <p className="text-xs text-slate-400">
              Dispositivos na mesma sala se descobrem automaticamente
            </p>
          </div>
        </div>

        {/* Modo Atual */}
        <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/70 mb-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">Descoberta Atual:</span>
            <span className="text-xs font-mono font-bold text-cyan-300 px-2 py-0.5 rounded bg-slate-900 border border-slate-700">
              {isCustom ? `Sala Personalizada: ${currentRoom.replace('custom_', '')}` : `Rede Local (Wi-Fi #${ipHash})`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
            {isCustom
              ? 'Você está em uma sala privada. Apenas quem estiver nesta mesma sala verá seu dispositivo.'
              : 'Agrupamento automático baseado na mesma rede Wi-Fi/IP público local.'}
          </p>
        </div>

        {/* QR Code para conectar celular rapidamente */}
        <div className="flex flex-col items-center p-4 rounded-2xl bg-slate-950/70 border border-slate-800 mb-5">
          <div className="w-36 h-36 rounded-xl overflow-hidden bg-slate-900 p-2 border border-slate-700 flex items-center justify-center mb-2">
            <img
              src={qrImageUrl}
              alt="QR Code da Sala"
              className="w-full h-full object-contain rounded-lg"
              onError={(e) => {
                // Fallback caso a API esteja bloqueada
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          </div>
          <p className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
            <QrCode className="w-3.5 h-3.5 text-cyan-400" />
            Aponte a câmera do celular para entrar nesta sala
          </p>
          <button
            onClick={handleCopyLink}
            className="mt-2 text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-mono transition-colors"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Link Copiado!' : 'Copiar Link da Sala'}
          </button>
        </div>

        {/* Formulário de Sala Personalizada */}
        <form onSubmit={handleApplyCustom} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Criar ou Entrar em Sala com Código / PIN:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Ex: escritorio-123 ou 42"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all"
              >
                Entrar
              </button>
            </div>
          </div>

          {isCustom && (
            <button
              type="button"
              onClick={handleResetToAuto}
              className="w-full py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Voltar para Detecção Automática de Wi-Fi
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
