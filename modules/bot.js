const C = require('./constants');
const Physics = require('./physics');
const Rules = require('./rules');
const { POCKETS, RAILS } = require('./table'); // Importa o layout
const { metaPayload } = require('./gameState'); // Para enviar atualizações

// === FUNÇÕES AUXILIARES DO BOT ===
function normalizeGroup(g) {
  if (!g) return null;
  const s = String(g).toLowerCase();
  if (s.includes('sol') || s.includes('lisa')) return 'solid';
  if (s.includes('str') || s.includes('list')) return 'stripe';
  return null;
}

function getBotGroup(game) {
    let g2 = normalizeGroup(game.players?.p2?.group);
    if (g2) return g2;
    const g1 = normalizeGroup(game.players?.p1?.group);
    if (g1) return g1 === 'solid' ? 'stripe' : 'solid';
    return null; 
}

function isMyBall(ball, group) {
    if (!group) return ball.id !== 0 && ball.id !== 8;
    const isSolid = (ball.id >= 1 && ball.id <= 7);
    const isStripe = (ball.id >= 9 && ball.id <= 15);
    return (group === 'solid') ? isSolid : isStripe;
}

function getLegalTargets(game) {
    const group = getBotGroup(game);
    const activeBalls = game.balls.filter(b => b.state === 'active');
    let myBalls = activeBalls.filter(b => b.id !== 0 && b.id !== 8 && isMyBall(b, group));
    
    if (myBalls.length === 0 && group) {
        const eight = activeBalls.find(b => b.id === 8);
        return eight ? [eight] : [];
    }
    if (!group) return activeBalls.filter(b => b.id !== 0 && b.id !== 8);
    return myBalls;
}

function isPathClear(start, end, balls, ignoreId1) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dist = Math.hypot(dx, dy);
    if(dist < 1) return true; 
    const ux = dx / dist; const uy = dy / dist;
    const SAFETY_MARGIN = (C.BALL_RADIUS * 2) + 0.5; 

    for (const b of balls) {
        if (b.id === ignoreId1 || b.state !== 'active') continue;
        const t = ((b.x - start.x) * ux + (b.y - start.y) * uy);
        if (t > 0 && t < dist) {
            const closestX = start.x + t * ux;
            const closestY = start.y + t * uy;
            const distToLine = Math.hypot(b.x - closestX, b.y - closestY);
            if (distToLine < SAFETY_MARGIN) return false; 
        }
    }
    return true;
}

function isPlayable(x, y) {
    const m = C.BALL_RADIUS; 
    return (x > C.OFFSET_X + m && x < C.TABLE_WIDTH - C.OFFSET_X - m &&
            y > C.OFFSET_Y + m && y < C.TABLE_HEIGHT - C.OFFSET_Y - m);
}

function cloneBalls(balls) { return balls.map(b => ({ ...b })); }
function cloneGameForSim(game) {
  return {
    players: JSON.parse(JSON.stringify(game.players)),
    shot: { inProgress: true, by: 'p2', firstContactId: null, pocketedIds: [], scratch: false, foul: false },
    audioEvents: [],
    currentTurn: game.currentTurn,
    phase: game.phase,
    winner: null
  };
}

function settleSimulation(simBalls, simGame) {
  for (let frame = 0; frame < 300; frame++) { 
    for (let i = 0; i < C.PHYSICS_STEPS; i++) Physics.stepPhysics(simBalls, simGame, simGame.audioEvents);
    let moving = false;
    for (const b of simBalls) {
      if (b.state === 'falling') { moving = true; continue; }
      if (Math.abs(b.vx) > 0.05 || Math.abs(b.vy) > 0.05) moving = true;
    }
    if (!moving) break;
  }
}

function simulateShotOutcome(game, angle, force) {
  const simBalls = cloneBalls(game.balls);
  const simGame = cloneGameForSim(game);
  const white = simBalls.find(b => b.id === 0);
  if (!white) return null;
  white.vx = Math.cos(angle) * force;
  white.vy = Math.sin(angle) * force;
  
  settleSimulation(simBalls, simGame);
  Rules.finalizeShot(simGame, simBalls, () => {});
  
  const finalWhite = simBalls.find(b => b.id === 0);
  return {
    foul: !!simGame.shot.foul,
    scratch: !!simGame.shot.scratch,
    firstContactId: simGame.shot.firstContactId,
    pocketedIds: simGame.shot.pocketedIds || [],
    finalWhitePos: finalWhite ? {x: finalWhite.x, y: finalWhite.y} : null
  };
}

function getBankCandidates(game, white, target) {
    const candidates = [];
    for (const pocket of POCKETS) {
        for (const rail of RAILS) {
            let mirrorX = pocket.x;
            let mirrorY = pocket.y;
            
            if (rail.id === 'top') mirrorY = rail.y - (pocket.y - rail.y);
            else if (rail.id === 'bottom') mirrorY = rail.y + (rail.y - pocket.y);
            else if (rail.id === 'left') mirrorX = rail.x - (pocket.x - rail.x);
            else if (rail.id === 'right') mirrorX = rail.x + (rail.x - pocket.x);

            const dx = mirrorX - target.x;
            const dy = mirrorY - target.y;
            const dist = Math.hypot(dx, dy);
            const ux = dx / dist; const uy = dy / dist;

            const ghostX = target.x - (ux * (C.BALL_RADIUS * 2.0));
            const ghostY = target.y - (uy * (C.BALL_RADIUS * 2.0));

            if (!isPlayable(ghostX, ghostY)) continue;

            const aimDx = ghostX - white.x;
            const aimDy = ghostY - white.y;
            const aimDist = Math.hypot(aimDx, aimDy);
            const aimAngle = Math.atan2(aimDy, aimDx);

            if (!isPathClear(white, {x: ghostX, y: ghostY}, game.balls, target.id)) continue;
            
            candidates.push({
                type: 'bank',
                angle: aimAngle,
                force: 50 + (aimDist/5),
                targetId: target.id,
                cut: 1.0, 
                dist: aimDist + dist + 100
            });
        }
    }
    return candidates;
}

function listCandidateShots(game, whitePosOverride = null) {
  let white = null;
  if (whitePosOverride) {
      white = { x: whitePosOverride.x, y: whitePosOverride.y };
  } else {
      white = game.balls.find(b => b.id === 0 && b.state === 'active');
  }
  if (!white) return [];

  const targets = getLegalTargets(game);
  let candidates = [];

  for (const target of targets) {
    for (const pocket of POCKETS) {
      const dx = pocket.x - target.x;
      const dy = pocket.y - target.y;
      const distToPocket = Math.hypot(dx, dy);
      const ux = dx / distToPocket; const uy = dy / distToPocket;

      const ghostX = target.x - (ux * (C.BALL_RADIUS * 2.0));
      const ghostY = target.y - (uy * (C.BALL_RADIUS * 2.0));
      
      if (!isPlayable(ghostX, ghostY)) continue;
      if (!isPathClear(target, pocket, game.balls, target.id)) continue; 
      
      if (!whitePosOverride) {
          if (!isPathClear(white, { x: ghostX, y: ghostY }, game.balls, target.id)) continue;
      }

      const aimDx = ghostX - white.x;
      const aimDy = ghostY - white.y;
      const aimDist = Math.hypot(aimDx, aimDy);
      const aimAngle = Math.atan2(aimDy, aimDx);

      const shotAngle = Math.atan2(dy, dx);
      let cut = Math.abs(aimAngle - shotAngle);
      while (cut > Math.PI) cut -= 2 * Math.PI;
      while (cut < -Math.PI) cut += 2 * Math.PI;
      cut = Math.abs(cut);

      if (cut > 1.35) continue;

      let force = 42 + (aimDist + distToPocket) / 10;
      if (cut > 0.4) force *= 0.9;
      if (distToPocket < 100) force *= 0.7;
      if (force > 65) force = 65;
      if (force < 20) force = 20;

      candidates.push({
        type: 'pot',
        angle: aimAngle,
        force: force,
        targetId: target.id,
        cut: cut,
        dist: aimDist + distToPocket
      });
    }
  }

  if (!whitePosOverride && candidates.length === 0) {
      const banks = getBankCandidates(game, white, targets[0]); 
      candidates = candidates.concat(banks);
  }

  return candidates;
}

function getBestShotSuper(game) {
  let candidates = listCandidateShots(game);
  if (candidates.length === 0) return null;

  candidates = candidates.filter(c => c.cut < 1.3);
  candidates.sort((a, b) => (a.cut + a.dist/2000) - (b.cut + b.dist/2000));
  
  const topCandidates = candidates.slice(0, 10); 
  let best = null;
  let bestScore = -Infinity;

  for (const c of topCandidates) {
    const out = simulateShotOutcome(game, c.angle, c.force);
    if (!out) continue;

    let score = 0;
    if (out.pocketedIds.includes(8)) {
        if (c.targetId !== 8) score = -999999;
        else if (out.foul || out.scratch) score = -999999;
        else score = 1000000; 
    } else if (out.scratch || out.foul) {
        score = -50000;
    } else if (out.firstContactId === c.targetId && out.pocketedIds.includes(c.targetId)) {
        score = 10000; 
    } else {
        score = -1000;
    }

    if (score < 0) continue;

    if (out.finalWhitePos && score > 0 && c.targetId !== 8) {
        const futureCandidates = listCandidateShots(game, out.finalWhitePos);
        if (futureCandidates.length > 0) {
            futureCandidates.sort((a, b) => a.cut - b.cut);
            const bestNext = futureCandidates[0];
            score += (2000 - (bestNext.cut * 1000)); 
            score -= bestNext.dist; 
        } else {
            score -= 5000;
        }
    }

    score -= c.cut * 500;
    score -= c.dist * 1.5;

    if (score > bestScore) {
      bestScore = score;
      best = { angle: c.angle, force: c.force };
    }
  }

  if (bestScore < 0) {
      if (candidates.length > 0) {
          return { angle: candidates[0].angle, force: 18 };
      }
  }

  return best;
}

// === EXPORTAR A MÁQUINA DE ESTADOS (UPDATE) ===
function updateBot(game, roomId, io) {
  if (!game.isBotRoom || game.currentTurn !== 'p2' || game.phase !== 'playing' || game.winner) {
    game.botState = 'idle';
    return;
  }
  if (game.shot.inProgress) {
    game.botState = 'idle';
    return;
  }
  const isMoving = game.balls.some(b => b.state === 'falling' || Math.hypot(b.vx, b.vy) > 0.05);
  if (isMoving) return;

  if (game.botState === 'idle') {
    game.botState = 'thinking';
    game.botTimer = Date.now() + 1000; 
    return;
  }

  if (game.botState === 'thinking') {
    if (Date.now() < game.botTimer) return;

    let shot = getBestShotSuper(game);
    
    if (!shot) {
        const white = game.balls.find(b => b.id === 0);
        const targets = getLegalTargets(game);
        if (white && targets.length > 0) {
            targets.sort((a,b) => Math.hypot(a.x-white.x, a.y-white.y) - Math.hypot(b.x-white.x, b.y-white.y));
            const t = targets[0];
            const a = Math.atan2(t.y - white.y, t.x - white.x);
            shot = { angle: a, force: 20 };
        }
    }

    if (shot) {
      game.botTarget = shot;
      if (!game.botCurrentAngle) game.botCurrentAngle = 0;
      game.botState = 'aiming';
    } else {
      game.currentTurn = 'p1';
      io.to(roomId).emit('meta', metaPayload(game));
      game.botState = 'idle';
    }
    return;
  }

  if (game.botState === 'aiming') {
    const target = game.botTarget.angle;
    let diff = target - game.botCurrentAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    if (Math.abs(diff) < 0.01) {
      game.botCurrentAngle = target;
      game.botState = 'stabilizing';
      game.botTimer = Date.now() + 200; 
    } else {
      game.botCurrentAngle += diff * 0.15;
    }
    
    io.to(roomId).emit('syncAim', { angle: game.botCurrentAngle, force: 0 });
    return;
  }

  if (game.botState === 'stabilizing') {
    if (Date.now() < game.botTimer) return;
    game.botState = 'charging';
    game.botCurrentForce = 0;
    return;
  }

  if (game.botState === 'charging') {
    const targetForce = game.botTarget.force;
    const targetVisual = (targetForce / 60) * 160; 

    if (game.botCurrentForce < targetVisual) {
      game.botCurrentForce += 2.0; 
      io.to(roomId).emit('syncAim', { angle: game.botCurrentAngle, force: game.botCurrentForce });
    } else {
      game.botState = 'shooting';
    }
    return;
  }

  if (game.botState === 'shooting') {
    const white = game.balls.find(b => b.id === 0);
    if (!white || white.state !== 'active') { game.botState = 'idle'; return; }

    game.shot.inProgress = true;
    game.shot.by = 'p2';
    game.shot.firstContactId = null; 
    game.shot.pocketedIds = []; 
    game.shot.scratch = false; 
    game.shot.foul = false; 
    game.shot.reason = '';

    const angle = game.botTarget.angle;
    const force = game.botTarget.force;

    white.vx = Math.cos(angle) * force;
    white.vy = Math.sin(angle) * force;

    io.to(roomId).emit('meta', metaPayload(game));
    io.to(roomId).emit('syncAim', { angle: angle, force: 0 });
    
    game.botState = 'idle';
    return;
  }
}

module.exports = { updateBot };