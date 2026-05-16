// --- ValueNoise & PerlinNoise & Worley综合地形 ----
class PerlinNoise {
    constructor(seed=1) {
        this.p = new Array(512);
        this.seed = seed;
        this._init();
    }
    _init(){
        let perm=Array(256);
        for(let i=0;i<256;i++) perm[i]=i;
        let rng = this._mulberry32(this.seed);
        for(let j=255;j>0;j--){
            let k=Math.floor(rng()*256);
            [perm[j],perm[k]] = [perm[k],perm[j]];
        }
        for(let i=0;i<512;i++) this.p[i]=perm[i&255];
    }
    _mulberry32(a){ return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t^=t+Math.imul(t^t>>>7,61|t);return ((t^t>>>14)>>>0)/4294967296;}}
    grad(hash,x,y){ const h=hash&3; return ((h&1)?-x:x) + ((h&2)?-y:y);}
    fade(t){ return t*t*t*(t*(t*6-15)+10);}
    lerp(a,b,t){ return a + (b-a)*t;}
    noise(x,y){
        let X = Math.floor(x)&255, Y = Math.floor(y)&255;
        let xf = x-Math.floor(x), yf = y-Math.floor(y);
        let tl = this.p[X+this.p[Y]], tr = this.p[X+1+this.p[Y]];
        let bl = this.p[X+this.p[Y+1]], br = this.p[X+1+this.p[Y+1]];
        let u = this.fade(xf), v = this.fade(yf);
        let n00 = this.grad(tl, xf,    yf );
        let n10 = this.grad(tr, xf-1,  yf );
        let n01 = this.grad(bl, xf,    yf-1 );
        let n11 = this.grad(br, xf-1,  yf-1 );
        let nx0 = this.lerp(n00, n10, u), nx1 = this.lerp(n01, n11, u);
        return this.lerp(nx0,nx1,v)*0.7+0.5;
    }
    fbm(x,y,{octaves=5,gain=0.5,lacunarity=2,amp=1,freq=1}={}) {
        let sum = 0, totalAmp = 0;
        for(let i=0;i<octaves;i++){
            sum += this.noise(x*freq, y*freq)*amp;
            totalAmp += amp;
            amp *= gain;
            freq *= lacunarity;
        }
        return sum/totalAmp;
    }
}
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
// =========== 方块定义与贴图 ===========
const BLOCK = {
    grass: 0, dirt: 1, stone: 2, wood: 3, leaf: 4,
    water: 5, bedrock: 6, sand: 7, deep_stone: 8, lava: 9,
    coal_mine: 10, copper_mine: 11, silver_mine: 12, platinum_mine: 13, diamond_mine: 14,
    ice: 15, snow: 16, cactus: 17
};
const COLORS = [
    0x4CAF50,0x8B5A2B,0x888888,0x8B4513,0x19cc19,0x4091F7,0x000000,0xDED39E,0x3A3A3A,
    0xEF0000,0x222222,0xF18D36,0xBFC7C7,0xc7bb80,0x68e0ff,
    0xaeeffd,0xffffff,0x41ca33
];
const BLOCKNAMES = [
    "grass", "dirt", "stone", "wood", "leaf", "water", "bedrock", "sand", "deep_stone",
    "lava", "coal_mine", "copper_mine", "silver_mine", "platinum_mine", "diamond_mine",
    "ice", "snow", "cactus"
];
const BLOCK_TEXTURE_FILES = [
    "grass_top.png", "grass.png", "grass_bottom.png",
    "dirt.png", "stone.png",
    "wood_top.png", "wood.png", "wood_bottom.png",
    "leaf.png", "water.png", "bedrock.png", "sand.png", "deep_stone.png",
    "lava.png", "coal_mine.png", "copper_mine.png", "silver_mine.png", "platinum_mine.png", "diamond_mine.png",
    "ice.png", "snow.png", "cactus.png"
];
const BLOCK_TEXTURES = {};
function preloadBlockTextures(callback) {
    const loader = new THREE.TextureLoader();
    let loaded=0, total=BLOCK_TEXTURE_FILES.length;
    for(let i=0;i<BLOCK_TEXTURE_FILES.length;i++){
        let file = BLOCK_TEXTURE_FILES[i];
        loader.load(
            "assets/textures/" + file,
            tex=>{
                tex.magFilter = tex.minFilter = THREE.NearestFilter;
                BLOCK_TEXTURES[file]=tex;
                if(++loaded===total && callback) callback();
            },
            undefined, ()=>{
                BLOCK_TEXTURES[file]=null;
                if(++loaded===total && callback) callback();
            }
        );
    }
}
function getBlockTexture(id, face) {
    let name = BLOCKNAMES[id];
    let base = name.toLowerCase();
    let fileKey=
        (face==="top"&&`${base}_top.png`)||
        (face==="bottom"&&`${base}_bottom.png`)||
        `${base}.png`;
    if(BLOCK_TEXTURES[fileKey]) return BLOCK_TEXTURES[fileKey];
    if(face==="side" && BLOCK_TEXTURES[`${base}_side.png`]) return BLOCK_TEXTURES[`${base}_side.png`];
    return null;
}

// ==== 设置页联动渲染距离 ====
function getRenderDist() {
    try {
        let d = parseInt(localStorage.getItem('renderDistance'), 10);
        if(isNaN(d) || d<3 || d>64) d=18;
        return d;
    } catch(e) {
        return 18;
    }
}

// ========== 地形生成 ==========
const WORLD_W = 512, WORLD_D = 512, WORLD_H = 64, SAND_THICK = 3;
const perlin = new PerlinNoise(20230519);
const valueNoise = new ValueNoise(54188114514);
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

function getBiome(x, z) {
    let bio = perlin.noise(x/180, z/180);
    if(bio < 0.32)  return "desert";
    if(bio > 0.72)  return "snow";
    return "normal";
}
function carveCave(blocks, cx, cy, cz, r, len, yaw, pitch) {
    // 安全兜底：blocks 不存在直接返回
    if (!blocks) return;
    
    let dx=Math.cos(pitch)*Math.cos(yaw), dz=Math.cos(pitch)*Math.sin(yaw), dy=Math.sin(pitch);
    for (let t = 0; t < len; ++t) {
        let px = Math.floor(cx+dx*t), py = Math.floor(cy+dy*t), pz = Math.floor(cz+dz*t);
        let rr = r * (Math.sin(Math.PI * t / len)*0.6+0.7);
        
        for(let x2=-rr;x2<=rr;++x2)
          for(let y2=-rr;y2<=rr;++y2)
            for(let z2=-rr;z2<=rr;++z2){
                let dist=Math.sqrt(x2*x2+y2*y2+z2*z2);
                if(dist<=rr){
                    let bx=px+x2, by=py+y2, bz=pz+z2;
                    if (
                        bx < 0 || bx >= WORLD_W ||
                        by < 0 || by >= WORLD_H ||
                        bz < 0 || bz >= WORLD_D ||
                        !blocks[bx] ||          // 防止 x 层不存在
                        !blocks[bx][by]         // 防止 y 层不存在
                    ) {
                        continue;
                    }
                    if(bx>3&&bx<WORLD_W-4&&by>3&&by<WORLD_H-3&&bz>3&&bz<WORLD_D-4)
                        blocks[bx][by][bz]=null;
                }
            }
    }
}
function addOreCluster(blocks, kind, cx, cy, cz, size) {
    let n = size*2+2;
    for(let i=0;i<n;i++){
        let ox=cx+Math.round((Math.random()-0.5)*size),
            oy=cy+Math.round((Math.random()-0.5)*size*0.6),
            oz=cz+Math.round((Math.random()-0.5)*size);
        let r = 1.2+Math.random()*(size/2);
        for(let x2=-r;x2<=r;++x2)
          for(let y2=-r;y2<=r;++y2)
            for(let z2=-r;z2<=r;++z2){
                let dist=Math.sqrt(x2*x2+y2*y2+z2*z2);
                if(dist<=r){
                    let bx=Math.floor(ox+x2), by=Math.floor(oy+y2), bz=Math.floor(oz+z2);
                    if(bx>2&&bx<WORLD_W-2&&by>2&&by<WORLD_H-2&&bz>2&&bz<WORLD_D-2 && blocks[bx][by][bz] && blocks[bx][by][bz]!==BLOCK.bedrock)
                        blocks[bx][by][bz]=kind;
                }
            }
    }
}
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
            let mtn = perlin.fbm(x/60, z/60, {octaves:6, gain:0.48, lacunarity:1.67});
            let hills = perlin.fbm(x/19, z/19, {octaves:3, gain:0.43, lacunarity:2.12});
            let dunes = valueNoise.fbm(x/7, z/7, {octaves:2, gain:0.4, lacunarity:2.9});
            let river = 1-valueNoise.worley(x/23,z/23,6);
            let island = Math.max(0,valueNoise.fbm(x/100,z/100,{octaves:2,gain:0.8,lacunarity:2.2}));
            let base = (0.44*mtn + 0.2*hills + 0.09*dunes + 0.12*river + 0.15*island);
            let h0 = Math.floor(WORLD_H*0.19 + base*WORLD_H*0.73);
            let h = clamp(h0, 5, WORLD_H-2);

            let biome = getBiome(x,z);
            for(let y=0; y<WORLD_H; ++y) blocks[x][y][z] = null;
            for(let y=0; y<bedrockBase; ++y)
                if(Math.random()<0.66 || y==0)
                    blocks[x][y][z]=BLOCK.bedrock;
                else
                    blocks[x][y][z]=BLOCK.deep_stone;
            for(let y=bedrockBase; y<=h; ++y){
                let isLow = h < waterLine + 3;
                if(isLow && y >= h-SAND_THICK+1 && biome==="desert") { blocks[x][y][z]=BLOCK.sand; continue; }
                if(isLow && y >= h-SAND_THICK+1 && biome==="snow") { blocks[x][y][z]=BLOCK.snow; continue;}
                if(y < bedrockBase + deepslateH || (y < h-6 && h > waterLine+10 && Math.random()<0.25)) {
                    let ore = randomOre(x, y, z);
                    if(ore) blocks[x][y][z]=ore;
                    else blocks[x][y][z]=BLOCK.deep_stone;
                    continue;
                }
                if(y >= h-SAND_THICK+1 && isLow && biome==="desert") { blocks[x][y][z]=BLOCK.sand; continue; }
                if(y >= h-SAND_THICK+1 && isLow && biome==="snow") { blocks[x][y][z]=BLOCK.snow; continue;}
                if(y < h-7) {
                    let ore = randomOre(x, y, z, 'stone');
                    if(ore) blocks[x][y][z]=ore;
                    else blocks[x][y][z]=BLOCK.stone;
                    continue;
                }
                if(y < h) { blocks[x][y][z]=BLOCK.dirt; continue; }
                if(y==h) {
                    if(biome==="desert") blocks[x][y][z]=BLOCK.sand;
                    else if(biome==="snow") blocks[x][y][z]=BLOCK.snow;
                    else if(isLow) blocks[x][y][z]=BLOCK.sand;
                    else blocks[x][y][z]=BLOCK.grass;
                    continue;
                }
            }
            if(h < waterLine-1) for(let y=h+1; y<waterLine; ++y)
                blocks[x][y][z] = BLOCK.water;
            // 沙漠仙人掌分布
            if(biome==="desert" && Math.random()<0.015 && h>waterLine+2){
                for(let dh=1;dh<=2+Math.floor(Math.random()*3);++dh)
                    if(h+dh<WORLD_H-1) blocks[x][h+dh][z]=BLOCK.cactus;
            }
        }
    }
    // 洞穴
    for(let i=0;i<350;++i){
        let cx = Math.floor(Math.random()*(WORLD_W-40))+20;
        let cy = 12+Math.floor(Math.random()*(WORLD_H-22));
        let cz = Math.floor(Math.random()*(WORLD_D-40))+20;
        let r = 2+Math.random()*5;
        let len = 18+Math.random()*55;
        let yaw = Math.random()*Math.PI*2, pitch = (Math.random()-0.6)*Math.PI/7;
        carveCave(blocks, cx, cy, cz, r, len, yaw, pitch);
    }
    // 矿物团
    const ORE_CLUSTER_CONFIG = [
        {kind: BLOCK.diamond_mine, minY:3, maxY:18, size:2, count:30},
        {kind: BLOCK.platinum_mine, minY:6, maxY:22, size:3, count:44},
        {kind: BLOCK.silver_mine, minY:8, maxY:28, size:4, count:60},
        {kind: BLOCK.copper_mine, minY:12, maxY:41, size:6, count:88},
        {kind: BLOCK.coal_mine, minY:10, maxY:56, size:9, count:160}
    ];
    for(let conf of ORE_CLUSTER_CONFIG){
        for(let i=0;i<conf.count;i++){
            let cx = Math.floor(Math.random()*(WORLD_W-24))+12;
            let cy = conf.minY+Math.floor(Math.random()*(conf.maxY-conf.minY));
            let cz = Math.floor(Math.random()*(WORLD_D-24))+12;
            addOreCluster(blocks, conf.kind, cx, cy, cz, conf.size);
        }
    }
    // 树
    for(let i=0; i<400; ++i){
        let x = Math.floor(Math.random()*(WORLD_W-7)+3), z = Math.floor(Math.random()*(WORLD_D-7)+3);
        let biome = getBiome(x,z);
        if(biome==="desert") continue;
        let snowTree = (biome==="snow");
        let y;
        for(y=WORLD_H-5; y>2; --y)
            if([BLOCK.grass,BLOCK.dirt].includes(blocks[x][y][z]) && blocks[x][y+1][z]==null)
                break;
        if(y<4) continue;
        let height = snowTree ? 2+Math.floor(valueNoise.noise(x*0.23,z*0.28)*1.4)
                              : 4+Math.floor(valueNoise.noise(x*0.23,z*0.28)*2.6);
        for(let h2=1;h2<=height;++h2)
            blocks[x][y+h2][z]=BLOCK.wood;
        for(let lx=-2;lx<=2;++lx)
         for(let ly=Math.floor(height/2);ly<=height+2;++ly)
          for(let lz=-2;lz<=2;++lz) {
            if(Math.abs(lx)+Math.abs(lz)>3||(lx===0&&ly===Math.floor(height/2)&&lz===0)) continue;
            let tx=x+lx, ty=y+ly, tz=z+lz;
            if(tx<0||ty>=WORLD_H||tz<0||tx>=WORLD_W||tz>=WORLD_D) continue;
            let dist = Math.abs(lx)+Math.abs(ly-height)+Math.abs(lz);
            let dropP = snowTree ? 0.28+0.07*dist : 0.12+0.04*dist;
            if(Math.random()<dropP) continue;
            if(blocks[tx][ty][tz]==null)
                blocks[tx][ty][tz]=snowTree?BLOCK.snow:BLOCK.leaf;
         }
    }
    return blocks;
}
function randomOre(x, y, z, type='deep') {
    let r = Math.random();
    let stoneDepth = Math.max(1, y);
    if(stoneDepth < 10 && r<0.012) return BLOCK.diamond_mine;
    if(stoneDepth < 14 && r<0.025) return BLOCK.platinum_mine;
    if(stoneDepth < 16 && r<0.045) return BLOCK.silver_mine;
    if(stoneDepth < 22 && r<0.06) return BLOCK.copper_mine;
    if(r<0.10) return BLOCK.coal_mine;
    return null;
}

// ====================================================
// ============ 游戏状态 & Three.js 渲染 ===============
// ====================================================
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

// Three.js渲染
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
function addBlockMesh(x, y, z, id) {
    let geometry = new THREE.BoxGeometry(1,1,1);
    const faces = ["side","side","top","bottom","side","side"];
    let faceMats = faces.map(face => {
        let tex = getBlockTexture(id, face);
        let opts={};
        if(tex){
            opts.map=tex;
            if(id===BLOCK.water || id===BLOCK.leaf || id===BLOCK.ice){
                opts.transparent = true; opts.opacity = 0.79;
            }
        }else{
            opts.color = COLORS[id]||0xff00ff;
        }
        return new THREE.MeshLambertMaterial(opts);
    });
    let mesh = new THREE.Mesh(geometry, faceMats);
    mesh.position.set(x,y,z);
    scene.add(mesh);
    blockMeshes.set(`${x}_${y}_${z}`, mesh);
}
function renderVisibleBlocks() {
    let camX = Math.floor(gameState.px), camY = Math.floor(gameState.py), camZ = Math.floor(gameState.pz);
    let RENDER_DIST = getRenderDist();
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
