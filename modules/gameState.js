const C = require('./constants');

function createGameState() {
    return {
        players: {
            p1: { id: null, name: 'P1', score: 0, group: null },
            p2: { id: null, name: 'P2', score: 0, group: null },
        },
        balls: [],      
        audioEvents: [], 
        currentTurn: 'p1',
        phase: 'waiting_players',
        winner: null,
        shot: { inProgress: false, by: null, firstContactId: null, pocketedIds: [], scratch: false, foul: false, reason: '' },
        
        // Estado do Bot
        isBotRoom: false,
        botState: 'idle',
        botTarget: null, 
        botCurrentAngle: 0,
        botCurrentForce: 0,
        botTimer: 0
    };
}

function setupBalls(roomGame) {
    roomGame.balls = [];
    // Bola branca
    roomGame.balls.push({ id: 0, x: 200, y: 200, vx: 0, vy: 0, type: 'cue', state: 'active', scale: 1 });
    
    const startX = 600; const startY = 200;
    // Layout do triângulo (15 bolas)
    const layout = [[1], [9, 2], [3, 8, 10], [11, 5, 12, 4], [6, 13, 7, 14, 15]];
    
    layout.forEach((row, rIdx) => {
        row.forEach((id, cIdx) => {
            const spacing = C.BALL_RADIUS * 2.05;
            const x = startX + (rIdx * spacing * Math.cos(Math.PI / 6));
            const rowH = row.length * spacing;
            const y = startY - (rowH / 2) + (cIdx * spacing) + C.BALL_RADIUS;
            
            roomGame.balls.push({
                id, x, y, vx: 0, vy: 0,
                color: C.ballColors[id],
                type: id === 8 ? 'black' : (id > 8 ? 'stripe' : 'solid'),
                state: 'active', scale: 1
            });
        });
    });
}

// Prepara o pacote de dados para enviar ao placar do cliente
function metaPayload(roomGame) {
    return {
        players: { p1: { ...roomGame.players.p1 }, p2: { ...roomGame.players.p2 } },
        currentTurn: roomGame.currentTurn,
        phase: roomGame.phase,
        winner: roomGame.winner,
        shot: { ...roomGame.shot }
    };
}

function getRoomList(rooms) {
    const list = [];
    Object.keys(rooms).forEach(id => {
        const r = rooms[id];
        if (r.isBotRoom) return;
        let count = 0;
        if(r.players.p1.id) count++;
        if(r.players.p2.id) count++;
        list.push({ id, count, status: r.phase === 'playing' ? 'JOGANDO' : 'AGUARDANDO' });
    });
    return list;
}

module.exports = { createGameState, setupBalls, metaPayload, getRoomList };