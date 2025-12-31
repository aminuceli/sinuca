const C = require('./constants');

// CONFIGURAÇÃO DE MIRA
const AIM_DEPTH = 5; 

// Posição das Caçapas (Pontos de mira)
const POCKETS = [
    { x: C.OFFSET_X - AIM_DEPTH, y: C.OFFSET_Y - AIM_DEPTH }, 
    { x: C.TABLE_WIDTH / 2, y: C.OFFSET_Y - AIM_DEPTH * 2 }, 
    { x: C.TABLE_WIDTH - C.OFFSET_X + AIM_DEPTH, y: C.OFFSET_Y - AIM_DEPTH }, 
    { x: C.OFFSET_X - AIM_DEPTH, y: C.TABLE_HEIGHT - C.OFFSET_Y + AIM_DEPTH }, 
    { x: C.TABLE_WIDTH / 2, y: C.TABLE_HEIGHT - C.OFFSET_Y + AIM_DEPTH * 2 }, 
    { x: C.TABLE_WIDTH - C.OFFSET_X + AIM_DEPTH, y: C.TABLE_HEIGHT - C.OFFSET_Y + AIM_DEPTH } 
];

// Tabelas (Paredes) para cálculo de Bank Shots
const RAILS = [
    { id: 'top', y: C.OFFSET_Y, normal: {x:0, y:1} },
    { id: 'bottom', y: C.TABLE_HEIGHT - C.OFFSET_Y, normal: {x:0, y:-1} },
    { id: 'left', x: C.OFFSET_X, normal: {x:1, y:0} },
    { id: 'right', x: C.TABLE_WIDTH - C.OFFSET_X, normal: {x:-1, y:0} }
];

module.exports = { POCKETS, RAILS, AIM_DEPTH };