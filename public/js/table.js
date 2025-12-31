import { CONSTANTS } from './constants.js';
import { GameState } from './state.js';

export function drawTable(ctx) {
    const { TOTAL_W, TOTAL_H, OFFSET_X, OFFSET_Y, PLAY_AREA_W, PLAY_AREA_H } = CONSTANTS;

    if (GameState.assets.table) { 
        ctx.drawImage(GameState.images.table, 0, 0, TOTAL_W, TOTAL_H); 
        return; 
    }

    // Fallback: Desenho procedural se a imagem não carregar
    let woodGrad = ctx.createLinearGradient(0, 0, TOTAL_W, TOTAL_H);
    woodGrad.addColorStop(0, "#3e2723"); woodGrad.addColorStop(1, "#1a100e");
    ctx.fillStyle = woodGrad; ctx.fillRect(0, 0, TOTAL_W, TOTAL_H);
    
    let clothGrad = ctx.createRadialGradient(TOTAL_W/2, TOTAL_H/2, 100, TOTAL_W/2, TOTAL_H/2, 500);
    clothGrad.addColorStop(0, "#2e7d32"); clothGrad.addColorStop(1, "#1b5e20");
    ctx.fillStyle = clothGrad; ctx.fillRect(OFFSET_X, OFFSET_Y, PLAY_AREA_W, PLAY_AREA_H);
    
    // Bordas
    ctx.fillStyle = "#144a18";
    ctx.fillRect(OFFSET_X, OFFSET_Y - 15, PLAY_AREA_W, 15); 
    ctx.fillRect(OFFSET_X, OFFSET_Y + PLAY_AREA_H, PLAY_AREA_W, 15);
    ctx.fillRect(OFFSET_X - 15, OFFSET_Y, 15, PLAY_AREA_H); 
    ctx.fillRect(OFFSET_X + PLAY_AREA_W, OFFSET_Y, 15, PLAY_AREA_H);

    // Caçapas (Bloco 3)
    const pockets = [
        [OFFSET_X-5, OFFSET_Y-5], [OFFSET_X+PLAY_AREA_W+5, OFFSET_Y-5], [OFFSET_X+PLAY_AREA_W/2, OFFSET_Y-8],
        [OFFSET_X-5, OFFSET_Y+PLAY_AREA_H+5], [OFFSET_X+PLAY_AREA_W+5, OFFSET_Y+PLAY_AREA_H+5], [OFFSET_X+PLAY_AREA_W/2, OFFSET_Y+PLAY_AREA_H+8]
    ];
    ctx.fillStyle = "#000"; 
    pockets.forEach(p => { 
        ctx.beginPath(); ctx.arc(p[0], p[1], CONSTANTS.POCKET_RADIUS, 0, Math.PI*2); ctx.fill(); 
    });
}