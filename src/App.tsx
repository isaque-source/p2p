/**
 * Aplicação Principal DropP2P
 * Interface SPA responsiva estilo Apple AirDrop / Snapdrop
 * Integração WebRTC P2P DataChannel + Sinalização Socket.io
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { Header } from './components/Header';
import { RadarArena } from './components/RadarArena';
import { IncomingModal } from './components/IncomingModal';
import { TransferDrawer } from './components/TransferDrawer';
import { SuccessModal } from './components/SuccessModal';
import { RoomModal } from './components/RoomModal';
import { ProfileModal } from './components/ProfileModal';
import { TextShareModal } from './components/TextShareModal';
import { HistoryModal } from './components/HistoryModal';
import { InfoModal } from './components/InfoModal';

import {
  PeerInfo,
  ActiveTransfer,
  IncomingTransferRequest,
  TransferHistoryItem,
  SharedTextItem,
  FileMetadata,
} from './types';
import { generateInitialIdentity, detectDevice } from './utils/device';
import { playChime } from './utils/audio';
import { WebRTCConnection, CHUNK_SIZE } from './services/webrtc';

export default function App() {
  // Identidade do próprio dispositivo
  const [selfPeer, setSelfPeer] = useState<PeerInfo>(() => {
    const init = generateInitialIdentity();
    return {
      id: '',
      peerId: init.peerId,
      deviceName: init.deviceName,
      deviceType: init.deviceType,
      os: init.os,
      avatarColor: init.avatarColor,
      avatarEmoji: init.avatarEmoji,
      room: '',
      ipHash: '',
      joinedAt: Date.now(),
    };
  });

  // Sala ativa e configuração de rede
  const [activeRoom, setActiveRoom] = useState<string>('');
  const [isCustomRoom, setIsCustomRoom] = useState(false);
  const [networkIpHash, setNetworkIpHash] = useState('');

  // Pares conectados na mesma rede/sala
  const [peers, setPeers] = useState<PeerInfo[]>([]);

  // Transferências e solicitações
  const [incomingRequest, setIncomingRequest] = useState<IncomingTransferRequest | null>(null);
  const [activeTransfers, setActiveTransfers] = useState<Map<string, ActiveTransfer>>(new Map());
  const [history, setHistory] = useState<TransferHistoryItem[]>([]);
  const [sharedTexts, setSharedTexts] = useState<SharedTextItem[]>([]);

  // Modal de sucesso de recebimento
  const [completedModalData, setCompletedModalData] = useState<{
    fileMeta: FileMetadata;
    blobUrl: string;
    senderName: string;
  } | null>(null);

  // Estados dos Modais
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isTextShareModalOpen, setIsTextShareModalOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [selectedPeerForText, setSelectedPeerForText] = useState<PeerInfo | null>(null);

  // Drag & drop global
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounterRef = useRef(0);

  // Referência para conexões WebRTC ativas indexadas por socketId do par
  const rtcConnectionsRef = useRef<Map<string, WebRTCConnection>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetPeerForFileRef = useRef<PeerInfo | null>(null);

  // Envia sinal WebRTC pelo socket
  const sendSignal = useCallback((targetSocketId: string, signal: any, fileMeta?: any) => {
    if (socketRef.current) {
      socketRef.current.emit('signal', {
        to: targetSocketId,
        signal,
        fileMeta,
      });
    }
  }, []);

  // Obtém ou cria uma instância de WebRTCConnection para um par específico
  const getOrCreateConnection = useCallback((peerSocketId: string): WebRTCConnection => {
    let conn = rtcConnectionsRef.current.get(peerSocketId);
    if (!conn) {
      conn = new WebRTCConnection(peerSocketId, sendSignal);
      rtcConnectionsRef.current.set(peerSocketId, conn);
    }
    return conn;
  }, [sendSignal]);

  // Fecha e remove conexão WebRTC
  const removeConnection = useCallback((peerSocketId: string) => {
    const conn = rtcConnectionsRef.current.get(peerSocketId);
    if (conn) {
      conn.close();
      rtcConnectionsRef.current.delete(peerSocketId);
    }
  }, []);

  // Extrai sala da URL se houver hash (ex: #room=minha-sala)
  const getCustomRoomFromUrl = useCallback(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      const match = window.location.hash.match(/#room=([^&]+)/);
      if (match && match[1]) {
        return decodeURIComponent(match[1]);
      }
    }
    return undefined;
  }, []);

  // ==========================================
  // INICIALIZAÇÃO DO SOCKET E SINALIZAÇÃO
  // ==========================================
  useEffect(() => {
    const initialCustomRoom = getCustomRoomFromUrl();
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[DropP2P] Conectado ao servidor de sinalização:', socket.id);

      socket.emit('join-room', {
        peerId: selfPeer.peerId,
        deviceName: selfPeer.deviceName,
        deviceType: selfPeer.deviceType,
        os: selfPeer.os,
        avatarColor: selfPeer.avatarColor,
        avatarEmoji: selfPeer.avatarEmoji,
        customRoom: initialCustomRoom,
      });
    });

    socket.on('room-joined', (data: {
      self: PeerInfo;
      roomName: string;
      ipHash: string;
      peers: PeerInfo[];
    }) => {
      setSelfPeer((prev) => ({
        ...prev,
        id: data.self.id,
        room: data.roomName,
        ipHash: data.ipHash,
      }));
      setActiveRoom(data.roomName);
      setIsCustomRoom(data.roomName.startsWith('custom_'));
      setNetworkIpHash(data.ipHash);
      setPeers(data.peers);
    });

    socket.on('peer-joined', (newPeer: PeerInfo) => {
      setPeers((prev) => {
        if (prev.some((p) => p.id === newPeer.id)) return prev;
        playChime('pop');
        return [...prev, newPeer];
      });
    });

    socket.on('peer-updated', (updatedPeer: PeerInfo) => {
      setPeers((prev) => prev.map((p) => (p.id === updatedPeer.id ? updatedPeer : p)));
    });

    socket.on('peer-left', (leftPeer: { socketId: string; peerId: string; deviceName?: string }) => {
      setPeers((prev) => prev.filter((p) => p.id !== leftPeer.socketId));
      removeConnection(leftPeer.socketId);
    });

    // Recebimento de sinais WebRTC (SDP Offer/Answer/Candidate)
    socket.on('signal', async (data: { from: string; signal: any; fileMeta?: any }) => {
      const conn = getOrCreateConnection(data.from);

      if (data.signal.type === 'offer') {
        const answer = await conn.handleOffer(data.signal);
        sendSignal(data.from, answer);
      } else if (data.signal.type === 'answer') {
        await conn.handleAnswer(data.signal);
      } else if (data.signal.type === 'candidate' && data.signal.candidate) {
        await conn.addIceCandidate(data.signal.candidate);
      }
    });

    // Solicitação de recebimento de arquivo (AirDrop Request)
    socket.on('transfer-request', (data: {
      from: string;
      sender: PeerInfo;
      fileInfo: FileMetadata;
    }) => {
      playChime('request');
      setIncomingRequest({
        id: data.fileInfo.id,
        fromSocketId: data.from,
        sender: data.sender,
        fileInfo: data.fileInfo,
        timestamp: Date.now(),
      });
    });

    // Resposta de aceite ou recusa do destinatário
    socket.on('transfer-response', async (data: {
      from: string;
      fileId: string;
      accepted: boolean;
      reason?: string;
    }) => {
      setActiveTransfers((prev) => {
        const next = new Map(prev);
        const transfer = next.get(data.fileId);
        if (transfer) {
          if (!data.accepted) {
            playChime('decline');
            transfer.status = 'declined';
            transfer.errorMessage = data.reason || 'O destinatário recusou o arquivo.';
          } else {
            transfer.status = 'connecting';
          }
          next.set(data.fileId, { ...transfer });
        }
        return next;
      });

      // Se foi aceito, o remetente inicia a conexão WebRTC e transmite o arquivo!
      if (data.accepted) {
        const transfer = activeTransfers.get(data.fileId);
        if (transfer && transfer.file) {
          try {
            const conn = getOrCreateConnection(data.from);
            const offer = await conn.createOffer();
            sendSignal(data.from, offer, transfer.fileInfo);

            // Atualiza status para transferindo
            setActiveTransfers((prev) => {
              const next = new Map(prev);
              const cur = next.get(data.fileId);
              if (cur) {
                cur.status = 'transferring';
                next.set(data.fileId, { ...cur });
              }
              return next;
            });

            // Inicia envio dos pedaços de 64KB com controle de fluxo
            await conn.sendFile(transfer.file, transfer.fileInfo, (progress, bytesTransferred, speedBps) => {
              const remainingBytes = transfer.fileInfo.size - bytesTransferred;
              const remainingSecs = speedBps > 0 ? remainingBytes / speedBps : 0;

              setActiveTransfers((p) => {
                const n = new Map(p);
                const item = n.get(data.fileId);
                if (item) {
                  item.progress = progress;
                  item.bytesTransferred = bytesTransferred;
                  item.speedBps = speedBps;
                  item.remainingSeconds = remainingSecs;
                  n.set(data.fileId, { ...item });
                }
                return n;
              });
            });

            // Transferência completa pelo remetente
            playChime('success');
            setActiveTransfers((p) => {
              const n = new Map(p);
              const item = n.get(data.fileId);
              if (item) {
                item.status = 'completed';
                item.progress = 100;
                item.completedTime = Date.now();
                n.set(data.fileId, { ...item });
              }
              return n;
            });

            // Registra no histórico
            setHistory((h) => [
              {
                id: data.fileId,
                direction: 'send',
                fileName: transfer.fileInfo.name,
                fileSize: transfer.fileInfo.size,
                fileType: transfer.fileInfo.type,
                peerName: transfer.peerName,
                timestamp: Date.now(),
                status: 'completed',
              },
              ...h,
            ]);
          } catch (err: any) {
            console.error('Erro durante envio WebRTC:', err);
            setActiveTransfers((p) => {
              const n = new Map(p);
              const item = n.get(data.fileId);
              if (item) {
                item.status = 'error';
                item.errorMessage = err.message || 'Falha na conexão P2P';
                n.set(data.fileId, { ...item });
              }
              return n;
            });
          }
        }
      }
    });

    // Cancelamento
    socket.on('transfer-cancel', (data: { from: string; fileId: string }) => {
      setActiveTransfers((prev) => {
        const next = new Map(prev);
        const item = next.get(data.fileId);
        if (item) {
          item.status = 'cancelled';
          item.errorMessage = 'Transferência cancelada pelo outro dispositivo.';
          next.set(data.fileId, { ...item });
        }
        return next;
      });
      const conn = rtcConnectionsRef.current.get(data.from);
      if (conn) conn.cancelTransfer();
    });

    // Recebimento de texto rápido compartilhado
    socket.on('text-share', (data: { from: string; sender: PeerInfo; text: string; timestamp: number }) => {
      playChime('request');
      setSharedTexts((prev) => [
        {
          id: `txt_${Date.now()}_${Math.random()}`,
          fromName: data.sender.deviceName,
          text: data.text,
          timestamp: data.timestamp || Date.now(),
        },
        ...prev,
      ]);
      setIsTextShareModalOpen(true);
    });

    return () => {
      socket.disconnect();
      for (const conn of rtcConnectionsRef.current.values()) {
        conn.close();
      }
      rtcConnectionsRef.current.clear();
    };
  }, [getCustomRoomFromUrl, getOrCreateConnection, removeConnection, sendSignal]);

  // ==========================================
  // ACEITAR OU RECUSAR TRANSFERÊNCIA (DESTINATÁRIO)
  // ==========================================

  const handleAcceptTransfer = (req: IncomingTransferRequest) => {
    setIncomingRequest(null);

    // Registra transferência ativa como recebimento
    const transferId = req.fileInfo.id;
    const newTransfer: ActiveTransfer = {
      id: transferId,
      direction: 'receive',
      peerSocketId: req.fromSocketId,
      peerName: req.sender.deviceName,
      peerAvatarEmoji: req.sender.avatarEmoji,
      fileInfo: req.fileInfo,
      status: 'transferring',
      progress: 0,
      bytesTransferred: 0,
      speedBps: 0,
      remainingSeconds: 0,
      startTime: Date.now(),
    };

    setActiveTransfers((prev) => new Map(prev).set(transferId, newTransfer));

    // Configura os ouvintes do WebRTCConnection para receber os pedaços
    const conn = getOrCreateConnection(req.fromSocketId);
    conn.setReceiverCallbacks({
      onProgress: (progress, bytesTransferred, speedBps) => {
        const remainingBytes = req.fileInfo.size - bytesTransferred;
        const remainingSecs = speedBps > 0 ? remainingBytes / speedBps : 0;

        setActiveTransfers((p) => {
          const next = new Map(p);
          const item = next.get(transferId);
          if (item) {
            item.progress = progress;
            item.bytesTransferred = bytesTransferred;
            item.speedBps = speedBps;
            item.remainingSeconds = remainingSecs;
            next.set(transferId, { ...item });
          }
          return next;
        });
      },
      onComplete: (blob, meta) => {
        playChime('success');
        const blobUrl = URL.createObjectURL(blob);

        setActiveTransfers((p) => {
          const next = new Map(p);
          const item = next.get(transferId);
          if (item) {
            item.status = 'completed';
            item.progress = 100;
            item.blobUrl = blobUrl;
            item.completedTime = Date.now();
            next.set(transferId, { ...item });
          }
          return next;
        });

        // Exibe modal de celebração com download automático/imediato
        setCompletedModalData({
          fileMeta: meta,
          blobUrl,
          senderName: req.sender.deviceName,
        });

        // Registra no histórico
        setHistory((h) => [
          {
            id: transferId,
            direction: 'receive',
            fileName: meta.name,
            fileSize: meta.size,
            fileType: meta.type,
            peerName: req.sender.deviceName,
            timestamp: Date.now(),
            blobUrl,
            status: 'completed',
          },
          ...h,
        ]);
      },
      onError: (err) => {
        console.error('Erro na recepção do arquivo:', err);
        setActiveTransfers((p) => {
          const next = new Map(p);
          const item = next.get(transferId);
          if (item) {
            item.status = 'error';
            item.errorMessage = err.message || 'Erro na transferência';
            next.set(transferId, { ...item });
          }
          return next;
        });
      },
    });

    // Envia resposta positiva ao remetente
    if (socketRef.current) {
      socketRef.current.emit('transfer-response', {
        to: req.fromSocketId,
        fileId: transferId,
        accepted: true,
      });
    }
  };

  const handleDeclineTransfer = (req: IncomingTransferRequest) => {
    setIncomingRequest(null);
    playChime('decline');

    if (socketRef.current) {
      socketRef.current.emit('transfer-response', {
        to: req.fromSocketId,
        fileId: req.fileInfo.id,
        accepted: false,
        reason: 'Transferência recusada pelo destinatário.',
      });
    }
  };

  // ==========================================
  // INICIAR ENVIO DE ARQUIVO (REMETENTE)
  // ==========================================

  const startFileTransfer = (targetPeer: PeerInfo, file: File) => {
    const fileId = `file_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const fileMeta: FileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
      totalChunks,
      lastModified: file.lastModified,
    };

    const newTransfer: ActiveTransfer = {
      id: fileId,
      direction: 'send',
      peerSocketId: targetPeer.id,
      peerName: targetPeer.deviceName,
      peerAvatarEmoji: targetPeer.avatarEmoji,
      fileInfo: fileMeta,
      file,
      status: 'waiting_approval',
      progress: 0,
      bytesTransferred: 0,
      speedBps: 0,
      remainingSeconds: 0,
      startTime: Date.now(),
    };

    setActiveTransfers((prev) => new Map(prev).set(fileId, newTransfer));

    // Envia solicitação pelo socket de sinalização para aparecer o modal no destinatário
    if (socketRef.current) {
      socketRef.current.emit('transfer-request', {
        to: targetPeer.id,
        fileInfo: fileMeta,
      });
    }
  };

  // Clique em um par abre o seletor nativo de arquivo
  const handleSelectFileForPeer = (peer: PeerInfo) => {
    targetPeerForFileRef.current = peer;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    const targetPeer = targetPeerForFileRef.current;
    if (files && files.length > 0 && targetPeer) {
      startFileTransfer(targetPeer, files[0]);
    }
  };

  // Soltar arquivo sobre o ícone do par
  const handleDropFileOnPeer = (peer: PeerInfo, file: File) => {
    playChime('pop');
    startFileTransfer(peer, file);
  };

  // Cancelar transferência em andamento
  const handleCancelTransfer = (transferId: string) => {
    const transfer = activeTransfers.get(transferId);
    if (!transfer) return;

    if (socketRef.current) {
      socketRef.current.emit('transfer-cancel', {
        to: transfer.peerSocketId,
        fileId: transferId,
      });
    }

    const conn = rtcConnectionsRef.current.get(transfer.peerSocketId);
    if (conn) conn.cancelTransfer();

    setActiveTransfers((prev) => {
      const next = new Map(prev);
      const item = next.get(transferId);
      if (item) {
        item.status = 'cancelled';
        item.errorMessage = 'Transferência cancelada por você.';
        next.set(transferId, { ...item });
      }
      return next;
    });
  };

  const handleDismissTransfer = (transferId: string) => {
    setActiveTransfers((prev) => {
      const next = new Map(prev);
      next.delete(transferId);
      return next;
    });
  };

  // Envio de texto rápido
  const handleSendText = (targetPeerId: string, text: string) => {
    if (socketRef.current) {
      socketRef.current.emit('text-share', {
        to: targetPeerId,
        text,
      });
    }
  };

  // Alteração de sala / PIN
  const handleSetRoom = (roomName: string | null) => {
    if (typeof window !== 'undefined') {
      if (roomName) {
        window.location.hash = `room=${encodeURIComponent(roomName)}`;
      } else {
        historyRefCleanUrl();
      }
    }

    if (socketRef.current) {
      socketRef.current.emit('join-room', {
        peerId: selfPeer.peerId,
        deviceName: selfPeer.deviceName,
        deviceType: selfPeer.deviceType,
        os: selfPeer.os,
        avatarColor: selfPeer.avatarColor,
        avatarEmoji: selfPeer.avatarEmoji,
        customRoom: roomName || undefined,
      });
    }
  };

  const historyRefCleanUrl = () => {
    if (typeof window !== 'undefined' && window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  // Atualização do Perfil
  const handleUpdateProfile = (updates: {
    deviceName: string;
    avatarEmoji: string;
    avatarColor: string;
  }) => {
    setSelfPeer((prev) => ({ ...prev, ...updates }));
    if (socketRef.current) {
      socketRef.current.emit('update-profile', updates);
    }
  };

  // Drag & drop global na janela inteira
  const handleWindowDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types && e.dataTransfer.types.includes('Files')) {
      setIsDraggingFile(true);
    }
  };

  const handleWindowDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingFile(false);
    }
  };

  const handleWindowDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleWindowDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingFile(false);
  };

  return (
    <div
      onDragEnter={handleWindowDragEnter}
      onDragLeave={handleWindowDragLeave}
      onDragOver={handleWindowDragOver}
      onDrop={handleWindowDrop}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative overflow-x-hidden selection:bg-cyan-500 selection:text-white"
    >
      {/* Input de arquivo invisível para seleção nativa */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
      />

      {/* Cabeçalho */}
      <Header
        selfPeer={selfPeer}
        activeRoom={activeRoom}
        isCustomRoom={isCustomRoom}
        historyCount={history.length}
        onOpenRoomModal={() => setIsRoomModalOpen(true)}
        onOpenProfileModal={() => setIsProfileModalOpen(true)}
        onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
        onOpenTextShareModal={() => {
          setSelectedPeerForText(null);
          setIsTextShareModalOpen(true);
        }}
        onOpenInfoModal={() => setIsInfoModalOpen(true)}
      />

      {/* Arena Central de Radar AirDrop */}
      <main className="flex-1 flex flex-col relative">
        <RadarArena
          peers={peers}
          selfPeer={selfPeer}
          activeTransfers={activeTransfers}
          onSelectFileForPeer={handleSelectFileForPeer}
          onDropFileOnPeer={handleDropFileOnPeer}
          onOpenRoomModal={() => setIsRoomModalOpen(true)}
          onSendTextToPeer={(peer) => {
            setSelectedPeerForText(peer);
            setIsTextShareModalOpen(true);
          }}
          isDraggingFile={isDraggingFile}
        />
      </main>

      {/* Overlay translúcido quando o usuário arrasta qualquer arquivo para a janela */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-40 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-none animate-fade-in border-4 border-dashed border-cyan-400/80 m-3 rounded-3xl">
          <div className="flex flex-col items-center text-center max-w-sm">
            <div className="w-20 h-20 rounded-full bg-cyan-500/20 border border-cyan-400 text-cyan-300 flex items-center justify-center mb-4 animate-bounce">
              <span className="text-3xl">📁</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">
              Solte sobre o dispositivo
            </h3>
            <p className="text-xs text-slate-300">
              Posicione o arquivo sobre o cartão do aparelho de destino para iniciar o envio instantâneo via AirDrop P2P.
            </p>
          </div>
        </div>
      )}

      {/* Gaveta / Floating Drawer de transferências ativas */}
      <TransferDrawer
        transfers={Array.from(activeTransfers.values())}
        onCancelTransfer={handleCancelTransfer}
        onDismissTransfer={handleDismissTransfer}
      />

      {/* Modal de solicitação de recebimento (Aceitar / Recusar) */}
      {incomingRequest && (
        <IncomingModal
          request={incomingRequest}
          onAccept={handleAcceptTransfer}
          onDecline={handleDeclineTransfer}
        />
      )}

      {/* Modal comemorativo de arquivo recebido com sucesso */}
      {completedModalData && (
        <SuccessModal
          fileMeta={completedModalData.fileMeta}
          blobUrl={completedModalData.blobUrl}
          senderName={completedModalData.senderName}
          onClose={() => setCompletedModalData(null)}
        />
      )}

      {/* Modais de controle */}
      {isRoomModalOpen && (
        <RoomModal
          currentRoom={activeRoom}
          isCustom={isCustomRoom}
          ipHash={networkIpHash}
          onSetRoom={handleSetRoom}
          onClose={() => setIsRoomModalOpen(false)}
        />
      )}

      {isProfileModalOpen && (
        <ProfileModal
          selfPeer={selfPeer}
          onUpdateProfile={handleUpdateProfile}
          onClose={() => setIsProfileModalOpen(false)}
        />
      )}

      {isHistoryModalOpen && (
        <HistoryModal
          history={history}
          onClearHistory={() => setHistory([])}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      )}

      {isTextShareModalOpen && (
        <TextShareModal
          peers={peers}
          selectedPeer={selectedPeerForText}
          sharedTexts={sharedTexts}
          onSendText={handleSendText}
          onClose={() => setIsTextShareModalOpen(false)}
        />
      )}

      {isInfoModalOpen && (
        <InfoModal onClose={() => setIsInfoModalOpen(false)} />
      )}
    </div>
  );
}
