import { CONSTANTS } from './constants.js';
import { GameState } from './state.js';
import { getPrediction } from './physics.js';
import { Vec2 } from './utils.js';

export function drawAimGuide(ctx, cueBall) {
    const { OFFSET_X, OFFSET_Y, BALL_RADIUS } = CONSTANTS;
    
    const prediction = getPrediction(cueBall, GameState.aimAngle);
    if (!prediction) return;

    const cx = cueBall.x + OFFSET_X;
    const cy = cueBall.y + OFFSET_Y;
    const impactX = prediction.impactPoint.x + OFFSET_X;
    const impactY = prediction.impactPoint.y + OFFSET_Y;
    const dist = Math.hypot(impactX - cx, impactY - cy);

    // 1. Linha do Taco até a Branca (Tracejada)
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(GameState.aimAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dist, 0);
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    ctx.setLineDash([10, 10]);
    ctx.stroke();
    ctx.restore();

    // 2. Bola Fantasma (No impacto)
    ctx.save();
    ctx.translate(impactX, impactY);
    ctx.beginPath();
    ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();

    // 3. MIRA DA BOLA ALVO (Ajustada: Curta e Tracejada)
    if (prediction.targetBall) {
        const tPos = { 
            x: prediction.targetBall.x + OFFSET_X, 
            y: prediction.targetBall.y + OFFSET_Y 
        };
        
        const angleToBall = Math.atan2(tPos.y - impactY, tPos.x - impactX);
        
        ctx.save();
        ctx.translate(tPos.x, tPos.y); 
        
        ctx.beginPath();
        ctx.moveTo(0, 0);
        
        // MUDANÇA 1: Comprimento limitado a 280px (aprox 1/3 da mesa)
        const aimLength = 280; 
        ctx.lineTo(Math.cos(angleToBall) * aimLength, Math.sin(angleToBall) * aimLength);
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)"; 
        
        // MUDANÇA 2: Agora é tracejada
        ctx.setLineDash([10, 10]); 
        
        ctx.stroke();
        ctx.restore();
    }
}