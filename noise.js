// noise.js
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
const WORLD_W = 512, WORLD_D = 512, WORLD_H = 100, SAND_THICK = 3;
let RENDER_DIST = 15; // 可调整渲染距离
const perlin = new PerlinNoise(20230519);
const valueNoise = new ValueNoise(54188114514);

// Biome: forest / desert / snow / mountain
function getBiome(x, z) {
    let bio = perlin.noise(x/180, z/180);
    let mountainMask = perlin.noise(x/160, z/160); // lower frequency but denser
    if (bio < 0.27) return "desert";
    if (bio > 0.75) return "snow";
    if (mountainMask > 0.68) return "mountain";
    return "forest";
}
function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }

// =========== randomOre（按深度+噪声聚簇，带生成门槛） ===========
function randomOre(x, y, z, type = 'deep_stone') {
    const depthFactor = clamp(1 - (y / (WORLD_H - 1)), 0, 1);
    const veinNoise = perlin.noise(x * 0.08, z * 0.08);
    const veinFactor = 0.6 + 0.9 * veinNoise;
    const baseOreChance = 0.06;
    const spawnChance = baseOreChance * veinFactor * (type === 'deep_stone' ? 1.6 : (type === 'stone' ? 0.8 : 1.0));
    if (Math.random() >= spawnChance) return null;
    const weights = [
        { ore: BLOCK.coal_mine, base: 0.12 * (0.9 + 0.2 * (1 - depthFactor)) },
        { ore: BLOCK.copper_mine, base: 0.07 * (0.9 + 0.4 * (1 - depthFactor)) },
        { ore: BLOCK.silver_mine, base: 0.04 * (0.7 + 0.8 * depthFactor) },
        { ore: BLOCK.platinum_mine, base: 0.02 * (0.5 + 1.2 * depthFactor) },
        { ore: BLOCK.diamond_mine, base: 0.008 * (0.2 + 5.0 * Math.pow(depthFactor, 3)) }
    ];
    let typeModifier = 1.0;
    if (type === 'stone') typeModifier = 0.85;
    if (type === 'deep_stone') typeModifier = 1.25;
    let total = 0;
    for (let w of weights) { w.final = w.base * veinFactor * typeModifier; total += w.final; }
    if (total <= 0) return null;
    let r = Math.random() * total, acc = 0;
    for (let w of weights) {
        acc += w.final;
        if (r < acc) {
            if (w.ore === BLOCK.diamond_mine && depthFactor < 0.25) return null;
            return w.ore;
        }
    }
    return null;
}

// =========== createWorld（完整实现，含分层 30% stone / 70% deep_stone） ===========
function createWorld() {
    const blocks = new Array(WORLD_W);
    for (let x = 0; x < WORLD_W; x++) {
        blocks[x] = new Array(WORLD_H);
        for (let y = 0; y < WORLD_H; y++) blocks[x][y] = new Array(WORLD_D).fill(null);
    }

    const waterLine = Math.floor(WORLD_H * 0.26);
    const deepslateH = 8;
    const bedrockBase = 2;

    // mountain amplitude multiplier (tuneable). 2.0 means mountain areas use double amplitude.
    const MOUNTAIN_MULTIPLIER = 2.0;
    const BASE_AMPLITUDE_FACTOR = 0.30;

    for (let x = 0; x < WORLD_W; x++) {
        for (let z = 0; z < WORLD_D; z++) {
            let mtn = perlin.fbm(x/60, z/60, {octaves:6, gain:0.48, lacunarity:1.67});
            let hills = perlin.fbm(x/19, z/19, {octaves:3, gain:0.43, lacunarity:2.12});
            let dunes = valueNoise.fbm(x/7, z/7, {octaves:2, gain:0.4, lacunarity:2.9});
            let river = 1 - valueNoise.worley(x/23, z/23, 6);
            let island = Math.max(0, valueNoise.fbm(x/100, z/100, {octaves:2, gain:0.8, lacunarity:2.2}));

            let base = (0.44*mtn + 0.2*hills + 0.09*dunes + 0.12*river + 0.15*island);

            let biome = getBiome(x, z);

            let amplitudeFactor = BASE_AMPLITUDE_FACTOR;
            if (biome === "mountain") {
                amplitudeFactor = BASE_AMPLITUDE_FACTOR * MOUNTAIN_MULTIPLIER;
            }

            let h0 = Math.floor(WORLD_H * 0.28 + base * WORLD_H * amplitudeFactor);
            let h = clamp(h0, 5, WORLD_H - 2);

            // base filling (bedrock)
            for (let y = 0; y < bedrockBase; ++y) {
                blocks[x][y][z] = (Math.random() < 0.66 || y === 0) ? BLOCK.bedrock : BLOCK.deep_stone;
            }

            // define underground band for stratification:
            const undergroundStart = bedrockBase + deepslateH; // inclusive
            const undergroundEnd = Math.max(bedrockBase + 1, h - 7); // inclusive
            const undergroundHeight = Math.max(1, undergroundEnd - undergroundStart + 1);
            const STONE_TOP_RATIO = 0.30; // fallback when band too small

            for (let y = bedrockBase; y <= h; ++y) {
                let isLow = h < waterLine + 3;

                // surface sand / snow for low biomes
                if (isLow && y >= h - SAND_THICK + 1 && biome === "desert") { blocks[x][y][z] = BLOCK.sand; continue; }
                if (isLow && y >= h - SAND_THICK + 1 && biome === "snow") { blocks[x][y][z] = BLOCK.snow; continue; }

                // deep layers / deepslate / ore / lava
                if (y < bedrockBase + deepslateH || (y < h - 6 && h > waterLine + 10 && Math.random() < 0.25)) {
                    // prioritize ore
                    let ore = randomOre(x, y, z, 'deep_stone');
                    if (ore) { blocks[x][y][z] = ore; continue; }

                    // deterministic stratification: if inside the band, split into 10 slices
                    if (y >= undergroundStart && y <= undergroundEnd) {
                        if (undergroundHeight >= 10) {
                            // compute slice index 0..9
                            const posInBand = y - undergroundStart; // 0..undergroundHeight-1
                            const sliceIndex = Math.floor(posInBand * 10 / undergroundHeight); // 0..9
                            if (sliceIndex < 3) {
                                // top 3 slices => stone
                                blocks[x][y][z] = BLOCK.stone;
                            } else {
                                // bottom 7 slices => deep_stone (allow lava in very deep)
                                if (y <= 12) {
                                    let lavaCluster = 1 - valueNoise.worley(x/10, z/10, 6);
                                    if (Math.random() < 0.015 * (0.6 + 1.4 * lavaCluster)) {
                                        blocks[x][y][z] = BLOCK.lava;
                                        continue;
                                    }
                                }
                                blocks[x][y][z] = BLOCK.deep_stone;
                            }
                        } else {
                            // band too small: fallback to deterministic top N layers stone (round up)
                            const topCount = Math.max(1, Math.round(undergroundHeight * STONE_TOP_RATIO)); // at least 1
                            const posInBand = y - undergroundStart;
                            if (posInBand < topCount) {
                                blocks[x][y][z] = BLOCK.stone;
                            } else {
                                if (y <= 12) {
                                    let lavaCluster = 1 - valueNoise.worley(x/10, z/10, 6);
                                    if (Math.random() < 0.015 * (0.6 + 1.4 * lavaCluster)) {
                                        blocks[x][y][z] = BLOCK.lava;
                                        continue;
                                    }
                                }
                                blocks[x][y][z] = BLOCK.deep_stone;
                            }
                        }
                        continue;
                    } else {
                        // outside stratified band: keep earlier heuristic
                        if (y <= bedrockBase + deepslateH - 1) {
                            if (Math.random() < 0.70) {
                                if (y <= 12) {
                                    let lavaCluster = 1 - valueNoise.worley(x/10, z/10, 6);
                                    if (Math.random() < 0.015 * (0.6 + 1.4 * lavaCluster)) {
                                        blocks[x][y][z] = BLOCK.lava;
                                        continue;
                                    }
                                }
                                blocks[x][y][z] = BLOCK.deep_stone;
                            } else {
                                blocks[x][y][z] = BLOCK.stone;
                            }
                        } else {
                            blocks[x][y][z] = BLOCK.deep_stone;
                        }
                        continue;
                    }
                }

                // near-surface sand/snow
                if (y >= h - SAND_THICK + 1 && isLow && biome === "desert") { blocks[x][y][z] = BLOCK.sand; continue; }
                if (y >= h - SAND_THICK + 1 && isLow && biome === "snow") { blocks[x][y][z] = BLOCK.snow; continue; }

                // upper underground: ore then mostly stone
                if (y < h - 7) {
                    let ore = randomOre(x, y, z, 'stone');
                    if (ore) { blocks[x][y][z] = ore; }
                    else { blocks[x][y][z] = (Math.random() < 0.85) ? BLOCK.stone : BLOCK.deep_stone; }
                    continue;
                }

                // near-surface: soil / mountain mixing
                if (y < h) {
                    if (biome === "mountain") {
                        let stoneProb = 0.35 + 0.4 * ((y - (h - 7)) / 7);
                        if (Math.random() < stoneProb) blocks[x][y][z] = BLOCK.stone;
                        else blocks[x][y][z] = BLOCK.soil;
                    } else {
                        blocks[x][y][z] = (biome === "desert") ? BLOCK.sand : BLOCK.soil;
                    }
                    continue;
                }

                // top block
                if (y == h) {
                    if (biome === "desert") blocks[x][y][z] = BLOCK.sand;
                    else if (biome === "snow") blocks[x][y][z] = BLOCK.snow;
                    else if (biome === "mountain") blocks[x][y][z] = BLOCK.snow;
                    else blocks[x][y][z] = BLOCK.grass;
                    continue;
                }
            }

            // water fill
            if (h < waterLine - 1) {
                for (let y = h + 1; y < waterLine; ++y) blocks[x][y][z] = BLOCK.water;
            }
        }
    }

    // Plants and trees (denser cactus in desert)
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
            if (Math.random() < 0.38) {
                let cactusHeight = 1 + Math.floor(Math.random() * 4);
                for (let h2 = 1; h2 <= cactusHeight; ++h2) {
                    if (y + h2 >= WORLD_H) break;
                    if (blocks[x][y+h2][z] !== null) break;
                    blocks[x][y+h2][z] = BLOCK.cactus;
                }
            }
            continue;
        }

        // forest & snow: trees
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

// ============ 游戏状态 & 初始化 ============
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
    blocks: null,
    hotbar: DEFAULT_HOTBAR.slice(),
    selectedSlot: 0
};
gameState.blocks = createWorld();
window.gameState = gameState;

// =========== Rendering / Three.js scene & performance caches ===========
let camera, scene, renderer, blockMeshes;
const SHARED_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);
const MATERIAL_CACHE = new Map();
let lastCameraCell = { x: -9999, y: -9999, z: -9999 };

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

function renderVisibleBlocks() {
    const camX = Math.floor(gameState.px), camY = Math.floor(gameState.py), camZ = Math.floor(gameState.pz);
    const minX = Math.max(0, camX - RENDER_DIST), maxX = Math.min(WORLD_W - 1, camX + RENDER_DIST);
    const minY = Math.max(0, camY - RENDER_DIST), maxY = Math.min(WORLD_H - 1, camY + RENDER_DIST);
    const minZ = Math.max(0, camZ - RENDER_DIST), maxZ = Math.min(WORLD_D - 1, camZ + RENDER_DIST);

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

// ===== Collision & movement (AABB + step-up) =====
function collidesAt(px, py, pz) {
    const r = 0.29;
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

function canStand(nx, ny, nz) {
    return !collidesAt(nx, ny, nz);
}

function updateCamera() {
    camera.position.set(gameState.px, gameState.py, gameState.pz);
    let lx = Math.cos(gameState.lookV) * Math.sin(gameState.lookH);
    let ly = Math.sin(gameState.lookV);
    let lz = Math.cos(gameState.lookV) * Math.cos(gameState.lookH);
    camera.lookAt(gameState.px + lx, gameState.py + ly, gameState.pz + lz);
}

function stepPlayer() {
    let ang = gameState.lookH, speed = gameState.speed;
    let dx = 0, dz = 0;
    if (gameState.move.w) { dx += Math.sin(ang) * speed; dz += Math.cos(ang) * speed; }
    if (gameState.move.s) { dx -= Math.sin(ang) * speed; dz -= Math.cos(ang) * speed; }
    if (gameState.move.a) { dx -= Math.sin(ang + Math.PI/2) * speed; dz += Math.cos(ang + Math.PI/2) * speed; }
    if (gameState.move.d) { dx -= Math.sin(ang - Math.PI/2) * speed; dz += Math.cos(ang - Math.PI/2) * speed; }
    // A, D不要改(上面)

    let px = gameState.px, py = gameState.py, pz = gameState.pz;
    if (!gameState.fly) gameState.vy -= 0.011;
    let dy = gameState.fly ? ((gameState.move.up ? speed : 0) - (gameState.move.down ? speed : 0)) : gameState.vy;

    let newY = py + dy;
    if (!collidesAt(px, newY, pz)) {
        py = newY;
    } else {
        if (!gameState.fly) gameState.vy = 0;
        for (let t = 0.05; t <= 0.5; t += 0.05) {
            if (!collidesAt(px, py + t, pz)) { py = py + t; break; }
        }
    }

    const tryStepMove = (targetX, targetY, targetZ, maxStep = 0.5) => {
        if (!collidesAt(targetX, targetY, targetZ)) return { success: true, nx: targetX, ny: targetY, nz: targetZ };
        for (let step = 0.05; step <= maxStep; step += 0.05) {
            if (!collidesAt(targetX, targetY + step, targetZ) && !collidesAt(targetX, targetY + step + 0.85, targetZ)) {
                return { success: true, nx: targetX, ny: targetY + step, nz: targetZ };
            }
        }
        return { success: false };
    };

    if (dx !== 0) {
        let res = tryStepMove(px + dx, py, pz);
        if (res.success) { px = res.nx; py = res.ny; pz = res.nz; }
    }
    if (dz !== 0) {
        let res = tryStepMove(px, py, pz + dz);
        if (res.success) { px = res.nx; py = res.ny; pz = res.nz; }
        else {
            let res2 = tryStepMove(px + dx, py, pz + dz);
            if (res2.success) { px = res2.nx; py = res2.ny; pz = res2.nz; }
        }
    }

    px = Math.max(1, Math.min(WORLD_W - 2, px));
    py = Math.max(2, Math.min(WORLD_H - 2, py));
    pz = Math.max(1, Math.min(WORLD_D - 2, pz));
    Object.assign(gameState, { px, py, pz });
}

function animate() {
    requestAnimationFrame(animate);
    stepPlayer();
    const camCellX = Math.floor(gameState.px), camCellY = Math.floor(gameState.py), camCellZ = Math.floor(gameState.pz);
    if (camCellX !== lastCameraCell.x || camCellY !== lastCameraCell.y || camCellZ !== lastCameraCell.z) {
        lastCameraCell.x = camCellX; lastCameraCell.y = camCellY; lastCameraCell.z = camCellZ;
        renderVisibleBlocks();
    }
    updateCamera();
    renderer && renderer.render(scene, camera);
}

// ===== Raycast & Input (liquids ignored) =====
function raycastBlock(maxDist = 6) {
    let ox = gameState.px, oy = gameState.py + 0.6, oz = gameState.pz;
    let lx = Math.cos(gameState.lookV) * Math.sin(gameState.lookH);
    let ly = Math.sin(gameState.lookV);
    let lz = Math.cos(gameState.lookV) * Math.cos(gameState.lookH);
    for (let i = 0; i < maxDist * 15; i++) {
        let d = i * 0.07;
        let x = ox + lx * d, y = oy + ly * d, z = oz + lz * d;
        let xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
        if (xi < 0 || xi >= WORLD_W || yi < 0 || yi >= WORLD_H || zi < 0 || zi >= WORLD_D) continue;
        let t = gameState.blocks[xi][yi][zi];
        if (t !== null) {
            if (t === BLOCK.water || t === BLOCK.lava) continue;
            let bx = x - lx * 0.08, by = y - ly * 0.08, bz = z - lz * 0.08;
            return { x: xi, y: yi, z: zi, px: Math.floor(bx), py: Math.floor(by), pz: Math.floor(bz) };
        }
    }
    return null;
}

function onMousedown(e) {
    if (!gameState.pointerLocked) return;
    const hit = raycastBlock();
    if (!hit) return;
    if (e.button == 0) {
        if (gameState.blocks[hit.x][hit.y][hit.z] !== BLOCK.bedrock) {
            gameState.blocks[hit.x][hit.y][hit.z] = null;
            removeBlockMesh(hit.x, hit.y, hit.z);
        }
    }
    if (e.button == 2) {
        let { px, py, pz } = hit;
        if (px < 0 || px >= WORLD_W || py < 0 || py >= WORLD_H || pz < 0 || pz >= WORLD_D) return;
        if (gameState.blocks[px][py][pz] == null
            && Math.abs(px - gameState.px) > 0.7
            && Math.abs(py - gameState.py) > 1.0
            && Math.abs(pz - gameState.pz) > 0.7) {
            let id = gameState.hotbar[gameState.selectedSlot];
            gameState.blocks[px][py][pz] = id;
            addBlockMesh(px, py, pz, id);
        }
    }
}
function onContextMenu(e) { e.preventDefault(); }

function setupInput() {
    renderer.domElement.addEventListener('click', () => renderer.domElement.requestPointerLock());
    document.addEventListener('pointerlockchange', () => {
        let locked = (document.pointerLockElement === renderer.domElement);
        gameState.pointerLocked = locked;
        if (locked) gameState.showInfo = false;
    });
    document.addEventListener('mousemove', e => {
        if (!gameState.pointerLocked) return;
        gameState.lookH += e.movementX * 0.002;
        gameState.lookV -= e.movementY * 0.002;
        let V = Math.PI / 2 * 0.99;
        if (gameState.lookV < -V) gameState.lookV = -V;
        if (gameState.lookV > V) gameState.lookV = V;
    });
    window.addEventListener('keydown', e => {
        if (/^Digit[1-8]$/.test(e.code)) gameState.selectedSlot = Number(e.code.slice(-1)) - 1;
        if (e.code === 'KeyW') gameState.move.w = 1;
        if (e.code === 'KeyA') gameState.move.a = 1;
        if (e.code === 'KeyS') gameState.move.s = 1;
        if (e.code === 'KeyD') gameState.move.d = 1;
        if (e.code === 'Space') {
            if (gameState.fly) gameState.move.up = 1;
            else if (gameState.vy === 0 && canStand(gameState.px, gameState.py - 0.2, gameState.pz)) gameState.vy = 0.32;
        }
        if (e.code === 'ShiftLeft') gameState.move.down = 1;
        if (e.code === 'KeyF') gameState.fly = !gameState.fly;
        if (e.code === 'Escape') { document.exitPointerLock && document.exitPointerLock(); }
    });
    window.addEventListener('keyup', e => {
        if (e.code === 'KeyW') gameState.move.w = 0;
        if (e.code === 'KeyA') gameState.move.a = 0;
        if (e.code === 'KeyS') gameState.move.s = 0;
        if (e.code === 'KeyD') gameState.move.d = 0;
        if (e.code === 'Space') gameState.move.up = 0;
        if (e.code === 'ShiftLeft') gameState.move.down = 0;
    });
    window.addEventListener('wheel', e => {
        let sz = gameState.hotbar.length;
        if (sz > 0) {
            if (e.deltaY > 0) gameState.selectedSlot = (gameState.selectedSlot + 1) % sz;
            if (e.deltaY < 0) gameState.selectedSlot = (gameState.selectedSlot + sz - 1) % sz;
            e.preventDefault();
        }
    }, { passive: false });
    window.addEventListener('mousedown', onMousedown);
    window.addEventListener('contextmenu', onContextMenu);
}

// block name helper
function blockName(id) {
    let idx = Object.values(BLOCK).indexOf(id);
    return BLOCKNAMES[idx] || "未知";
}

// Vue UI + boot
const { createApp } = Vue;
createApp({
  setup() {
      return {
        pointerLocked: Vue.computed(() => gameState.pointerLocked),
        showInfo: Vue.computed(() => gameState.showInfo),
        hotbar: Vue.computed(() => gameState.hotbar),
        selectedSlot: Vue.computed(() => gameState.selectedSlot),
        COLORS, blockName
      };
  },
  mounted() {
      preloadBlockTextures(() => {
          setupThree();
          setupInput();
          renderVisibleBlocks();
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
      <div v-for="(bid,i) in hotbar" :key="i"
           :style="{
            width:'42px',height:'42px',
            margin:'0 3px',position:'relative',
            border:'3px solid '+(i===selectedSlot?'#efb637':'#999'),
            background:'#f1efea',borderRadius:'7px',boxShadow:i===selectedSlot?'0 0 12px #ffc':'' }">
        <div :style="{
              width:'100%',height:'100%',
              display:'flex',alignItems:'center',justifyContent:'center',
              fontWeight:'bold',fontSize:'1.0em',color:'#222',zIndex:2
          }">{{ blockName(bid) }}</div>
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
