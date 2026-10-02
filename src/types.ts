export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface PeerInfo {
  id: string; // socket.id
  peerId: string;
  deviceName: string;
  deviceType: DeviceType;
  os: string;
  avatarColor: string;
  avatarEmoji: string;
  room: string;
  ipHash: string;
  joinedAt: number;
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  totalChunks: number;
  lastModified?: number;
}

export interface IncomingTransferRequest {
  id: string;
  fromSocketId: string;
  sender: PeerInfo;
  fileInfo: FileMetadata;
  timestamp: number;
}

export type TransferStatus =
  | 'waiting_approval'
  | 'connecting'
  | 'transferring'
  | 'completed'
  | 'declined'
  | 'cancelled'
  | 'error';

export interface ActiveTransfer {
  id: string; // unique transfer / file id
  direction: 'send' | 'receive';
  peerSocketId: string;
  peerName: string;
  peerAvatarEmoji: string;
  fileInfo: FileMetadata;
  file?: File; // present when direction === 'send'
  status: TransferStatus;
  progress: number; // 0 to 100
  bytesTransferred: number;
  speedBps: number; // bytes per second
  remainingSeconds: number;
  blobUrl?: string; // present when received
  errorMessage?: string;
  startTime: number;
  completedTime?: number;
}

export interface TransferHistoryItem {
  id: string;
  direction: 'send' | 'receive';
  fileName: string;
  fileSize: number;
  fileType: string;
  peerName: string;
  timestamp: number;
  blobUrl?: string;
  status: 'completed' | 'declined' | 'cancelled' | 'error';
}

export interface SharedTextItem {
  id: string;
  fromName: string;
  text: string;
  timestamp: number;
}
