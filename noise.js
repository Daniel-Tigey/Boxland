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

// =========== PerlinNoise (2D) 实现 ===========
class PerlinNoise {
    constructor(seed = 0) {
        this.seed = seed >>> 0;
        this._rand = (function(s) {
            let state = s >>> 0;
            return function() {
                state = (1664525 * state + 1013904223) >>> 0;
                return state / 4294967296;
            };
        })(this.seed ^ 0x9E3779B9);
        this.perm = new Uint8Array(512);
        const p = new Uint8Array(256);
        for (let i = 0; i < 256; i++) p[i] = i;
        for (let i = 255; i > 0; i--) {
            const j = Math.floor(this._rand() * (i + 1));
            const t = p[i]; p[i] = p[j]; p[j] = t;
        }
        for (let i = 0; i < 512; i++) this.perm[i] = p[i & 255];
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(a, b, t) { return a + t * (b - a); }
    grad(hash, x, y) {
        const h = hash & 7;
        switch (h) {
            case 0: return  x + y;
            case 1: return -x + y;
            case 2: return  x - y;
            case 3: return -x - y;
            case 4: return  x;
            case 5: return -x;
            case 6: return  y;
            default: return -y;
        }
    }
    noise(x, y) {
        const X = Math.floor(x) & 255;
        const Y = Math.floor(y) & 255;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);
        const u = this.fade(xf);
        const v = this.fade(yf);
        const aa = this.perm[X + this.perm[Y]];
        const ab = this.perm[X + this.perm[Y + 1]];
        const ba = this.perm[X + 1 + this.perm[Y]];
        const bb = this.perm[X + 1 + this.perm[Y + 1]];
        const x1 = this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
        const x2 = this.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);
        const result = this.lerp(x1, x2, v) * 0.5 + 0.5;
        return result;
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
}

// =========== 方块定义 ===========
const BLOCK = {
    grass: 0, soil: 1, stone: 2, banyan_wood: 3, leaf_00: 4, leaf_07: 5,
    water: 6, bedrock: 7, sand: 8, deep_stone: 9, lava: 10,
    coal_mine: 11, copper_mine: 12, silver_mine: 13, platinum_mine: 14, diamond_mine: 15,
    ice: 16, snow: 17, cactus: 18, fir_wood: 19
};
const COLORS = [
    0x4CAF50,0x8B5A2B,0x888888,0x8B4513,0x19cc19,0x17a44a,
    0x4091F7,0x000000,0xDED39E,0x3A3A3A,0xEF0000,
    0x222222,0xF18D36,0xBFC7C7,0xc7bb80,0x68e0ff,
    0xFFFFFF,0xEEEEEE,0x2E8B57,0xA0522D
];
const BLOCKNAMES = [
    "grass","soil","stone","banyan_wood","leaf_00","leaf_07",
    "water","bedrock","sand","deep_stone","lava",
    "coal_mine","copper_mine","silver_mine","platinum_mine","diamond_mine",
    "ice","snow","cactus","fir_wood"
];

// ==== 贴图文件名key ====
const BLOCK_TEXTURES = {};
const BLOCK_TEXTURE_FILES = [
    "grass_soil_top.png","grass_soil.png","grass_soil_bottom.png",
    "soil.png",
    "stone.png",
    "banyan_wood_top.png","banyan_wood.png","banyan_wood_bottom.png",
    "leaf_00.png","leaf_07.png",
    "water.png",
    "bedrock.png",
    "sand.png",
    "deep_stone.png",
    "lava.png",
    "coal_mine.png","copper_mine.png","silver_mine.png","platinum_mine.png","diamond_mine.png",
    "ice.png","snow.png","cactus.png",
    "fir_wood_top.png","fir_wood.png","fir_wood_bottom.png"
];

const BLOCK_TEXTURE_MAP = {
    [BLOCK.grass]:   { top: "grass_soil_top.png", side: "grass_soil.png", bottom: "grass_soil_bottom.png" },
    [BLOCK.soil]:    { side: "soil.png" },
    [BLOCK.stone]:   { side: "stone.png" },
    [BLOCK.banyan_wood]: { top: "banyan_wood_top.png", side: "banyan_wood.png", bottom: "banyan_wood_bottom.png" },
    [BLOCK.leaf_00]: { side: "leaf_00.png", transparent: true, alphaTest: 0.5 },
    [BLOCK.leaf_07]: { side: "leaf_07.png", transparent: true, alphaTest: 0.5 },
    [BLOCK.water]:   { side: "water.png", transparent: true, opacity: 0.75 },
    [BLOCK.bedrock]: { side: "bedrock.png" },
    [BLOCK.sand]:    { side: "sand.png" },
    [BLOCK.deep_stone]: { side: "deep_stone.png" },
    [BLOCK.lava]:    { side: "lava.png", transparent: false },
    [BLOCK.coal_mine]: { side: "coal_mine.png" },
    [BLOCK.copper_mine]: { side: "copper_mine.png" },
    [BLOCK.silver_mine]: { side: "silver_mine.png" },
    [BLOCK.platinum_mine]: { side: "platinum_mine.png" },
    [BLOCK.diamond_mine]: { side: "diamond_mine.png" },
    [BLOCK.ice]:     { side: "ice.png" },
    [BLOCK.snow]:    { side: "snow.png" },
    [BLOCK.cactus]:  { side: "cactus.png" },
    [BLOCK.fir_wood]:{ top: "fir_wood_top.png", side: "fir_wood.png", bottom: "fir_wood_bottom.png" }
};

// 预加载贴图（按文件名 key 存入 BLOCK_TEXTURES）
function preloadBlockTextures(callback) {
    const loader = new THREE.TextureLoader();
    let loaded = 0, total = BLOCK_TEXTURE_FILES.length;
    for (let i = 0; i < BLOCK_TEXTURE_FILES.length; i++) {
        const file = BLOCK_TEXTURE_FILES[i];
        loader.load(
            "assets/textures/" + file,
            tex => {
                tex.magFilter = THREE.NearestFilter;
                tex.minFilter = THREE.NearestFilter;
                BLOCK_TEXTURES[file] = tex;
                if (++loaded === total && callback) callback();
            },
            undefined,
            err => {
                BLOCK_TEXTURES[file] = null;
                if (++loaded === total && callback) callback();
            }
        );
    }
}

// helper: 根据纹理或颜色创建材质（考虑透明/不透明/alphaTest）
function makeMaterialFromTexOrColor(tex, color, opts = {}) {
    const matOpts = {};
    if (tex) {
        matOpts.map = tex;
        if (opts.transparent) {
            matOpts.transparent = true;
            matOpts.opacity = (typeof opts.opacity === 'number') ? opts.opacity : 1.0;
        }
        if (opts.alphaTest) matOpts.alphaTest = opts.alphaTest;
    } else {
        matOpts.color = color || 0xff00ff;
    }
    return new THREE.MeshLambertMaterial(matOpts);
}

// ===== World constants =====
const WORLD_W = 512, WORLD_D = 512, WORLD_H = 64, SAND_THICK = 3;
let RENDER_DIST = 15; // 可调整渲染距离（越大越耗性能）
const perlin = new PerlinNoise(20230519);
const valueNoise = new ValueNoise(54188114514);

// Biome: forest / desert / snow
function getBiome(x, z) {
    let bio = perlin.noise(x/180, z/180);
    if (bio < 0.32) return "desert";
    if (bio > 0.72) return "snow";
    return "forest";
}
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// =========== randomOre（改：先按位置门槛再采样权重） ===========
function randomOre(x, y, z, type = 'deep_stone') {
    // depthFactor: 0 at top, 1 at bottom
    const depthFactor = clamp(1 - (y / (WORLD_H - 1)), 0, 1);

    // vein clustering factor (较低频)
    const veinNoise = perlin.noise(x * 0.08, z * 0.08); // 0..1
    const veinFactor = 0.6 + 0.9 * veinNoise; // 0.6..1.5

    // 总体生成概率门槛：prevent ores everywhere
    const baseOreChance = 0.06; // 基础每方块生成矿脉的概率尺度（更小 => 更稀有）
    const spawnChance = baseOreChance * veinFactor * (type === 'deep_stone' ? 1.6 : (type === 'stone' ? 0.8 : 1.0));
    if (Math.random() >= spawnChance) return null; // 大多数方块直接不生成矿石

    // 权重（按深度调整）
    const weights = [
        { ore: BLOCK.coal_mine, base: 0.12 * (0.9 + 0.2 * (1 - depthFactor)) },
        { ore: BLOCK.copper_mine, base: 0.07 * (0.9 + 0.4 * (1 - depthFactor)) },
        { ore: BLOCK.silver_mine, base: 0.04 * (0.7 + 0.8 * depthFactor) },
        { ore: BLOCK.platinum_mine, base: 0.02 * (0.5 + 1.2 * depthFactor) },
        { ore: BLOCK.diamond_mine, base: 0.008 * (0.2 + 5.0 * Math.pow(depthFactor, 3)) }
    ];

    // 类型修正
    let typeModifier = 1.0;
    if (type === 'stone') typeModifier = 0.85;
    if (type === 'deep_stone') typeModifier = 1.25;

    // 计算 final 权重
    let total = 0;
    for (let w of weights) {
        w.final = w.base * veinFactor * typeModifier;
        total += w.final;
    }
    if (total <= 0) return null;

    // 按权重选择
    let r = Math.random() * total;
    let acc = 0;
    for (let w of weights) {
        acc += w.final;
        if (r < acc) {
            if (w.ore === BLOCK.diamond_mine && depthFactor < 0.25) return null; // 钻石深度约束
            return w.ore;
        }
    }
    return null;
}

// =========== World generation ===========
// ... (createWorld unchanged from previous saved, uses randomOre as above)
// For brevity I keep createWorld identical to your last version; it's still included in the actual script

function createWorld() {
    const blocks = new Array(WORLD_W);
    for (let x = 0; x < WORLD_W; x++) {
        blocks[x] = new Array(WORLD_H);
        for (let y = 0; y < WORLD_H; y++) {
            blocks[x][y] = new Array(WORLD_D).fill(null);
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
            let river = 1 - valueNoise.worley(x/23, z/23, 6);
            let island = Math.max(0, valueNoise.fbm(x/100, z/100, {octaves:2, gain:0.8, lacunarity:2.2}));
            let base = 0.44*mtn + 0.2*hills + 0.09*dunes + 0.12*river + 0.15*island;
            let h0 = Math.floor(WORLD_H*0.19 + base*WORLD_H*0.73);
            let h = clamp(h0, 5, WORLD_H-2);

            let biome = getBiome(x, z);

            for (let y = 0; y < bedrockBase; ++y) {
                blocks[x][y][z] = (Math.random() < 0.66 || y === 0) ? BLOCK.bedrock : BLOCK.deep_stone;
            }

            for (let y = bedrockBase; y <= h; ++y) {
                let isLow = h < waterLine + 3;
                if (isLow && y >= h - SAND_THICK + 1 && biome === "desert") { blocks[x][y][z] = BLOCK.sand; continue; }
                if (isLow && y >= h - SAND_THICK + 1 && biome === "snow") { blocks[x][y][z] = BLOCK.snow; continue; }

                if (y < bedrockBase + deepslateH || (y < h - 6 && h > waterLine + 10 && Math.random() < 0.25)) {
                    let ore = randomOre(x, y, z, 'deep_stone');
                    blocks[x][y][z] = ore ? ore : BLOCK.deep_stone;
                    continue;
                }

                if (y >= h - SAND_THICK + 1 && isLow && biome === "desert") { blocks[x][y][z] = BLOCK.sand; continue; }
                if (y >= h - SAND_THICK + 1 && isLow && biome === "snow") { blocks[x][y][z] = BLOCK.snow; continue; }

                if (y < h - 7) {
                    let ore = randomOre(x, y, z, 'stone');
                    blocks[x][y][z] = ore ? ore : BLOCK.stone;
                    continue;
                }

                if (y < h) {
                    blocks[x][y][z] = (biome === "desert") ? BLOCK.sand : BLOCK.soil;
                    continue;
                }

                if (y == h) {
                    if (biome === "desert") blocks[x][y][z] = BLOCK.sand;
                    else if (biome === "snow") blocks[x][y][z] = BLOCK.snow;
                    else blocks[x][y][z] = BLOCK.grass;
                    continue;
                }
            }

            if (h < waterLine - 1) {
                for (let y = h + 1; y < waterLine; ++y) blocks[x][y][z] = BLOCK.water;
            }
        }
    }

    // Plants and trees (unchanged from prior)
    for (let i = 0; i < 400; ++i) {
        let x = Math.floor(Math.random() * (WORLD_W - 7) + 3),
            z = Math.floor(Math.random() * (WORLD_D - 7) + 3);
        let biome = getBiome(x, z);

        // find surface y
        let y;
        for (y = WORLD_H - 5; y > 2; --y)
            if ([BLOCK.grass, BLOCK.soil, BLOCK.sand, BLOCK.snow].includes(blocks[x][y][z]) && blocks[x][y+1][z] == null)
                break;
        if (y < 4) continue;

        if (biome === "desert") {
            if (Math.random() < 0.18) {
                let cactusHeight = 1 + Math.floor(Math.random() * 3);
                for (let h2 = 1; h2 <= cactusHeight; ++h2) {
                    if (y + h2 >= WORLD_H) break;
                    if (blocks[x][y+h2][z] !== null) break;
                    blocks[x][y+h2][z] = BLOCK.cactus;
                }
            }
            continue;
        }

        let snowTree = (biome === "snow");
        let woodType = snowTree ? BLOCK.fir_wood : BLOCK.banyan_wood;
        let height = snowTree ? 2 + Math.floor(valueNoise.noise(x*0.23, z*0.28) * 2.0)
                              : 4 + Math.floor(valueNoise.noise(x*0.23, z*0.28) * 2.8);
        if (height < 2) height = 2;

        // check space
        let spaceOk = true;
        for (let h2 = 1; h2 <= height + 2; ++h2) {
            let ty = y + h2;
            if (ty >= WORLD_H || blocks[x][ty][z] !== null) { spaceOk = false; break; }
        }
        if (!spaceOk) continue;

        for (let h2 = 1; h2 <= height; ++h2) blocks[x][y+h2][z] = woodType;

        for (let lx = -2; lx <= 2; ++lx)
         for (let ly = Math.floor(height/2); ly <= height + 2; ++ly)
          for (let lz = -2; lz <= 2; ++lz) {
            if (Math.abs(lx) + Math.abs(lz) > 3 || (lx === 0 && ly === Math.floor(height/2) && lz === 0)) continue;
            let tx = x + lx, ty = y + ly, tz = z + lz;
            if (tx < 0 || ty >= WORLD_H || tz < 0 || tx >= WORLD_W || tz >= WORLD_D) continue;
            let dist = Math.abs(lx) + Math.abs(ly - height) + Math.abs(lz);
            let dropP = snowTree ? 0.25 + 0.07 * dist : 0.10 + 0.04 * dist;
            if (Math.random() < dropP) continue;
            if (blocks[tx][ty][tz] == null) blocks[tx][ty][tz] = snowTree ? BLOCK.leaf_07 : BLOCK.leaf_00;
         }
    }

    return blocks;
}

// ============ 游戏状态 ============
const HOTBAR_SIZE = 8;
const DEFAULT_HOTBAR = [
    BLOCK.grass, BLOCK.soil, BLOCK.stone, BLOCK.sand,
    BLOCK.banyan_wood, BLOCK.leaf_00, BLOCK.deep_stone, BLOCK.coal_mine
];

const gameState = {
    pointerLocked: false, showInfo: true,
    px: WORLD_W / 2, py: Math.floor(WORLD_H * 0.80), pz: WORLD_D / 2,
    vx: 0, vy: 0, vz: 0,
    lookH: Math.PI / 2, lookV: -0.30,
    fly: false,
    move: { w: 0, a: 0, s: 0, d: 0, up: 0, down: 0 },
    speed: 0.17, size: 0.6,
    blocks: createWorld(),
    hotbar: DEFAULT_HOTBAR.slice(),
    selectedSlot: 0
};
window.gameState = gameState;

// =========== Rendering / Three.js scene & performance caches ===========
let camera, scene, renderer, blockMeshes;
const SHARED_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const MATERIAL_CACHE = new Map(); // block id -> materials array
let lastCameraCell = { x: -9999, y: -9999, z: -9999 };

// setupThree with pixel ratio limit
function setupThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x81D4FA);
    camera = new THREE.PerspectiveCamera(82, window.innerWidth / window.innerHeight, 0.1, 1600);
    renderer = new THREE.WebGLRenderer({antialias: true});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.zIndex = 5;
    document.body.appendChild(renderer.domElement);
    const ambient = new THREE.AmbientLight(0xffffff, 0.72); scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffee, 1.1); dir.position.set(60, 80, 5); scene.add(dir);
    blockMeshes = new Map();
}

// optimized addBlockMesh using shared geometry & cached materials
function addBlockMesh(x, y, z, id) {
    const key = `${x}_${y}_${z}`;
    if (blockMeshes.has(key)) return;

    let materials = MATERIAL_CACHE.get(id);
    if (!materials) {
        const desc = BLOCK_TEXTURE_MAP[id] || {};
        const sideTex = desc.side ? BLOCK_TEXTURES[desc.side] : null;
        const topTex = desc.top ? BLOCK_TEXTURES[desc.top] : sideTex;
        const bottomTex = desc.bottom ? BLOCK_TEXTURES[desc.bottom] : sideTex;
        const transparent = !!desc.transparent;
        const opacity = (typeof desc.opacity === 'number') ? desc.opacity : (transparent ? 0.75 : 1.0);
        const alphaTest = desc.alphaTest || 0;

        const sideMat = makeMaterialFromTexOrColor(sideTex, COLORS[id] || 0xff00ff, { transparent, opacity, alphaTest });
        const topMat = makeMaterialFromTexOrColor(topTex, COLORS[id] || 0xff00ff, { transparent, opacity, alphaTest });
        const bottomMat = makeMaterialFromTexOrColor(bottomTex, COLORS[id] || 0xff00ff, { transparent, opacity, alphaTest });

        materials = [ sideMat, sideMat, topMat, bottomMat, sideMat, sideMat ];
        MATERIAL_CACHE.set(id, materials);
    }

    const mesh = new THREE.Mesh(SHARED_GEOMETRY, materials);
    mesh.position.set(x, y, z);
    mesh.frustumCulled = true;
    mesh.__blockId = id;
    scene.add(mesh);
    blockMeshes.set(key, mesh);
}

// optimized renderVisibleBlocks: only update cells within RENDER_DIST and remove meshes outside
function renderVisibleBlocks() {
    const camX = Math.floor(gameState.px), camY = Math.floor(gameState.py), camZ = Math.floor(gameState.pz);
    const minX = Math.max(0, camX - RENDER_DIST), maxX = Math.min(WORLD_W - 1, camX + RENDER_DIST);
    const minY = Math.max(0, camY - RENDER_DIST), maxY = Math.min(WORLD_H - 1, camY + RENDER_DIST);
    const minZ = Math.max(0, camZ - RENDER_DIST), maxZ = Math.min(WORLD_D - 1, camZ + RENDER_DIST);

    // add missing meshes in frustum box
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                const id = gameState.blocks[x][y][z];
                const key = `${x}_${y}_${z}`;
                if (id !== null) {
                    if (!blockMeshes.has(key)) {
                        addBlockMesh(x, y, z, id);
                    } else {
                        const mesh = blockMeshes.get(key);
                        if (mesh.__blockId !== id) {
                            const mats = MATERIAL_CACHE.get(id);
                            if (mats) mesh.material = mats;
                            mesh.__blockId = id;
                        }
                    }
                }
            }
        }
    }

    // remove meshes outside frustum box
    for (const key of Array.from(blockMeshes.keys())) {
        const [sx, sy, sz] = key.split('_').map(Number);
        if (sx < minX || sx > maxX || sy < minY || sy > maxY || sz < minZ || sz > maxZ) {
            const mesh = blockMeshes.get(key);
            if (mesh) {
                scene.remove(mesh);
                blockMeshes.delete(key);
            }
        }
    }
}

function removeBlockMesh(x, y, z) {
    const key = `${x}_${y}_${z}`;
    const mesh = blockMeshes.get(key);
    if (mesh) {
        scene.remove(mesh);
        blockMeshes.delete(key);
    }
}

window.addEventListener('resize', () => {
    if (!renderer || !camera) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
});

// ===== Collision: AABB-based accurate check =====
function collidesAt(px, py, pz) {
    // player's collision box
    const r = 0.29; // horizontal radius
    const minX = Math.floor(px - r);
    const maxX = Math.floor(px + r);
    const minY = Math.floor(py - 0.8);
    const maxY = Math.floor(py + 1.64);
    const minZ = Math.floor(pz - r);
    const maxZ = Math.floor(pz + r);

    for (let x = minX; x <= maxX; x++) {
        if (x < 0 || x >= WORLD_W) return true;
        for (let y = minY; y <= maxY; y++) {
            if (y < 0 || y >= WORLD_H) return true;
            for (let z = minZ; z <= maxZ; z++) {
                if (z < 0 || z >= WORLD_D) return true;
                const b = gameState.blocks[x][y][z];
                if (b !== null && b !== BLOCK.water && b !== BLOCK.lava) {
                    return true;
                }
            }
        }
    }
    return false;
}

// keep compat canStand but use collidesAt
function canStand(nx, ny, nz) {
    return !collidesAt(nx, ny, nz);
}

// ===== Player movement with axis separation & step-up handling =====
function stepPlayer() {
    let ang = gameState.lookH, speed = gameState.speed;
    let dx = 0, dz = 0;
    if (gameState.move.w) { dx += Math.sin(ang) * speed; dz += Math.cos(ang) * speed; }
    if (gameState.move.s) { dx -= Math.sin(ang) * speed; dz -= Math.cos(ang) * speed; }
    if (gameState.move.a) { dx += Math.sin(ang - Math.PI/2) * speed; dz += Math.cos(ang - Math.PI/2) * speed; }
    if (gameState.move.d) { dx += Math.sin(ang + Math.PI/2) * speed; dz += Math.cos(ang + Math.PI/2) * speed; }

    let px = gameState.px, py = gameState.py, pz = gameState.pz;
    // vertical velocity
    if (!gameState.fly) {
        gameState.vy -= 0.011;
    }
    let dy = gameState.fly ? ((gameState.move.up ? speed : 0) - (gameState.move.down ? speed : 0)) : gameState.vy;

    // 1) vertical move (apply gravity/jump)
    let newY = py + dy;
    if (!collidesAt(px, newY, pz)) {
        py = newY;
    } else {
        // hit ceiling or ground -> reset vy
        if (!gameState.fly) gameState.vy = 0;
        // try small upward adjustments to avoid sinking into blocks
        let stepped = false;
        for (let t = 0.05; t <= 0.5; t += 0.05) {
            if (!collidesAt(px, py + t, pz)) { py = py + t; stepped = true; break; }
        }
        if (!stepped) {
            // keep py
        }
    }

    // helper for step-up attempts when horizontal blocked
    const tryStepMove = (targetX, targetY, targetZ, maxStep = 0.5) => {
        // try small upward steps (simulate stepping up small ledge)
        if (!collidesAt(targetX, targetY, targetZ)) return { success: true, nx: targetX, ny: targetY, nz: targetZ };
        for (let step = 0.05; step <= maxStep; step += 0.05) {
            if (!collidesAt(targetX, targetY + step, targetZ) && !collidesAt(targetX, targetY + step + 0.85, targetZ)) {
                return { success: true, nx: targetX, ny: targetY + step, nz: targetZ };
            }
        }
        return { success: false };
    };

    // 2) horizontal movement: separate axes to avoid corner clipping
    // attempt X
    if (dx !== 0) {
        let res = tryStepMove(px + dx, py, pz);
        if (res.success) {
            px = res.nx; py = res.ny; pz = res.nz;
        } else {
            // blocked in X; do nothing for X
        }
    }

    // attempt Z
    if (dz !== 0) {
        let res = tryStepMove(px, py, pz + dz);
        if (res.success) {
            px = res.nx; py = res.ny; pz = res.nz;
        } else {
            // If separate axes blocked, try diagonal combined (allows sliding along corner)
            let res2 = tryStepMove(px + dx, py, pz + dz);
            if (res2.success) {
                px = res2.nx; py = res2.ny; pz = res2.nz;
            }
        }
    }

    // clamp to world bounds
    px = Math.max(1, Math.min(WORLD_W - 2, px));
    py = Math.max(2, Math.min(WORLD_H - 2, py));
    pz = Math.max(1, Math.min(WORLD_D - 2, pz));

    Object.assign(gameState, { px, py, pz });
}

// rest of rendering + raycast/input + Vue UI unchanged (kept from previous optimized script)
// For brevity, please merge the rest of the previously provided optimized script (setupThree, addBlockMesh, renderVisibleBlocks, animate, raycastBlock, setupInput, Vue boot) unchanged.
// The full file should include everything from the prior optimized version, but with the above updated collidesAt/canStand/stepPlayer and modified randomOre.
