import React from 'react';
import { Wifi, ShieldCheck, History, MessageSquare, Info, Sparkles, SlidersHorizontal, Smartphone } from 'lucide-react';
import { PeerInfo } from '../types';

interface HeaderProps {
  selfPeer: PeerInfo;
  activeRoom: string;
  isCustomRoom: boolean;
  historyCount: number;
  onOpenRoomModal: () => void;
  onOpenProfileModal: () => void;
  onOpenHistoryModal: () => void;
  onOpenTextShareModal: () => void;
  onOpenInfoModal: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  selfPeer,
  activeRoom,
  isCustomRoom,
  historyCount,
  onOpenRoomModal,
  onOpenProfileModal,
  onOpenHistoryModal,
  onOpenTextShareModal,
  onOpenInfoModal,
}) => {
  const displayRoomName = isCustomRoom
    ? activeRoom.replace('custom_', 'Sala #')
    : `Rede Local #${selfPeer.ipHash || 'Wi-Fi'}`;

  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-xl px-4 py-3 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Logo & Marca */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-white font-bold ring-1 ring-white/20">
            <span className="text-xl">⚡</span>
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base sm:text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">
                DropP2P
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-cyan-500/20 text-cyan-300 rounded border border-cyan-500/30">
                P2P Local
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Transferência direta de arquivos no navegador estilo AirDrop
            </p>
          </div>
        </div>

        {/* Status de Rede & Botão de Sala */}
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenRoomModal}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700/70 text-xs text-slate-200 transition-all hover:border-cyan-500/40 shadow-sm group"
            title="Alterar sala de descoberta ou escanear QR Code"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <Wifi className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="font-medium max-w-[130px] sm:max-w-[190px] truncate">
              {displayRoomName}
            </span>
            <span className="text-[10px] text-slate-400 bg-slate-700/60 px-1.5 py-0.5 rounded ml-0.5">
              Trocar
            </span>
          </button>
        </div>

        {/* Ações Rápidas & Perfil */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Compartilhar Texto Rápido */}
          <button
            onClick={onOpenTextShareModal}
            className="p-2 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/50 text-xs flex items-center gap-1.5 transition-colors"
            title="Compartilhar texto rápido ou links"
          >
            <MessageSquare className="w-4 h-4 text-cyan-400" />
            <span className="hidden md:inline font-medium">Texto / Link</span>
          </button>

          {/* Histórico */}
          <button
            onClick={onOpenHistoryModal}
            className="relative p-2 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800/60 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700/50 text-xs flex items-center gap-1.5 transition-colors"
            title="Histórico de transferências"
          >
            <History className="w-4 h-4 text-slate-400" />
            <span className="hidden md:inline font-medium">Histórico</span>
            {historyCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-cyan-500 text-slate-950 font-bold text-[10px] rounded-full h-4 w-4 flex items-center justify-center ring-2 ring-slate-900">
                {historyCount}
              </span>
            )}
          </button>

          {/* Como Funciona / Ajuda */}
          <button
            onClick={onOpenInfoModal}
            className="p-2 rounded-lg bg-slate-800/60 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border border-slate-700/50 transition-colors"
            title="Como funciona a tecnologia P2P"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Perfil do Dispositivo Atual */}
          <button
            onClick={onOpenProfileModal}
            className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700/80 text-xs text-white transition-all group"
            title="Clique para editar nome do dispositivo e avatar"
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-sm ring-1 ring-white/20 shadow-sm transition-transform group-hover:scale-105"
              style={{ backgroundColor: selfPeer.avatarColor }}
            >
              {selfPeer.avatarEmoji}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-[11px] font-bold text-slate-200 max-w-[100px] truncate leading-tight">
                {selfPeer.deviceName}
              </p>
              <p className="text-[9px] text-slate-400 leading-tight">
                Você ({selfPeer.os})
              </p>
            </div>
          </button>
        </div>
      </div>
    </header>
  );
};
