/**
 * Aplicação Principal DropP2P
 * Interface SPA responsiva estilo Apple AirDrop / Snapdrop
 * Integração WebRTC P2P DataChannel + Sinalização Socket.io + Simulador de Teste
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
import { generateInitialIdentity } from './utils/device';
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
  const [realPeers, setRealPeers] = useState<PeerInfo[]>([]);

  // Dispositivo de teste simulado (ativo por padrão para teste imediato de 1 aba!)
  const [isVirtualPeerActive, setIsVirtualPeerActive] = useState(true);

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

  // Referências mutáveis para evitar bugs de stale closures no React
  const transfersRef = useRef<Map<string, ActiveTransfer>>(new Map());
  const rtcConnectionsRef = useRef<Map<string, WebRTCConnection>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetPeerForFileRef = useRef<PeerInfo | null>(null);

  // Dispositivo simulado
  const virtualPeer: PeerInfo = {
    id: 'sim_device_iphone',
    peerId: 'sim_peer_1',
    deviceName: 'iPhone 16 Pro (Simulado)',
    deviceType: 'mobile',
    os: 'iOS',
    avatarEmoji: '📱',
    avatarColor: '#8b5cf6',
    room: activeRoom || 'net_local',
    ipHash: networkIpHash || 'wi-fi',
    joinedAt: Date.now(),
  };

  // Lista combinada de pares reais + virtual (se ativo)
  const allPeers = isVirtualPeerActive ? [...realPeers, virtualPeer] : realPeers;

  // Atualiza tanto o ref quanto o state do React atomicamente
  const updateTransferState = useCallback((id: string, updater: (prev?: ActiveTransfer) => ActiveTransfer | null) => {
    const current = transfersRef.current.get(id);
    const updated = updater(current);
    if (updated === null) {
      transfersRef.current.delete(id);
    } else {
      transfersRef.current.set(id, updated);
    }
    setActiveTransfers(new Map(transfersRef.current));
  }, []);

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

  // Obtém ou cria conexão WebRTC
  const getOrCreateConnection = useCallback((peerSocketId: string): WebRTCConnection => {
    let conn = rtcConnectionsRef.current.get(peerSocketId);
    if (!conn) {
      conn = new WebRTCConnection(peerSocketId, sendSignal);
      rtcConnectionsRef.current.set(peerSocketId, conn);
    }
    return conn;
  }, [sendSignal]);

  const removeConnection = useCallback((peerSocketId: string) => {
    const conn = rtcConnectionsRef.current.get(peerSocketId);
    if (conn) {
      conn.close();
      rtcConnectionsRef.current.delete(peerSocketId);
    }
  }, []);

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
      setRealPeers(data.peers);
    });

    socket.on('peer-joined', (newPeer: PeerInfo) => {
      setRealPeers((prev) => {
        if (prev.some((p) => p.id === newPeer.id)) return prev;
        playChime('pop');
        return [...prev, newPeer];
      });
    });

    socket.on('peer-updated', (updatedPeer: PeerInfo) => {
      setRealPeers((prev) => prev.map((p) => (p.id === updatedPeer.id ? updatedPeer : p)));
    });

    socket.on('peer-left', (leftPeer: { socketId: string; peerId: string; deviceName?: string }) => {
      setRealPeers((prev) => prev.filter((p) => p.id !== leftPeer.socketId));
      removeConnection(leftPeer.socketId);
    });

    // Recebimento de sinais WebRTC (SDP / ICE)
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

    // Resposta de aceite ou recusa do destinatário (RESOLVENDO BUG DE STALE CLOSURE!)
    socket.on('transfer-response', async (data: {
      from: string;
      fileId: string;
      accepted: boolean;
      reason?: string;
    }) => {
      const transfer = transfersRef.current.get(data.fileId);
      if (!transfer) {
        console.warn('Transferência não encontrada no registro local:', data.fileId);
        return;
      }

      if (!data.accepted) {
        playChime('decline');
        updateTransferState(data.fileId, (prev) => {
          if (!prev) return transfer;
          return {
            ...prev,
            status: 'declined',
            errorMessage: data.reason || 'O destinatário recusou o arquivo.',
          };
        });
        return;
      }

      // Aceito: inicia transferência real!
      updateTransferState(data.fileId, (prev) => ({
        ...(prev || transfer),
        status: 'connecting',
      }));

      if (transfer.file) {
        try {
          const conn = getOrCreateConnection(data.from);
          const offer = await conn.createOffer();
          sendSignal(data.from, offer, transfer.fileInfo);

          // Verifica se o DataChannel direto WebRTC abre em até 2.5s
          const isChannelOpen = await conn.waitForChannelOpen(2500);

          updateTransferState(data.fileId, (prev) => ({
            ...(prev || transfer),
            status: 'transferring',
          }));

          const onProgressCallback = (progress: number, bytesTransferred: number, speedBps: number) => {
            const remainingBytes = transfer.fileInfo.size - bytesTransferred;
            const remainingSecs = speedBps > 0 ? remainingBytes / speedBps : 0;

            updateTransferState(data.fileId, (prev) => {
              if (!prev) return transfer;
              return {
                ...prev,
                progress,
                bytesTransferred,
                speedBps,
                remainingSeconds: remainingSecs,
              };
            });
          };

          if (isChannelOpen) {
            // Envio 100% P2P via WebRTC DataChannel
            await conn.sendFileViaDataChannel(transfer.file, transfer.fileInfo, onProgressCallback);
          } else {
            // Fallback via retransmissão WebSocket (em caso de firewall UDP restritivo)
            console.log('[DropP2P] Utilizando retransmissão de fallback para garantia de entrega');
            let offset = 0;
            const totalBytes = transfer.file.size;
            let chunkIdx = 0;
            const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);

            while (offset < totalBytes) {
              const slice = transfer.file.slice(offset, offset + CHUNK_SIZE);
              const buffer = await slice.arrayBuffer();

              socket.emit('transfer-chunk', {
                to: data.from,
                fileId: data.fileId,
                chunkIndex: chunkIdx,
                totalChunks,
                chunk: buffer,
                isLast: offset + buffer.byteLength >= totalBytes,
              });

              offset += buffer.byteLength;
              chunkIdx++;
              const pct = Math.min(100, Math.round((offset / totalBytes) * 100));
              onProgressCallback(pct, offset, 8 * 1024 * 1024);
              await new Promise((r) => setTimeout(r, 12));
            }
          }

          // Transferência concluída
          playChime('success');
          updateTransferState(data.fileId, (prev) => {
            if (!prev) return transfer;
            return {
              ...prev,
              status: 'completed',
              progress: 100,
              completedTime: Date.now(),
            };
          });

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
          console.error('Erro na transferência:', err);
          updateTransferState(data.fileId, (prev) => {
            if (!prev) return transfer;
            return {
              ...prev,
              status: 'error',
              errorMessage: err.message || 'Erro durante a transmissão P2P.',
            };
          });
        }
      }
    });

    // Chunks recebidos via socket (fallback)
    socket.on('transfer-chunk', (data: {
      from: string;
      fileId: string;
      chunk: ArrayBuffer;
      isLast: boolean;
    }) => {
      const conn = rtcConnectionsRef.current.get(data.from);
      if (conn) {
        conn.handleReceivedBinaryChunk(data.chunk);
      }
    });

    // Cancelamento
    socket.on('transfer-cancel', (data: { from: string; fileId: string }) => {
      updateTransferState(data.fileId, (prev) => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'cancelled',
          errorMessage: 'Transferência cancelada pelo outro dispositivo.',
        };
      });
      const conn = rtcConnectionsRef.current.get(data.from);
      if (conn) conn.cancelTransfer();
    });

    // Compartilhamento de texto
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
  }, [getCustomRoomFromUrl, getOrCreateConnection, removeConnection, sendSignal, updateTransferState]);

  // ==========================================
  // ACEITAR OU RECUSAR TRANSFERÊNCIA
  // ==========================================

  const handleAcceptTransfer = (req: IncomingTransferRequest) => {
    setIncomingRequest(null);
    const transferId = req.fileInfo.id;

    // Se for teste do simulador
    if (req.fromSocketId === 'sim_device_iphone') {
      simulateReceivingFile(req);
      return;
    }

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

    updateTransferState(transferId, () => newTransfer);

    const conn = getOrCreateConnection(req.fromSocketId);
    conn.prepareIncomingFile(req.fileInfo);

    conn.setReceiverCallbacks({
      onProgress: (progress, bytesTransferred, speedBps) => {
        const remainingBytes = req.fileInfo.size - bytesTransferred;
        const remainingSecs = speedBps > 0 ? remainingBytes / speedBps : 0;

        updateTransferState(transferId, (prev) => {
          if (!prev) return newTransfer;
          return {
            ...prev,
            progress,
            bytesTransferred,
            speedBps,
            remainingSeconds: remainingSecs,
          };
        });
      },
      onComplete: (blob, meta) => {
        playChime('success');
        const blobUrl = URL.createObjectURL(blob);

        updateTransferState(transferId, (prev) => {
          if (!prev) return newTransfer;
          return {
            ...prev,
            status: 'completed',
            progress: 100,
            blobUrl,
            completedTime: Date.now(),
          };
        });

        setCompletedModalData({
          fileMeta: meta,
          blobUrl,
          senderName: req.sender.deviceName,
        });

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
        updateTransferState(transferId, (prev) => {
          if (!prev) return newTransfer;
          return {
            ...prev,
            status: 'error',
            errorMessage: err.message || 'Erro no recebimento P2P',
          };
        });
      },
    });

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

    if (req.fromSocketId !== 'sim_device_iphone' && socketRef.current) {
      socketRef.current.emit('transfer-response', {
        to: req.fromSocketId,
        fileId: req.fileInfo.id,
        accepted: false,
        reason: 'Recusado pelo destinatário.',
      });
    }
  };

  // ==========================================
  // INICIAR ENVIO DE ARQUIVO
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

    updateTransferState(fileId, () => newTransfer);

    // Se o destino for o dispositivo simulado de teste, simula resposta e transferência imediata!
    if (targetPeer.id === 'sim_device_iphone') {
      simulateSendingToVirtualPeer(fileId, file, fileMeta, targetPeer);
      return;
    }

    // Envio para par real pela rede
    if (socketRef.current) {
      socketRef.current.emit('transfer-request', {
        to: targetPeer.id,
        fileInfo: fileMeta,
      });
    }
  };

  // Simulação de envio para o iPhone virtual (para teste instantâneo em 1 aba!)
  const simulateSendingToVirtualPeer = (fileId: string, file: File, meta: FileMetadata, peer: PeerInfo) => {
    // 1. Simula aprovação após 600ms
    setTimeout(() => {
      updateTransferState(fileId, (prev) => {
        if (!prev) return null;
        return { ...prev, status: 'transferring' };
      });

      let currentBytes = 0;
      const totalBytes = file.size;
      const stepBytes = Math.max(CHUNK_SIZE * 2, Math.floor(totalBytes / 25));

      const interval = setInterval(() => {
        currentBytes += stepBytes;
        if (currentBytes >= totalBytes) {
          currentBytes = totalBytes;
          clearInterval(interval);

          playChime('success');
          updateTransferState(fileId, (prev) => {
            if (!prev) return null;
            return {
              ...prev,
              progress: 100,
              bytesTransferred: totalBytes,
              status: 'completed',
              completedTime: Date.now(),
            };
          });

          setHistory((h) => [
            {
              id: fileId,
              direction: 'send',
              fileName: meta.name,
              fileSize: meta.size,
              fileType: meta.type,
              peerName: peer.deviceName,
              timestamp: Date.now(),
              status: 'completed',
            },
            ...h,
          ]);
        } else {
          const progress = Math.min(99, Math.round((currentBytes / totalBytes) * 100));
          updateTransferState(fileId, (prev) => {
            if (!prev) return null;
            return {
              ...prev,
              progress,
              bytesTransferred: currentBytes,
              speedBps: 18 * 1024 * 1024, // 18 MB/s
              remainingSeconds: Math.max(1, Math.ceil((totalBytes - currentBytes) / (18 * 1024 * 1024))),
            };
          });
        }
      }, 70);
    }, 600);
  };

  // Simulação de recebimento de arquivo (o iPhone virtual manda para o usuário!)
  const handleSimulateIncomingFile = () => {
    const sampleFiles = [
      { name: 'documento_apresentacao_dropp2p.pdf', size: 3450000, type: 'application/pdf' },
      { name: 'foto_paisagem_alta_resolucao.jpg', size: 5200000, type: 'image/jpeg' },
      { name: 'projeto_codigo_fonte.zip', size: 8900000, type: 'application/zip' },
    ];
    const picked = sampleFiles[Math.floor(Math.random() * sampleFiles.length)];
    const fileId = `sim_file_${Date.now()}`;

    const fileMeta: FileMetadata = {
      id: fileId,
      name: picked.name,
      size: picked.size,
      type: picked.type,
      totalChunks: Math.ceil(picked.size / CHUNK_SIZE),
    };

    playChime('request');
    setIncomingRequest({
      id: fileId,
      fromSocketId: virtualPeer.id,
      sender: virtualPeer,
      fileInfo: fileMeta,
      timestamp: Date.now(),
    });
  };

  const simulateReceivingFile = (req: IncomingTransferRequest) => {
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

    updateTransferState(transferId, () => newTransfer);

    let currentBytes = 0;
    const totalBytes = req.fileInfo.size;
    const stepBytes = Math.max(CHUNK_SIZE * 3, Math.floor(totalBytes / 20));

    const interval = setInterval(() => {
      currentBytes += stepBytes;
      if (currentBytes >= totalBytes) {
        currentBytes = totalBytes;
        clearInterval(interval);

        playChime('success');
        // Cria um blob de amostra real para download
        const dummyContent = `DropP2P - Arquivo de teste transferido via simulação P2P.\nNome: ${req.fileInfo.name}\nTamanho: ${req.fileInfo.size} bytes\nData: ${new Date().toLocaleString()}`;
        const dummyBlob = new Blob([dummyContent], { type: req.fileInfo.type });
        const blobUrl = URL.createObjectURL(dummyBlob);

        updateTransferState(transferId, (prev) => {
          if (!prev) return newTransfer;
          return {
            ...prev,
            progress: 100,
            status: 'completed',
            blobUrl,
            completedTime: Date.now(),
          };
        });

        setCompletedModalData({
          fileMeta: req.fileInfo,
          blobUrl,
          senderName: req.sender.deviceName,
        });

        setHistory((h) => [
          {
            id: transferId,
            direction: 'receive',
            fileName: req.fileInfo.name,
            fileSize: req.fileInfo.size,
            fileType: req.fileInfo.type,
            peerName: req.sender.deviceName,
            timestamp: Date.now(),
            blobUrl,
            status: 'completed',
          },
          ...h,
        ]);
      } else {
        const progress = Math.min(99, Math.round((currentBytes / totalBytes) * 100));
        updateTransferState(transferId, (prev) => {
          if (!prev) return newTransfer;
          return {
            ...prev,
            progress,
            bytesTransferred: currentBytes,
            speedBps: 15 * 1024 * 1024,
            remainingSeconds: Math.max(1, Math.ceil((totalBytes - currentBytes) / (15 * 1024 * 1024))),
          };
        });
      }
    }, 80);
  };

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

  const handleDropFileOnPeer = (peer: PeerInfo, file: File) => {
    playChime('pop');
    startFileTransfer(peer, file);
  };

  const handleCancelTransfer = (transferId: string) => {
    const transfer = transfersRef.current.get(transferId);
    if (!transfer) return;

    if (transfer.peerSocketId !== 'sim_device_iphone' && socketRef.current) {
      socketRef.current.emit('transfer-cancel', {
        to: transfer.peerSocketId,
        fileId: transferId,
      });
    }

    const conn = rtcConnectionsRef.current.get(transfer.peerSocketId);
    if (conn) conn.cancelTransfer();

    updateTransferState(transferId, (prev) => {
      if (!prev) return null;
      return {
        ...prev,
        status: 'cancelled',
        errorMessage: 'Transferência cancelada por você.',
      };
    });
  };

  const handleDismissTransfer = (transferId: string) => {
    updateTransferState(transferId, () => null);
  };

  const handleSendText = (targetPeerId: string, text: string) => {
    if (targetPeerId === 'sim_device_iphone') {
      playChime('pop');
      alert(`[iPhone 16 Pro Simulado] Mensagem recebida: "${text}"`);
      return;
    }
    if (socketRef.current) {
      socketRef.current.emit('text-share', {
        to: targetPeerId,
        text,
      });
    }
  };

  const handleSetRoom = (roomName: string | null) => {
    if (typeof window !== 'undefined') {
      if (roomName) {
        window.location.hash = `room=${encodeURIComponent(roomName)}`;
      } else if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
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
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileInputChange}
      />

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

      <main className="flex-1 flex flex-col relative">
        <RadarArena
          peers={allPeers}
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
          isVirtualPeerActive={isVirtualPeerActive}
          onToggleVirtualPeer={() => setIsVirtualPeerActive((prev) => !prev)}
          onSimulateIncomingFile={handleSimulateIncomingFile}
        />
      </main>

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

      <TransferDrawer
        transfers={Array.from(activeTransfers.values())}
        onCancelTransfer={handleCancelTransfer}
        onDismissTransfer={handleDismissTransfer}
      />

      {incomingRequest && (
        <IncomingModal
          request={incomingRequest}
          onAccept={handleAcceptTransfer}
          onDecline={handleDeclineTransfer}
        />
      )}

      {completedModalData && (
        <SuccessModal
          fileMeta={completedModalData.fileMeta}
          blobUrl={completedModalData.blobUrl}
          senderName={completedModalData.senderName}
          onClose={() => setCompletedModalData(null)}
        />
      )}

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
          peers={allPeers}
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
