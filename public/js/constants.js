export const CONSTANTS = {
    // Dimensões da Mesa (Devem bater com o servidor)
    TABLE_WIDTH: 800,
    TABLE_HEIGHT: 400,
    OFFSET_X: 25, // Margem da tabela (bordas)
    OFFSET_Y: 25,
    
    // Dimensões Físicas
    BALL_RADIUS: 11.5,
    POCKET_RADIUS: 28,
    
    // Tela e Renderização
    TOTAL_W: 800, // Largura total do Canvas
    TOTAL_H: 400, // Altura total do Canvas
    
    // Cores das Bolas (Mapeamento Visual)
    BALL_COLORS: {
        0: 0xffffff, // Branca
        1: 0xffd700, // Amarela
        2: 0x0000ff, // Azul
        3: 0xff0000, // Vermelha
        4: 0x800080, // Roxa
        5: 0xffa500, // Laranja
        6: 0x008000, // Verde
        7: 0x800000, // Marrom
        8: 0x000000, // Preta
        // Listradas (Mesmas cores base)
        9: 0xffd700, 10: 0x0000ff, 11: 0xff0000, 
        12: 0x800080, 13: 0xffa500, 14: 0x008000, 15: 0x800000
    }
};
