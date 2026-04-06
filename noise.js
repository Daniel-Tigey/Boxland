// --- ValueNoise + Fractal Brownian Motion 地形采样
class ValueNoise {
    constructor(seed = 1) {this.seed = seed;}
    hash(x, y) {
        let n = x * 374761393 + y * 668265263;
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
            amp *= gain; freq *= lacunarity;
        }
        return sum / totalAmp;
    }
}

// ================== 方块定义 ===================
const BLOCK = { grass:0, dirt:1, stone:2, log:3, leaf:4, water:5, bedrock:6 };
const COLORS = [
    0x4CAF50, // grass
    0x8B5A2B, // dirt
    0x888888, // stone
    0x8B4513, // log
    0x19cc19, // leaf
    0x4091F7, // water
    0x000000  // bedrock
];

// ================== 世界生成 ====================
const WORLD_W = 64, WORLD_D = 64, WORLD_H = 28;
const BLOCK_SIZE = 1;
const noise = new ValueNoise(54188114514);

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
    // 地形
    for (let x = 0; x < WORLD_W; x++) {
        for (let z = 0; z < WORLD_D; z++) {
            let base = noise.fbm(x/40, z/40, {octaves:5, gain:0.46, lacunarity:2});
            let aux = (
                0.9 * noise.fbm(x/14+20, z/14-13, {octaves:2, gain:0.4, lacunarity:2.3}) + 
                0.40*noise.fbm(x/7+99, z/7-33, {octaves:1, gain:0.7, lacunarity:5.8})
            );
            let h = Math.floor(7 + 12 * base + 2.5*aux);
            
            blocks[x][0][z]=BLOCK.bedrock;
            blocks[x][1][z]=BLOCK.stone;
            for(let y=1; y<=h; ++y){
                if(y<4 || (base>0.70 && y<h && y>16)) blocks[x][y][z]=BLOCK.stone;
                else if(y<h) blocks[x][y][z]=BLOCK.dirt;
                else blocks[x][y][z]=BLOCK.grass;
            }
            let wl = 12;
            if(h<wl-1) for(let y=h+1; y<wl; ++y) blocks[x][y][z]=BLOCK.water;
        }
    }
    // 树：干最矮2
    for(let i=0; i<50; ++i){
        let x = Math.floor(Math.random()*(WORLD_W-7)+3), z = Math.floor(Math.random()*(WORLD_D-7)+3);
        let y;
        for(y=WORLD_H-3; y>2; --y) if([BLOCK.grass,BLOCK.dirt].includes(blocks[x][y][z]))break;
        if(y<4) continue;
        let height = 2 + Math.floor(noise.noise(x*0.20,z*0.21)*2.8);
        for(let h=1;h<=height;++h) blocks[x][y+h][z]=BLOCK.log;
        for(let lx=-2;lx<=2;++lx)
         for(let ly=Math.ceil(height/2);ly<=height+2;++ly)
          for(let lz=-2;lz<=2;++lz) {
            if(Math.abs(lx)+Math.abs(lz)>3||(lx===0&&ly===Math.ceil(height/2)&&lz===0)) continue;
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
    lookH: Math.PI / 2,     // 向 X 正方向
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
    camera = new THREE.PerspectiveCamera(82, window.innerWidth/window.innerHeight, 0.1, 1200);
    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.zIndex=5;
    document.body.appendChild(renderer.domElement);
    const ambient = new THREE.AmbientLight(0xffffff, 0.72); scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffee, 1.1); dir.position.set(60,80,5); scene.add(dir);
    blockMeshes = new Map();
    renderVisibleBlocks();
}

// 渲染距离摄像机 16 格内的方块，超出即时卸载
function renderVisibleBlocks() {
    const RENDER_DIST = 16;
    let camX = Math.floor(gameState.px), camY = Math.floor(gameState.py), camZ = Math.floor(gameState.pz);

    // 渲染区块
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
    let geometry = new THREE.BoxGeometry(BLOCK_SIZE,BLOCK_SIZE,BLOCK_SIZE);
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
    // 正确的第一人称视角
    let lx = Math.cos(gameState.lookV) * Math.cos(gameState.lookH);
    let ly = Math.sin(gameState.lookV);
    let lz = Math.cos(gameState.lookV) * Math.sin(gameState.lookH);
    camera.lookAt(gameState.px+lx, gameState.py+ly, gameState.pz+lz);
}

// ============ 碰撞系统，落地自动弹出纠偏 =============
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

// ================== 玩家物理&反卡死移动 ====================
function stepPlayer() {
    let ang = gameState.lookH, speed = gameState.speed;
    let dx = 0, dz = 0;
    // 前后
    if(gameState.move.w) { dx += Math.cos(ang)*speed; dz += Math.sin(ang)*speed; }
    if(gameState.move.s) { dx -= Math.cos(ang)*speed; dz -= Math.sin(ang)*speed; }
    // 左右
    if(gameState.move.a) { dx += Math.cos(ang - Math.PI/2)*speed; dz += Math.sin(ang - Math.PI/2)*speed; }
    if(gameState.move.d) { dx += Math.cos(ang + Math.PI/2)*speed; dz += Math.sin(ang + Math.PI/2)*speed; }
    let px = gameState.px, py = gameState.py, pz = gameState.pz;
    let dy = 0;
    if(gameState.fly){
        if(gameState.move.up) dy += speed;
        if(gameState.move.down) dy -= speed;
    } else {
        gameState.vy -= 0.011;
        dy = gameState.vy;
    }

    // 物理碰撞&地面弹出：先Y
    if(canStand(px, py+dy, pz)) {
        py += dy;
    } else {
        // 如果掉进方块，用最小步进尝试踢出
        let maxTry = 8, found = false, newY = py;
        for(let t=0;t<=maxTry;++t) {
            if(canStand(px, py+t*0.1, pz)) { newY=py+t*0.1; found=true; break; }
        }
        if(found) py = newY;
        gameState.vy = 0;
    }

    // X方向
    if(canStand(px+dx, py, pz)) px += dx;
    // Z方向
    if(canStand(px, py, pz+dz)) pz += dz;

    // 越界保护
    px = Math.max(1, Math.min(WORLD_W-2, px));
    py = Math.max(2, Math.min(WORLD_H-2, py));
    pz = Math.max(1, Math.min(WORLD_D-2, pz));
    Object.assign(gameState, {px,py,pz});
}

// ================== 游戏主循环渲染 ====================
function animate() {
    requestAnimationFrame(animate);
    stepPlayer();
    renderVisibleBlocks();
    updateCamera();
    renderer && renderer.render(scene, camera);
}

// ================== 方块射线、交互 ====================
function raycastBlock(maxDist=6) {
    let ox = gameState.px, oy = gameState.py+0.6, oz = gameState.pz;
    let lx = Math.cos(gameState.lookV) * Math.cos(gameState.lookH);
    let ly = Math.sin(gameState.lookV);
    let lz = Math.cos(gameState.lookV) * Math.sin(gameState.lookH);
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

// ================== 键鼠、飞行、视角 ====================
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
        // 正确视角控制：左右增加，抬头为lookV减小
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

// ================== Vue界面 ====================
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
