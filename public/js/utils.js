export const Vec2 = {
    add: (v1, v2) => ({ x: v1.x + v2.x, y: v1.y + v2.y }),
    sub: (v1, v2) => ({ x: v1.x - v2.x, y: v1.y - v2.y }),
    scale: (v, s) => ({ x: v.x * s, y: v.y * s }),
    dot: (v1, v2) => v1.x * v2.x + v1.y * v2.y,
    dist: (p1, p2) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2)),
    norm: (v) => { 
        const l = Math.sqrt(v.x*v.x + v.y*v.y); 
        return l===0 ? {x:0,y:0} : {x:v.x/l, y:v.y/l}; 
    }
};

export function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
}