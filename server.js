/**
 * ==============================================================================
 * DropP2P - Servidor de Sinalização WebRTC (Node.js + Socket.io)
 * ==============================================================================
 * Descrição:
 * Este servidor é responsável EXCLUSIVAMENTE por:
 * 1. Agrupar dispositivos na mesma rede local (usando hash anônimo do IP público/local)
 * 2. Facilitar a troca de metadados de conexão WebRTC (ofertas SDP, respostas e candidatos ICE)
 * 3. Notificar solicitações de transferência ("Aceitar" / "Recusar")
 *
 * PRIVACIDADE E LOCAL-FIRST:
 * - Nenhum arquivo ou byte de arquivo passa por este servidor.
 * - Todos os dados de arquivo são transferidos ponto a ponto (P2P) diretamente
 *   entre os navegadores através de canais WebRTC DataChannel cifrados com DTLS.
 * ==============================================================================
 */

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);

// Porta do servidor (padrão 3000)
const PORT = process.env.PORT || 3000;

// Configuração do Socket.io para sinalização
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 1e6, // Limite baixo: arquivos NUNCA transitam pelo socket!
});

// Servir arquivos estáticos da versão Vanilla (HTML, CSS, JS puro)
app.use(express.static(path.join(__dirname, 'vanilla')));

// Mapa em memória de pares ativos por socket.id
// { [socketId: string]: { id, peerId, deviceName, deviceType, os, avatarColor, avatarEmoji, room, ipHash } }
const connectedPeers = new Map();

/**
 * Normaliza e gera um hash anônimo do IP do cliente para agrupar dispositivos
 * na mesma rede física/Wi-Fi automaticamente.
 */
function extractClientIpHash(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  let clientIp = '';

  if (typeof forwarded === 'string') {
    clientIp = forwarded.split(',')[0].trim();
  } else if (Array.isArray(forwarded) && forwarded.length > 0) {
    clientIp = forwarded[0].trim();
  } else {
    clientIp = socket.handshake.address || socket.conn.remoteAddress || '127.0.0.1';
  }

  // Normaliza localhost
  if (clientIp === '::1' || clientIp === '::ffff:127.0.0.1') {
    clientIp = '127.0.0.1';
  }

  // Hash SHA-256 de 8 caracteres para privacidade
  return crypto.createHash('sha256').update(clientIp).digest('hex').substring(0, 8);
}

// Endpoint de diagnóstico de rede
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    totalConnected: connectedPeers.size,
    timestamp: new Date().toISOString(),
  });
});

// Eventos de Sinalização via Socket.io
io.on('connection', (socket) => {
  const networkHash = extractClientIpHash(socket);

  // 1. Cliente entra na sala (por rede local ou sala personalizada)
  socket.on('join-room', (payload = {}) => {
    // Se informado customRoom, usa sala privada; senão agrupa por rede local
    const roomName = payload.customRoom && payload.customRoom.trim().length > 0
      ? `custom_${payload.customRoom.trim().toLowerCase()}`
      : `net_${networkHash}`;

    // Desconecta de salas antigas se houver
    const oldPeer = connectedPeers.get(socket.id);
    if (oldPeer) {
      socket.leave(oldPeer.room);
      socket.to(oldPeer.room).emit('peer-left', { socketId: socket.id, peerId: oldPeer.peerId });
    }

    socket.join(roomName);

    const peerInfo = {
      id: socket.id,
      peerId: payload.peerId || socket.id,
      deviceName: payload.deviceName || 'Dispositivo Anônimo',
      deviceType: payload.deviceType || 'desktop',
      os: payload.os || 'Desconhecido',
      avatarColor: payload.avatarColor || '#0ea5e9',
      avatarEmoji: payload.avatarEmoji || '⚡',
      room: roomName,
      ipHash: networkHash,
      joinedAt: Date.now(),
    };

    connectedPeers.set(socket.id, peerInfo);

    // Lista de outros pares presentes na mesma sala
    const peersInRoom = [];
    for (const [id, peer] of connectedPeers.entries()) {
      if (id !== socket.id && peer.room === roomName) {
        peersInRoom.push(peer);
      }
    }

    // Envia confirmação de entrada e lista dos pares presentes
    socket.emit('room-joined', {
      self: peerInfo,
      roomName,
      ipHash: networkHash,
      peers: peersInRoom,
    });

    // Anuncia a presença do novo par para os outros integrantes da sala
    socket.to(roomName).emit('peer-joined', peerInfo);
  });

  // 2. Atualização de perfil do dispositivo
  socket.on('update-profile', (updates = {}) => {
    const peer = connectedPeers.get(socket.id);
    if (peer) {
      Object.assign(peer, updates);
      socket.to(peer.room).emit('peer-updated', peer);
    }
  });

  // 3. Encaminhamento de Sinais WebRTC (SDP Offer, SDP Answer, Candidatos ICE)
  socket.on('signal', ({ to, signal, fileMeta }) => {
    const target = io.sockets.sockets.get(to);
    if (target) {
      target.emit('signal', {
        from: socket.id,
        signal,
        fileMeta,
      });
    }
  });

  // 4. Solicitação de Envio de Arquivo (AirDrop Prompt)
  socket.on('transfer-request', ({ to, fileInfo }) => {
    const target = io.sockets.sockets.get(to);
    const sender = connectedPeers.get(socket.id);
    if (target && sender) {
      target.emit('transfer-request', {
        from: socket.id,
        sender,
        fileInfo,
      });
    }
  });

  // 5. Resposta do Destinatário (Aceitou ou Recusou)
  socket.on('transfer-response', ({ to, fileId, accepted, reason }) => {
    const target = io.sockets.sockets.get(to);
    if (target) {
      target.emit('transfer-response', {
        from: socket.id,
        fileId,
        accepted,
        reason,
      });
    }
  });

  // 6. Cancelamento de Transferência
  socket.on('transfer-cancel', ({ to, fileId }) => {
    const target = io.sockets.sockets.get(to);
    if (target) {
      target.emit('transfer-cancel', {
        from: socket.id,
        fileId,
      });
    }
  });

  // 7. Desconexão do Dispositivo
  socket.on('disconnect', () => {
    const peer = connectedPeers.get(socket.id);
    if (peer) {
      socket.to(peer.room).emit('peer-left', {
        socketId: socket.id,
        peerId: peer.peerId,
        deviceName: peer.deviceName,
      });
      connectedPeers.delete(socket.id);
    }
  });
});

// Inicialização do Servidor HTTP
server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  DropP2P - Servidor de Sinalização Ativo`);
  console.log(`  Endereço local: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
