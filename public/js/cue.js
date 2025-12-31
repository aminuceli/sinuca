import { CONSTANTS } from './constants.js';
import { GameState } from './state.js';

export function drawCue(ctx, cueBall) {
    const { OFFSET_X, OFFSET_Y, BALL_RADIUS } = CONSTANTS;
    const cx = cueBall.x + OFFSET_X;
    const cy = cueBall.y + OFFSET_Y;
    const dist = BALL_RADIUS + 10 + GameState.mouse.pullBackDist; // +10 para afastar um pouco da bola
    const cueW = 430; 
    const cueH = 13; // Altura visual do taco

    // AJUSTE FINO: Mude este valor se o taco não alinhar com o pontilhado
    const yVisualOffset = 0; // Tente 2 ou -2 se estiver torto

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(GameState.aimAngle);

    // Desenho do Taco
    if (GameState.assets.cue) {
        ctx.save(); 
        ctx.rotate(Math.PI); 
        // Aqui desenhamos o taco. O eixo Y é centralizado em -cueH/2
        ctx.drawImage(GameState.images.cue, dist, (-cueH/2) + yVisualOffset, cueW, cueH);
        ctx.restore();
    } else {
        // Fallback (retângulo marrom) caso imagem falhe
        ctx.fillStyle = "#8d6e63";
        ctx.rotate(Math.PI);
        ctx.fillRect(dist, -3, 300, 6);
    }

    // Barra de Força (Visualização da potência)
    if (GameState.mouse.pullBackDist > 0) {
        ctx.rotate(Math.PI); 
        const forcePct = Math.min(1, GameState.mouse.pullBackDist / 160);
        // Cor muda de verde para vermelho conforme força
        const green = Math.floor(255 * (1 - forcePct));
        const red = 255;
        
        ctx.fillStyle = `rgb(${red}, ${green}, 0)`;
        
        // Desenha a barra levemente acima do taco
        ctx.fillRect(dist + 10, -20, GameState.mouse.pullBackDist / 2, 6);
        
        // Contorno
        ctx.strokeStyle = "rgba(255,255,255,0.5)"; 
        ctx.lineWidth = 1;
        ctx.strokeRect(dist + 10, -20, GameState.mouse.pullBackDist / 2, 6);
    }

    ctx.restore();
}