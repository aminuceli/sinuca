import { CONSTANTS } from './constants.js';
import { Vec2 } from './utils.js';
import { GameState } from './state.js';

export function getPrediction(cueBall, angle) {
    const start = { x: cueBall.x, y: cueBall.y };
    const dir = { x: Math.cos(angle), y: Math.sin(angle) };
    
    let closestDist = Infinity;
    let targetBall = null;
    let targetDir = null; // Vamos calcular isso agora
    let hitWall = false;

    // 1. Verifica colisão com BOLAS
    GameState.ballsMap.forEach(ball => {
        if (ball.id === 0 || (ball.scale || 1) < 1) return;

        const bPos = { x: ball.x, y: ball.y };
        const toBall = Vec2.sub(bPos, start);
        const projection = Vec2.dot(toBall, dir);

        if (projection <= 0) return;

        const closestPointOnLine = Vec2.add(start, Vec2.scale(dir, projection));
        const distToLine = Vec2.dist(bPos, closestPointOnLine);

        if (distToLine < CONSTANTS.BALL_RADIUS * 2) {
            const backDist = Math.sqrt(Math.pow(CONSTANTS.BALL_RADIUS * 2, 2) - Math.pow(distToLine, 2));
            const impactDist = projection - backDist;

            if (impactDist < closestDist && impactDist > 0) {
                closestDist = impactDist;
                targetBall = ball;
            }
        }
    });

    // 2. Verifica colisão com PAREDES
    const margin = CONSTANTS.BALL_RADIUS;
    const w = CONSTANTS.PLAY_AREA_W;
    const h = CONSTANTS.PLAY_AREA_H;
    
    const dists = [
        dir.x < 0 ? (margin - start.x) / dir.x : Infinity,
        dir.x > 0 ? ((w - margin) - start.x) / dir.x : Infinity,
        dir.y < 0 ? (margin - start.y) / dir.y : Infinity,
        dir.y > 0 ? ((h - margin) - start.y) / dir.y : Infinity
    ];

    for(let d of dists) {
        if (d > 0 && d < closestDist) {
            closestDist = d;
            targetBall = null; 
            hitWall = true;
        }
    }

    if (closestDist === Infinity) closestDist = 1500;

    const impactPoint = Vec2.add(start, Vec2.scale(dir, closestDist));

    // 3. CALCULA A DIREÇÃO DA BOLA ALVO (A Mágica acontece aqui)
    if (targetBall) {
        // Vetor entre o ponto de impacto (fantasma) e o centro da bola alvo
        const impactVector = Vec2.sub({x: targetBall.x, y: targetBall.y}, impactPoint);
        targetDir = Vec2.norm(impactVector); // Normaliza para ter direção pura
    }

    return { targetBall, impactPoint, hitWall, targetDir };
}