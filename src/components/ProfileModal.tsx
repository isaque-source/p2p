import React, { useState } from 'react';
import { X, Check, Smile, Palette, User } from 'lucide-react';
import { PeerInfo } from '../types';

interface ProfileModalProps {
  selfPeer: PeerInfo;
  onUpdateProfile: (updates: { deviceName: string; avatarEmoji: string; avatarColor: string }) => void;
  onClose: () => void;
}

const EMOJIS = ['🐬', '🦅', '🦦', '🦊', '🐼', '🐆', '🦉', '🐺', '🐢', '🐯', '🦁', '🐧', '🚀', '⚡', '💻', '📱'];
const COLORS = [
  '#0ea5e9', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#f43f5e', // rose
  '#f97316', // orange
  '#eab308', // yellow
  '#10b981', // emerald
  '#14b8a6', // teal
  '#64748b', // slate
];

export const ProfileModal: React.FC<ProfileModalProps> = ({
  selfPeer,
  onUpdateProfile,
  onClose,
}) => {
  const [deviceName, setDeviceName] = useState(selfPeer.deviceName);
  const [avatarEmoji, setAvatarEmoji] = useState(selfPeer.avatarEmoji);
  const [avatarColor, setAvatarColor] = useState(selfPeer.avatarColor);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceName.trim()) return;

    localStorage.setItem('dropp2p_device_name', deviceName.trim());
    localStorage.setItem('dropp2p_avatar_emoji', avatarEmoji);
    localStorage.setItem('dropp2p_avatar_color', avatarColor);

    onUpdateProfile({
      deviceName: deviceName.trim(),
      avatarEmoji,
      avatarColor,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-md rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-base font-bold text-white mb-1">
          Identidade do Dispositivo
        </h3>
        <p className="text-xs text-slate-400 mb-5">
          Como os outros aparelhos na rede verão você no radar
        </p>

        {/* Prévia do Avatar */}
        <div className="flex flex-col items-center justify-center mb-6">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-4xl shadow-xl ring-4 ring-white/10 mb-2 transition-transform duration-200"
            style={{ backgroundColor: avatarColor }}
          >
            {avatarEmoji}
          </div>
          <span className="text-xs text-slate-400">Prévia do Avatar</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Nome do Dispositivo:
            </label>
            <input
              type="text"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              placeholder="Ex: MacBook do Alex"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white focus:outline-none focus:border-cyan-500"
              maxLength={35}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Escolha seu Emoji / Mascote:
            </label>
            <div className="grid grid-cols-8 gap-2">
              {EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setAvatarEmoji(emoji)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-transform ${
                    avatarEmoji === emoji
                      ? 'bg-slate-700 ring-2 ring-cyan-400 scale-110'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Cor do Avatar:
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setAvatarColor(color)}
                  className={`w-7 h-7 rounded-full transition-transform ${
                    avatarColor === color ? 'ring-2 ring-white scale-125' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all"
            >
              Salvar Perfil
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
