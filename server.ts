/**
 * Servidor de Sinalização e Aplicação Full-Stack (DropP2P)
 * Gerencia a descoberta de pares na mesma rede local/sala e roteia sinais WebRTC.
 * NENHUM arquivo passa pelo servidor: a transferência ocorre 100% P2P direta via WebRTC DataChannel.
 */
import express from 'express';
import http from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

interface PeerInfo {
  id: string; // socket.id
  peerId: string;
  deviceName: string;
  deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
  os: string;
  avatarColor: string;
  avatarEmoji: string;
  room: string;
  ipHash: string;
  joinedAt: number;
}

const app = express();
const server = http.createServer(app);

// Configuração do Socket.io para sinalização
const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e6, // Apenas sinais leves, arquivos NÃO passam pelo socket!
});

// Cache em memória dos pares conectados indexados por socket.id
const peers = new Map<string, PeerInfo>();

/**
 * Normaliza e gera um hash anônimo do IP público/local do cliente
 * para agrupar automaticamente os dispositivos na mesma rede física/Wi-Fi.
 */
function getClientIpHash(socket: Socket): string {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  let rawIp = '';

  if (typeof forwarded === 'string') {
    rawIp = forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    rawIp = forwarded[0].trim();
  } else {
    rawIp = socket.handshake.address || socket.conn.remoteAddress || '127.0.0.1';
  }

  // Se for localhost IPv6, normaliza
  if (rawIp === '::1' || rawIp === '::ffff:127.0.0.1') {
    rawIp = '127.0.0.1';
  }

  // Gera hash curto para identificação segura da rede local sem expor o IP original
  return crypto.createHash('sha256').update(rawIp).digest('hex').substring(0, 8);
}

// Endpoint de status e informações de rede
app.get('/api/network-info', (req, res) => {
  const forwarded = req.headers['x-forwarded-for'];
  let clientIp = '';
  if (typeof forwarded === 'string') {
    clientIp = forwarded.split(',')[0].trim();
  } else {
    clientIp = req.socket.remoteAddress || '127.0.0.1';
  }
  const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 8);
  res.json({
    status: 'online',
    networkGroup: ipHash,
    activePeersCount: peers.size,
    timestamp: Date.now(),
  });
});

io.on('connection', (socket: Socket) => {
  const ipHash = getClientIpHash(socket);

  // Cliente anuncia presença e entra na sala (por IP hash ou sala personalizada)
  socket.on('join-room', (payload: {
    peerId: string;
    deviceName: string;
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'unknown';
    os: string;
    avatarColor: string;
    avatarEmoji: string;
    customRoom?: string;
  }) => {
    // Se o usuário digitou uma sala específica, usa ela; caso contrário, agrupa por hash de IP da rede local
    const roomName = payload.customRoom && payload.customRoom.trim().length > 0
      ? `custom_${payload.customRoom.trim().toLowerCase()}`
      : `net_${ipHash}`;

    // Desconecta de salas anteriores se houver
    const existing = peers.get(socket.id);
    if (existing) {
      socket.leave(existing.room);
      socket.to(existing.room).emit('peer-left', { socketId: socket.id, peerId: existing.peerId });
    }

    socket.join(roomName);

    const peerInfo: PeerInfo = {
      id: socket.id,
      peerId: payload.peerId || socket.id,
      deviceName: payload.deviceName || 'Dispositivo Anônimo',
      deviceType: payload.deviceType || 'desktop',
      os: payload.os || 'Desconhecido',
      avatarColor: payload.avatarColor || '#0ea5e9',
      avatarEmoji: payload.avatarEmoji || '⚡',
      room: roomName,
      ipHash,
      joinedAt: Date.now(),
    };

    peers.set(socket.id, peerInfo);

    // Encontra outros pares já presentes nesta mesma sala
    const peersInRoom: PeerInfo[] = [];
    for (const [id, peer] of peers.entries()) {
      if (id !== socket.id && peer.room === roomName) {
        peersInRoom.push(peer);
      }
    }

    // Envia lista atualizada de pares existentes para o novo integrante
    socket.emit('room-joined', {
      self: peerInfo,
      roomName,
      ipHash,
      peers: peersInRoom,
    });

    // Notifica todos os outros na sala que um novo dispositivo chegou
    socket.to(roomName).emit('peer-joined', peerInfo);
  });

  // Atualização de nome ou detalhes do perfil
  socket.on('update-profile', (updates: Partial<PeerInfo>) => {
    const peer = peers.get(socket.id);
    if (peer) {
      Object.assign(peer, updates);
      socket.to(peer.room).emit('peer-updated', peer);
    }
  });

  // ==========================================
  // ROTEAMENTO DE SINALIZAÇÃO WEBRTC (SDP / ICE)
  // O servidor atua estritamente como correio de mensagens
  // ==========================================

  socket.on('signal', (data: { to: string; signal: any; fileMeta?: any }) => {
    const targetSocket = io.sockets.sockets.get(data.to);
    if (targetSocket) {
      targetSocket.emit('signal', {
        from: socket.id,
        signal: data.signal,
        fileMeta: data.fileMeta,
      });
    }
  });

  // Solicitação de envio de arquivo (para exibir modal "Aceitar / Recusar" no destinatário)
  socket.on('transfer-request', (data: {
    to: string;
    fileInfo: {
      id: string;
      name: string;
      size: number;
      type: string;
      totalChunks?: number;
    };
  }) => {
    const targetSocket = io.sockets.sockets.get(data.to);
    const sender = peers.get(socket.id);
    if (targetSocket && sender) {
      targetSocket.emit('transfer-request', {
        from: socket.id,
        sender,
        fileInfo: data.fileInfo,
      });
    }
  });

  // Resposta do destinatário (Aceitou ou Recusou)
  socket.on('transfer-response', (data: {
    to: string;
    fileId: string;
    accepted: boolean;
    reason?: string;
  }) => {
    const targetSocket = io.sockets.sockets.get(data.to);
    if (targetSocket) {
      targetSocket.emit('transfer-response', {
        from: socket.id,
        fileId: data.fileId,
        accepted: data.accepted,
        reason: data.reason,
      });
    }
  });

  // Cancelamento de transferência em andamento
  socket.on('transfer-cancel', (data: { to: string; fileId: string }) => {
    const targetSocket = io.sockets.sockets.get(data.to);
    if (targetSocket) {
      targetSocket.emit('transfer-cancel', {
        from: socket.id,
        fileId: data.fileId,
      });
    }
  });

  // Compartilhamento rápido de texto/link/área de transferência
  socket.on('text-share', (data: { to: string; text: string }) => {
    const targetSocket = io.sockets.sockets.get(data.to);
    const sender = peers.get(socket.id);
    if (targetSocket && sender) {
      targetSocket.emit('text-share', {
        from: socket.id,
        sender,
        text: data.text,
        timestamp: Date.now(),
      });
    }
  });

  // Desconexão do dispositivo
  socket.on('disconnect', () => {
    const peer = peers.get(socket.id);
    if (peer) {
      socket.to(peer.room).emit('peer-left', {
        socketId: socket.id,
        peerId: peer.peerId,
        deviceName: peer.deviceName,
      });
      peers.delete(socket.id);
    }
  });
});

// Integração com Vite em desenvolvimento ou arquivos estáticos em produção
async function setupServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[DropP2P] Servidor de sinalização rodando na porta ${PORT}`);
    console.log(`[DropP2P] Modo: ${isProd ? 'Produção' : 'Desenvolvimento'}`);
  });
}

setupServer().catch((err) => {
  console.error('[DropP2P] Falha ao iniciar servidor:', err);
  process.exit(1);
});
