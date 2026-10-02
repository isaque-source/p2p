import { DeviceType } from '../types';

const ADJECTIVES = [
  'Rápido', 'Ágil', 'Veloz', 'Sábio', 'Azul', 'Dourado', 'Brilhante',
  'Valente', 'Calmo', 'Curioso', 'Livre', 'Zen', 'Astuto', 'Amigável'
];

const ANIMALS = [
  { name: 'Golfinho', emoji: '🐬', color: '#0ea5e9' },
  { name: 'Falcão', emoji: '🦅', color: '#f59e0b' },
  { name: 'Lontra', emoji: '🦦', color: '#10b981' },
  { name: 'Raposa', emoji: '🦊', color: '#f97316' },
  { name: 'Panda', emoji: '🐼', color: '#64748b' },
  { name: 'Lince', emoji: '🐆', color: '#ec4899' },
  { name: 'Coruja', emoji: '🦉', color: '#8b5cf6' },
  { name: 'Lobo', emoji: '🐺', color: '#6366f1' },
  { name: 'Tartaruga', emoji: '🐢', color: '#14b8a6' },
  { name: 'Tigre', emoji: '🐯', color: '#eab308' },
  { name: 'Leão', emoji: '🦁', color: '#d97706' },
  { name: 'Pinguim', emoji: '🐧', color: '#3b82f6' },
];

export function detectDevice(): { os: string; deviceType: DeviceType } {
  if (typeof window === 'undefined') {
    return { os: 'Desconhecido', deviceType: 'desktop' };
  }

  const ua = navigator.userAgent;
  let os = 'Outro SO';
  let deviceType: DeviceType = 'desktop';

  // Detecção de SO
  if (/Macintosh|Mac OS X/i.test(ua)) {
    os = 'macOS';
    deviceType = 'desktop';
  } else if (/Windows NT/i.test(ua)) {
    os = 'Windows';
    deviceType = 'desktop';
  } else if (/Android/i.test(ua)) {
    os = 'Android';
    deviceType = /Tablet|iPad/i.test(ua) ? 'tablet' : 'mobile';
  } else if (/iPhone/i.test(ua)) {
    os = 'iOS';
    deviceType = 'mobile';
  } else if (/iPad/i.test(ua)) {
    os = 'iPadOS';
    deviceType = 'tablet';
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
    deviceType = 'desktop';
  }

  // Detecção de toque para tablets híbridos (ex: iPad com UserAgent de Mac)
  if (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && os === 'macOS') {
    os = 'iPadOS';
    deviceType = 'tablet';
  }

  return { os, deviceType };
}

export function generateInitialIdentity() {
  const { os, deviceType } = detectDevice();

  // Verifica se já temos salvo no localStorage
  const savedName = typeof window !== 'undefined' ? localStorage.getItem('dropp2p_device_name') : null;
  const savedColor = typeof window !== 'undefined' ? localStorage.getItem('dropp2p_avatar_color') : null;
  const savedEmoji = typeof window !== 'undefined' ? localStorage.getItem('dropp2p_avatar_emoji') : null;
  const savedPeerId = typeof window !== 'undefined' ? localStorage.getItem('dropp2p_peer_id') : null;

  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const adjective = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const randomName = `${animal.name} ${adjective} (${os})`;

  const peerId = savedPeerId || `peer_${Math.random().toString(36).substring(2, 10)}`;
  if (typeof window !== 'undefined' && !savedPeerId) {
    localStorage.setItem('dropp2p_peer_id', peerId);
  }

  return {
    peerId,
    deviceName: savedName || randomName,
    avatarColor: savedColor || animal.color,
    avatarEmoji: savedEmoji || animal.emoji,
    os,
    deviceType,
  };
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSecond)}/s`;
}

export function formatTimeRemaining(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return 'Calculando...';
  if (seconds < 60) return `${Math.ceil(seconds)}s restantes`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.ceil(seconds % 60);
  return `${mins}m ${secs}s restantes`;
}

export function getFileCategoryIcon(mimeType: string, fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (mimeType.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
    return 'image';
  }
  if (mimeType.startsWith('video/') || ['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext)) {
    return 'video';
  }
  if (mimeType.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'flac', 'm4a'].includes(ext)) {
    return 'audio';
  }
  if (['pdf', 'doc', 'docx', 'txt', 'rtf', 'odt', 'csv', 'xlsx'].includes(ext)) {
    return 'document';
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return 'archive';
  }
  if (['js', 'ts', 'tsx', 'jsx', 'html', 'css', 'json', 'py', 'c', 'cpp', 'rs', 'go'].includes(ext)) {
    return 'code';
  }
  return 'generic';
}
