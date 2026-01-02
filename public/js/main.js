import { CONSTANTS } from './constants.js';
import { GameState } from './state.js';
import { init3D, render3D } from './balls.js';
import { drawTable } from './table.js';
import { drawCue } from './cue.js';
import { drawAimGuide } from './aim.js';
import { updateHUD, setStatus, showError } from './ui.js';
import { audioSystem } from './audio.js'; 

// --- ELEMENTOS DO DOM ---
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const roomInput = document.getElementById('roomInput');
const btnJoin = document.getElementById('btnJoin');
const activeRoomsList = document.getElementById('activeRoomsList');
const lobbyStatus = document.getElementById('lobbyStatus');
const btnLeave = document.getElementById('btnLeave'); 
const btnBot = document.getElementById('btnBot'); 

// --- CONFIGURAÇÃO CANVAS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const glCanvas = document.getElementById('glCanvas');

canvas.width = CONSTANTS.TOTAL_W;
canvas.height = CONSTANTS.TOTAL_H;

// Variáveis de Controle
const keys = {}; 
let isDragging = false;
let startDragX = 0;
let startDragY = 0;
let myId = null; 
let currentRoom = null; 

// Inicializa 3D
init3D(glCanvas);

// --- CONEXÃO SOCKET ---
const socket = io();

socket.on('connect', () => {
    myId = socket.id;
    console.log("Conectado! ID:", myId);
    if(lobbyStatus) {
        lobbyStatus.textContent = "Conectado! Escolha uma sala.";
        lobbyStatus.style.color = "#00ff00";
    }
});

// --- FUNÇÃO PARA TELA CHEIA (MOBILE) ---
function goFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) { elem.requestFullscreen().catch(() => {}); }
    else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
}

// --- LÓGICA DO LOBBY ---
socket.on('roomList', (rooms) => {
    if(!activeRoomsList) return;
    activeRoomsList.innerHTML = ''; 

    if (rooms.length === 0) {
        activeRoomsList.innerHTML = '<div class="empty-list">Nenhuma sala ativa...<br>Seja o primeiro!</div>';
        return;
    }

    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-item';
        const isFull = room.count >= 2;
        const btnText = isFull ? "ASSISTIR" : "JOGAR";
        const btnClass = isFull ? "btn-join-small watch" : "btn-join-small";

        div.innerHTML = `
            <div class="room-info">
                <div class="room-name">${room.id.toUpperCase()}</div>
                <div class="room-count">${room.count}/2 - ${room.status}</div>
            </div>
            <button class="${btnClass}" data-room="${room.id}">${btnText}</button>
        `;
        activeRoomsList.appendChild(div);
    });

    document.querySelectorAll('.btn-join-small').forEach(btn => {
        btn.addEventListener('click', (e) => {
            goFullscreen(); // Tenta tela cheia ao clicar
            const roomToJoin = e.target.getAttribute('data-room');
            joinGame(roomToJoin);
        });
    });
});

if(btnJoin) {
    btnJoin.addEventListener('click', () => {
        goFullscreen(); // Tenta tela cheia
        const roomName = roomInput.value.trim();
        if(roomName.length < 3) {
            lobbyStatus.textContent = "Nome muito curto (min 3 letras).";
            lobbyStatus.style.color = "red";
            return;
        }
        joinGame(roomName);
    });
}

if(btnBot) {
    btnBot.addEventListener('click', () => {
        goFullscreen(); // Tenta tela cheia
        if(lobbyStatus) lobbyStatus.textContent = "Criando partida contra CPU...";
        socket.emit('createBotRoom');
    });
}

function joinGame(roomName) {
    if(lobbyStatus) lobbyStatus.textContent = "Entrando...";
    socket.emit('joinRoom', roomName);
}

// Sucesso ao entrar
socket.on('roomJoined', (data) => {
    console.log("Entrou na sala:", data);
    currentRoom = data.roomId;
    
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    
    const roleText = data.role === 'spectator' ? 'Espectador' : 'Jogando';
    const roleLine = document.getElementById('roleLine');
    if(roleLine) roleLine.textContent = `Sala: ${currentRoom.toUpperCase()} (${roleText})`;
    
    resizeCanvas();
    setTimeout(() => { window.dispatchEvent(new Event('resize')); }, 50);
});

// Sair da Sala
if(btnLeave) btnLeave.addEventListener('click', exitToLobby);

const btnOverlayLobby = document.getElementById('btn-lobby');
if(btnOverlayLobby) {
    btnOverlayLobby.addEventListener('click', () => {
        exitToLobby();
        document.getElementById('game-overlay').classList.add('hidden');
    });
}

function exitToLobby() {
    socket.emit('leaveRoom'); 
    gameScreen.classList.add('hidden');
    lobbyScreen.classList.remove('hidden');
    currentRoom = null;
    lobbyStatus.textContent = "Saiu da sala.";
    lobbyStatus.style.color = "#ccc";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function resizeCanvas() {
    canvas.width = CONSTANTS.TOTAL_W;
    canvas.height = CONSTANTS.TOTAL_H;
}


// --- EVENTOS DO JOGO ---

socket.on('disconnect', () => showError("Desconectado do servidor."));

socket.on('init', (serverBalls) => {
    GameState.ballsMap.clear();
    serverBalls.forEach(b => GameState.ballsMap.set(b.id, { ...b }));
});

socket.on('gameState', (serverBalls) => {
    serverBalls.forEach(sb => {
        let local = GameState.ballsMap.get(sb.id);
        if(!local) local = { ...sb, scale: 1 };
        local.x = sb.x; local.y = sb.y; local.vx = sb.vx; local.vy = sb.vy;
        
        if ((sb.scale ?? 1) < 1) {
            if(local.scale === undefined) local.scale = 1;
            local.scale = local.scale * 0.92; 
            if (local.scale < 0.03) local.scale = 0;
        } else {
             local.scale = 1;
        }
        GameState.ballsMap.set(sb.id, local);
    });
    
    if (serverBalls.length < GameState.ballsMap.size) {
        const ids = new Set(serverBalls.map(b=>b.id));
        for(let id of GameState.ballsMap.keys()) if(!ids.has(id)) GameState.ballsMap.delete(id);
    }
});

socket.on('meta', (m) => {
    GameState.meta = m;
    const currentId = myId || socket.id;
    updateHUD(currentId);
});

socket.on('syncAim', (data) => {
    if (GameState.meta) {
        const turnKey = GameState.meta.currentTurn;
        const activePlayerId = GameState.meta.players[turnKey]?.id;
        const currentId = myId || socket.id;

        if (activePlayerId !== currentId) {
            GameState.aimAngle = data.angle;
            GameState.mouse.pullBackDist = data.force; 
            GameState.mouse.isDragging = (data.force > 0);
        }
    }
});

document.getElementById('btnReset').addEventListener('click', () => socket.emit('reset'));


// --- CONTROLES (TECLADO E MOUSE/TOUCH) ---
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// === CORREÇÃO PARA CELULAR: TOUCH EVENTS ===
function touchHandler(event) {
    if (event.touches.length > 1) return; // Ignora zoom com dois dedos
    
    const touch = event.changedTouches[0];
    const type = {
        "touchstart": "mousedown",
        "touchmove": "mousemove",
        "touchend": "mouseup"
    }[event.type];

    const mouseEvent = new MouseEvent(type, {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true
    });

    if (type === "mousemove") event.preventDefault(); 
    canvas.dispatchEvent(mouseEvent);
}
canvas.addEventListener("touchstart", touchHandler, {passive: false});
canvas.addEventListener("touchmove", touchHandler, {passive: false});
canvas.addEventListener("touchend", touchHandler, {passive: false});


// MOUSE DOWN UNIFICADO
canvas.addEventListener('mousedown', (e) => {
    if(!currentRoom) return;
    
    // 1. POSICIONAR BOLA
    if (GameState.meta && GameState.meta.phase === 'placing_cue') {
        const turnKey = GameState.meta.currentTurn;
        const activePlayerId = GameState.meta.players[turnKey]?.id;
        const currentId = myId || socket.id;

        if (activePlayerId === currentId) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;

            const mx = (e.clientX - rect.left) * scaleX;
            const my = (e.clientY - rect.top) * scaleY;
            
            const { OFFSET_X, OFFSET_Y } = CONSTANTS;
            socket.emit('placeCueBall', { 
                x: mx - OFFSET_X, 
                y: my - OFFSET_Y 
            });
        }
        return; 
    }

    // 2. TACADA
    if (GameState.meta) {
        const turnKey = GameState.meta.currentTurn;
        const activePlayerId = GameState.meta.players[turnKey]?.id;
        const currentId = myId || socket.id;
        if (activePlayerId !== currentId) return;
    }
    const white = GameState.ballsMap.get(0);
    if (!white) return;
    if (keys['ShiftLeft'] || keys['ShiftRight']) return;

    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    startDragX = e.clientX - rect.left;
    startDragY = e.clientY - rect.top;
    
    GameState.mouse.isDragging = true;
    GameState.mouse.startX = startDragX;
    GameState.mouse.startY = startDragY;
    GameState.mouse.pullBackDist = 0;
});

canvas.addEventListener('mousemove', (e) => {
    if(!currentRoom) return;
    const white = GameState.ballsMap.get(0);
    
    // Se a branca não existe ou está se movendo, ou está caindo, não mira
    if (!white || (white.scale||1) < 1 || Math.hypot(white.vx||0, white.vy||0) > 0.1) return;

    // Se estiver posicionando bola, não desenha mira de taco
    if (GameState.meta && GameState.meta.phase === 'placing_cue') return;

    if (GameState.meta) {
        const turnKey = GameState.meta.currentTurn;
        const activePlayerId = GameState.meta.players[turnKey]?.id;
        const currentId = myId || socket.id;
        if (activePlayerId !== currentId) return; 
    }

    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (isDragging) {
        const dx = mx - startDragX;
        const dy = my - startDragY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        GameState.mouse.pullBackDist = Math.min(160, dist);
    } else {
        const { OFFSET_X, OFFSET_Y } = CONSTANTS;
        const cx = white.x + OFFSET_X;
        const cy = white.y + OFFSET_Y;

        if (keys['ShiftLeft'] || keys['ShiftRight']) {
            if (e.movementX !== 0 || e.movementY !== 0) {
                GameState.aimAngle += e.movementX * 0.003; 
            }
        } else {
            GameState.aimAngle = Math.atan2(my - cy, mx - cx);
        }
    }
    socket.emit('syncAim', {
        angle: GameState.aimAngle,
        force: GameState.mouse.pullBackDist
    });
});

window.addEventListener('mouseup', (e) => {
    if (isDragging) {
        if (GameState.mouse.pullBackDist > 5) {
            const force = (GameState.mouse.pullBackDist / 160) * 50;
            audioSystem.play('cue', force / 50);
            socket.emit('shoot', {
                angle: GameState.aimAngle,
                force: force
            });
        }
        isDragging = false;
        GameState.mouse.isDragging = false;
        GameState.mouse.pullBackDist = 0;
    }
});

// --- ÁUDIO ---
document.addEventListener('click', () => {
    audioSystem.loadSounds();
    audioSystem.toggleMusic();
    if (audioSystem.ctx.state === 'suspended') audioSystem.ctx.resume();
}, { once: true });

socket.on('audioBatch', (events) => {
    if(!currentRoom) return;
    events.forEach(evt => {
        if (evt.type === 'hit') audioSystem.play(evt.variant, evt.vol);
        else if (evt.type === 'cushion') audioSystem.play('cushion', evt.vol);
        else if (evt.type === 'pocket') audioSystem.play('pocket', 1.0);
    });
});

// --- LOOP ---
function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if(currentRoom) {
        const precisionSpeed = 0.002; 
        if (keys['ArrowLeft']) GameState.aimAngle -= precisionSpeed;
        if (keys['ArrowRight']) GameState.aimAngle += precisionSpeed;

        drawTable(ctx);
        const white = GameState.ballsMap.get(0);
        
        // Só desenha taco se a branca estiver parada E a fase for 'playing'
        const isPlaying = (GameState.meta && GameState.meta.phase === 'playing');
        
        if (white && (white.scale||1) >= 1 && Math.hypot(white.vx||0, white.vy||0) < 0.15 && isPlaying) {
            drawAimGuide(ctx, white);
            drawCue(ctx, white);
        }
    }
    render3D(); 
    requestAnimationFrame(loop);
}
loop();
