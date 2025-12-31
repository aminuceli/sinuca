module.exports = {
  // DIMENSÕES DA MESA
  TABLE_WIDTH: 800,
  TABLE_HEIGHT: 400,
  
  // MARGENS (A BORDA DE MADEIRA/TABELA)
  // Essencial para o bot saber onde a bola bate e não mirar na parede
  OFFSET_X: 25, 
  OFFSET_Y: 25,

  // BOLAS
  BALL_RADIUS: 11.5,
  
  // CAÇAPAS (Buracos)
  POCKET_RADIUS: 28,           // Aumentei um pouco para facilitar a caída
  POCKET_PULL_RADIUS: 26,      
  POCKET_MAX_SPEED: 95.0,      // Aceita tacadas muito fortes (bot sniper)
  POCKET_PULL_STRENGTH: 0.15,  // Leve atração gravitacional para ajudar
  
  // FÍSICA E COLISÃO
  RESTITUTION: 0.985,         // Quique da bola
  CUSHION_RESTITUTION: 0.85,  // Tabela absorve mais (mais realista, evita bola voando)
  CUSHION_TANGENTIAL_LOSS: 0.985,
  MIN_VELOCITY: 0.02,         // Mais precisão no fim do movimento
  PHYSICS_STEPS: 8,           // Qualidade da simulação (8 é bom)

  // CORES
  ballColors: {
    1: 'gold', 2: 'blue', 3: 'red', 4: 'purple', 5: 'orange', 6: 'green', 7: 'maroon',
    8: 'black',
    9: 'gold', 10: 'blue', 11: 'red', 12: 'purple', 13: 'orange', 14: 'green', 15: 'maroon'
  },

  // POSIÇÃO OFICIAL DAS CAÇAPAS (USADA PELA FÍSICA)
  pockets: [
    {x: 0, y: 0}, {x: 400, y: 0}, {x: 800, y: 0},
    {x: 0, y: 400}, {x: 400, y: 400}, {x: 800, y: 400}
  ]
};