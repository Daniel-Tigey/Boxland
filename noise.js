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

// ============ 方块定义与颜色 ============
const BLOCK = {
    grass: 0, dirt: 1, stone: 2, wood: 3, leaf: 4,
    water: 5, bedrock: 6, sand: 7, deep_stone: 8, lava: 9,
    coal_mine: 10, copper_mine: 11, silver_mine: 12, platinum_mine: 13, diamond_mine: 14
};
const COLORS = [
    0x4CAF50, // grass
    0x8B5A2B, // dirt
    0x888888, // stone
    0x8B4513, // wood
    0x19cc19, // leaf
    0x4091F7, // water
    0x000000, // bedrock
    0xDED39E, // sand
    0x3A3A3A, // deep_stone
    0xEF0000, // lava
    0x222222, // coal_mine (black)
    0xF18D36, // copper_mine (copper/orange)
    0xBFC7C7, // silver_mine (light grey)
    0xc7bb80, // platinum_mine (yellow silver)
    0x68e0ff  // diamond_mine (bright blue)
];

// ========== 世界参数 ============
const WORLD_W = 64, WORLD_D = 64, WORLD_H = 48, SAND_THICK = 3;
const noise = new ValueNoise(54188114514);

function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// ========== 生成世界 ============
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
    const waterLine = Math.floor(WORLD_H * 0.26);
    const deepslateH = 8;
    const bedrockBase = 2;

    for (let x = 0; x < WORLD_W; x++) {
        for (let z = 0; z < WORLD_D; z++) {
            // 地形主噪声
            let e = noise.fbm(x/30, z/30, {octaves:4, gain:0.55, lacunarity:2.1});
            let worleyVal = 0.44 - noise.worley(x/32, z/32, 5);
            let h0 = Math.floor(
                WORLD_H * 0.2 +
                Math.pow(e, 1.05) * WORLD_H * 0.55 +
                worleyVal * WORLD_H * 0.25
            );
            let h = clamp(h0, 5, WORLD_H-2);

            // 清空本柱
            for(let y=0; y<WORLD_H; ++y) blocks[x][y][z] = null;

            // 基岩层
            for(let y=0; y<bedrockBase; ++y)
                if(Math.random()<0.66 || y==0)
                    blocks[x][y][z]=BLOCK.bedrock;
                else
                    blocks[x][y][z]=BLOCK.deep_stone;

            // 地表分层与矿物
            for(let y=bedrockBase; y<=h; ++y){
                let isLow = h < waterLine + 3;
                // 水域沙底
                if(isLow && y >= h-SAND_THICK+1) {
                    blocks[x][y][z] = BLOCK.sand;
                    continue;
                }
                // 深层石头
                if(y < bedrockBase + deepslateH || (y < h-6 && h > waterLine+10 && Math.random()<0.25)) {
                    // ---- 矿石自然生成 in deep_stone ----
                    let ore = randomOre(x, y, z);
                    if(ore) blocks[x][y][z]=ore;
                    else blocks[x][y][z]=BLOCK.deep_stone;
                    continue;
                }
                // 沙丘／洼地
                if(y >= h-SAND_THICK+1 && isLow) {
                    blocks[x][y][z] = BLOCK.sand;
                    continue;
                }
                // 普通石头
                if(y < h-7) {
                    // ---- 矿石自然生成 in stone ----
                    let ore = randomOre(x, y, z, 'stone');
                    if(ore) blocks[x][y][z]=ore;
                    else blocks[x][y][z]=BLOCK.stone;
                    continue;
                }
                // 土
                if(y < h) {
                    blocks[x][y][z]=BLOCK.dirt;
                    continue;
                }
                // 顶层
                if(y==h) {
                    if(isLow) blocks[x][y][z]=BLOCK.sand;
                    else blocks[x][y][z]=BLOCK.grass;
                    continue;
                }
            }
            // 水体
            if(h < waterLine-1)
                for(let y=h+1; y<waterLine; ++y)
                    blocks[x][y][z] = BLOCK.water;
        }
    }
    // 树（更高）
    for(let i=0; i<60; ++i){
        let x = Math.floor(Math.random()*(WORLD_W-7)+3), z = Math.floor(Math.random()*(WORLD_D-7)+3);
        let y;
        for(y=WORLD_H-5; y>2; --y)
            if([BLOCK.grass,BLOCK.dirt].includes(blocks[x][y][z]) && blocks[x][y+1][z]==null)
                break;
        if(y<4) continue;
        let height = 4 + Math.floor(noise.noise(x*0.23,z*0.28)*2.8);
        for(let h=1;h<=height;++h)
            blocks[x][y+h][z]=BLOCK.wood;
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

// ====== 矿物分布控制函数 ======
function randomOre(x, y, z, type='deep') {
    // 可根据 y 深度分布概率
    let r = Math.random();
    // 深层石头产生概率较大；普通石头稀少
    // y愈小，越深，越稀有矿几率越高
    let stoneDepth = Math.max(1, y);

    // 钻石
    if(stoneDepth < 10 && r<0.012) return BLOCK.diamond_mine;
    // 白金
    if(stoneDepth < 14 && r<0.025) return BLOCK.platinum_mine;
    // 银矿
    if(stoneDepth < 16 && r<0.045) return BLOCK.silver_mine;
    // 铜矿
    if(stoneDepth < 22 && r<0.06) return BLOCK.copper_mine;
    // 煤矿
    if(r<0.10) return BLOCK.coal_mine;

    return null;
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

// ========== Three.js 渲染等保持不变 ==========
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

function updateCamera() {
    camera.position.set(gameState.px, gameState.py, gameState.pz);
    let lx = Math.cos(gameState.lookV) * Math.sin(gameState.lookH);
    let ly = Math.sin(gameState.lookV);
    let lz = Math.cos(gameState.lookV) * Math.cos(gameState.lookH);
    camera.lookAt(gameState.px + lx, gameState.py + ly, gameState.pz + lz);
}
function isSolid(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if(x<0||x>=WORLD_W||y<0||y>=WORLD_H||z<0||z>=WORLD_D) return true;
    let val = gameState.blocks[x][y][z];
    return val!==null && val!==BLOCK.water && val!==BLOCK.lava;
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
    if(gameState.move.w) { dx += Math.sin(ang)*speed; dz += Math.cos(ang)*speed; }
    if(gameState.move.s) { dx -= Math.sin(ang)*speed; dz -= Math.cos(ang)*speed; }
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
