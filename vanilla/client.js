/**
 * DropP2P - Cliente Vanilla JavaScript
 * Implementação pura sem frameworks para transferência direta de arquivos via WebRTC DataChannel
 */

(function () {
  'use strict';

  // Configuração WebRTC e tamanho de bloco (64 KB)
  const CHUNK_SIZE = 64 * 1024;
  const BUFFER_THRESHOLD = 1024 * 1024; // 1 MB
  const RTC_CONFIG = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  // Elementos do DOM
  const dom = {
    roomLabel: document.getElementById('room-label'),
    selfName: document.getElementById('self-name'),
    selfOs: document.getElementById('self-os'),
    selfAvatar: document.getElementById('self-avatar'),
    dockName: document.getElementById('dock-name'),
    dockAvatar: document.getElementById('dock-avatar'),
    devicesContainer: document.getElementById('devices-container'),
    arenaStatus: document.getElementById('arena-status'),
    fileInput: document.getElementById('file-input'),

    // Modal de solicitação
    incomingModal: document.getElementById('incoming-modal'),
    modalSenderName: document.getElementById('modal-sender-name'),
    modalSenderOs: document.getElementById('modal-sender-os'),
    modalSenderAvatar: document.getElementById('modal-sender-avatar'),
    modalFileName: document.getElementById('modal-file-name'),
    modalFileSize: document.getElementById('modal-file-size'),
    btnAccept: document.getElementById('btn-accept'),
    btnDecline: document.getElementById('btn-decline'),
    timerProgress: document.getElementById('timer-progress'),

    // Drawer de progresso
    transferDrawer: document.getElementById('transfer-drawer'),
    transferTitle: document.getElementById('transfer-title'),
    transferProgressBar: document.getElementById('transfer-progress-bar'),
    transferPercent: document.getElementById('transfer-percent'),
    transferSpeed: document.getElementById('transfer-speed'),
    transferCancelBtn: document.getElementById('transfer-cancel-btn'),
  };

  // Estado Local
  let socket = null;
  let selfPeer = null;
  let peers = [];
  let pendingIncomingRequest = null;
  let selectedTargetPeer = null;
  let activeTransfer = null;

  // Mapa de conexões WebRTC ativas por socketId
  const peerConnections = new Map();

  // Utilitário de formatação de bytes
  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Detecção simples de dispositivo e SO
  function detectOS() {
    const ua = navigator.userAgent;
    if (/Macintosh|Mac OS X/i.test(ua)) return 'macOS';
    if (/Windows/i.test(ua)) return 'Windows';
    if (/Android/i.test(ua)) return 'Android';
    if (/iPhone|iPad/i.test(ua)) return 'iOS';
    if (/Linux/i.test(ua)) return 'Linux';
    return 'Web';
  }

  // Gerador de identidade aleatória
  function generateIdentity() {
    const animals = [
      { name: 'Golfinho', emoji: '🐬', color: '#0ea5e9' },
      { name: 'Falcão', emoji: '🦅', color: '#f59e0b' },
      { name: 'Lontra', emoji: '🦦', color: '#10b981' },
      { name: 'Raposa', emoji: '🦊', color: '#f97316' },
      { name: 'Lince', emoji: '🐆', color: '#ec4899' },
    ];
    const item = animals[Math.floor(Math.random() * animals.length)];
    const os = detectOS();
    return {
      peerId: 'peer_' + Math.random().toString(36).substring(2, 9),
      deviceName: `${item.name} (${os})`,
      os,
      deviceType: /Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      avatarEmoji: item.emoji,
      avatarColor: item.color,
    };
  }

  // Inicialização do Socket.io
  function initSocket() {
    socket = io();
    selfPeer = generateIdentity();

    // Renderiza identidade local
    dom.selfName.textContent = selfPeer.deviceName;
    dom.selfOs.textContent = selfPeer.os;
    dom.selfAvatar.textContent = selfPeer.avatarEmoji;
    dom.selfAvatar.style.backgroundColor = selfPeer.avatarColor;
    dom.dockName.textContent = selfPeer.deviceName;
    dom.dockAvatar.textContent = selfPeer.avatarEmoji;
    dom.dockAvatar.style.backgroundColor = selfPeer.avatarColor;

    socket.on('connect', () => {
      socket.emit('join-room', selfPeer);
    });

    socket.on('room-joined', (data) => {
      dom.roomLabel.textContent = `Rede #${data.ipHash}`;
      peers = data.peers || [];
      renderPeers();
    });

    socket.on('peer-joined', (newPeer) => {
      if (!peers.some((p) => p.id === newPeer.id)) {
        peers.push(newPeer);
        renderPeers();
      }
    });

    socket.on('peer-left', (data) => {
      peers = peers.filter((p) => p.id !== data.socketId);
      renderPeers();
      const pc = peerConnections.get(data.socketId);
      if (pc) {
        pc.close();
        peerConnections.delete(data.socketId);
      }
    });

    // Sinais WebRTC
    socket.on('signal', async ({ from, signal, fileMeta }) => {
      const pc = getOrCreatePeerConnection(from);

      if (signal.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { to: from, signal: answer });
      } else if (signal.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
      } else if (signal.type === 'candidate' && signal.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      }
    });

    // Solicitação de recebimento de arquivo
    socket.on('transfer-request', ({ from, sender, fileInfo }) => {
      pendingIncomingRequest = { from, sender, fileInfo };
      showIncomingModal(sender, fileInfo);
    });

    // Resposta do destinatário
    socket.on('transfer-response', async ({ from, fileId, accepted, reason }) => {
      if (!activeTransfer || activeTransfer.fileId !== fileId) return;

      if (!accepted) {
        console.warn(reason || 'O destinatário recusou o arquivo.');
        hideTransferDrawer();
        return;
      }

      // Conecta WebRTC e inicia o envio dos pedaços
      const pc = getOrCreatePeerConnection(from);
      const channel = pc.createDataChannel('dropp2p-channel');
      setupDataChannel(channel, from);

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { to: from, signal: offer });

      channel.onopen = () => {
        sendBufferedFile(channel, activeTransfer.file);
      };
    });
  }

  // Cria ou recupera RTCPeerConnection
  function getOrCreatePeerConnection(peerSocketId) {
    if (peerConnections.has(peerSocketId)) {
      return peerConnections.get(peerSocketId);
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    peerConnections.set(peerSocketId, pc);

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', {
          to: peerSocketId,
          signal: { type: 'candidate', candidate: event.candidate },
        });
      }
    };

    pc.ondatachannel = (event) => {
      setupDataChannel(event.channel, peerSocketId);
    };

    return pc;
  }

  // Configuração do canal de dados para recepção
  function setupDataChannel(channel, peerSocketId) {
    channel.binaryType = 'arraybuffer';
    let incomingMeta = null;
    let receivedChunks = [];
    let receivedBytes = 0;

    channel.onmessage = (event) => {
      if (typeof event.data === 'string') {
        const msg = JSON.parse(event.data);
        if (msg.type === 'file-meta') {
          incomingMeta = msg.fileMeta;
          receivedChunks = [];
          receivedBytes = 0;
          showTransferDrawer('Recebendo: ' + incomingMeta.name);
        } else if (msg.type === 'file-complete') {
          // Arquivo concluído!
          const blob = new Blob(receivedChunks, { type: incomingMeta.type });
          triggerDownload(blob, incomingMeta.name);
          hideTransferDrawer();
        }
      } else if (event.data instanceof ArrayBuffer) {
        receivedChunks.push(event.data);
        receivedBytes += event.data.byteLength;

        if (incomingMeta) {
          const pct = Math.round((receivedBytes / incomingMeta.size) * 100);
          updateTransferProgress(pct, formatBytes(receivedBytes) + ' / ' + formatBytes(incomingMeta.size));
        }
      }
    };
  }

  // Envio de arquivo em pedaços com backpressure
  async function sendBufferedFile(channel, file) {
    showTransferDrawer('Enviando: ' + file.name);

    // 1. Envia metadados
    channel.send(
      JSON.stringify({
        type: 'file-meta',
        fileMeta: { name: file.name, size: file.size, type: file.type },
      })
    );

    let offset = 0;
    while (offset < file.size) {
      if (channel.bufferedAmount > BUFFER_THRESHOLD) {
        await new Promise((resolve) => {
          channel.onbufferedamountlow = () => {
            channel.onbufferedamountlow = null;
            resolve();
          };
        });
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const buffer = await slice.arrayBuffer();
      channel.send(buffer);
      offset += buffer.byteLength;

      const pct = Math.round((offset / file.size) * 100);
      updateTransferProgress(pct, formatBytes(offset) + ' / ' + formatBytes(file.size));
    }

    // 2. Envia sinal de término
    channel.send(JSON.stringify({ type: 'file-complete' }));
    hideTransferDrawer();
    console.log('Arquivo enviado com sucesso!');
  }

  // Renderiza pares descobertos na tela
  function renderPeers() {
    dom.devicesContainer.innerHTML = '';

    if (peers.length === 0) {
      dom.arenaStatus.textContent = 'Procurando outros dispositivos na mesma rede Wi-Fi...';
      return;
    }

    dom.arenaStatus.textContent = `${peers.length} dispositivo(s) conectado(s) na rede.`;

    peers.forEach((peer) => {
      const card = document.createElement('div');
      card.className = 'device-card';

      card.innerHTML = `
        <div class="device-avatar" style="background-color: ${peer.avatarColor}">${peer.avatarEmoji}</div>
        <div class="device-name">${peer.deviceName}</div>
        <div class="device-os">${peer.os}</div>
        <div class="device-action">Enviar Arquivo</div>
      `;

      // Clique para abrir seletor
      card.addEventListener('click', () => {
        selectedTargetPeer = peer;
        dom.fileInput.value = '';
        dom.fileInput.click();
      });

      // Arrastar e soltar sobre o cartão
      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        card.classList.add('drag-over');
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          startSendFlow(peer, e.dataTransfer.files[0]);
        }
      });

      dom.devicesContainer.appendChild(card);
    });
  }

  // Seleção de arquivo nativa
  dom.fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0 && selectedTargetPeer) {
      startSendFlow(selectedTargetPeer, e.target.files[0]);
    }
  });

  // Início do fluxo de envio
  function startSendFlow(targetPeer, file) {
    const fileId = 'file_' + Date.now();
    activeTransfer = {
      fileId,
      targetPeer,
      file,
    };

    socket.emit('transfer-request', {
      to: targetPeer.id,
      fileInfo: {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
      },
    });

    showTransferDrawer('Aguardando aceite de ' + targetPeer.deviceName);
  }

  // Modal de solicitação
  function showIncomingModal(sender, fileInfo) {
    dom.modalSenderName.textContent = sender.deviceName;
    dom.modalSenderOs.textContent = sender.os;
    dom.modalSenderAvatar.textContent = sender.avatarEmoji;
    dom.modalSenderAvatar.style.backgroundColor = sender.avatarColor;
    dom.modalFileName.textContent = fileInfo.name;
    dom.modalFileSize.textContent = formatBytes(fileInfo.size);
    dom.incomingModal.classList.remove('hidden');
  }

  dom.btnAccept.addEventListener('click', () => {
    dom.incomingModal.classList.add('hidden');
    if (!pendingIncomingRequest) return;

    socket.emit('transfer-response', {
      to: pendingIncomingRequest.from,
      fileId: pendingIncomingRequest.fileInfo.id,
      accepted: true,
    });
  });

  dom.btnDecline.addEventListener('click', () => {
    dom.incomingModal.classList.add('hidden');
    if (!pendingIncomingRequest) return;

    socket.emit('transfer-response', {
      to: pendingIncomingRequest.from,
      fileId: pendingIncomingRequest.fileInfo.id,
      accepted: false,
      reason: 'Recusado pelo destinatário',
    });
  });

  // Barra de progresso
  function showTransferDrawer(title) {
    dom.transferTitle.textContent = title;
    dom.transferProgressBar.style.width = '0%';
    dom.transferPercent.textContent = '0%';
    dom.transferDrawer.classList.remove('hidden');
  }

  function hideTransferDrawer() {
    dom.transferDrawer.classList.add('hidden');
  }

  function updateTransferProgress(percent, label) {
    dom.transferProgressBar.style.width = percent + '%';
    dom.transferPercent.textContent = percent + '%';
    dom.transferSpeed.textContent = label;
  }

  function triggerDownload(blob, fileName) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Iniciar cliente ao carregar a página
  window.addEventListener('DOMContentLoaded', initSocket);
})();
