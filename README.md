# DropP2P - Transferência de Arquivos Local P2P (Estilo AirDrop / Snapdrop)

Uma aplicação web completa, moderna e focada em privacidade para **transferência direta de arquivos ponto a ponto (P2P)** entre dispositivos conectados na mesma rede local (Wi-Fi), sem logins, sem instalação de software e sem enviar nenhum arquivo para servidores na nuvem.

---

## ⚡ Principais Características

- **100% P2P Local via WebRTC DataChannel**: Os arquivos são transmitidos diretamente da memória de um navegador para o outro através de canais de dados criptografados (DTLS).
- **Zero Arquivos na Nuvem**: O servidor atua apenas para **sinalização leve** (descoberta de pares e troca de SDP/ICE); ele nunca recebe nem armazena o conteúdo dos arquivos.
- **Descoberta Automática de Dispositivos**: Dispositivos na mesma rede física/Wi-Fi se descobrem instantaneamente via hash anônimo do IP público/local.
- **Interface Estilo AirDrop / Snapdrop**: Radar com ondas concêntricas, cartões com mascotes animais personalizáveis, anéis de progresso circulares e animações fluidas.
- **Arrastar e Soltar (Drag & Drop)**: Arraste arquivos de qualquer lugar da tela e solte sobre o avatar do aparelho de destino.
- **Fluxo com Autorização ("Aceitar" / "Recusar")**: O destinatário visualiza o nome, tamanho e remetente do arquivo antes de autorizar o download.
- **Fatiamento em Pedaços de 64KB com Backpressure**: Transfira arquivos gigantes com controle de fluxo (`bufferedAmountLowThreshold`) sem travar a aba do navegador.
- **Chimes e Efeitos Sonoros AirDrop**: Sons sintetizados em tempo real via **Web Audio API** (sem arquivos de áudio externos).
- **Salas com Código / PIN e QR Code**: Conecte celulares apontando a câmera para o QR Code ou digite um código de sala específico.
- **Compartilhamento Rápido de Texto**: Envie links, senhas ou anotações diretamente para a área de transferência do outro dispositivo.

---

## 🛠️ Tecnologias Utilizadas

| Camada | Tecnologia | Função |
| :--- | :--- | :--- |
| **P2P Data** | WebRTC (`RTCPeerConnection`, `RTCDataChannel`) | Transferência direta em blocos de 64KB |
| **Sinalização** | Node.js + Express + Socket.io | Descoberta de pares e roteamento de SDP |
| **Frontend Live** | React 19 + TypeScript + Tailwind CSS | Interface SPA responsiva e interativa |
| **Frontend Puro** | HTML5, CSS3 e Vanilla JS (`/vanilla`) | Código puro sem dependências de frameworks |
| **Áudio** | Web Audio API (`AudioContext`) | Síntese de tons e alertas sonoros |

---

## 🚀 Como Executar Localmente

### 1. Pré-requisitos
- **Node.js** (versão 18 ou superior)
- Gerenciador de pacotes **npm** ou **bun**

### 2. Instalação das Dependências
Clone o repositório ou navegue até a pasta do projeto e execute:

```bash
npm install
```

### 3. Iniciar a Aplicação (Servidor Full-Stack com Vite)
Para rodar a aplicação completa com suporte à interface moderna:

```bash
npm run dev
```

O servidor iniciará na porta **3000**:
- Acesse no navegador: **`http://localhost:3000`**

### 4. Alternativa: Executar a Versão Pura Vanilla (Sem React)
Também fornecemos uma versão 100% Vanilla em `/vanilla`:

```bash
node server.js
```
Acesse `http://localhost:3000` para testar a interface nativa em HTML/CSS/JS.

---

## 📱 Como Testar em Vários Dispositivos

1. **No Mesmo Computador**:
   - Abra `http://localhost:3000` na sua janela principal.
   - Abra uma **janela anônima** ou outro navegador (ex: Chrome e Firefox).
   - Você verá os dois aparelhos aparecendo instantaneamente no radar com mascotes diferentes!
   - Clique em um dispositivo ou arraste um arquivo sobre ele para testar.

2. **No Celular e no Computador (Mesmo Wi-Fi)**:
   - Descubra o IP local do seu computador na rede (ex: `192.168.1.15`).
   - No computador, clique no botão **QR Code** no DropP2P.
   - Aponte a câmera do seu celular para o QR Code ou acesse `http://IP_DO_SEU_PC:3000`.
   - Aceite a transferência no celular e veja a velocidade máxima da rede local sem passar pela internet!

---

## 📂 Estrutura do Código

```
├── server.ts             # Servidor de sinalização Full-Stack integrado com Vite
├── server.js             # Servidor de sinalização Vanilla puro (Node.js + Socket.io)
├── src/
│   ├── App.tsx           # Orquestração do estado P2P, modais e drag-and-drop
│   ├── types.ts          # Interfaces TypeScript (PeerInfo, Transfer, etc.)
│   ├── services/
│   │   └── webrtc.ts     # Gerenciador WebRTC com chunking de 64KB e backpressure
│   ├── utils/
│   │   ├── audio.ts      # Chimes inspirados no AirDrop gerados via Web Audio API
│   │   └── device.ts     # Detecção de SO, nomes amigáveis e formatações
│   └── components/
│       ├── Header.tsx        # Barra superior com status da rede e controles
│       ├── RadarArena.tsx    # Radar central estilo AirDrop com órbitas
│       ├── IncomingModal.tsx # Modal de aprovação ("Aceitar" / "Recusar")
│       ├── TransferDrawer.tsx# Barra de progresso com velocidade e tempo restante
│       ├── SuccessModal.tsx  # Confetes e botão para salvar o arquivo recebido
│       ├── RoomModal.tsx     # Gerador de QR Code e salas personalizadas
│       ├── ProfileModal.tsx  # Editor de apelido, emoji e cor do dispositivo
│       ├── TextShareModal.tsx# Compartilhamento rápido de texto e links
│       └── HistoryModal.tsx  # Histórico de transferências da sessão
└── vanilla/
    ├── index.html        # Frontend HTML5 puro
    ├── style.css         # Estilização CSS3 pura responsiva
    └── client.js         # Código Vanilla JS com WebRTC e Socket.io
```

---

## 🔒 Segurança e Privacidade

- **Criptografia E2E**: Todo canal de dados WebRTC utiliza **DTLS (Datagram Transport Layer Security)** por especificação do protocolo.
- **Privacidade de IP**: Os IPs dos clientes nunca são expostos publicamente; o servidor calcula um hash criptográfico SHA-256 truncado para agrupar as salas.
- **Nenhum Rastreamento**: Não há banco de dados nem cookies de rastreamento. As conexões são voláteis e encerram ao fechar a aba.
