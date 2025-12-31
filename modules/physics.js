const C = require('./constants');

// Função auxiliar: Atrito (Sem alterações)
function rollingFrictionFactor(speed) {
  if (speed > 8) return 0.993;
  if (speed > 4) return 0.990;
  if (speed > 2) return 0.987;
  return 0.982;
}

// Função auxiliar: Iniciar queda na caçapa
// MODIFICADO: Agora aceita audioEvents para tocar o som
function startFalling(ball, pocket, game, audioEvents) {
  if (ball.state === 'falling') return;

  // --- ÁUDIO: BOLA CAIU ---
  if (audioEvents) {
      audioEvents.push({ type: 'pocket', vol: 1.0 });
  }
  // ------------------------

  ball.state = 'falling';
  ball.targetPocket = pocket;
  ball.vx *= 0.45;
  ball.vy *= 0.45;

  // Registra que bola caiu (para as regras)
  if (game.shot.inProgress) {
    if (ball.id !== 0) {
      if (!game.shot.pocketedIds.includes(ball.id)) game.shot.pocketedIds.push(ball.id);
    }
  }
}

// Função auxiliar: Resolver colisão Bola x Bola
// MODIFICADO: Agora aceita audioEvents para calcular o impacto
function resolveCollision(b1, b2, game, audioEvents) {
  const dx = b2.x - b1.x;
  const dy = b2.y - b1.y;
  const dist = Math.hypot(dx, dy);
  const minDist = C.BALL_RADIUS * 2;

  if (dist <= 0 || dist >= minDist) return;

  // Regra: Primeiro contato da branca
  if (game.shot.inProgress && !game.shot.firstContactId) {
    if (b1.id === 0 && b2.id !== 0) game.shot.firstContactId = b2.id;
    else if (b2.id === 0 && b1.id !== 0) game.shot.firstContactId = b1.id;
  }

  const nx = dx / dist;
  const ny = dy / dist;

  // --- ÁUDIO: CALCULA A FORÇA DO IMPACTO ---
  // Fazemos isso ANTES de alterar as posições/velocidades
  const dvx_audio = b1.vx - b2.vx;
  const dvy_audio = b1.vy - b2.vy;
  // Projeção da velocidade na normal (força real da batida)
  const impactForce = Math.abs(dvx_audio * nx + dvy_audio * ny);

  if (audioEvents && impactForce > 0.5) {
      const vol = Math.min(1, impactForce / 30); // 30 é uma pancada forte
      audioEvents.push({
          type: 'hit',
          variant: vol > 0.6 ? 'hit_hard' : 'hit_soft',
          vol: vol
      });
  }
  // ------------------------------------------

  const overlap = (minDist - dist) / 2;
  b1.x -= nx * overlap; b1.y -= ny * overlap;
  b2.x += nx * overlap; b2.y += ny * overlap;

  const dvx = b2.vx - b1.vx;
  const dvy = b2.vy - b1.vy;
  const relVel = dvx * nx + dvy * ny;

  if (relVel > 0) return;

  const j = -(1 + C.RESTITUTION) * relVel / 2;
  const ix = j * nx;
  const iy = j * ny;

  b1.vx -= ix; b1.vy -= iy;
  b2.vx += ix; b2.vy += iy;
}

// === FUNÇÃO PRINCIPAL DESTE MÓDULO ===
// MODIFICADO: Recebe audioEvents do server.js
function stepPhysics(balls, game, audioEvents) {
  
  for (let i = balls.length - 1; i >= 0; i--) {
    const ball = balls[i];

    // 1. Lógica de Queda
    if (ball.state === 'falling') {
      ball.x += (ball.targetPocket.x - ball.x) * C.POCKET_PULL_STRENGTH;
      ball.y += (ball.targetPocket.y - ball.y) * C.POCKET_PULL_STRENGTH;
      
      // Ajuste visual da queda (se quiser mais rápido ou devagar, mude aqui)
      ball.scale -= 0.03; 

      if (ball.scale <= 0) {
        if (ball.id === 0) {
          // Scratch da Branca
          ball.state = 'active';
          ball.scale = 1;
          ball.x = 200; ball.y = 200;
          ball.vx = 0; ball.vy = 0;
          if (game.shot.inProgress) {
            game.shot.scratch = true;
            game.shot.foul = true;
            game.shot.reason = game.shot.reason || 'Branca caiu (suicídio)';
          }
        } else {
          balls.splice(i, 1);
        }
      }
      continue;
    }

    // 2. Movimento
    ball.x += ball.vx / C.PHYSICS_STEPS;
    ball.y += ball.vy / C.PHYSICS_STEPS;

    // 3. Atrito
    const speed = Math.hypot(ball.vx, ball.vy);
    const fr = rollingFrictionFactor(speed);
    ball.vx *= Math.pow(fr, 1 / C.PHYSICS_STEPS);
    ball.vy *= Math.pow(fr, 1 / C.PHYSICS_STEPS);

    // 4. Caçapas
    for (const p of C.pockets) {
      const dx = ball.x - p.x;
      const dy = ball.y - p.y;
      const dist = Math.hypot(dx, dy);

      if (dist < C.POCKET_RADIUS && speed < C.POCKET_MAX_SPEED) {
        // Passamos audioEvents para a função tocar o som
        if (dist < C.POCKET_PULL_RADIUS) startFalling(ball, p, game, audioEvents);
        break;
      }
    }

    // 5. Paredes (Com Som de Tabela)
    if (ball.state === 'active') {
      let hitWall = false;
      let impactSpeed = 0;

      // Esquerda
      if (ball.x < C.BALL_RADIUS) {
        ball.x = C.BALL_RADIUS; 
        impactSpeed = Math.abs(ball.vx); // Velocidade da batida
        ball.vx *= -C.CUSHION_RESTITUTION; 
        ball.vy *= C.CUSHION_TANGENTIAL_LOSS;
        hitWall = true;
      }
      // Direita
      if (ball.x > C.TABLE_WIDTH - C.BALL_RADIUS) {
        ball.x = C.TABLE_WIDTH - C.BALL_RADIUS; 
        impactSpeed = Math.abs(ball.vx);
        ball.vx *= -C.CUSHION_RESTITUTION; 
        ball.vy *= C.CUSHION_TANGENTIAL_LOSS;
        hitWall = true;
      }
      // Cima
      if (ball.y < C.BALL_RADIUS) {
        ball.y = C.BALL_RADIUS; 
        impactSpeed = Math.abs(ball.vy);
        ball.vy *= -C.CUSHION_RESTITUTION; 
        ball.vx *= C.CUSHION_TANGENTIAL_LOSS;
        hitWall = true;
      }
      // Baixo
      if (ball.y > C.TABLE_HEIGHT - C.BALL_RADIUS) {
        ball.y = C.TABLE_HEIGHT - C.BALL_RADIUS; 
        impactSpeed = Math.abs(ball.vy);
        ball.vy *= -C.CUSHION_RESTITUTION; 
        ball.vx *= C.CUSHION_TANGENTIAL_LOSS;
        hitWall = true;
      }

      // --- ÁUDIO: BATIDA NA TABELA ---
      if (hitWall && audioEvents && impactSpeed > 0.5) {
          audioEvents.push({ 
              type: 'cushion', 
              vol: Math.min(1, impactSpeed / 20) 
          });
      }
    }
  }

  // 6. Colisões entre bolas
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      if (balls[i].state === 'active' && balls[j].state === 'active') {
        // Passamos audioEvents para resolver colisão com som
        resolveCollision(balls[i], balls[j], game, audioEvents);
      }
    }
  }
}

module.exports = { stepPhysics };