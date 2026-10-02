/**
 * Gerenciador WebRTC P2P (RTCPeerConnection + RTCDataChannel) com Fallback Relay
 * Suporta transferência direta de arquivos em pedaços (chunking de 64KB)
 * com controle de backpressure (bufferedAmountLowThreshold) e fallback automático.
 */

import { FileMetadata } from '../types';

export const CHUNK_SIZE = 64 * 1024; // 64 KB por pedaço
export const BUFFER_THRESHOLD = 1024 * 1024; // 1 MB backpressure limit

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export interface TransferCallbacks {
  onProgress?: (progress: number, bytesTransferred: number, speedBps: number) => void;
  onComplete?: (blob: Blob, fileMeta: FileMetadata) => void;
  onError?: (err: Error) => void;
}

export class WebRTCConnection {
  public peerSocketId: string;
  public pc: RTCPeerConnection;
  public dataChannel: RTCDataChannel | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private isRemoteDescriptionSet = false;
  private sendSignal: (targetSocketId: string, signal: any, fileMeta?: any) => void;

  // Estado de recepção de arquivo
  private incomingMeta: FileMetadata | null = null;
  private receivedChunks: ArrayBuffer[] = [];
  private receivedBytes = 0;
  private lastProgressReport = 0;
  private speedSamples: { time: number; bytes: number }[] = [];
  private transferCallbacks: TransferCallbacks = {};
  private isCancelled = false;

  constructor(
    peerSocketId: string,
    sendSignal: (targetSocketId: string, signal: any, fileMeta?: any) => void
  ) {
    this.peerSocketId = peerSocketId;
    this.sendSignal = sendSignal;

    this.pc = new RTCPeerConnection(RTC_CONFIG);

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal(this.peerSocketId, {
          type: 'candidate',
          candidate: event.candidate,
        });
      }
    };

    this.pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel);
    };

    this.pc.onconnectionstatechange = () => {
      if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'disconnected') {
        // Conexão direta falhou
      }
    };
  }

  // Configura os ouvintes do canal de dados de alta velocidade
  private setupDataChannel(channel: RTCDataChannel) {
    this.dataChannel = channel;
    this.dataChannel.binaryType = 'arraybuffer';
    this.dataChannel.bufferedAmountLowThreshold = BUFFER_THRESHOLD;

    this.dataChannel.onmessage = (event) => {
      if (this.isCancelled) return;

      if (typeof event.data === 'string') {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'file-meta') {
            this.incomingMeta = msg.fileMeta;
            this.receivedChunks = [];
            this.receivedBytes = 0;
            this.speedSamples = [{ time: performance.now(), bytes: 0 }];
            this.lastProgressReport = performance.now();
          } else if (msg.type === 'file-complete') {
            if (this.incomingMeta && this.receivedChunks.length > 0) {
              const fileBlob = new Blob(this.receivedChunks, {
                type: this.incomingMeta.type || 'application/octet-stream',
              });
              this.transferCallbacks.onComplete?.(fileBlob, this.incomingMeta);
              this.receivedChunks = [];
            }
          } else if (msg.type === 'transfer-cancelled') {
            this.isCancelled = true;
            this.transferCallbacks.onError?.(new Error('A transferência foi cancelada pelo remetente.'));
          }
        } catch (e) {
          console.error('Erro ao analisar mensagem de controle:', e);
        }
      } else if (event.data instanceof ArrayBuffer) {
        this.handleReceivedBinaryChunk(event.data);
      }
    };
  }

  // Processa pedaço binário recebido
  public handleReceivedBinaryChunk(arrayBuffer: ArrayBuffer) {
    if (!this.incomingMeta) return;

    this.receivedChunks.push(arrayBuffer);
    this.receivedBytes += arrayBuffer.byteLength;

    const now = performance.now();
    if (now - this.lastProgressReport > 70 || this.receivedBytes >= this.incomingMeta.size) {
      const progress = Math.min(100, Math.round((this.receivedBytes / this.incomingMeta.size) * 100));

      this.speedSamples.push({ time: now, bytes: this.receivedBytes });
      if (this.speedSamples.length > 10) this.speedSamples.shift();

      const oldest = this.speedSamples[0];
      const timeDelta = (now - oldest.time) / 1000;
      const bytesDelta = this.receivedBytes - oldest.bytes;
      const speedBps = timeDelta > 0 ? Math.round(bytesDelta / timeDelta) : 0;

      this.transferCallbacks.onProgress?.(progress, this.receivedBytes, speedBps);
      this.lastProgressReport = now;
    }

    if (this.receivedBytes >= this.incomingMeta.size && this.incomingMeta.size > 0) {
      setTimeout(() => {
        if (this.receivedChunks.length > 0 && this.incomingMeta) {
          const fileBlob = new Blob(this.receivedChunks, {
            type: this.incomingMeta.type || 'application/octet-stream',
          });
          this.transferCallbacks.onComplete?.(fileBlob, this.incomingMeta);
          this.receivedChunks = [];
        }
      }, 50);
    }
  }

  public prepareIncomingFile(meta: FileMetadata) {
    this.incomingMeta = meta;
    this.receivedChunks = [];
    this.receivedBytes = 0;
    this.speedSamples = [{ time: performance.now(), bytes: 0 }];
    this.lastProgressReport = performance.now();
  }

  // Define os callbacks para escutar o progresso do recebimento
  public setReceiverCallbacks(callbacks: TransferCallbacks) {
    this.transferCallbacks = callbacks;
  }

  // Cria a oferta WebRTC (iniciado pelo remetente)
  public async createOffer(): Promise<RTCSessionDescriptionInit> {
    const channel = this.pc.createDataChannel('dropp2p-channel', {
      ordered: true,
    });
    this.setupDataChannel(channel);

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    return offer;
  }

  // Responde com SDP Answer (iniciado pelo destinatário)
  public async handleOffer(offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(offer));
    this.isRemoteDescriptionSet = true;
    await this.flushPendingIceCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    return answer;
  }

  // Recebe a resposta do destinatário
  public async handleAnswer(answer: RTCSessionDescriptionInit): Promise<void> {
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer));
    this.isRemoteDescriptionSet = true;
    await this.flushPendingIceCandidates();
  }

  // Adiciona candidato ICE com buffer de segurança
  public async addIceCandidate(candidate: RTCIceCandidateInit): Promise<void> {
    if (!this.isRemoteDescriptionSet) {
      this.pendingCandidates.push(candidate);
      return;
    }
    try {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      console.warn('Erro ao adicionar candidato ICE:', err);
    }
  }

  private async flushPendingIceCandidates() {
    while (this.pendingCandidates.length > 0) {
      const candidate = this.pendingCandidates.shift();
      if (candidate) {
        try {
          await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.warn('Erro ao processar candidato ICE acumulado:', err);
        }
      }
    }
  }

  // Aguarda abertura do canal com timeout rápido
  public async waitForChannelOpen(timeoutMs = 3000): Promise<boolean> {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      return true;
    }
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
          clearInterval(checkInterval);
          resolve(true);
        } else if (this.pc.connectionState === 'failed' || this.pc.connectionState === 'closed') {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 50);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(this.dataChannel?.readyState === 'open');
      }, timeoutMs);
    });
  }

  /**
   * Envia arquivo diretamente pelo DataChannel WebRTC
   */
  public async sendFileViaDataChannel(
    file: File,
    fileMeta: FileMetadata,
    onProgress?: (progress: number, bytesTransferred: number, speedBps: number) => void
  ): Promise<void> {
    this.isCancelled = false;
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('DataChannel não está aberto');
    }

    // Envia metadados
    this.dataChannel.send(
      JSON.stringify({
        type: 'file-meta',
        fileMeta,
      })
    );

    let offset = 0;
    const totalBytes = file.size;
    const speedSamples: { time: number; bytes: number }[] = [
      { time: performance.now(), bytes: 0 },
    ];
    let lastReport = performance.now();

    while (offset < totalBytes) {
      if (this.isCancelled) {
        throw new Error('Transferência cancelada.');
      }

      if (this.dataChannel.bufferedAmount > BUFFER_THRESHOLD) {
        await new Promise<void>((resolve) => {
          if (!this.dataChannel) return resolve();
          this.dataChannel.onbufferedamountlow = () => {
            if (this.dataChannel) this.dataChannel.onbufferedamountlow = null;
            resolve();
          };
        });
      }

      const slice = file.slice(offset, offset + CHUNK_SIZE);
      const arrayBuffer = await slice.arrayBuffer();

      this.dataChannel.send(arrayBuffer);
      offset += arrayBuffer.byteLength;

      const now = performance.now();
      if (now - lastReport > 70 || offset >= totalBytes) {
        const progress = Math.min(100, Math.round((offset / totalBytes) * 100));

        speedSamples.push({ time: now, bytes: offset });
        if (speedSamples.length > 10) speedSamples.shift();

        const oldest = speedSamples[0];
        const timeDelta = (now - oldest.time) / 1000;
        const bytesDelta = offset - oldest.bytes;
        const speedBps = timeDelta > 0 ? Math.round(bytesDelta / timeDelta) : 0;

        onProgress?.(progress, offset, speedBps);
        lastReport = now;
      }
    }

    this.dataChannel.send(
      JSON.stringify({
        type: 'file-complete',
        fileId: fileMeta.id,
      })
    );
  }

  public cancelTransfer() {
    this.isCancelled = true;
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      try {
        this.dataChannel.send(JSON.stringify({ type: 'transfer-cancelled' }));
      } catch {}
    }
  }

  public close() {
    this.isCancelled = true;
    try {
      if (this.dataChannel) {
        this.dataChannel.close();
      }
      this.pc.close();
    } catch {}
  }
}
