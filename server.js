const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

// === MÓDULOS LOCAIS (Agora tudo organizado) ===
const C = require('./modules/constants');
const Physics = require('./modules/physics');
const Rules = require('./modules/rules');
const GameState = require('./modules/gameState'); // Placar e Regras
const Bot = require('./modules/bot');             // Inteligência Artificial
const Table = require('./modules/table');         // Não usado aqui, mas já separado

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Estado Geral das Salas
const rooms = {}; 

// === SOCKET.IO ===
io.on('connection', (socket) => {
    socket.roomId = null;
    socket.emit('roomList', GameState.getRoomList(rooms));

    // BOT ROOM
    socket.on('createBotRoom', () => {
        if(socket.roomId) socket.leave(socket.roomId);
        const roomId = 'bot_' + socket.id.substr(0, 4);
        socket.join(roomId);
        socket.roomId = roomId;

        rooms[roomId] = GameState.createGameState();
        GameState.setupBalls(rooms[roomId]);
        
        const game = rooms[roomId];
        game.isBotRoom = true;
        game.players.p1.id = socket.id; game.players.p1.name = "VOCÊ";
        game.players.p2.id = 'BOT'; game.players.p2.name = "SUPER BOT";
        game.phase = 'playing';

        socket.emit('roomJoined', { roomId, role: 'p1' });
        io.to(roomId).emit('init', game.balls);
        io.to(roomId).emit('meta', GameState.metaPayload(game));
    });

    // HUMAN ROOM
    socket.on('joinRoom', (roomId) => {
        roomId = roomId.trim().toLowerCase().substring(0, 12);
        if(!roomId) return;
        if(socket.roomId) socket.leave(socket.roomId);
        socket.join(roomId);
        socket.roomId = roomId;

        if (!rooms[roomId]) {
            rooms[roomId] = GameState.createGameState();
            GameState.setupBalls(rooms[roomId]);
        }
        const game = rooms[roomId];
        let role = 'spectator';
        if (!game.players.p1.id) { game.players.p1.id = socket.id; role = 'p1'; } 
        else if (!game.players.p2.id) { game.players.p2.id = socket.id; game.phase = 'playing'; role = 'p2'; }

        socket.emit('roomJoined', { roomId, role });
        io.to(roomId).emit('init', game.balls);
        io.to(roomId).emit('meta', GameState.metaPayload(game));
        io.emit('roomList', GameState.getRoomList(rooms));
    });

    // LEAVE
    socket.on('leaveRoom', () => {
        if(socket.roomId && rooms[socket.roomId]) {
            const game = rooms[socket.roomId];
            if (game.isBotRoom) { delete rooms[socket.roomId]; } 
            else {
                let changed = false;
                if (game.players.p1.id === socket.id) { game.players.p1.id = null; game.players.p1.score=0; game.players.p1.group=null; changed=true; }
                if (game.players.p2.id === socket.id) { game.players.p2.id = null; game.players.p2.score=0; game.players.p2.group=null; changed=true; }
                if(changed) {
                    game.phase = 'waiting_players';
                    game.winner = null;
                    io.to(socket.roomId).emit('meta', GameState.metaPayload(game));
                }
                if(!game.players.p1.id && !game.players.p2.id) delete rooms[socket.roomId];
            }
            socket.leave(socket.roomId);
            socket.roomId = null;
            io.emit('roomList', GameState.getRoomList(rooms));
        }
    });

    socket.on('syncAim', (data) => {
        if(socket.roomId) socket.to(socket.roomId).emit('syncAim', data);
    });

    socket.on('shoot', (data) => {
        if(!socket.roomId || !rooms[socket.roomId]) return;
        const game = rooms[socket.roomId];
        if (game.currentTurn === 'p2' && game.players.p2.id === 'BOT') return; 

        const pk = (game.players.p1.id === socket.id) ? 'p1' : ((game.players.p2.id === socket.id) ? 'p2' : null);
        if (!pk) return;
        
        const moving = game.balls.some(b => b.state === 'falling' || Math.hypot(b.vx, b.vy) > 0.12);
        if (moving) return;

        const cueBall = game.balls.find(b => b.id === 0);
        if (!cueBall || cueBall.state !== 'active') return;

        game.shot.inProgress = true;
        game.shot.by = pk;
        game.shot.firstContactId = null; game.shot.pocketedIds = []; game.shot.scratch = false; game.shot.foul = false; game.shot.reason = '';

        const power = Math.min(Number(data.force || 0), 50);
        const angle = Number(data.angle || 0);
        cueBall.vx = Math.cos(angle) * power;
        cueBall.vy = Math.sin(angle) * power;

        io.to(socket.roomId).emit('meta', GameState.metaPayload(game));
    });

    socket.on('reset', () => {
        if(!socket.roomId || !rooms[socket.roomId]) return;
        const game = rooms[socket.roomId];
        GameState.setupBalls(game);
        game.currentTurn = 'p1';
        game.phase = (game.players.p1.id && game.players.p2.id) ? 'playing' : 'waiting_players';
        if (game.isBotRoom) game.phase = 'playing';
        game.winner = null; game.players.p1.score=0; game.players.p1.group=null; game.players.p2.score=0; game.players.p2.group=null;
        io.to(socket.roomId).emit('gameState', game.balls);
        io.to(socket.roomId).emit('meta', GameState.metaPayload(game));
    });

    socket.on('disconnect', () => {
        if(socket.roomId && rooms[socket.roomId]) {
            const game = rooms[socket.roomId];
            if (game.isBotRoom) { delete rooms[socket.roomId]; return; }

            let changed = false;
            if (game.players.p1.id === socket.id) { game.players.p1.id = null; game.players.p1.score=0; game.players.p1.group=null; changed=true; }
            if (game.players.p2.id === socket.id) { game.players.p2.id = null; game.players.p2.score=0; game.players.p2.group=null; changed=true; }
            if(changed) {
                game.phase = 'waiting_players';
                game.winner = null;
                io.to(socket.roomId).emit('meta', GameState.metaPayload(game));
            }
            if(!game.players.p1.id && !game.players.p2.id) delete rooms[socket.roomId];
            io.emit('roomList', GameState.getRoomList(rooms));
        }
    });
});

// === LOOP PRINCIPAL DO JOGO ===
setInterval(() => {
    Object.keys(rooms).forEach(roomId => {
        const game = rooms[roomId];
        const balls = game.balls;

        // Atualiza a IA do Bot (passamos o IO para ele poder emitir eventos)
        Bot.updateBot(game, roomId, io);

        for(let i=0; i < C.PHYSICS_STEPS; i++) Physics.stepPhysics(balls, game, game.audioEvents);

        let isMoving = false;
        for (const b of balls) {
            if (isNaN(b.x) || isNaN(b.y)) { b.x = C.TABLE_WIDTH/2; b.y = C.TABLE_HEIGHT/2; b.vx=0; b.vy=0; }
            if (b.state === 'falling') { isMoving = true; continue; }
            if (Math.abs(b.vx) < C.MIN_VELOCITY) b.vx = 0;
            if (Math.abs(b.vy) < C.MIN_VELOCITY) b.vy = 0;
            if (b.vx !== 0 || b.vy !== 0) isMoving = true;
        }

        if (game.shot.inProgress && !isMoving) {
            Rules.finalizeShot(game, balls, () => {
                game.shot.inProgress = false; game.shot.pocketedIds = [];
            });
            io.to(roomId).emit('meta', GameState.metaPayload(game));
        }

        io.to(roomId).emit('gameState', balls);

        if (game.audioEvents.length > 0) {
            const limitedEvents = game.audioEvents.slice(0, 8);
            io.to(roomId).emit('audioBatch', limitedEvents);
            game.audioEvents = [];
        }
    });
}, 16);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));