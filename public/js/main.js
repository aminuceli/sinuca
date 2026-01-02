// =============================================================================
// 1. CONFIGURAÇÕES E CONSTANTES
// =============================================================================
const CONSTANTS = {
    TABLE_WIDTH: 800,
    TABLE_HEIGHT: 400,
    OFFSET_X: 25,
    OFFSET_Y: 25,
    BALL_RADIUS: 11.5,
    POCKET_RADIUS: 28,
    TOTAL_W: 800,
    TOTAL_H: 400,
    // Cores para o 3D
    BALL_COLORS: [
        0xffffff, // 0 - Branca
        0xffd700, 0x0000ff, 0xff0000, 0x800080, 0xffa500, 0x008000, 0x800000, // 1-7 (Lisas)
        0x111111, // 8 - Preta
        0xffd700, 0x0000ff, 0xff0000, 0x800080, 0xffa500, 0x008000, 0x800000  // 9-15 (Listradas)
    ]
};

// =============================================================================
// 2. ESTADO DO JOGO
// =============================================================================
const GameState = {
    ballsMap: new Map(), // Onde guardamos as bolas recebidas do servidor
    meta: null,          // Placar, Turno, Vencedor
    aimAngle: 0,         // Ângulo da mira
    mouse: {
        isDragging: false,
        startX: 0,
        startY: 0,
        pullBackDist: 0
    }
};

// =============================================================================
// 3. SISTEMA DE ÁUDIO
// =============================================================================
const audioSystem = {
    ctx: new (window.AudioContext || window.webkitAudioContext)(),
    
    loadSounds() {
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },

    play(type, vol = 1) {
        if (this.ctx.state === 'suspended') return;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        const now = this.ctx.currentTime;

        if (type === 'cue') { // Som de tacada
            osc.frequency.setValueAtTime(600, now);
            osc.frequency.exponentialRampToValueAtTime(100, now + 0.1);
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'hit') { // Batida de bola
            osc.frequency.setValueAtTime(300, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.05);
            gain.gain.setValueAtTime(vol, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        } else if (type === 'pocket') { // Caçapa
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.linearRampToValueAtTime(50, now + 0.3);
            gain.gain.setValueAtTime(vol, now);
            gain.gain.linearRampToValueAtTime(0, now + 0.3);
            osc.start(now);
            osc.stop(now + 0.3);
        } else if (type === 'cushion') { // Tabela
            osc.frequency.setValueAtTime(200, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 0.05);
            gain.gain.setValueAtTime(vol * 0.8, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
            osc.start(now);
            osc.stop(now + 0.1);
        }
    },
    toggleMusic() {} 
};

// =============================================================================
// 4. GRÁFICOS 3D (Bolas) - Usando THREE.js global
// =============================================================================
let scene, camera, renderer;
const spheres = new Map();

function init3D(canvasDOM) {
    if (!window.THREE) return; // Proteção caso Three.js não carregue

    const w = canvasDOM.parentElement.clientWidth;
    const h = canvasDOM.parentElement.clientHeight;

    scene = new THREE.Scene();
    
    // Luzes
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(50, 50, 100);
    scene.add(dirLight);

    // Câmera Ortográfica (Visão Top-Down perfeita)
    camera = new THREE.OrthographicCamera(w / -2, w / 2, h / 2, h / -2, 1, 1000);
    camera.position.set(CONSTANTS.TABLE_WIDTH / 2, CONSTANTS.TABLE_HEIGHT / 2, 100);
    camera.lookAt(CONSTANTS.TABLE_WIDTH / 2, CONSTANTS.TABLE_HEIGHT / 2, 0);

    renderer = new THREE.WebGLRenderer({ canvas: canvasDOM, alpha: true, antialias: true });
    renderer.setSize(w, h);
}

function render3D() {
    if (!renderer) return;

    // Sincroniza bolas do servidor com as esferas 3D
    GameState.ballsMap.forEach((ballData, id) => {
        let sphere = spheres.get(id);
        
        // Cria a bola se não existir
        if (!sphere) {
            const geometry = new THREE.SphereGeometry(CONSTANTS.BALL_RADIUS, 32, 32);
            const colorHex = CONSTANTS.BALL_COLORS[id] || 0xffffff;
            const material = new THREE.MeshPhongMaterial({ color: colorHex, shininess: 80 });
            sphere = new THREE.Mesh(geometry, material);
            
            // Marcação visual simples para listradas (9-15)
            if (id >= 9 && id <= 15) {
                const stripeGeo = new THREE.CylinderGeometry(11.6, 11.6, 10, 32, 1, true);
                const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
                const stripe = new THREE.Mesh(stripeGeo, stripeMat);
                stripe.rotation.z = Math.PI / 2;
                sphere.add(stripe);
            }

            scene.add(sphere);
            spheres.set(id, sphere);
        }

        // Atualiza Posição (Adiciona margem da mesa)
        const visualX = ballData.x + CONSTANTS.OFFSET_X;
        const visualY = ballData.y + CONSTANTS.OFFSET_Y;
        sphere.position.set(visualX, visualY, 0);

        // Efeito Fantasma (Bola na Mão)
        if (ballData.state === 'placing') {
            sphere.material.opacity = 0.5;
            sphere.material.transparent = true;
        } else {
            sphere.material.opacity = 1;
            sphere.material.transparent = false;
        }

        // Rotação simulada baseada na velocidade
        sphere.rotation.x += (ballData.vy || 0) * 0.05;
        sphere.rotation.y -= (ballData.vx || 0) * 0.05;
    });

    // Remove bolas que não existem mais (caíram)
    spheres.forEach((mesh, id) => {
        if (!GameState.ballsMap.has(id)) {
            scene.remove(mesh);
            spheres.delete(id);
        }
    });

    renderer.render(scene, camera);
}

// =============================================================================
// 5. INTERFACE (UI) E PLACAR
// =============================================================================
const ui = {
    p1Card: document.getElementById('p1Card'),
    p2Card: document.getElementById('p2Card'),
    p1Score: document.getElementById('p1Score'),
    p2Score: document.getElementById('p2Score'),
    p1Group: document.getElementById('p1Group'),
    p2Group: document.getElementById('p2Group'),
    
    phaseTitle: document.getElementById('phaseTitle'),
    phaseMsg: document.getElementById('phaseMsg'),
    foulMsg: document.getElementById('foulMsg'),
    
    overlay: document.getElementById('game-overlay'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayMsg: document.getElementById('overlay-msg'),
    lobbyBtn: document.getElementById('btn-lobby')
};

if(ui.lobbyBtn) ui.lobbyBtn.addEventListener('click', () => window.location.reload());

function setStatus(title, msg, color = "#fff") {
    if(ui.phaseTitle) { ui.phaseTitle.textContent = title; ui.phaseTitle.style.color = color; }
    if(ui.phaseMsg) ui.phaseMsg.textContent = msg;
}

function updateHUD(myId) {
    if (!GameState.meta) return;
    const { players, currentTurn, phase, winner, shot } = GameState.meta;
    const p1 = players.p1;
    const p2 = players.p2;

    // Atualiza Textos
    if(ui.p1Score) ui.p1Score.textContent = p1.score;
    if(ui.p2Score) ui.p2Score.textContent = p2.score;
    
    const labelGroup = (g) => (!g ? "-" : (g === 'solid' ? "LISAS" : "LISTRADAS"));
    if(ui.p1Group) ui.p1Group.textContent = labelGroup(p1.group);
    if(ui.p2Group) ui.p2Group.textContent = labelGroup(p2.group);

    const isMeP1 = (myId === p1.id);
    const isMeP2 = (myId === p2.id);

    // Destaque do Turno
    if(ui.p1Card) ui.p1Card.className = (currentTurn === 'p1') ? "player-pill p1-pill p1-active" : "player-pill p1-pill";
    if(ui.p2Card) ui.p2Card.className = (currentTurn === 'p2') ? "player-pill p2-pill p2-active" : "player-pill p2-pill";

    // Lógica de Mensagens
    if (winner) {
        ui.overlay.classList.remove('hidden');
        const iWon = (winner === myId) || (winner === 'p1' && isMeP1) || (winner === 'p2' && isMeP2);
        ui.overlayTitle.textContent = iWon ? "VITÓRIA!" : "DERROTA";
        ui.overlayTitle.style.color = iWon ? "#00ff00" : "#ff0055";
        ui.overlayMsg.textContent = iWon ? "Parabéns, você venceu!" : "Tente novamente.";
    } 
    else if (phase === 'waiting_players') {
        ui.overlay.classList.remove('hidden');
        ui.overlayTitle.textContent = "AGUARDANDO";
        ui.overlayMsg.textContent = "Esperando oponente...";
        if(ui.lobbyBtn) ui.lobbyBtn.classList.add('hidden');
    } 
    else {
        ui.overlay.classList.add('hidden'); // Esconde overlay durante o jogo

        if (phase === 'placing_cue') {
            const isMyTurn = (currentTurn === 'p1' && isMeP1) || (currentTurn === 'p2' && isMeP2);
            if(isMyTurn) setStatus("BOLA NA MÃO", "Toque na mesa para posicionar", "#00ffff");
            else setStatus("OPONENTE POSICIONANDO", "Aguarde...", "#ffd700");
        } else {
            const isMyTurn = (currentTurn === 'p1' && isMeP1) || (currentTurn === 'p2' && isMeP2);
            if(isMyTurn) setStatus("SUA VEZ", "Arraste para tacar", "#00ff00");
            else setStatus(`VEZ DE ${currentTurn === 'p1' ? 'P1' : 'P2'}`, "Aguarde...", "#ffd700");
        }
    }

    // Alerta de Falta
    if (shot && shot.foul) {
        ui.foulMsg.textContent = `FALTA: ${shot.reason}`;
        ui.foulMsg.style.display = 'block';
        setTimeout(() => { ui.foulMsg.style.display = 'none'; }, 3000);
    }
}

// =============================================================================
// 6. LÓGICA DO JOGO (MAIN)
// =============================================================================
const lobbyScreen = document.getElementById('lobby-screen');
const gameScreen = document.getElementById('game-screen');
const roomInput = document.getElementById('roomInput');
const btnJoin = document.getElementById('btnJoin');
const activeRoomsList = document.getElementById('activeRoomsList');
const lobbyStatus = document.getElementById('lobbyStatus');
const btnLeave = document.getElementById('btnLeave'); 
const btnBot = document.getElementById('btnBot'); 

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const glCanvas = document.getElementById('glCanvas');

canvas.width = CONSTANTS.TOTAL_W;
canvas.height = CONSTANTS.TOTAL_H;

// Variáveis Locais
let currentRoom = null;
let myId = null;
let isDragging = false;
let startDragX = 0, startDragY = 0;

// Inicializa o 3D
init3D(glCanvas);

// Conexão Socket
const socket = io();

socket.on('connect', () => {
    myId = socket.id;
    if(lobbyStatus) {
        lobbyStatus.textContent = "Conectado! Escolha uma sala.";
        lobbyStatus.style.color = "#00ff00";
    }
});

// Funções de Tela Cheia
function goFullscreen() {
    const elem = document.documentElement;
    if (elem.requestFullscreen) { elem.requestFullscreen().catch(() => {}); }
    else if (elem.webkitRequestFullscreen) { elem.webkitRequestFullscreen(); }
}

// Lobby
if(btnJoin) btnJoin.addEventListener('click', () => {
    goFullscreen();
    const room = roomInput.value.trim();
    if(room.length < 3) return alert("Nome muito curto!");
    socket.emit('joinRoom', room);
});

if(btnBot) btnBot.addEventListener('click', () => {
    goFullscreen();
    socket.emit('createBotRoom');
});

socket.on('roomJoined', (data) => {
    currentRoom = data.roomId;
    lobbyScreen.classList.add('hidden');
    gameScreen.classList.remove('hidden');
    // Força redimensionamento
    setTimeout(() => { 
        canvas.width = CONSTANTS.TOTAL_W; 
        canvas.height = CONSTANTS.TOTAL_H; 
        init3D(glCanvas); 
    }, 100);
});

socket.on('roomList', (rooms) => {
    if(!activeRoomsList) return;
    activeRoomsList.innerHTML = '';
    if (rooms.length === 0) {
        activeRoomsList.innerHTML = '<div class="empty-list">Nenhuma sala ativa...</div>';
        return;
    }
    rooms.forEach(room => {
        const div = document.createElement('div');
        div.className = 'room-item';
        div.innerHTML = `
            <div class="room-name">${room.id}</div>
            <button class="btn-join-small" onclick="window.joinExisting('${room.id}')">ENTRAR</button>
        `;
        activeRoomsList.appendChild(div);
    });
});

// Hack para o onclick do HTML funcionar
window.joinExisting = (rid) => {
    goFullscreen();
    socket.emit('joinRoom', rid);
};

if(btnLeave) btnLeave.addEventListener('click', () => {
    socket.emit('leaveRoom');
    window.location.reload();
});

document.getElementById('btnReset').addEventListener('click', () => socket.emit('reset'));

// RECEBE DADOS DO SERVIDOR
socket.on('init', (serverBalls) => {
    GameState.ballsMap.clear();
    serverBalls.forEach(b => GameState.ballsMap.set(b.id, { ...b }));
});

socket.on('gameState', (serverBalls) => {
    serverBalls.forEach(sb => {
        let local = GameState.ballsMap.get(sb.id);
        if(!local) local = { ...sb };
        // Atualiza dados físicos
        local.x = sb.x; local.y = sb.y; local.vx = sb.vx; local.vy = sb.vy; local.state = sb.state;
        GameState.ballsMap.set(sb.id, local);
    });
    // Remove bolas extras
    if(serverBalls.length < GameState.ballsMap.size) {
        const ids = new Set(serverBalls.map(b=>b.id));
        for(let id of GameState.ballsMap.keys()) if(!ids.has(id)) GameState.ballsMap.delete(id);
    }
});

socket.on('meta', (m) => {
    GameState.meta = m;
    updateHUD(myId || socket.id);
});

socket.on('audioBatch', (events) => {
    if(!currentRoom) return;
    events.forEach(evt => audioSystem.play(evt.type, evt.vol));
});

socket.on('syncAim', (data) => {
    // Sincroniza mira do oponente
    if (GameState.meta) {
        const turnKey = GameState.meta.currentTurn;
        const activePlayerId = GameState.meta.players[turnKey]?.id;
        if (activePlayerId !== (myId || socket.id)) {
            GameState.aimAngle = data.angle;
            GameState.mouse.pullBackDist = data.force; 
        }
    }
});

// =============================================================================
// 7. INPUTS (MOUSE E TOUCH UNIFICADOS)
// =============================================================================
function handleInputStart(x, y) {
    if(!currentRoom) return;
    
    // Inicia Áudio no primeiro toque
    audioSystem.loadSounds();

    // 1. LÓGICA DE POSICIONAR BOLA (Bola na Mão)
    if (GameState.meta && GameState.meta.phase === 'placing_cue') {
        const turnKey = GameState.meta.currentTurn;
        const activePlayerId = GameState.meta.players[turnKey]?.id;
        
        if (activePlayerId === (myId || socket.id)) {
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const mx = (x - rect.left) * scaleX;
            const my = (y - rect.top) * scaleY;
            
            // Envia posição corrigida pelo Offset do servidor
            socket.emit('placeCueBall', { 
                x: mx - CONSTANTS.OFFSET_X, 
                y: my - CONSTANTS.OFFSET_Y 
            });
        }
        return;
    }

    // 2. LÓGICA DE TACADA
    if (GameState.meta) {
        const turnKey = GameState.meta.currentTurn;
        const activePlayerId = GameState.meta.players[turnKey]?.id;
        if (activePlayerId !== (myId || socket.id)) return;
    }

    const white = GameState.ballsMap.get(0);
    if (!white || white.state !== 'active') return;

    isDragging = true;
    const rect = canvas.getBoundingClientRect();
    startDragX = x - rect.left;
    startDragY = y - rect.top;
    
    GameState.mouse.isDragging = true;
    GameState.mouse.pullBackDist = 0;
}

function handleInputMove(x, y) {
    if(!currentRoom) return;
    
    // Ignora se estiver na fase de posicionar
    if (GameState.meta && GameState.meta.phase === 'placing_cue') return;

    const white = GameState.ballsMap.get(0);
    if (!white || white.state !== 'active') return;

    // Se não é minha vez, não mira
    if (GameState.meta) {
        const turnKey = GameState.meta.currentTurn;
        const activePlayerId = GameState.meta.players[turnKey]?.id;
        if (activePlayerId !== (myId || socket.id)) return;
    }

    const rect = canvas.getBoundingClientRect();
    const mx = x - rect.left;
    const my = y - rect.top;

    if (isDragging) {
        const dx = mx - startDragX;
        const dy = my - startDragY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        GameState.mouse.pullBackDist = Math.min(160, dist);
    } else {
        // Mira (Taco girando em volta da branca)
        const cx = white.x + CONSTANTS.OFFSET_X;
        const cy = white.y + CONSTANTS.OFFSET_Y;
        // Compensa escala do canvas se necessário
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        GameState.aimAngle = Math.atan2((my * scaleY) - cy, (mx * scaleX) - cx);
    }

    socket.emit('syncAim', {
        angle: GameState.aimAngle,
        force: GameState.mouse.pullBackDist
    });
}

function handleInputEnd() {
    if (isDragging) {
        if (GameState.mouse.pullBackDist > 5) {
            const force = (GameState.mouse.pullBackDist / 160) * 50; // Força máx 50
            audioSystem.play('cue', force / 50);
            socket.emit('shoot', {
                angle: GameState.aimAngle,
                force: force
            });
        }
        isDragging = false;
        GameState.mouse.isDragging = false;
        GameState.mouse.pullBackDist = 0;
        // Reseta visual da força
        socket.emit('syncAim', { angle: GameState.aimAngle, force: 0 });
    }
}

// Event Listeners (Mouse)
canvas.addEventListener('mousedown', (e) => handleInputStart(e.clientX, e.clientY));
window.addEventListener('mousemove', (e) => handleInputMove(e.clientX, e.clientY));
window.addEventListener('mouseup', handleInputEnd);

// Event Listeners (Touch - Celular)
canvas.addEventListener('touchstart', (e) => {
    if(e.touches.length > 1) return;
    e.preventDefault();
    handleInputStart(e.touches[0].clientX, e.touches[0].clientY);
}, {passive: false});

window.addEventListener('touchmove', (e) => {
    e.preventDefault(); 
    handleInputMove(e.touches[0].clientX, e.touches[0].clientY);
}, {passive: false});

window.addEventListener('touchend', handleInputEnd);


// =============================================================================
// 8. RENDERIZAÇÃO (LOOP 2D)
// =============================================================================
function drawTable2D() {
    const { OFFSET_X, OFFSET_Y, TABLE_WIDTH, TABLE_HEIGHT, POCKET_RADIUS, TOTAL_W, TOTAL_H } = CONSTANTS;
    
    // Fundo
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, TOTAL_W, TOTAL_H);
    ctx.fillStyle = '#2b8a3e'; // Feltro
    ctx.fillRect(OFFSET_X, OFFSET_Y, TABLE_WIDTH - OFFSET_X*2, TABLE_HEIGHT - OFFSET_Y*2);

    // Caçapas
    ctx.fillStyle = '#000';
    const pockets = [
        {x: OFFSET_X, y: OFFSET_Y},
        {x: TABLE_WIDTH/2, y: OFFSET_Y - 5},
        {x: TABLE_WIDTH - OFFSET_X, y: OFFSET_Y},
        {x: OFFSET_X, y: TABLE_HEIGHT - OFFSET_Y},
        {x: TABLE_WIDTH/2, y: TABLE_HEIGHT - OFFSET_Y + 5},
        {x: TABLE_WIDTH - OFFSET_X, y: TABLE_HEIGHT - OFFSET_Y}
    ];
    pockets.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, POCKET_RADIUS, 0, Math.PI*2); ctx.fill();
    });
}

function drawCue2D(white) {
    if(!white) return;
    const { OFFSET_X, OFFSET_Y } = CONSTANTS;
    const cx = white.x + OFFSET_X;
    const cy = white.y + OFFSET_Y;
    
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(GameState.aimAngle);

    // Guia de Mira
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(300, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.stroke();

    // Taco
    const dist = 25 + GameState.mouse.pullBackDist;
    ctx.beginPath();
    ctx.moveTo(-dist, -3);
    ctx.lineTo(-(dist+300), -6);
    ctx.lineTo(-(dist+300), 6);
    ctx.lineTo(-dist, 3);
    ctx.fillStyle = '#8B4513';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.setLineDash([]);
    ctx.stroke();

    ctx.restore();
}

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (currentRoom) {
        drawTable2D();
        
        const white = GameState.ballsMap.get(0);
        // Desenha taco apenas se estiver jogando e for sua vez (ou visualização local)
        const isPlaying = (GameState.meta && GameState.meta.phase === 'playing');
        
        // Verifica velocidade para não desenhar taco enquanto bola rola
        const stopped = white && Math.abs(white.vx||0) < 0.05 && Math.abs(white.vy||0) < 0.05;

        if (white && white.state === 'active' && isPlaying && stopped) {
            drawCue2D(white);
        }
    }
    
    render3D(); // Renderiza as bolas (Three.js)
    requestAnimationFrame(loop);
}

// Inicia
loop();
