export const GameState = {
    ballsMap: new Map(),
    meta: null, // Placar e status do servidor
    aimAngle: 0,
    targetAimAngle: 0,
    isShiftDown: false,
    mouse: { x: 0, y: 0, isDown: false, pullBackDist: 0 },
    assets: { table: false, cue: false },
    images: { table: new Image(), cue: new Image() }
};

// Inicializa imagens
GameState.images.table.src = 'mesa.png';
GameState.images.cue.src = 'taco.png';
GameState.images.table.onload = () => GameState.assets.table = true;
GameState.images.cue.onload = () => GameState.assets.cue = true;