const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// ==================================================================
// 1. CONSTANTES (Configuração da Mesa e Física)
// ==================================================================
const C = {
  TABLE_WIDTH: 800,
  TABLE_HEIGHT: 400,
  OFFSET_X: 25,
  OFFSET_Y: 25,
  BALL_RADIUS: 11.5,
  
  POCKET_RADIUS: 28,
  POCKET_PULL_RADIUS: 26,
  POCKET_MAX_SPEED: 80.0,
  POCKET_PULL_STRENGTH: 0.1,
  
  RESTITUTION: 0.985,
  CUSHION_RESTITUTION: 0.92,
  CUSHION_TANGENTIAL_LOSS: 0.985,
  MIN_VELOCITY: 0.02, // Reduzido para garantir parada total
  PHYSICS_STEPS: 8,

  ballColors: {
    1: 'gold', 2: 'blue', 3: 'red', 4: 'purple', 5: 'orange', 6: 'green', 7: 'maroon',
    8: 'black', 9: 'gold', 10: 'blue', 11: 'red', 12: 'purple', 13: 'orange', 14: 'green', 15: 'maroon'
  }
};

// ==================================================================
// 2. FÍSICA (Motor de Colisão Integrado)
// ==================================================================
const Physics = {
    resolveCollision: function(b1, b2) {
        const dx = b2.x - b1.x;
        const dy = b2.y - b1.y;
        const dist = Math.hypot(dx, dy);

        if (dist < C.BALL_RADIUS * 2) {
            const angle = Math.atan2(dy, dx);
            const sin = Math.sin(angle), cos = Math.cos(angle);

            const v1 = { x: 0, y: 0 }, v2 = { x: 0, y: 0 };
            v1.x = b1.vx * cos + b1.vy * sin;
            v1.y = b1.vy * cos - b1.vx * sin;
            v2.x = b2.vx * cos + b2.vy * sin;
            v2.y = b2.vy * cos - b2.vx * sin;

            const v1x = ((v1.x * (1 - 1)) + (2 * 1 * v2.x)) / 2;
            const v2x = ((v2.x * (1 - 1)) + (2 * 1 * v1.x)) / 2;

            v1.x = v1x; v2.x = v2x;

            b1.vx = v1.x * cos - v1.y * sin;
            b1.vy = v1.y * cos + v1.x * sin;
            b2.vx = v2.x * cos - v2.y * sin;
            b2.vy = v2.y * cos + v2.x * sin;

            const overlap = (C.BALL_RADIUS * 2 - dist) / 2;
            b1.x -= overlap * Math.cos(angle); b1.y -= overlap * Math.sin(angle);
            b2.x += overlap * Math.cos(angle); b2.y += overlap * Math.sin(angle);
            
            return true;
        }
        return false;
    },

    stepPhysics: function(balls, game, audioQueue) {
        // 1. Movimento
        balls.forEach(b => {
            // Bolas encaçapadas ou em modo "posicionamento" não se movem sozinhas
            if (b.state === 'pocketed' || b.state === 'placing') return;
            
            b.x += b.vx; b.y += b.vy;
            b.vx *= 0.99; b.vy *= 0.99; // Atrito
            
            if (Math.abs(b.vx) < C.MIN_VELOCITY) b.vx = 0;
            if (Math.abs(b.vy) < C.MIN_VELOCITY) b.vy = 0;
        });

        // 2. Colisão com Tabelas
        const minX = C.OFFSET_X + C.BALL_RADIUS;
        const maxX = C.TABLE_WIDTH - C.OFFSET_X - C.BALL_RADIUS;
        const minY = C.OFFSET_Y + C.BALL_RADIUS;
        const maxY = C.TABLE_HEIGHT - C.OFFSET_Y - C.BALL_RADIUS;

        balls.forEach(b => {
            if (b.state !== 'active') return; 
            
            let hit = false;
            if (b.x < minX) { b.x = minX; b.vx = -b.vx * C.CUSHION_RESTITUTION; hit = true; }
            if (b.x > maxX) { b.x = maxX; b.vx = -b.vx * C.CUSHION_RESTITUTION; hit = true; }
            if (b.y < minY) { b.y = minY; b.vy = -b.vy * C.CUSHION_RESTITUTION; hit = true; }
            if (b.y > maxY) { b.y = maxY; b.vy = -b.vy * C.CUSHION_RESTITUTION; hit = true; }
            
            if(hit && audioQueue && Math.hypot(b.vx, b.vy) > 0.5) {
                audioQueue.push({ type: 'cushion', vol: Math.min(1, Math.hypot(b.vx, b.vy)/15) });
            }
        });

        // 3. Colisão Bola x Bola
        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                // IMPORTANTE: Só colide se AMBAS forem 'active'.
                // Se a branca for 'placing' (fantasma), ela atravessa tudo sem bater.
                if (balls[i].state === 'active' && balls[j].state === 'active') {
                    if (Physics.resolveCollision(balls[i], balls[j])) {
                        if (!game.shot.firstContactId && balls[i].id === 0) game.shot.firstContactId = balls[j].id;
                        if (!game.shot.firstContactId && balls[j].id === 0) game.shot.firstContactId = balls[i].id;
                        
                        if(audioQueue) {
                            const impact = Math.hypot(balls[i].vx - balls[j].vx, balls[i].vy - balls[j].vy);
                            audioQueue.push({ type: 'hit', variant: 'hard', vol: Math.min(1, impact/10) });
                        }
                    }
                }
            }
        }

        // 4. Caçapas
        const pockets = [
            {x: C.OFFSET_X, y: C.OFFSET_Y}, {x: 400, y: C.OFFSET_Y}, {x: 800-C.OFFSET_X, y: C.OFFSET_Y},
            {x: C.OFFSET_X, y: 400-C.OFFSET_Y}, {x: 400, y: 400-C.OFFSET_Y}, {x: 800-C.OFFSET_X, y: 400-C.OFFSET_Y}
        ];

        balls.forEach(b => {
            if (b.state !== 'active') return;
            pockets.forEach(p => {
                const dist = Math.hypot(b.x - p.x, b.y - p.y);
                if (dist < C.POCKET_PULL_RADIUS) {
                    b.state = 'pocketed'; 
                    b.vx = 0; b.vy = 0;
                    game.shot.pocketedIds.push(b.id);
                    if(audioQueue) audioQueue.push({ type: 'pocket', vol: 1 });
                }
            });
        });
    }
};

// ==================================================================
// 3. REGRAS (Lógica de Jogo)
// ==================================================================
function activeBallsByType(balls, type) {
    return balls.filter(b => b.type === type && b.state === 'active');
}
function otherPlayerKey(k) { return k === 'p1' ? 'p2' : 'p1'; }

const Rules = {
    finalizeShot: function(game, balls, clearShotCallback) {
        const shooter = game.shot.by;
        if (!shooter) { clearShotCallback(); return; }
        
        const other = otherPlayerKey(shooter);
        const shooterObj = game.players[shooter];
        const otherObj = game.players[other];

        if (!game.shot.firstContactId) { 
            game.shot.foul = true; 
            game.shot.reason = 'Não tocou em nenhuma bola'; 
        }

        const whiteBall = balls.find(b => b.id === 0);
        if (whiteBall && (whiteBall.state === 'pocketed' || game.shot.scratch)) {
            game.shot.scratch = true; 
            game.shot.foul = true; 
            game.shot.reason = 'Branca caiu (Scratch)';
        }

        const eightStillOnTable = balls.some(b => b.id === 8 && b.state === 'active');
        const eightPocketed = !eightStillOnTable;

        if (!shooterObj.group && !otherObj.group) {
            const pocketedNon8 = game.shot.pocketedIds.filter(id => id !== 8 && id !== 0)
                .map(id => ({ id, type: (id > 8 ? 'stripe' : 'solid') }));
            
            if (pocketedNon8.length > 0) {
                shooterObj.group = pocketedNon8[0].type;
                otherObj.group = shooterObj.group === 'solid' ? 'stripe' : 'solid';
            }
        }

        if (!game.shot.foul && shooterObj.group) {
            const fc = game.shot.firstContactId;
            if (fc && fc !== 8) {
                const fcType = (fc > 8 ? 'stripe' : 'solid');
                if (fcType !== shooterObj.group) { 
                    game.shot.foul = true; 
                    game.shot.reason = `Tocou na bola adversária`; 
                }
            }
            if (fc === 8) {
                const rem = activeBallsByType(balls, shooterObj.group).length;
                if (rem > 0) { 
                    game.shot.foul = true; 
                    game.shot.reason = 'Tocou na 8 cedo demais'; 
                }
            }
        }

        if (shooterObj.group) {
            const gained = game.shot.pocketedIds.filter(id => {
                if (id === 8 || id === 0) return false;
                const t = (id > 8 ? 'stripe' : 'solid');
                return t === shooterObj.group;
            }).length;
            shooterObj.score += gained;
        }

        if (eightPocketed) {
            game.phase = 'game_over';
            if (!shooterObj.group) { 
                game.winner = other; 
                game.shot.reason = '8 caiu cedo demais (sem grupo)!'; 
            }
            else {
                const rem = activeBallsByType(balls, shooterObj.group).length;
                if (game.shot.scratch) { 
                    game.winner = other; 
                    game.shot.reason = 'Suicídio da branca na 8!'; 
                }
                else if (rem > 0) { 
                    game.winner = other; 
                    game.shot.reason = '8 caiu com bolas restantes!'; 
                }
                else if (game.shot.foul) { 
                    game.winner = other; 
                    game.shot.reason = 'Falta na jogada da 8'; 
                }
                else { 
                    game.winner = shooter; 
                }
            }
            clearShotCallback(); 
            return;
        }

        let keepTurn = false;
        if (!game.shot.foul && shooterObj.group) {
            keepTurn = game.shot.pocketedIds.some(id => {
                if (id === 8 || id === 0) return false;
                return (id > 8 ? 'stripe' : 'solid') === shooterObj.group;
            });
        } else if (!game.shot.foul && !shooterObj.group) {
            keepTurn = game.shot.pocketedIds.some(id => id !== 8 && id !== 0);
        }

        if (game.shot.foul || !keepTurn) {
            game.currentTurn = other;
        }
        
        clearShotCallback();
    }
};

// ==================================================================
// 4. SUPER BOT V4 (Inteligência Artificial)
// ==================================================================
const POCKETS = [
    { x: C.OFFSET_X - 5, y: C.OFFSET_Y - 5 }, 
    { x: C.TABLE_WIDTH / 2, y: C.OFFSET_Y - 8 }, 
    { x: C.TABLE_WIDTH - C.OFFSET_X + 5, y: C.OFFSET_Y - 5 }, 
    { x: C.OFFSET_X - 5, y: C.TABLE_HEIGHT - C.OFFSET_Y + 5 }, 
    { x: C.TABLE_WIDTH / 2, y: C.TABLE_HEIGHT - C.OFFSET_Y + 8 }, 
    { x: C.TABLE_WIDTH - C.OFFSET_X + 5, y: C.TABLE_HEIGHT - C.OFFSET_Y + 5 } 
];

function normalizeGroup(g) {
  if (!g) return null;
  const s = String(g).toLowerCase();
  if (s.includes('sol') || s.includes('lisa')) return 'solid';
  if (s.includes('str') || s.includes('list')) return 'stripe';
  return null;
}

function getLegalTargets(game) {
    let g2 = normalizeGroup(game.players.p2.group);
    if (!g2) {
        const g1 = normalizeGroup(game.players.p1.group);
        if (g1) g2 = g1 === 'solid' ? 'stripe' : 'solid';
    }
    const group = g2;
    const active = game.balls.filter(b => b.state === 'active');
    
    if (!group) return active.filter(b => b.id !== 0 && b.id !== 8);
    
    const isSolid = (group === 'solid');
    let myBalls = active.filter(b => {
        if (b.id === 0 || b.id === 8) return false;
        const bSolid = (b.id >= 1 && b.id <= 7);
        return isSolid === bSolid;
    });
    
    if (myBalls.length === 0) {
        const eight = active.find(b => b.id === 8);
        return eight ? [eight] : [];
    }
    return myBalls;
}

function isPathClear(start, end, balls, ignoreId) {
    const dx = end.x - start.x, dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    if(dist < 1) return true;
    const ux = dx/dist, uy = dy/dist;
    
    for (const b of balls) {
        if (b.id === ignoreId || b.state !== 'active') continue;
        const t = ((b.x - start.x) * ux + (b.y - start.y) * uy);
        if (t > 0 && t < dist) {
            const cx = start.x + t * ux, cy = start.y + t * uy;
            if (Math.hypot(b.x - cx, b.y - cy) < (C.BALL_RADIUS * 2 + 1)) return false;
        }
    }
    return true;
}

function simulateShot(game, angle, force) {
    const simBalls = game.balls.map(b => ({...b}));
    const white = simBalls.find(b => b.id === 0);
    if(!white) return null;
    
    white.vx = Math.cos(angle) * force;
    white.vy = Math.sin(angle) * force;
    
    let firstContact = null;
    let pocketedIds = [];
    let scratch = false;

    // Simula 300 frames para o futuro
    for(let f=0; f<300; f++) {
        simBalls.forEach(b => {
            if(b.state !== 'active') return;
            b.x += b.vx; b.y += b.vy;
            b.vx *= 0.99; b.vy *= 0.99;
        });
        
        for(let i=0; i<simBalls.length; i++) {
            for(let j=i+1; j<simBalls.length; j++) {
                const b1 = simBalls[i], b2 = simBalls[j];
                if(b1.state==='active' && b2.state==='active') {
                    const dx = b2.x-b1.x, dy=b2.y-b1.y;
                    if(Math.hypot(dx, dy) < C.BALL_RADIUS*2) {
                        Physics.resolveCollision(b1, b2); 
                        if(!firstContact && b1.id===0) firstContact = b2.id;
                        if(!firstContact && b2.id===0) firstContact = b1.id;
                    }
                }
            }
        }
        
        simBalls.forEach(b => {
            if(b.state!=='active') return;
            POCKETS.forEach(p => {
                if(Math.hypot(b.x-p.x, b.y-p.y) < C.POCKET_RADIUS) {
                    b.state='pocketed'; pocketedIds.push(b.id);
                }
            });
        });
    }
    
    if(pocketedIds.includes(0)) scratch = true;
    return { pocketedIds, firstContact, scratch, finalWhite: white };
}

function getBestShotSuper(game) {
    const white = game.balls.find(b => b.id === 0);
    if (!white || white.state !== 'active') return null;
    const targets = getLegalTargets(game);
    let candidates = [];

    targets.forEach(target => {
        POCKETS.forEach(pocket => {
            const dx = pocket.x - target.x, dy = pocket.y - target.y;
            const distPocket = Math.hypot(dx, dy);
            const ux = dx/distPocket, uy = dy/distPocket;
            
            const gx = target.x - (ux * C.BALL_RADIUS * 2);
            const gy = target.y - (uy * C.BALL_RADIUS * 2);
            
            if (gx < C.OFFSET_X || gx > C.TABLE_WIDTH - C.OFFSET_X || gy < C.OFFSET_Y || gy > C.TABLE_HEIGHT - C.OFFSET_Y) return;
            if (!isPathClear(target, pocket, game.balls, target.id)) return;
            if (!isPathClear(white, {x:gx, y:gy}, game.balls, target.id)) return;

            const aimDx = gx - white.x, aimDy = gy - white.y;
            const aimAngle = Math.atan2(aimDy, aimDx);
            const shotAngle = Math.atan2(dy, dx);
            let cut = Math.abs(aimAngle - shotAngle);
            if(cut > Math.PI) cut = 2*Math.PI - cut;
            if (cut > 1.3) return;

            let force = 45 + (Math.hypot(aimDx, aimDy) + distPocket)/10;
            if (cut > 0.5) force *= 0.85;
            if (force > 65) force = 65;

            candidates.push({ angle: aimAngle, force, targetId: target.id, cut });
        });
    });

    candidates.sort((a,b) => a.cut - b.cut);
    
    const topCandidates = candidates.slice(0, 8);
    let best = null;
    let bestScore = -Infinity;

    for (const c of topCandidates) {
        const out = simulateShot(game, c.angle, c.force);
        if (!out) continue;

        let score = 0;
        
        if (out.pocketedIds.includes(8)) {
            if (c.targetId !== 8) score = -999999; 
            else if (out.scratch) score = -999999; 
            else score = 1000000; 
        } else if (out.scratch) {
            score = -50000;
        } else if (out.firstContactId === c.targetId && out.pocketedIds.includes(c.targetId)) {
            score = 10000;
        } else {
            score = -1000;
        }

        if (score > 0 && out.finalWhite && c.targetId !== 8) {
            const nextTargets = getLegalTargets(game).filter(t => t.id !== c.targetId);
            let hasShot = false;
            nextTargets.forEach(nt => {
                if (isPathClear(out.finalWhite, nt, game.balls, nt.id)) hasShot = true;
            });
            if (hasShot) score += 2000;
            else score -= 5000; 
        }

        score -= c.cut * 500; 

        if (score > bestScore) {
            bestScore = score;
            best = c;
        }
    }

    if (best) return best;
    
    if(targets.length > 0) {
        const t = targets[0];
        return { angle: Math.atan2(t.y-white.y, t.x-white.x), force: 22 };
    }
    return null;
}

function updateBot(game, roomId) {
    if (!game.isBotRoom || game.currentTurn !== 'p2' || game.phase !== 'playing') {
        game.botState = 'idle'; return;
    }
    if (game.shot.inProgress) { game.botState = 'idle'; return; }
    
    const isMoving = game.balls.some(b => b.state === 'falling' || Math.abs(b.vx) > 0 || Math.abs(b.vy) > 0);
    if (isMoving) return;

    if (game.botState === 'idle') {
        game.botState = 'thinking'; game.botTimer = Date.now() + 1000;
        return;
    }
    if (game.botState === 'thinking') {
        if (Date.now() < game.botTimer) return;
        
        const shot = getBestShotSuper(game);
        if (shot) {
            game.botTarget = shot;
            game.botCurrentAngle = shot.angle; 
            game.botState = 'shooting';
        } else {
            game.currentTurn = 'p1';
            io.to(roomId).emit('meta', getMeta(game));
            game.botState = 'idle';
        }
        return;
    }
    if (game.botState === 'shooting') {
        const white = game.balls.find(b => b.id === 0);
        
        game.shot.inProgress = true;
        game.shot.by = 'p2';
        game.shot.firstContactId = null; game.shot.pocketedIds = []; game.shot.scratch = false; game.shot.foul = false;
        
        white.vx = Math.cos(game.botTarget.angle) * game.botTarget.force;
        white.vy = Math.sin(game.botTarget.angle) * game.botTarget.force;
        
        io.to(roomId).emit('meta', getMeta(game));
        io.to(roomId).emit('syncAim', { angle: game.botTarget.angle, force: 0 });
        game.botState = 'idle';
    }
}

// ==================================================================
// 5. SOCKET
// ==================================================================
const rooms = {};

function createGameState() {
    return {
        players: { p1: { id: null, score: 0, group: null }, p2: { id: null, score: 0, group: null } },
        balls: [], audioEvents: [], currentTurn: 'p1', phase: 'waiting_players', winner: null,
        shot: { inProgress: false, by: null, firstContactId: null, pocketedIds: [], scratch: false, foul: false },
        isBotRoom: false, botState: 'idle'
    };
}

function setupBalls(game) {
    game.balls = [{ id: 0, x: 200, y: 200, vx: 0, vy: 0, type: 'cue', state: 'active' }];
    const layout = [[1], [9, 2], [3, 8, 10], [11, 5, 12, 4], [6, 13, 7, 14, 15]];
    const startX = 600, startY = 200;
    layout.forEach((row, r) => row.forEach((id, c) => {
        const x = startX + (r * C.BALL_RADIUS * 2.05 * Math.cos(Math.PI/6));
        const y = startY - (row.length * C.BALL_RADIUS * 2.05 / 2) + (c * C.BALL_RADIUS * 2.05) + C.BALL_RADIUS;
        game.balls.push({ id, x, y, vx: 0, vy: 0, type: id===8?'black':(id>8?'stripe':'solid'), state: 'active' });
    }));
}

function getMeta(game) {
    return {
        players: game.players, currentTurn: game.currentTurn, phase: game.phase, winner: game.winner, shot: game.shot
    };
}

function getRoomList() {
    return Object.keys(rooms).map(id => ({
        id, count: (rooms[id].players.p1.id?1:0) + (rooms[id].players.p2.id?1:0),
        status: rooms[id].phase === 'playing' ? 'JOGANDO' : 'AGUARDANDO'
    }));
}

io.on('connection', (socket) => {
    socket.roomId = null;
    socket.emit('roomList', getRoomList());

    socket.on('createBotRoom', () => {
        if(socket.roomId) socket.leave(socket.roomId);
        const rid = 'bot_' + socket.id.substr(0, 4);
        socket.join(rid); socket.roomId = rid;
        rooms[rid] = createGameState();
        rooms[rid].isBotRoom = true;
        rooms[rid].players.p1.id = socket.id; rooms[rid].players.p1.name = "VOCÊ";
        rooms[rid].players.p2.id = 'BOT'; rooms[rid].players.p2.name = "SUPER BOT";
        rooms[rid].phase = 'playing';
        setupBalls(rooms[rid]);
        socket.emit('roomJoined', { roomId: rid, role: 'p1' });
        io.to(rid).emit('init', rooms[rid].balls);
        io.to(rid).emit('meta', getMeta(rooms[rid]));
    });

    socket.on('joinRoom', (rid) => {
        if(!rid) return;
        if(socket.roomId) socket.leave(socket.roomId);
        socket.join(rid); socket.roomId = rid;
        if(!rooms[rid]) { rooms[rid] = createGameState(); setupBalls(rooms[rid]); }
        
        const game = rooms[rid];
        let role = 'spectator';
        if(!game.players.p1.id) { game.players.p1.id = socket.id; role = 'p1'; }
        else if(!game.players.p2.id) { game.players.p2.id = socket.id; role = 'p2'; game.phase = 'playing'; }
        
        socket.emit('roomJoined', { roomId: rid, role });
        io.to(rid).emit('init', game.balls);
        io.to(rid).emit('meta', getMeta(game));
        io.emit('roomList', getRoomList());
    });

    socket.on('placeCueBall', (data) => {
        if(!socket.roomId || !rooms[socket.roomId]) return;
        const game = rooms[socket.roomId];
        if (game.phase !== 'placing_cue') return;
        
        const isP1 = (game.players.p1.id === socket.id);
        const isP2 = (game.players.p2.id === socket.id);
        if ((game.currentTurn === 'p1' && !isP1) || (game.currentTurn === 'p2' && !isP2)) return;

        const white = game.balls.find(b => b.id === 0);
        if(white) {
            let nx = Number(data.x), ny = Number(data.y);
            const m = C.BALL_RADIUS + C.OFFSET_X;
            if (nx < m) nx = m; if (nx > C.TABLE_WIDTH - m) nx = C.TABLE_WIDTH - m;
            if (ny < m) ny = m; if (ny > C.TABLE_HEIGHT - m) ny = C.TABLE_HEIGHT - m;
            
            white.x = nx; white.y = ny; white.vx = 0; white.vy = 0; 
            white.state = 'active'; // AQUI ELA VOLTA A SER REAL
            game.phase = 'playing';
            
            io.to(socket.roomId).emit('gameState', game.balls);
            io.to(socket.roomId).emit('meta', getMeta(game));
        }
    });

    socket.on('shoot', (data) => {
        if(!socket.roomId || !rooms[socket.roomId]) return;
        const game = rooms[socket.roomId];
        if(game.phase === 'placing_cue') return; 
        if (game.currentTurn === 'p2' && game.players.p2.id === 'BOT') return; 
        
        const white = game.balls.find(b => b.id === 0);
        if(white) {
            game.shot.inProgress = true;
            game.shot.by = (game.players.p1.id === socket.id) ? 'p1' : 'p2';
            game.shot.firstContactId = null; game.shot.pocketedIds = []; game.shot.scratch = false; game.shot.foul = false;
            
            const power = Math.min(Number(data.force || 0), 60);
            white.vx = Math.cos(data.angle) * power;
            white.vy = Math.sin(data.angle) * power;
            
            io.to(socket.roomId).emit('meta', getMeta(game));
        }
    });
    
    socket.on('syncAim', (d) => { if(socket.roomId) socket.to(socket.roomId).emit('syncAim', d); });
    socket.on('leaveRoom', () => { if(socket.roomId && rooms[socket.roomId]) delete rooms[socket.roomId]; io.emit('roomList', getRoomList()); });
    socket.on('disconnect', () => { if(socket.roomId && rooms[socket.roomId]) delete rooms[socket.roomId]; io.emit('roomList', getRoomList()); });
    socket.on('reset', () => { 
        if(!socket.roomId) return; 
        const g = rooms[socket.roomId]; 
        setupBalls(g); g.currentTurn='p1'; g.phase='playing'; g.winner=null; g.players.p1.score=0; g.players.p2.score=0; g.players.p1.group=null; g.players.p2.group=null;
        io.to(socket.roomId).emit('gameState', g.balls); io.to(socket.roomId).emit('meta', getMeta(g));
    });
});

setInterval(() => {
    Object.keys(rooms).forEach(rid => {
        const game = rooms[rid];
        
        if (game.phase === 'placing_cue' && game.currentTurn === 'p2' && game.players.p2.id === 'BOT') {
             const white = game.balls.find(b => b.id === 0);
             if (white) {
                 white.x = 200; white.y = 200 + (Math.random()*100 - 50);
                 white.state = 'active'; white.vx = 0; white.vy = 0;
                 game.phase = 'playing';
                 io.to(rid).emit('meta', getMeta(game));
                 io.to(rid).emit('gameState', game.balls);
             }
        } 
        else {
            updateBot(game, rid);
        }

        Physics.stepPhysics(game.balls, game, game.audioEvents);
        
        let isMoving = game.balls.some(b => b.state === 'falling' || Math.abs(b.vx) > 0 || Math.abs(b.vy) > 0);
        
        if (game.shot.inProgress && !isMoving) {
            Rules.finalizeShot(game, game.balls, () => {
                game.shot.inProgress = false; game.shot.pocketedIds = [];
            });
            
            if (game.shot.scratch) {
                game.phase = 'placing_cue';
                const white = game.balls.find(b => b.id === 0);
                if(white) {
                    // DEFINE COMO PLACING (FANTASMA) PARA NÃO COLIDIR
                    white.state = 'placing'; 
                    white.x = 200; white.y = 200; 
                    white.vx = 0; white.vy = 0;
                }
            }
            io.to(rid).emit('meta', getMeta(game));
        }
        
        io.to(rid).emit('gameState', game.balls);
        if(game.audioEvents.length > 0) {
            io.to(rid).emit('audioBatch', game.audioEvents);
            game.audioEvents = [];
        }
    });
}, 16);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`SERVIDOR RODANDO NA PORTA ${PORT}`));
