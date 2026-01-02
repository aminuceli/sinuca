import { GameState } from './state.js';

const ui = {
    // Placar e Cards
    p1Card: document.getElementById('p1Card'),
    p2Card: document.getElementById('p2Card'),
    p1Score: document.getElementById('p1Score'),
    p2Score: document.getElementById('p2Score'),
    p1Group: document.getElementById('p1Group'),
    p2Group: document.getElementById('p2Group'),
    p1Turn: document.getElementById('p1Turn'),
    p2Turn: document.getElementById('p2Turn'),
    
    // Barras de Bolas
    p1Rack: document.getElementById('p1Rack'),
    p2Rack: document.getElementById('p2Rack'),
    
    // Mensagens Centrais
    phaseTitle: document.getElementById('phaseTitle'),
    phaseMsg: document.getElementById('phaseMsg'),
    foulMsg: document.getElementById('foulMsg'),
    
    // Overlay (Tela Final)
    overlay: document.getElementById('game-overlay'),
    overlayTitle: document.getElementById('overlay-title'),
    overlayMsg: document.getElementById('overlay-msg'),
    lobbyBtn: document.getElementById('btn-lobby')
};

if(ui.lobbyBtn) {
    ui.lobbyBtn.addEventListener('click', () => window.location.reload());
}

function createMiniBall(number) {
    const div = document.createElement('div');
    div.className = `mini-ball mb-${number}`;
    return div;
}

export function setStatus(title, msg) {
    if(ui.phaseTitle) ui.phaseTitle.textContent = title || "";
    if(ui.phaseMsg) ui.phaseMsg.textContent = msg || "";
}

export function showError(msg) {
    setStatus("ERRO", msg);
    if(ui.phaseTitle) ui.phaseTitle.style.color = "red";
}

// === FUNÇÃO PRINCIPAL DE ATUALIZAÇÃO ===
export function updateHUD(myId) {
    if (!GameState.meta) return;

    const { players, currentTurn, phase, winner, shot } = GameState.meta;
    const p1 = players.p1;
    const p2 = players.p2;

    // --- 1. Atualiza Números ---
    ui.p1Score.textContent = p1.score;
    ui.p2Score.textContent = p2.score;
    
    const labelGroup = (g) => (!g ? "-" : (g === 'solid' ? "LISAS" : "LISTRADAS"));
    ui.p1Group.textContent = labelGroup(p1.group);
    ui.p2Group.textContent = labelGroup(p2.group);

    // --- 2. Diagnóstico ---
    const isMeP1 = (myId === p1.id);
    const isMeP2 = (myId === p2.id);

    // --- 3. Mensagens de Turno ---
    ui.p1Card.className = "card"; 
    ui.p2Card.className = "card";
    ui.p1Turn.className = "turnBadge";
    ui.p2Turn.className = "turnBadge";

    // FASE: JOGANDO
    if (phase === 'playing' && !winner) {
        // Define de quem é a vez
        const isP1Turn = (currentTurn === 'p1');
        
        // Ilumina card ativo
        if (isP1Turn) {
            ui.p1Card.classList.add('p1-active');
            ui.p1Turn.classList.add('on');
            ui.p1Turn.textContent = "JOGANDO";
            ui.p2Turn.textContent = "AGUARDE";
        } else {
            ui.p2Card.classList.add('p2-active');
            ui.p2Turn.classList.add('on');
            ui.p2Turn.textContent = "JOGANDO";
            ui.p1Turn.textContent = "AGUARDE";
        }

        // Mensagem Central
        const isMyTurn = (isP1Turn && isMeP1) || (!isP1Turn && isMeP2);

        if (isMyTurn) {
            ui.phaseTitle.textContent = "SUA VEZ";
            ui.phaseTitle.style.color = "#00ff00";
            ui.phaseTitle.style.textShadow = "0 0 10px #00ff00";
            ui.phaseMsg.textContent = "Você está no controle.";
        } else {
            const name = isP1Turn ? "JOGADOR 1" : "JOGADOR 2";
            ui.phaseTitle.textContent = `VEZ DE ${name}`;
            ui.phaseTitle.style.color = "#ffd700";
            ui.phaseTitle.style.textShadow = "none";
            ui.phaseMsg.textContent = "Aguarde a jogada...";
        }

    } 
    // FASE: BOLA NA MÃO (CORRIGIDO)
    else if (phase === 'placing_cue' && !winner) {
        const isP1Turn = (currentTurn === 'p1');
        const isMyTurn = (isP1Turn && isMeP1) || (!isP1Turn && isMeP2);

        if (isMyTurn) {
            ui.phaseTitle.textContent = "BOLA NA MÃO";
            ui.phaseTitle.style.color = "#00ffff"; 
            ui.phaseMsg.textContent = "Clique na mesa para posicionar a branca.";
        } else {
            ui.phaseTitle.textContent = "OPONENTE POSICIONANDO";
            ui.phaseTitle.style.color = "#ffd700";
            ui.phaseMsg.textContent = "Aguarde...";
        }
    }

    // --- 4. Falta ---
    if (shot && shot.foul) {
        ui.foulMsg.textContent = `FALTA: ${shot.reason}`;
        ui.foulMsg.style.display = 'block';
    } else {
        ui.foulMsg.style.display = 'none';
    }

    // --- 5. Bolinhas (Rack) ---
    if(ui.p1Rack) updateRack(ui.p1Rack, p1.group);
    if(ui.p2Rack) updateRack(ui.p2Rack, p2.group);

    // --- 6. Fim de Jogo ---
    handleOverlay(myId, phase, winner, players);
}

function updateRack(container, group) {
    container.innerHTML = ''; 
    if (!group) return; 

    let targetIds = (group === 'solid') ? [1,2,3,4,5,6,7] : [9,10,11,12,13,14,15];
    let count = 0;
    
    targetIds.forEach(id => {
        if (GameState.ballsMap.has(id)) {
            container.appendChild(createMiniBall(id));
            count++;
        }
    });

    if (count === 0 && GameState.ballsMap.has(8)) {
        const b8 = createMiniBall(8);
        b8.style.border = "2px solid #fff";
        container.appendChild(b8);
    }
}

function handleOverlay(myId, phase, winner, players) {
    if (ui.overlay) ui.overlay.classList.add('hidden');

    // MODO VITÓRIA
    if (winner) {
        if (ui.overlay) ui.overlay.classList.remove('hidden');
        if (ui.lobbyBtn) ui.lobbyBtn.classList.remove('hidden');

        let iWon = false;
        if (winner === 'p1' && myId === players.p1.id) iWon = true;
        if (winner === 'p2' && myId === players.p2.id) iWon = true;
        if (winner === myId) iWon = true;

        if (iWon) {
            ui.overlayTitle.textContent = "VITÓRIA!";
            ui.overlayTitle.style.color = "#00ff00";
            ui.overlayMsg.textContent = "Você venceu a partida!";
        } else {
            ui.overlayTitle.textContent = "DERROTA";
            ui.overlayTitle.style.color = "#ff0055";
            ui.overlayMsg.textContent = "Mais sorte na próxima vez.";
        }
        return;
    }

    // MODO LOBBY
    if (phase === 'waiting_players') {
        if (ui.overlay) ui.overlay.classList.remove('hidden');
        ui.overlayTitle.textContent = "AGUARDANDO";
        ui.overlayTitle.style.color = "#ffd700";
        ui.overlayMsg.textContent = "Esperando oponente...";
        if (ui.lobbyBtn) ui.lobbyBtn.classList.add('hidden');
    }
}