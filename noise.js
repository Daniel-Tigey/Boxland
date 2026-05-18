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

// =========== 方块定义 ===========
const BLOCK = {
    grass: 0, dirt: 1, stone: 2, wood: 3, leaf: 4,
    water: 5, bedrock: 6, sand: 7, deep_stone: 8, lava: 9,
    coal_mine: 10, copper_mine: 11, silver_mine: 12, platinum_mine: 13, diamond_mine: 14,
    ice: 15, snow: 16, cactus: 17
};
const COLORS = [
    0x4CAF50,0x8B5A2B,0x888888,0x8B4513,0x19cc19,0x4091F7,0x000000,0xDED39E,0x3A3A3A,
    0xEF0000,0x222222,0xF18D36,0xBFC7C7,0xc7bb80,0x68e0ff
];
const BLOCKNAMES = [
    "grass", "dirt", "stone", "wood", "leaf", "water", "bedrock", "sand", "deep_stone",
    "lava", "coal_mine", "copper_mine", "silver_mine", "platinum_mine", "diamond_mine",
    "ice", "snow", "cactus"
];

// ==== 贴图文件名key ====
const BLOCK_TEXTURES = {};
const BLOCK_TEXTURE_FILES = [
    "grass_top.png", "grass.png", "grass_bottom.png",
    "dirt.png",
    "stone.png",
    "wood_top.png", "wood.png", "wood_bottom.png",
    "leaf.png",
    "water.png",
    "bedrock.png",
    "sand.png",
    "deep_stone.png",
    "lava.png",
    "coal_mine.png",
    "copper_mine.png",
    "silver_mine.png",
    "platinum_mine.png",
    "diamond_mine.png",
    "ice.png",
    "snow.png"，
    "cactus.png"
];
function preloadBlockTextures(callback) {
    const loader = new THREE.TextureLoader();
    let loaded=0, total=BLOCK_TEXTURE_FILES.length;
    for(let i=0;i<BLOCK_TEXTURE_FILES.length;i++){
        let file = BLOCK_TEXTURE_FILES[i];
        loader.load(
            "assets/textures/" + file,
            tex=>{
                tex.magFilter = tex.minFilter = THREE.NearestFilter;
                BLOCK_TEXTURES[i]=tex; // i与BLOCK定义顺序一致
                if(++loaded===total && callback) callback();
            },
            undefined, ()=>{
                BLOCK_TEXTURES[i]=null;
                if(++loaded===total && callback) callback();
            }
        );
    }
}

// ===== 512*64*512大地图，渲染距离变量 =====
const WORLD_W = 512, WORLD_D = 512, WORLD_H = 64, SAND_THICK = 3;
let RENDER_DIST = 18; // 默认渲染距离
const perlin = new PerlinNoise(20230519);
const valueNoise = new ValueNoise(54188114514);
function getBiome(x, z) {
    // Perlin或valueNoise都可，低频即可，控制湿度/温度
    let bio = perlin.noise(x/180, z/180); // 0~1
    if(bio < 0.32)  return "desert";
    if(bio > 0.72)  return "snow";
    return "normal";
}
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
function createWorld() {
    const blocks = [];
    for (let x = 0; x < WORLD_W; x++) {
        blocks[x] = [];
        for (let y = 0; y < WORLD_H; y++) {
            blocks[x][y] = [];
            for (let z = 0; z < WORLD_D; z++) blocks[x][y][z] = null;
        }
    }
    const waterLine = Math.floor(WORLD_H * 0.26);
    const deepslateH = 8;
    const bedrockBase = 2;

    for (let x = 0; x < WORLD_W; x++) {
        for (let z = 0; z < WORLD_D; z++) {
            // 地形高度叠加
            let mtn = perlin.fbm(x/60, z/60, {octaves:6, gain:0.48, lacunarity:1.67});
            let hills = perlin.fbm(x/19, z/19, {octaves:3, gain:0.43, lacunarity:2.12});
            let dunes = valueNoise.fbm(x/7, z/7, {octaves:2, gain:0.4, lacunarity:2.9});
            let river = 1-valueNoise.worley(x/23,z/23,6);
            let island = Math.max(0,valueNoise.fbm(x/100,z/100,{octaves:2,gain:0.8,lacunarity:2.2}));
            let base = (0.44*mtn + 0.2*hills + 0.09*dunes + 0.12*river + 0.15*island);
            let h0 = Math.floor(WORLD_H*0.19 + base*WORLD_H*0.73);
            let h = clamp(h0, 5, WORLD_H-2);

            // 群系
            let biome = getBiome(x,z);
            for(let y=0; y<WORLD_H; ++y) blocks[x][y][z] = null;
            for(let y=0; y<bedrockBase; ++y)
                if(Math.random()<0.66 || y==0)
                    blocks[x][y][z]=BLOCK.bedrock;
                else
                    blocks[x][y][z]=BLOCK.deep_stone;
            for(let y=bedrockBase; y<=h; ++y){
                let isLow = h < waterLine + 3;
                // -- 群系地表判定关键 --
                // 沙漠/雪原水体强制填沙/雪底
                if(isLow && y >= h-SAND_THICK+1 && biome==="desert") { blocks[x][y][z]=BLOCK.sand; continue; }
                if(isLow && y >= h-SAND_THICK+1 && biome==="snow") { blocks[x][y][z]=BLOCK.stone; continue;} // 雪原湖底为石，可用雪块自定义
                // 其它分层如下
                if(y < bedrockBase + deepslateH || (y < h-6 && h > waterLine+10 && Math.random()<0.25)) {
                    let ore = randomOre(x, y, z);
                    if(ore) blocks[x][y][z]=ore;
                    else blocks[x][y][z]=BLOCK.deep_stone;
                    continue;
                }
                if(y >= h-SAND_THICK+1 && isLow && biome==="desert") { blocks[x][y][z]=BLOCK.sand; continue; }
                if(y >= h-SAND_THICK+1 && isLow && biome==="snow") { blocks[x][y][z]=BLOCK.stone; continue;}
                if(y < h-7) {
                    let ore = randomOre(x, y, z, 'stone');
                    if(ore) blocks[x][y][z]=ore;
                    else blocks[x][y][z]=BLOCK.stone;
                    continue;
                }
                if(y < h) { blocks[x][y][z]=BLOCK.dirt; continue; }
                if(y==h) {
                    // 顶层：按群系决定表层
                    if(biome==="desert") blocks[x][y][z]=BLOCK.sand;
                    else if(biome==="snow") blocks[x][y][z]=BLOCK.stone; // 可设置为雪方块（需扩展BLOCK）
                    else if(isLow) blocks[x][y][z]=BLOCK.sand;
                    else blocks[x][y][z]=BLOCK.grass;
                    continue;
                }
            }
            // 水体
            if(h < waterLine-1) for(let y=h+1; y<waterLine; ++y)
                blocks[x][y][z] = BLOCK.water;
        }
    }

    // 树生长（草原/森林群系添加树，沙漠/雪原极少树或完全无树）
    for(let i=0; i<400; ++i){ // 树木数量可多些
        let x = Math.floor(Math.random()*(WORLD_W-7)+3), z = Math.floor(Math.random()*(WORLD_D-7)+3);
        let biome = getBiome(x,z);
        // 沙漠禁止树，雪原罕见树且更小
        if(biome==="desert") continue;
        let snowTree = (biome==="snow");
        let y;
        for(y=WORLD_H-5; y>2; --y)
            if([BLOCK.grass,BLOCK.dirt].includes(blocks[x][y][z]) && blocks[x][y+1][z]==null)
                break;
        if(y<4) continue;
        let height = snowTree ? 3+Math.floor(valueNoise.noise(x*0.23,z*0.28)*1.6) : 4+Math.floor(valueNoise.noise(x*0.23,z*0.28)*2.8);
        for(let h2=1;h2<=height;++h2)
            blocks[x][y+h2][z]=BLOCK.wood;
        for(let lx=-2;lx<=2;++lx)
         for(let ly=Math.floor(height/2);ly<=height+2;++ly)
          for(let lz=-2;lz<=2;++lz) {
            if(Math.abs(lx)+Math.abs(lz)>3||(lx===0&&ly===Math.floor(height/2)&&lz===0)) continue;
            let tx=x+lx, ty=y+ly, tz=z+lz;
            if(tx<0||ty>=WORLD_H||tz<0||tx>=WORLD_W||tz>=WORLD_D) continue;
            let dist = Math.abs(lx)+Math.abs(ly-height)+Math.abs(lz);
            let dropP = snowTree ? 0.25+0.07*dist : 0.10+0.04*dist;
            if(Math.random()<dropP) continue;
            // 雪原的树冠用stone（需要新BLOCK为雪块/冰，这里模拟用stone）
            if(blocks[tx][ty][tz]==null) blocks[tx][ty][tz]=snowTree?BLOCK.stone:BLOCK.leaf;
         }
    }
    return blocks;
}

// ============ 游戏状态 ============
const HOTBAR_SIZE=8;
const DEFAULT_HOTBAR = [
    BLOCK.grass, BLOCK.dirt, BLOCK.stone, BLOCK.sand,
    BLOCK.wood, BLOCK.leaf, BLOCK.deep_stone, BLOCK.coal_mine
];
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
    hotbar: DEFAULT_HOTBAR.slice(),
    selectedSlot: 0
};
window.gameState = gameState;

// =========== Three.js 场景 ===========
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

// ===== 用贴图渲染方块，如果没贴图则用纯色 =====
function addBlockMesh(x, y, z, id) {
    let geometry = new THREE.BoxGeometry(1,1,1);
    let opts = {}, tex = BLOCK_TEXTURES[id];
    if(tex) {
        opts.map = tex;
        if(id===BLOCK.water || id===BLOCK.leaf) {
            opts.transparent = true;
            opts.opacity = 0.75;
        }
    } else {
        opts.color = COLORS[id]||0xff00ff;
    }
    let material = new THREE.MeshLambertMaterial(opts);
    let mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x,y,z);
    scene.add(mesh);
    blockMeshes.set(`${x}_${y}_${z}`, mesh);
}
function renderVisibleBlocks() {
    const RENDER_DIST = 19;
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
            let id = gameState.hotbar[gameState.selectedSlot];
            gameState.blocks[px][py][pz]=id;
            addBlockMesh(px,py,pz,id);
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
        if(/^Digit[1-8]$/.test(e.code)){
            gameState.selectedSlot = Number(e.code.slice(-1)) - 1;
        }
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
    window.addEventListener('wheel',e=>{
        let sz = gameState.hotbar.length;
        if(sz>0) {
            if(e.deltaY>0) gameState.selectedSlot = (gameState.selectedSlot+1)%sz;
            if(e.deltaY<0) gameState.selectedSlot = (gameState.selectedSlot+sz-1)%sz;
            e.preventDefault();
        }
    },{passive:false});
    window.addEventListener('mousedown',onMousedown);
    window.addEventListener('contextmenu',onContextMenu);
}
function blockName(id) {
    let idx = Object.values(BLOCK).indexOf(id);
    return BLOCKNAMES[idx] || "未知";
}

// Vue界面
const {createApp} = Vue;
createApp({
  setup() {
      return {
        pointerLocked: Vue.computed(()=>gameState.pointerLocked),
        showInfo: Vue.computed(()=>gameState.showInfo),
        hotbar: Vue.computed(()=>gameState.hotbar),
        selectedSlot: Vue.computed(()=>gameState.selectedSlot),
        COLORS,
        blockName
      }
  },
  mounted() {
      preloadBlockTextures(()=>{
          setupThree();
          setupInput();
          animate();
      });
  },
  template: `
  <div>
    <slot></slot>
    <div v-if="showInfo && !pointerLocked"
         style="position:fixed;top:0;left:0;background:rgba(0,0,0,0.7);color:#fff;padding:6px 20px;font-size:15px;z-index:20;">
        <b>WASD/空格/Shift</b> 移动 | <b>鼠标左/右</b> 挖掘/放置 | <b>鼠标</b> 转头 <br>
        <b>1-8</b>/滚轮快速切换物品栏 &nbsp; <b>F</b>飞行 &nbsp; <b>Esc</b> 退出 <br>
        单击画面进入游戏
    </div>
    <div style="position:fixed;left:50%;transform:translateX(-50%);bottom:24px;z-index:25;display:flex;gap:8px;">
      <div v-for="(bid,i) in hotbar"
           :key="i"
           :style="{
            width:'42px',height:'42px',
            margin:'0 3px',position:'relative',
            border:'3px solid '+(i===selectedSlot?'#efb637':'#999'),
            background:'#f1efea',borderRadius:'7px',boxShadow:i===selectedSlot?'0 0 12px #ffc':'' }">
        <div :style="{
              width:'100%',height:'100%',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontWeight:'bold',fontSize:'1.19em',color:'#222',zIndex:2
          }">
          {{ blockName(bid) }}
        </div>
        <div v-if="COLORS[bid]" :style="{
          position:'absolute',left:'7px',top:'6px',zIndex:1,
          width:'26px',height:'26px',
          background:'#'+(COLORS[bid].toString(16).padStart(6,'0')),
          border:'2px solid #7e6332',borderRadius:'5px'
        }"></div>
        <div v-if="i===selectedSlot" style="
            position:absolute;left:-5px;top:-5px;width:51px;height:51px;pointer-events:none;
            border:2.2px solid #ffe26a;border-radius:8px;box-shadow:0 0 18px 0 #ffe26a88;
          "></div>
      </div>
    </div>
  </div>
  `
}).mount("#app");
