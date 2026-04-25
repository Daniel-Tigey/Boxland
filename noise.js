// --- ValueNoise + Worley分型地形 FBM/Worley Cellular Noise ----
class ValueNoise {
    constructor(seed = 1) { this.seed = seed; }
    hash(x, y) {
        let n = x * 374761393 + y * 668265263 + this.seed * 31;
        n = (n ^ (n >> 13)) ^ this.seed;
        return (n & 255) / 255;
    }
    lerp(a, b, t) { return a + (b - a) * t; }
    fade(t) { return t * t * (3 - 2 * t); }
    noise(x, y) {
        const xi = Math.floor(x), yi = Math.floor(y);
        const xf = x - xi, yf = y - yi;
        const tl = this.hash(xi, yi);
        const tr = this.hash(xi + 1, yi);
        const bl = this.hash(xi, yi + 1);
        const br = this.hash(xi + 1, yi + 1);
        const xt = this.lerp(tl, tr, this.fade(xf));
        const xb = this.lerp(bl, br, this.fade(xf));
        return this.lerp(xt, xb, this.fade(yf));
    }
    fbm(x, y, {octaves = 5, gain = 0.5, lacunarity = 2.0, amp = 1, freq = 1} = {}) {
        let sum = 0, totalAmp = 0;
        for (let i = 0; i < octaves; ++i) {
            sum += this.noise(x * freq, y * freq) * amp;
            totalAmp += amp;
            amp *= gain;
            freq *= lacunarity;
        }
        return sum / totalAmp;
    }
    // Worley/Voronoi距离型元胞噪声（简单2D, 每单位格唯一随机点, 距离最近点的距离）
    worley(x, y, cell_density=8) {
        const ci = Math.floor(x * cell_density), cj = Math.floor(y * cell_density);
        let minDist = 999;
        for (let i = -1; i <= 1; i++)
            for (let j = -1; j <= 1; j++) {
                let seed = (ci + i) * 49632 + (cj + j) * 325176 + this.seed * 13337;
                let fx = (ci + i) + (Math.sin(seed) * 43758.5453 % 1);
                let fy = (cj + j) + (Math.cos(seed) * 12345.6789 % 1);
                let dx = x * cell_density - fx;
                let dy = y * cell_density - fy;
                let dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < minDist) minDist = dist;
            }
        return Math.max(0, Math.min(minDist, 1));
    }
}

// ================== 方块定义 ===================
const BLOCK = {
    grass: 0, dirt: 1, stone: 2, log: 3, leaf: 4,
    water: 5, bedrock: 6, sand: 7, deepslate: 8
};
const COLORS = [
    0x4CAF50, // grass
    0x8B5A2B, // dirt
    0x888888, // stone
    0x8B4513, // log
    0x19cc19, // leaf
    0x4091F7, // water
    0x000000, // bedrock
    0xDED39E, // sand
    0x3A3A3A  // deepslate
];

// ================== 世界生成参数 ==================
const WORLD_W = 64, WORLD_D = 64, WORLD_H = 48, SAND_THICK = 3;
const noise = new ValueNoise(54188114514);

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function createWorld() {
    const blocks = [];
    for (let x = 0; x < WORLD_W; x++) {
        blocks[x] = [];
        for (let y = 0; y < WORLD_H; y++) {
            blocks[x][y] = [];
            for (let z = 0; z < WORLD_D; z++) {
                blocks[x][y][z] = null;
            }
        }
    }

    // ---------- 噪声参数和地表线 ----------
    const waterLine = Math.floor(WORLD_H * 0.26); // ~12
    const deepslateH = 8; // 深层石头自然层厚
    const bedrockBase = 2; // 基岩最低层厚度

    for (let x = 0; x < WORLD_W; x++) {
        for (let z = 0; z < WORLD_D; z++) {
            // 主地形 Fractal ValueNoise
            let e = noise.fbm(x/30, z/30, {octaves:4, gain:0.55, lacunarity:2.1});
            // 更起伏：加大幅度 + Worley引入大山沟（或洼地）
            let worleyVal = 0.44 - noise.worley(x/32, z/32, 5); // 范围 [0,1], 低为山谷
            let h0 = Math.floor(
                WORLD_H * 0.2 +
                Math.pow(e, 1.05) * WORLD_H * 0.55 +
                worleyVal * WORLD_H * 0.25
            );
            // 让山地、谷地落差更明显
            let h = clamp(h0, 5, WORLD_H-2);

            // ---- 低于较低水位洼地全埋沙底、沙子厚度 SAND_THICK ----
            // 三层底部一定概率为基岩（更自然结构），否则深层石头
            for(let y=0; y<WORLD_H; ++y)
                blocks[x][y][z] = null;

            // 基岩（0~bedrockBase-1），随机化更像MC
            for(let y=0; y<bedrockBase; ++y)
                if(Math.random() < 0.66 || y==0)
                    blocks[x][y][z] = BLOCK.bedrock;
                else
                    blocks[x][y][z] = BLOCK.deepslate;

            // 地表分层
            for(let y=bedrockBase; y<=h; ++y){
                let isLow = h < waterLine + 3; // 湖洋或洼地
                // 水域沙底
                if(isLow && y >= h-SAND_THICK+1)
                    blocks[x][y][z] = BLOCK.sand;
                // 深层石头
                else if(y < bedrockBase + deepslateH || (y < h-6 && h > waterLine+10 && Math.random()<0.25))
                    blocks[x][y][z] = BLOCK.deepslate;
                // 沙丘／洼地表层
                else if(y >= h-SAND_THICK+1 && isLow)
                    blocks[x][y][z] = BLOCK.sand;
                // 普通石头
                else if(y < h-7)
                    blocks[x][y][z] = BLOCK.stone;
                // 土
                else if(y < h)
                    blocks[x][y][z] = BLOCK.dirt;
                // 顶层
                else if(y == h) {
                    if(isLow) blocks[x][y][z] = BLOCK.sand;
                    else blocks[x][y][z] = BLOCK.grass;
                }
            }

            // 水体填洼地
            if(h < waterLine-1) {
                for(let y=h+1; y<waterLine; ++y)
                    blocks[x][y][z] = BLOCK.water;
            }
        }
    }

    // ---- 树（高度再+1） ----
    for(let i=0; i<60; ++i){
        let x = Math.floor(Math.random()*(WORLD_W-7)+3), z = Math.floor(Math.random()*(WORLD_D-7)+3);
        let y;
        for(y=WORLD_H-5; y>2; --y)
            if([BLOCK.grass,BLOCK.dirt].includes(blocks[x][y][z]) && blocks[x][y+1][z] == null)
                break;
        if(y<4) continue;
        let height = 4 + Math.floor(noise.noise(x*0.23,z*0.28)*2.8); // 比之前多+1
        for(let h=1;h<=height;++h)
            blocks[x][y+h][z]=BLOCK.log;
        for(let lx=-2;lx<=2;++lx)
         for(let ly=Math.floor(height/2);ly<=height+2;++ly)
          for(let lz=-2;lz<=2;++lz) {
            if(Math.abs(lx)+Math.abs(lz)>3||(lx===0&&ly===Math.floor(height/2)&&lz===0)) continue;
            let tx=x+lx, ty=y+ly, tz=z+lz;
            if(tx<0||ty>=WORLD_H||tz<0||tx>=WORLD_W||tz>=WORLD_D) continue;
            if(blocks[tx][ty][tz]==null) blocks[tx][ty][tz]=BLOCK.leaf;
         }
    }
    return blocks;
}

const gameState = {
    pointerLocked: false, showInfo: true,
    px: WORLD_W/2, py: Math.floor(WORLD_H*0.80), pz: WORLD_D/2,
    vx: 0, vy: 0, vz: 0,
    lookH: Math.PI / 2,
    lookV: -0.30,
    fly: false,
    move: { w: 0, a: 0, s: 0, d: 0, up: 0, down: 0 },
    speed: 0.17,
    size: 0.6,
    blocks: createWorld(),
};
window.gameState = gameState;

// ================== ThreeJS 场景、动态渲染区块 ====================
let camera, scene, renderer, blockMeshes;
function setupThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x81D4FA);
    camera = new THREE.PerspectiveCamera(82, window.innerWidth/window.innerHeight, 0.1, 1600);
    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.zIndex=5;
    document.body.appendChild(renderer.domElement);
    const ambient = new THREE.AmbientLight(0xffffff, 0.72); scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffee, 1.1); dir.position.set(60,80,5); scene.add(dir);
    blockMeshes = new Map();
    renderVisibleBlocks();
}

function renderVisibleBlocks() {
    const RENDER_DIST = 16;
    let camX = Math.floor(gameState.px), camY = Math.floor(gameState.py), camZ = Math.floor(gameState.pz);
    for(let x=0;x<WORLD_W;++x)
     for(let y=0;y<WORLD_H;++y)
      for(let z=0;z<WORLD_D;++z) {
        let id = gameState.blocks[x][y][z];
        let key = `${x}_${y}_${z}`;
        let dx = x-camX, dy = y-camY, dz = z-camZ;
        let inRange = Math.max(Math.abs(dx),Math.abs(dy),Math.abs(dz)) <= RENDER_DIST;
        if(id !== null && inRange) {
            if(!blockMeshes.has(key)) addBlockMesh(x,y,z,id);
        } else {
            if(blockMeshes.has(key)) {
                scene.remove(blockMeshes.get(key));
                blockMeshes.delete(key);
            }
        }
      }
}

function addBlockMesh(x, y, z, id) {
    let color = COLORS[id]||0xff00ff;
    let geometry = new THREE.BoxGeometry(1,1,1);
    let material = new THREE.MeshLambertMaterial({color});
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z);
    scene.add(mesh);
    blockMeshes.set(`${x}_${y}_${z}`, mesh);
}
function removeBlockMesh(x, y, z) {
    let key = `${x}_${y}_${z}`;
    let mesh = blockMeshes.get(key);
    if(mesh) { scene.remove(mesh); blockMeshes.delete(key);}
}

window.addEventListener('resize',()=>{
    if(!renderer||!camera)return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
});

// ================== 玩家视角 ====================
function updateCamera() {
    camera.position.set(gameState.px, gameState.py, gameState.pz);
    // FPS朝向，W前进=Z+
    let lx = Math.cos(gameState.lookV) * Math.sin(gameState.lookH);
    let ly = Math.sin(gameState.lookV);
    let lz = Math.cos(gameState.lookV) * Math.cos(gameState.lookH);
    camera.lookAt(gameState.px + lx, gameState.py + ly, gameState.pz + lz);
}

function isSolid(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if(x<0||x>=WORLD_W||y<0||y>=WORLD_H||z<0||z>=WORLD_D) return true;
    let val = gameState.blocks[x][y][z];
    return val!==null && val!==BLOCK.water && val!==BLOCK.leaf;
}
function canStand(nx, ny, nz) {
    let h = 1.64, r = 0.29;
    for(let y=ny-0.8; y<ny+h; y+=0.38)
    for(let dx=-r; dx<=r; dx+=0.35)
    for(let dz=-r; dz<=r; dz+=0.35) {
        if(isSolid(nx+dx, y, nz+dz))return false;
    }
    return true;
}
function stepPlayer() {
    let ang = gameState.lookH, speed = gameState.speed;
    let dx = 0, dz = 0;
    // 前后
    if(gameState.move.w) { dx += Math.sin(ang)*speed; dz += Math.cos(ang)*speed; }
    if(gameState.move.s) { dx -= Math.sin(ang)*speed; dz -= Math.cos(ang)*speed; }
    // 左右
    if(gameState.move.a) { dx += Math.sin(ang - Math.PI/2)*speed; dz += Math.cos(ang - Math.PI/2)*speed; }
    if(gameState.move.d) { dx += Math.sin(ang + Math.PI/2)*speed; dz += Math.cos(ang + Math.PI/2)*speed; }
    let px = gameState.px, py = gameState.py, pz = gameState.pz;
    let dy = 0;
    if(gameState.fly){
        if(gameState.move.up) dy += speed;
        if(gameState.move.down) dy -= speed;
    } else {
        gameState.vy -= 0.011;
        dy = gameState.vy;
    }
    if(canStand(px, py+dy, pz)) {
        py += dy;
    } else {
        let maxTry = 8, found = false, newY = py;
        for(let t=0;t<=maxTry;++t) {
            if(canStand(px, py+t*0.1, pz)) { newY=py+t*0.1; found=true; break; }
        }
        if(found) py = newY;
        gameState.vy = 0;
    }
    if(canStand(px+dx, py, pz)) px += dx;
    if(canStand(px, py, pz+dz)) pz += dz;
    px = Math.max(1, Math.min(WORLD_W-2, px));
    py = Math.max(2, Math.min(WORLD_H-2, py));
    pz = Math.max(1, Math.min(WORLD_D-2, pz));
    Object.assign(gameState, {px,py,pz});
}

function animate() {
    requestAnimationFrame(animate);
    stepPlayer();
    renderVisibleBlocks();
    updateCamera();
    renderer && renderer.render(scene, camera);
}

// ================== 方块交互 ====================
function raycastBlock(maxDist=6) {
    let ox = gameState.px, oy = gameState.py+0.6, oz = gameState.pz;
    let lx = Math.cos(gameState.lookV) * Math.sin(gameState.lookH);
    let ly = Math.sin(gameState.lookV);
    let lz = Math.cos(gameState.lookV) * Math.cos(gameState.lookH);
    for(let i=0;i<maxDist*15;i++) {
        let d = i*0.07;
        let x = ox+lx*d, y = oy+ly*d, z = oz+lz*d;
        let xi = Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
        if(xi<0||xi>=WORLD_W||yi<0||yi>=WORLD_H||zi<0||zi>=WORLD_D)continue;
        let t = gameState.blocks[xi][yi][zi];
        if(t!==null && t!==BLOCK.leaf) {
            let bx = x-lx*0.08, by = y-ly*0.08, bz = z-lz*0.08;
            return {x:xi,y:yi,z:zi, px:Math.floor(bx),py:Math.floor(by),pz:Math.floor(bz)};
        }
    }
    return null;
}

function onMousedown(e) {
    if (!gameState.pointerLocked) return;
    const hit = raycastBlock();
    if (!hit) return;
    if(e.button==0) {
        if(gameState.blocks[hit.x][hit.y][hit.z]!==BLOCK.bedrock){
            gameState.blocks[hit.x][hit.y][hit.z]=null;
            removeBlockMesh(hit.x,hit.y,hit.z);
        }
    }
    if(e.button==2) {
        let {px,py,pz} = hit;
        if (px<0||px>=WORLD_W||py<0||py>=WORLD_H||pz<0||pz>=WORLD_D ) return;
        if(gameState.blocks[px][py][pz]==null
           && Math.abs(px-gameState.px)>0.7
           && Math.abs(py-gameState.py)>1.0
           && Math.abs(pz-gameState.pz)>0.7 ){
            gameState.blocks[px][py][pz]=BLOCK.grass;
            addBlockMesh(px,py,pz,BLOCK.grass);
        }
    }
}
function onContextMenu(e) { e.preventDefault(); }

function setupInput() {
    renderer.domElement.addEventListener('click',()=>{
        renderer.domElement.requestPointerLock();
    });
    document.addEventListener('pointerlockchange',()=>{
        let locked = (document.pointerLockElement===renderer.domElement);
        gameState.pointerLocked = locked;
        if(locked) gameState.showInfo = false;
    });
    document.addEventListener('mousemove',e=>{
        if(!gameState.pointerLocked)return;
        gameState.lookH += e.movementX * 0.002;
        gameState.lookV -= e.movementY * 0.002;
        let V=Math.PI/2*0.99;
        if(gameState.lookV<-V)gameState.lookV=-V;
        if(gameState.lookV>V)gameState.lookV=V;
    });
    window.addEventListener('keydown',e=>{
        if(e.code==='KeyW')gameState.move.w=1;
        if(e.code==='KeyA')gameState.move.a=1;
        if(e.code==='KeyS')gameState.move.s=1;
        if(e.code==='KeyD')gameState.move.d=1;
        if(e.code==='Space') {
            if(gameState.fly)gameState.move.up=1;
            else if(gameState.vy===0 && canStand(gameState.px,gameState.py-0.2,gameState.pz)) gameState.vy=0.32;
        }
        if(e.code==='ShiftLeft')gameState.move.down=1;
        if(e.code==='KeyF')gameState.fly=!gameState.fly;
        if(e.code==='Escape'){ document.exitPointerLock && document.exitPointerLock(); }
    });
    window.addEventListener('keyup',e=>{
        if(e.code==='KeyW')gameState.move.w=0;
        if(e.code==='KeyA')gameState.move.a=0;
        if(e.code==='KeyS')gameState.move.s=0;
        if(e.code==='KeyD')gameState.move.d=0;
        if(e.code==='Space')gameState.move.up=0;
        if(e.code==='ShiftLeft')gameState.move.down=0;
    });
    window.addEventListener('mousedown',onMousedown);
    window.addEventListener('contextmenu',onContextMenu);
}

const {createApp} = Vue;
createApp({
  setup() {
      return {
        pointerLocked: Vue.computed(()=>gameState.pointerLocked),
        showInfo: Vue.computed(()=>gameState.showInfo),
      }
  },
  mounted() {
      setupThree();
      setupInput();
      animate();
  }
}).mount("#app");
