import React, { useState } from 'react';
import { X, Send, Copy, Check, MessageSquare, ExternalLink } from 'lucide-react';
import { PeerInfo, SharedTextItem } from '../types';

interface TextShareModalProps {
  peers: PeerInfo[];
  selectedPeer: PeerInfo | null;
  sharedTexts: SharedTextItem[];
  onSendText: (targetPeerId: string, text: string) => void;
  onClose: () => void;
}

export const TextShareModal: React.FC<TextShareModalProps> = ({
  peers,
  selectedPeer,
  sharedTexts,
  onSendText,
  onClose,
}) => {
  const [text, setText] = useState('');
  const [targetId, setTargetId] = useState<string>(
    selectedPeer?.id || (peers.length > 0 ? peers[0].id : '')
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !targetId) return;

    onSendText(targetId, text.trim());
    setText('');
  };

  const handleCopy = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const isLink = (str: string) => {
    return /^https?:\/\//i.test(str.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl p-6 relative flex flex-col max-h-[85vh]">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">
              Compartilhar Texto ou Links
            </h3>
            <p className="text-xs text-slate-400">
              Envie notas rápidas, links ou sua área de transferência para outros aparelhos
            </p>
          </div>
        </div>

        {/* Formulário de Envio */}
        <form onSubmit={handleSend} className="space-y-3 mb-4">
          {peers.length > 1 && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Destinatário:
              </label>
              <select
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                {peers.map((peer) => (
                  <option key={peer.id} value={peer.id}>
                    {peer.avatarEmoji} {peer.deviceName} ({peer.os})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cole um link, número, senha ou anotação rápida aqui..."
              rows={3}
              className="w-full p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-mono"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!text.trim() || peers.length === 0}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md"
            >
              <Send className="w-3.5 h-3.5" />
              Enviar Texto
            </button>
          </div>
        </form>

        {/* Mensagens Recebidas nesta Sessão */}
        <div className="flex-1 overflow-y-auto pt-3 border-t border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 mb-2">
            Mensagens Recebidas ({sharedTexts.length})
          </h4>

          {sharedTexts.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Nenhuma mensagem de texto recebida ainda nesta sessão.
            </div>
          ) : (
            <div className="space-y-2.5">
              {sharedTexts.map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 relative group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-semibold text-cyan-300">
                      De: {item.fromName}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(item.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-xs text-slate-100 font-mono break-all whitespace-pre-wrap select-all">
                    {item.text}
                  </p>

                  <div className="mt-2 flex items-center gap-2">
                    <button
                      onClick={() => handleCopy(item.id, item.text)}
                      className="px-2 py-1 rounded bg-slate-700 hover:bg-slate-600 text-[11px] text-slate-200 flex items-center gap-1 font-sans transition-colors"
                    >
                      {copiedId === item.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      {copiedId === item.id ? 'Copiado!' : 'Copiar'}
                    </button>

                    {isLink(item.text) && (
                      <a
                        href={item.text}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded bg-slate-700/80 hover:bg-slate-600 text-[11px] text-cyan-300 flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Abrir Link
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
