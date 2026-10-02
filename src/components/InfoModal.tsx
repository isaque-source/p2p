import React from 'react';
import { X, ShieldCheck, Zap, HardDrive, Wifi, Lock, Users } from 'lucide-react';

interface InfoModalProps {
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 relative max-h-[85vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Como Funciona o DropP2P
            </h3>
            <p className="text-xs text-slate-400">
              Arquitetura Local-First inspirada em AirDrop e Snapdrop
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs text-slate-300">
          <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-1">
                100% P2P & Privacidade Máxima
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Nenhum arquivo ou byte de dados passa pelo servidor. A transferência é estabelecida diretamente entre navegadores através de <strong>WebRTC DataChannel</strong> com criptografia de ponta a ponta (DTLS/SRTP).
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-1">
                Descoberta Automática na Rede Wi-Fi
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Dispositivos conectados na mesma rede local/Wi-Fi são detectados automaticamente pelo hash de IP do servidor de sinalização. Você também pode criar salas com PIN para emparelhar aparelhos específicos.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 shrink-0">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-1">
                Velocidade Máxima da Rede Local
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Como os arquivos não sobem para a nuvem nem dependem do limite de upload da internet, a transferência roda na velocidade total da sua rede Wi-Fi local (LAN) com chunking inteligente de 64KB e controle de fluxo.
              </p>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-800/70 border border-slate-700/60 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-white text-sm mb-1">
                Multiplataforma Sem Instalação
              </h4>
              <p className="text-slate-400 leading-relaxed">
                Funciona em qualquer navegador moderno (Chrome, Safari, Firefox, Edge) no iPhone, Android, Mac, Windows e Linux sem instalar nenhum aplicativo e sem precisar criar contas.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-colors"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
