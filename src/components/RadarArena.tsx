import React, { useRef, useState } from 'react';
import {
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  UploadCloud,
  QrCode,
  Copy,
  ExternalLink,
  Check,
  Send,
  Sparkles,
  Wifi,
  FileUp,
} from 'lucide-react';
import { PeerInfo, ActiveTransfer } from '../types';

interface RadarArenaProps {
  peers: PeerInfo[];
  selfPeer: PeerInfo;
  activeTransfers: Map<string, ActiveTransfer>;
  onSelectFileForPeer: (peer: PeerInfo) => void;
  onDropFileOnPeer: (peer: PeerInfo, file: File) => void;
  onOpenRoomModal: () => void;
  onSendTextToPeer: (peer: PeerInfo) => void;
  isDraggingFile: boolean;
}

export const RadarArena: React.FC<RadarArenaProps> = ({
  peers,
  selfPeer,
  activeTransfers,
  onSelectFileForPeer,
  onDropFileOnPeer,
  onOpenRoomModal,
  onSendTextToPeer,
  isDraggingFile,
}) => {
  const [hoveredPeerId, setHoveredPeerId] = useState<string | null>(null);
  const [dragOverPeerId, setDragOverPeerId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="w-3.5 h-3.5" />;
      case 'tablet':
        return <Tablet className="w-3.5 h-3.5" />;
      default:
        return <Laptop className="w-3.5 h-3.5" />;
    }
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleOpenNewTab = () => {
    if (typeof window !== 'undefined') {
      window.open(window.location.href, '_blank');
    }
  };

  return (
    <div className="relative w-full flex-1 flex flex-col items-center justify-center min-h-[500px] overflow-hidden px-4 py-8 select-none">
      {/* Círculos concêntricos de radar de fundo */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {/* Onda 1 */}
        <div className="radar-circle absolute w-[260px] h-[260px] sm:w-[380px] sm:h-[380px] md:w-[480px] md:h-[480px] rounded-full border border-cyan-500/20" />
        {/* Onda 2 */}
        <div className="radar-circle radar-circle-delay-1 absolute w-[260px] h-[260px] sm:w-[380px] sm:h-[380px] md:w-[480px] md:h-[480px] rounded-full border border-cyan-400/25" />
        {/* Onda 3 */}
        <div className="radar-circle radar-circle-delay-2 absolute w-[260px] h-[260px] sm:w-[380px] sm:h-[380px] md:w-[480px] md:h-[480px] rounded-full border border-blue-500/20" />

        {/* Anéis estáticos de referência */}
        <div className="absolute w-[220px] h-[220px] rounded-full border border-slate-800/80" />
        <div className="absolute w-[400px] h-[400px] rounded-full border border-slate-800/60" />
        <div className="absolute w-[600px] h-[600px] rounded-full border border-slate-800/40 hidden sm:block" />
        <div className="absolute w-[800px] h-[800px] rounded-full border border-slate-800/20 hidden md:block" />

        {/* Linhas cruzadas sutis do radar */}
        <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-slate-800/50 to-transparent" />
        <div className="absolute h-full w-[1px] bg-gradient-to-b from-transparent via-slate-800/50 to-transparent" />
      </div>

      {/* Indicador superior de instrução */}
      <div className="z-10 mb-auto text-center max-w-md px-4">
        {peers.length > 0 ? (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-700/60 text-xs text-slate-300 backdrop-blur-md shadow-md animate-fade-in">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span>
              {peers.length} {peers.length === 1 ? 'dispositivo online' : 'dispositivos online'} na rede. Clique ou arraste um arquivo para enviar.
            </span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/70 border border-slate-800 text-xs text-slate-400 backdrop-blur-md">
            <Wifi className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Radar ativo escutando a rede local...</span>
          </div>
        )}
      </div>

      {/* ÁREA CENTRAL DO RADAR: DISPOSITIVOS */}
      <div className="z-10 w-full max-w-4xl my-auto flex flex-col items-center justify-center min-h-[300px]">
        {peers.length === 0 ? (
          // Estado vazio: radar procurando outros dispositivos
          <div className="flex flex-col items-center text-center max-w-sm px-6 py-8 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl relative">
            <div className="relative mb-5">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500/20 to-blue-500/10 flex items-center justify-center ring-1 ring-cyan-500/30">
                <Wifi className="w-9 h-9 text-cyan-400 animate-pulse" />
              </div>
              <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs">
                🔍
              </span>
            </div>

            <h3 className="text-base sm:text-lg font-bold text-white mb-1.5">
              Procurando dispositivos...
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-5 leading-relaxed">
              Dispositivos na mesma rede Wi-Fi aparecerão aqui automaticamente.
            </p>

            <div className="w-full p-3 rounded-xl bg-slate-800/50 border border-slate-700/60 mb-4 text-left">
              <p className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5 mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                Como testar agora:
              </p>
              <p className="text-[11px] text-slate-300 leading-normal">
                Abra esta mesma página em <strong>outra aba</strong>, na janela anônima ou no seu celular para ver a descoberta instantânea!
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 w-full">
              <button
                onClick={handleOpenNewTab}
                className="flex-1 min-w-[120px] flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-lg shadow-cyan-500/20"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Abrir em Nova Aba
              </button>

              <button
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                title="Copiar URL"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLink ? 'Copiado!' : 'Copiar Link'}
              </button>

              <button
                onClick={onOpenRoomModal}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
                title="Exibir QR Code e Sala"
              >
                <QrCode className="w-3.5 h-3.5 text-slate-300" />
                QR Code
              </button>
            </div>
          </div>
        ) : (
          // Dispositivos encontrados: grade / órbita elegante de nós
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 w-full max-w-3xl justify-items-center">
            {peers.map((peer) => {
              // Verifica se há transferência ativa com este par
              let activeTransfer: ActiveTransfer | undefined;
              for (const transfer of activeTransfers.values()) {
                if (transfer.peerSocketId === peer.id && ['transferring', 'connecting', 'waiting_approval'].includes(transfer.status)) {
                  activeTransfer = transfer;
                  break;
                }
              }

              const isDragOver = dragOverPeerId === peer.id;
              const isTransferring = activeTransfer?.status === 'transferring';
              const isWaiting = activeTransfer?.status === 'waiting_approval';

              return (
                <div
                  key={peer.id}
                  onMouseEnter={() => setHoveredPeerId(peer.id)}
                  onMouseLeave={() => setHoveredPeerId(null)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverPeerId(peer.id);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (dragOverPeerId === peer.id) setDragOverPeerId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverPeerId(null);
                    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                      onDropFileOnPeer(peer, e.dataTransfer.files[0]);
                    }
                  }}
                  className={`relative flex flex-col items-center p-5 rounded-3xl transition-all duration-300 cursor-pointer w-full max-w-[240px] group ${
                    isDragOver
                      ? 'bg-cyan-500/20 border-2 border-cyan-400 scale-105 shadow-2xl shadow-cyan-500/30'
                      : isDraggingFile
                      ? 'bg-slate-900/80 border-2 border-dashed border-cyan-500/60 scale-102 hover:scale-105'
                      : 'bg-slate-900/70 hover:bg-slate-800/80 border border-slate-700/60 hover:border-cyan-500/40 shadow-xl'
                  }`}
                  onClick={() => {
                    if (!activeTransfer) {
                      onSelectFileForPeer(peer);
                    }
                  }}
                >
                  {/* Círculo com Anel de Progresso SVG (AirDrop Style) */}
                  <div className="relative mb-3 flex items-center justify-center">
                    {/* Anel SVG de progresso quando transferindo */}
                    {activeTransfer && (
                      <svg className="absolute -inset-2.5 w-[84px] h-[84px] -rotate-90 pointer-events-none">
                        <circle
                          cx="42"
                          cy="42"
                          r="36"
                          className="stroke-slate-800"
                          strokeWidth="4"
                          fill="transparent"
                        />
                        <circle
                          cx="42"
                          cy="42"
                          r="36"
                          className="stroke-cyan-400 transition-all duration-150"
                          strokeWidth="4"
                          strokeDasharray={226.2}
                          strokeDashoffset={226.2 - (226.2 * activeTransfer.progress) / 100}
                          strokeLinecap="round"
                          fill="transparent"
                        />
                      </svg>
                    )}

                    {/* Avatar do Dispositivo */}
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl shadow-lg ring-2 transition-transform ${
                        isDragOver
                          ? 'ring-cyan-300 scale-110'
                          : 'ring-white/20 group-hover:scale-105'
                      }`}
                      style={{ backgroundColor: peer.avatarColor }}
                    >
                      {peer.avatarEmoji}
                    </div>

                    {/* Indicador de SO / Dispositivo flutuante */}
                    <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-slate-800 border border-slate-600 text-slate-200 shadow-md">
                      {getDeviceIcon(peer.deviceType)}
                    </div>

                    {/* Ponto verde de status online */}
                    <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-slate-900"></span>
                    </span>
                  </div>

                  {/* Nome do Dispositivo */}
                  <h4 className="text-sm font-bold text-white text-center line-clamp-1 group-hover:text-cyan-300 transition-colors">
                    {peer.deviceName}
                  </h4>

                  {/* Detalhes de SO e Tipo */}
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                    <span>{peer.os}</span>
                    <span>•</span>
                    <span className="capitalize">{peer.deviceType}</span>
                  </p>

                  {/* Status ou Ação sugerida */}
                  <div className="mt-3 w-full">
                    {isWaiting ? (
                      <div className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-[11px] font-semibold text-amber-300 text-center animate-pulse">
                        Aguardando aceite...
                      </div>
                    ) : isTransferring ? (
                      <div className="w-full">
                        <div className="flex justify-between text-[10px] text-cyan-300 font-mono mb-1">
                          <span>{activeTransfer?.direction === 'send' ? 'Enviando...' : 'Recebendo...'}</span>
                          <span>{activeTransfer?.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-cyan-400 rounded-full transition-all duration-150"
                            style={{ width: `${activeTransfer?.progress}%` }}
                          />
                        </div>
                      </div>
                    ) : isDragOver ? (
                      <div className="px-2.5 py-1 rounded-full bg-cyan-500 text-slate-950 font-bold text-[11px] text-center shadow-md animate-bounce">
                        Solte para Enviar!
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-[11px] font-semibold text-cyan-400/90 group-hover:text-cyan-300 flex items-center gap-1">
                          <FileUp className="w-3.5 h-3.5" />
                          Enviar Arquivo
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSendTextToPeer(peer);
                          }}
                          className="p-1 rounded-md hover:bg-slate-700/80 text-slate-400 hover:text-white transition-colors"
                          title="Enviar texto ou link"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* RODAPÉ DO RADAR: SEU PRÓPRIO DISPOSITIVO */}
      <div className="z-10 mt-auto pt-6 flex flex-col items-center">
        <div className="relative group flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/90 border border-slate-700/80 backdrop-blur-md shadow-lg">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-base shadow-sm ring-1 ring-white/20"
            style={{ backgroundColor: selfPeer.avatarColor }}
          >
            {selfPeer.avatarEmoji}
          </div>
          <div className="text-left">
            <p className="text-xs font-bold text-slate-200">
              {selfPeer.deviceName} <span className="text-[10px] text-cyan-400 font-normal">(Você)</span>
            </p>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Visível para dispositivos na mesma rede
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
