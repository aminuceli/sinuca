function activeBallsByType(balls, type) {
    return balls.filter(b => b.type === type && b.state === 'active');
}

function otherPlayerKey(k) { return k === 'p1' ? 'p2' : 'p1'; }

function finalizeShot(game, balls, clearShotCallback) {
    const shooter = game.shot.by;
    if (!shooter) { clearShotCallback(); return; }
  
    const other = otherPlayerKey(shooter);
    const shooterObj = game.players[shooter];
    const otherObj = game.players[other];
  
    // 1. Falta: Não acertou nenhuma bola
    if (!game.shot.firstContactId) {
      game.shot.foul = true;
      game.shot.reason = game.shot.reason || 'Não tocou em nenhuma bola';
    }

    // === CORREÇÃO AQUI: DETECTAR SCRATCH (BRANCA CAIU) ===
    // Precisamos saber se a branca caiu para marcar falta, 
    // mas NÃO vamos resetar a posição dela aqui (o server.js cuida disso agora)
    const whiteBall = balls.find(b => b.id === 0);
    if (whiteBall && (whiteBall.state === 'pocketed' || game.shot.scratch)) {
        game.shot.scratch = true; // Marca que foi scratch
        game.shot.foul = true;    // É falta
        game.shot.reason = 'Branca caiu (Scratch)';
    }
    // ====================================================
  
    const eightStillOnTable = balls.some(b => b.id === 8);
    const eightPocketed = !eightStillOnTable;
  
    // 2. Definir Grupo (Lisas ou Listradas) se ainda não definido
    if (!shooterObj.group && !otherObj.group) {
      const pocketedNon8 = game.shot.pocketedIds
        .filter(id => id !== 8 && id !== 0)
        .map(id => ({ id, type: (id > 8 ? 'stripe' : 'solid') }));
  
      if (pocketedNon8.length > 0) {
        shooterObj.group = pocketedNon8[0].type;
        otherObj.group = shooterObj.group === 'solid' ? 'stripe' : 'solid';
      }
    }
  
    // 3. Falta: Tocar na bola errada primeiro
    if (!game.shot.foul && shooterObj.group) {
      const fc = game.shot.firstContactId;
      if (fc && fc !== 8) {
        const fcType = (fc > 8 ? 'stripe' : 'solid');
        if (fcType !== shooterObj.group) {
          game.shot.foul = true;
          game.shot.reason = `Tocou na bola adversária (${fcType})`;
        }
      }
      if (fc === 8) {
        const shooterRemaining = activeBallsByType(balls, shooterObj.group).length;
        if (shooterRemaining > 0) {
          game.shot.foul = true;
          game.shot.reason = 'Tocou na 8 antes de limpar suas bolas';
        }
      }
    }
  
    // 4. Contabilizar Pontos
    if (shooterObj.group) {
      const gained = game.shot.pocketedIds.filter(id => {
        if (id === 8) return false;
        const t = (id > 8 ? 'stripe' : 'solid');
        return t === shooterObj.group;
      }).length;
      shooterObj.score += gained;
    }
  
    // 5. VITÓRIA / DERROTA (Bola 8)
    if (eightPocketed) {
      game.phase = 'game_over';
      const shooterGroup = shooterObj.group;
      
      if (!shooterGroup) {
          game.winner = other; 
          game.shot.reason = 'Derrubou a 8 cedo demais!';
      } else {
          const shooterRemaining = activeBallsByType(balls, shooterGroup).length;
          
          if (game.shot.scratch) { 
              game.winner = other;
              game.shot.reason = 'Suicídio da branca na jogada da 8!';
          }
          else if (shooterRemaining > 0) { 
              game.winner = other;
              game.shot.reason = 'Derrubou a 8 antes de terminar o grupo!';
          }
          else if (game.shot.foul) { 
              game.winner = other;
              game.shot.reason = 'Falta cometida na jogada da 8';
          } else {
              game.winner = shooter;
          }
      }
      clearShotCallback();
      return;
    }
  
    // 6. Troca de Turno
    let keepTurn = false;
    if (!game.shot.foul && shooterObj.group) {
      keepTurn = game.shot.pocketedIds.some(id => {
        if (id === 8) return false;
        const t = (id > 8 ? 'stripe' : 'solid');
        return t === shooterObj.group;
      });
    } else if (!game.shot.foul && !shooterObj.group) {
      keepTurn = game.shot.pocketedIds.some(id => id !== 8);
    }
  
    if (game.shot.foul || !keepTurn) {
      game.currentTurn = other;
    }
  
    clearShotCallback();
}

module.exports = { finalizeShot };