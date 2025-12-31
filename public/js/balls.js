import { CONSTANTS } from './constants.js';
import { GameState } from './state.js';

let scene, camera, renderer, shadowMatBase;
const ballRigs = new Map();
const coresPersonalizadas = {
    0: '#ffffff', 1: '#ffdb00', 2: '#0055ff', 3: '#ff0022', 4: '#aa33ff', 5: '#ff8c00', 6: '#008800', 7: '#b85c38', 8: '#151515',
    9: '#ffdb00', 10: '#0055ff', 11: '#ff0022', 12: '#aa33ff', 13: '#ff8c00', 14: '#008800', 15: '#b85c38'
};

function makeBallTexture(ballId, type, baseColor) {
    const size = 512;
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d');

    if (type === 'stripe') {
        g.fillStyle = '#fdfdfd'; g.fillRect(0, 0, size, size);
        g.fillStyle = baseColor; g.fillRect(0, size * 0.25, size, size * 0.50);
    } else {
        g.fillStyle = baseColor; g.fillRect(0, 0, size, size);
    }

    if (ballId === 0) {
        g.beginPath(); g.arc(size*0.5, size*0.5, size*0.035, 0, Math.PI*2); g.fillStyle = '#ff0000'; g.fill();
    } else {
        let r, f;
        if (type === 'stripe') { r = size * 0.19; f = 180; } else { r = size * 0.12; f = 110; }
        g.beginPath(); g.arc(size * 0.5, size * 0.5, r, 0, Math.PI * 2); g.fillStyle = '#ffffff'; g.fill();
        g.fillStyle = '#000000'; g.font = `bold ${f}px Arial`;
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(String(ballId), size * 0.5, size * 0.52);
    }
    return new THREE.CanvasTexture(c);
}

function ensureBallRig(b) {
    if (ballRigs.has(b.id)) return ballRigs.get(b.id);
    
    const color = coresPersonalizadas[b.id] || (b.type === 'cue' ? '#fff' : (b.type === 'black'?'#111':'#f00'));
    const tex = makeBallTexture(b.id, b.type, color);
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.1, transparent: true });
    const geo = new THREE.SphereGeometry(CONSTANTS.BALL_RADIUS, 32, 32);
    const mesh = new THREE.Mesh(geo, mat);

    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shadowMatBase.clone());
    shadowMesh.rotation.x = -Math.PI / 2; shadowMesh.position.y = 0.5;

    const group = new THREE.Group();
    group.add(shadowMesh); group.add(mesh);
    scene.add(group);
    
    const rig = { group, ballMesh: mesh, shadowMesh };
    ballRigs.set(b.id, rig);
    return rig;
}

function rotateBall(mesh, dx, dy) {
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < 0.001) return;
    const angle = dist / CONSTANTS.BALL_RADIUS;
    const axis = new THREE.Vector3(dy, 0, -dx).normalize();
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    mesh.quaternion.premultiply(q);
}

export function init3D(canvasEl) {
    const { TOTAL_W, TOTAL_H } = CONSTANTS;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(35, TOTAL_W/TOTAL_H, 0.1, 2000);
    
    renderer = new THREE.WebGLRenderer({ canvas: canvasEl, alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.78); scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, 0.65); key.position.set(0, 320, 240); scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, 0.22); fill.position.set(-260, 180, -180); scene.add(fill);

    camera.position.set(TOTAL_W / 2, 850, TOTAL_H / 2 + 50);
    camera.lookAt(new THREE.Vector3(TOTAL_W / 2, 0, TOTAL_H / 2));

    // Textura de sombra genérica
    const sc = document.createElement('canvas'); sc.width=sc.height=256;
    const sg = sc.getContext('2d');
    const grad = sg.createRadialGradient(128,128,25,128,128,115);
    grad.addColorStop(0, 'rgba(0,0,0,0.35)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    sg.fillStyle=grad; sg.fillRect(0,0,256,256);
    shadowMatBase = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false });

    window.addEventListener('resize', () => {
        const rect = canvasEl.getBoundingClientRect();
        renderer.setSize(rect.width, rect.height, false);
        camera.aspect = rect.width / rect.height;
        camera.updateProjectionMatrix();
    });
    // Trigger initial resize
    setTimeout(() => window.dispatchEvent(new Event('resize')), 100);
}

export function render3D() {
    const { OFFSET_X, OFFSET_Y, BALL_RADIUS } = CONSTANTS;
    const alive = new Set();
    
    GameState.ballsMap.forEach((b) => {
        alive.add(b.id);
        const rig = ensureBallRig(b);
        const sc = b.scale ?? 1;
        const sink = 1 - sc;

        const tx = b.x + OFFSET_X;
        const ty = b.y + OFFSET_Y;
        
        rotateBall(rig.ballMesh, tx - rig.group.position.x, ty - rig.group.position.z);
        
        rig.group.position.set(tx, 0, ty);
        rig.ballMesh.scale.setScalar(sc);
        rig.ballMesh.position.y = BALL_RADIUS - (sink * 140); // 140 = pocket depth visual

        // Opacidade
        if (sink > 0) {
            const t = Math.min(1, Math.max(0, (sink - 0.15) / 0.85));
            rig.ballMesh.material.opacity = 1 - 0.55 * t;
        } else rig.ballMesh.material.opacity = 1;

        // Sombra
        const sSize = (BALL_RADIUS * 2.8) * sc;
        rig.shadowMesh.scale.set(sSize, sSize, 1);
        rig.shadowMesh.material.opacity = 0.28 * (1 - sink);
    });

    // Cleanup
    for (const [id, rig] of ballRigs.entries()) {
        if (!alive.has(id)) {
            scene.remove(rig.group);
            rig.ballMesh.material.dispose();
            ballRigs.delete(id);
        }
    }
    renderer.render(scene, camera);
}