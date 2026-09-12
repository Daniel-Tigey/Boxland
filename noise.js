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
    ice: 16, snow: 17, cactus: 18, fir_wood: 19, quartz_block: 20
};
const COLORS = [
    0x4CAF50,0x8B5A2B,0x888888,0x8B4513,0x19cc19,0x17a44a,
    0x4091F7,0x000000,0xDED39E,0x3A3A3A,0xEF0000,
    0x222222,0xF18D36,0xBFC7C7,0xc7bb80,0x68e0ff,
    0xFFFFFF,0xEEEEEE,0x2E8B57,0xA0522D,
    0xF5F5F0 // quartz (浅石英色)
];
const BLOCKNAMES = [
    "grass","soil","stone","banyan_wood","leaf_00","leaf_07",
    "water","bedrock","sand","deep_stone","lava",
    "coal_mine","copper_mine","silver_mine","platinum_mine","diamond_mine",
    "ice","snow","cactus","fir_wood","quartz_block"
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
    "ice.png","snow.png",
    "cactus.png", "cactus_top.png",
    "fir_wood_top.png","fir_wood.png","fir_wood_bottom.png",
    "quartz_block.png"
];

const BLOCK_TEXTURE_MAP = {
    [BLOCK.grass]:   { top: "grass_soil_top.png", side: "grass_soil.png", bottom: "grass_soil_bottom.png" },
    [BLOCK.soil]:    { side: "soil.png" },
    [BLOCK.stone]:   { side: "stone.png" },
    [BLOCK.banyan_wood]: { top: "banyan_wood_top.png", side: "banyan_wood.png", bottom: "banyan_wood_bottom.png" },
    [BLOCK.leaf_00]: { side: "leaf_00.png", transparent: true, alphaTest: 0.5 },
    [BLOCK.leaf_07]: { side: "leaf_07.png", transparent: true, alphaTest: 0.5 },
    [BLOCK.water]:   { side: "water.png", transparent: true, opacity: 0.75, alphaTest: 0.75 },
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
    [BLOCK.cactus]:  { top: "cactus_top.png", side: "cactus.png" },
    [BLOCK.fir_wood]:{ top: "fir_wood_top.png", side: "fir_wood.png", bottom: "fir_wood_bottom.png" },
    [BLOCK.quartz_block]: { side: "quartz_block.png" }
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
const WORLD_W = 1024, WORLD_D = 1024, WORLD_H = 128, SAND_THICK = 3; // 扩张大小
let RENDER_DIST = 15; // 可调整渲染距离
const perlin = new PerlinNoise(20230519);
const valueNoise = new ValueNoise(54188114514);

// Biome: forest / desert / snow / mountain / pillar
function getBiome(x, z) {
    let bio = perlin.noise(x/180, z/180);
    let mountainMask = perlin.noise(x/160, z/160); // lower frequency but denser
    let pillarMask = perlin.noise(x/120, z/120); // pillar areas
    if (bio < 0.27) return "desert";
    if (bio > 0.75) return "snow";
    if (mountainMask > 0.68) return "mountain";
    if (pillarMask > 0.86) return "pillar";
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

// =========== createWorld ===========
// 山、石柱群系、湖泊、每列 stone/deep_stone 抖动、仙人掌 & 秃树 & 沙漠 quartz 簇
function createWorld() {
    const blocks = new Array(WORLD_W);
    for (let x = 0; x < WORLD_W; x++) {
        blocks[x] = new Array(WORLD_H);
        for (let y = 0; y < WORLD_H; y++) blocks[x][y] = new Array(WORLD_D).fill(null);
    }

    const waterLine = Math.floor(WORLD_H * 0.26);
    const deepslateH = 8;
    const bedrockBase = 2;

    // mountain tuning (kept as before)
    const MOUNTAIN_MULTIPLIER = 2.0;
    const MOUNTAIN_BIAS = 6;
    const MOUNTAIN_LIFT = 10;
    const BASE_AMPLITUDE_FACTOR = 0.30;

    // 石头和深层石头分界线
    const STONE_LEVEL_Y = Math.floor(WORLD_H * 0.35); // 基准分界线

    // NEW: 固定 deep_stone 阈值（Y 小于此值则为 deep_stone，否则为 stone）
    const DEEPSTONE_LEVEL = Math.max(0, bedrockBase + deepslateH + 1); // 确保大于 bedrockBase

    // 湖泊、仙人掌、秃树参数
    const LAKE_ATTEMPTS = 600;
    const CACTUS_SPAWN_PROB = 0.72; // 仙人掌出现概率
    const CACTUS_MAX_HEIGHT = 5;    // 仙人掌最高高度
    const BALD_TREE_PROB = 0.05;    // 5% 概率不生成树叶

    function smoothstep(a, b, t) {
        if (b <= a) return t >= b ? 1 : 0;
        t = (t - a) / (b - a);
        t = Math.max(0, Math.min(1, t));
        return t * t * (3 - 2 * t);
    }

    for (let x = 0; x < WORLD_W; x++) {
        for (let z = 0; z < WORLD_D; z++) {
            // noises
            let mtn = perlin.fbm(x/60, z/60, {octaves:6, gain:0.48, lacunarity:1.67});
            let hills = perlin.fbm(x/19, z/19, {octaves:3, gain:0.43, lacunarity:2.12});
            let dunes = valueNoise.fbm(x/7, z/7, {octaves:2, gain:0.4, lacunarity:2.9});
            let river = 1 - valueNoise.worley(x/23, z/23, 6);
            let island = Math.max(0, valueNoise.fbm(x/100, z/100, {octaves:2, gain:0.8, lacunarity:2.2}));

            let base = (0.44*mtn + 0.2*hills + 0.09*dunes + 0.12*river + 0.15*island);

            // get biome and a low-frequency mountain mask
            let biome = getBiome(x, z);
            let mountainRaw = perlin.fbm(x/160, z/160, {octaves:3, gain:0.6, lacunarity:2.0});
            let mountainStrength = smoothstep(0.60, 0.88, mountainRaw);

            // base no-mountain height (for mountainHeight calculation)
            const baseHNoMountain = Math.floor(WORLD_H * 0.28 + base * WORLD_H * BASE_AMPLITUDE_FACTOR);

            // amplitude factor blends smoothly between base and amplified
            let amplitudeFactor = BASE_AMPLITUDE_FACTOR * (1 + mountainStrength * (MOUNTAIN_MULTIPLIER - 1));
            // vertical bias scaled by mountainStrength, include required extra lift
            let verticalBias = Math.round((MOUNTAIN_BIAS + MOUNTAIN_LIFT) * mountainStrength);

            // compute height
            let h0 = Math.floor(WORLD_H * 0.28 + base * WORLD_H * amplitudeFactor + verticalBias);
            let h = clamp(h0, 5, WORLD_H - 2);

            // mountainHeight and snow threshold (upper half)
            const mountainHeight = Math.max(0, h - baseHNoMountain);
            const snowThresholdY = baseHNoMountain + Math.ceil(mountainHeight / 2);

            // per-column jitter for stone/deep_stone cutoff: -2..+2 using low-frequency noise
            const jitterRaw = valueNoise.fbm(x * 0.08, z * 0.08, {octaves:2, gain:0.5, lacunarity:2});
            const jitter = Math.round((jitterRaw - 0.5) * 4); // roughly -2..+2
            const localStoneLevel = clamp(STONE_LEVEL_Y + jitter, bedrockBase + 1, WORLD_H - 5);

            // base filling (bedrock)
            for (let y = 0; y < bedrockBase; ++y) {
                blocks[x][y][z] = (Math.random() < 0.66 || y === 0) ? BLOCK.bedrock : BLOCK.deep_stone;
            }

            // underground stratification band
            const undergroundStart = bedrockBase + deepslateH; // inclusive
            const undergroundEnd = Math.max(bedrockBase + 1, h - 7); // inclusive
            const undergroundHeight = Math.max(1, undergroundEnd - undergroundStart + 1);

            for (let y = bedrockBase; y <= h; ++y) {
                let isLow = h < waterLine + 3;

                // shore sand / snow
                if (isLow && y >= h - SAND_THICK + 1 && biome === "desert") { blocks[x][y][z] = BLOCK.sand; continue; }
                if (isLow && y >= h - SAND_THICK + 1 && biome === "snow") { blocks[x][y][z] = BLOCK.snow; continue; }

                // deep layers / deepslate / ore / lava
                if (y < bedrockBase + deepslateH || (y < h - 6 && h > waterLine + 10 && Math.random() < 0.25)) {
                    // try ore first (use deep_stone type for ore sampling here)
                    let ore = randomOre(x, y, z, 'deep_stone');
                    if (ore) { blocks[x][y][z] = ore; continue; }

                    // classify by deterministic Y cutoff: y < DEEPSTONE_LEVEL -> deep_stone, else stone
                    if (y < DEEPSTONE_LEVEL) {
                        // deep stone with occasional lava
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
                    continue;
                }

                // near-surface sand/snow (handled)
                if (y >= h - SAND_THICK + 1 && isLow && biome === "desert") { blocks[x][y][z] = BLOCK.sand; continue; }
                if (y >= h - SAND_THICK + 1 && isLow && biome === "snow") { blocks[x][y][z] = BLOCK.snow; continue; }

                // upper underground: ore sampling then deterministic stone/deep_stone
                if (y < h - 7) {
                    let ore = randomOre(x, y, z, 'stone');
                    if (ore) {
                        blocks[x][y][z] = ore;
                    } else {
                        // deterministic: below DEEPSTONE_LEVEL => deep_stone else stone
                        if (y < DEEPSTONE_LEVEL) blocks[x][y][z] = BLOCK.deep_stone;
                        else blocks[x][y][z] = BLOCK.stone;
                    }
                    continue;
                }

                // near-surface: soil or stone; mountain top snow logic
                if (y < h) {
                    const localTopFrac = ((y - (h - 7)) / 7);
                    const topFracClamped = Math.max(0, Math.min(1, localTopFrac));
                    const baseStoneProb = 0.10 + 0.25 * topFracClamped;
                    const mountainStoneBoost = mountainStrength * 0.6;
                    const stoneProb = Math.max(0, Math.min(0.98, baseStoneProb + mountainStoneBoost));
                    if (Math.random() < stoneProb) {
                        // stone; if upper-half of mountain, may be snow (7/8)
                        if (mountainHeight > 0 && y >= snowThresholdY) {
                            blocks[x][y][z] = (Math.random() < 0.875) ? BLOCK.snow : BLOCK.stone;
                        } else {
                            blocks[x][y][z] = BLOCK.stone;
                        }
                    } else {
                        blocks[x][y][z] = (biome === "desert") ? BLOCK.sand : BLOCK.soil;
                    }
                    continue;
                }

                // top block
                if (y == h) {
                    if (biome === "desert") blocks[x][y][z] = BLOCK.sand;
                    else if (biome === "snow") blocks[x][y][z] = BLOCK.snow;
                    else {
                        if (mountainHeight > 0 && h >= snowThresholdY) {
                            blocks[x][y][z] = (Math.random() < 0.875) ? BLOCK.snow : BLOCK.grass;
                        } else if (biome === "pillar") {
                            // pillar biome surface = stone
                            blocks[x][y][z] = BLOCK.stone;
                            blocks[x][y][z] = BLOCK.quartz_block;
                        } else {
                            blocks[x][y][z] = BLOCK.grass;
                        }
                    }

                    // 石英簇
                    if (biome === "desert" && Math.random() < 0.05) {
                        const clusterSeed = valueNoise.worley(x/6, z/6, 6);
                        const clusterRadius = 1 + (clusterSeed > 0.5 ? 1 : 0); // radius 1 或 2
                        for (let ox = -clusterRadius; ox <= clusterRadius; ox++) {
                            for (let oz = -clusterRadius; oz <= clusterRadius; oz++) {
                                const dx = ox, dz = oz;
                                if (dx*dx + dz*dz > (clusterRadius + 0.0001)*(clusterRadius + 0.0001)) continue;
                                const gx = x + ox, gz = z + oz;
                                if (gx < 0 || gx >= WORLD_W || gz < 0 || gz >= WORLD_D) continue;
                                // 找到该列地表 y
                                let gy = -1;
                                for (let yy = WORLD_H - 5; yy > 2; --yy) {
                                    if ([BLOCK.grass, BLOCK.soil, BLOCK.sand, BLOCK.snow].includes(blocks[gx][yy][gz]) && blocks[gx][yy+1][gz] == null) {
                                        gy = yy; break;
                                    }
                                }
                                if (gy < 4) continue;
                                // 仅在砂层顶上放 quartz 且上方空位
                                if (blocks[gx][gy][gz] === BLOCK.sand && blocks[gx][gy+1][gz] == null) {
                                    const p = 0.6 * (1 - valueNoise.worley(gx/3, gz/3, 6));
                                    if (Math.random() < p) {
                                        blocks[gx][gy+1][gz] = BLOCK.quartz_block;
                                    }
                                }
                            }
                        }
                    }
                    // --- end quartz cluster ---
                    continue;
                }
            }

            // water fill
            if (h < waterLine - 1) {
                for (let y = h + 1; y < waterLine; ++y) blocks[x][y][z] = BLOCK.water;
            }
        }
    }

    // -------------------------
    // Lake generation (fixed)
    // -------------------------
    for (let attempt = 0; attempt < LAKE_ATTEMPTS; attempt++) {
        const lx = Math.floor(Math.random() * (WORLD_W - 12)) + 6;
        const lz = Math.floor(Math.random() * (WORLD_D - 12)) + 6;
        const lb = getBiome(lx, lz);

        let spawnProb = 0;
        if (lb === 'forest') spawnProb = 0.30;
        else if (lb === 'snow') spawnProb = 0.20;
        else if (lb === 'desert') spawnProb = 0.10;
        else spawnProb = 0.0;
        if (Math.random() >= spawnProb) continue;

        // find surface Y
        let surfaceY = -1;
        for (let yy = WORLD_H - 5; yy > 2; --yy) {
            if ([BLOCK.grass, BLOCK.soil, BLOCK.sand, BLOCK.snow].includes(blocks[lx][yy][lz]) && blocks[lx][yy+1][lz] == null) {
                surfaceY = yy; break;
            }
        }
        if (surfaceY < 4) continue;

        const radius = 2 + Math.floor(Math.random() * 5); // 2..6
        const maxDepth = 1 + Math.floor(Math.random() * 4); // 1..4

        for (let tx = lx - radius; tx <= lx + radius; tx++) {
            if (tx < 1 || tx >= WORLD_W - 1) continue;
            for (let tz = lz - radius; tz <= lz + radius; tz++) {
                if (tz < 1 || tz >= WORLD_D - 1) continue;
                const dx = tx - lx, dz = tz - lz;
                const d2 = dx*dx + dz*dz;
                if (d2 > radius*radius) continue;
                const dist = Math.sqrt(d2);
                const factor = 1 - (dist / (radius + 0.0001));
                const carveDepth = Math.max(1, Math.ceil(factor * maxDepth));
                let bottomY = surfaceY - carveDepth;
                if (bottomY <= bedrockBase) bottomY = bedrockBase + 1;
                // carve out
                for (let cy = surfaceY; cy > bottomY; cy--) blocks[tx][cy][tz] = null;
                // lake bottom is sand
                blocks[tx][bottomY][tz] = BLOCK.sand;
                // fill liquid from bottomY+1 up to surfaceY (inclusive)
                for (let fy = bottomY + 1; fy <= surfaceY; fy++) {
                    if (lb === 'snow') {
                        blocks[tx][fy][tz] = BLOCK.ice;
                    } else if (lb === 'desert') {
                        // desert lakes: small chance to be lava (e.g., 8%)
                        if (Math.random() < 0.08) blocks[tx][fy][tz] = BLOCK.lava;
                        else blocks[tx][fy][tz] = BLOCK.water;
                    } else {
                        // forest and others: water
                        blocks[tx][fy][tz] = BLOCK.water;
                    }
                }
            }
        }
    }

    // -------------------------
    // Plants and trees (with cactus boost & bald trees)
    // -------------------------
    for (let i = 0; i < 400; ++i) {
        let tx = Math.floor(Math.random() * (WORLD_W - 7) + 3),
            tz = Math.floor(Math.random() * (WORLD_D - 7) + 3);
        let biome = getBiome(tx, tz);

        // find surface y
        let y;
        for (y = WORLD_H - 5; y > 2; --y)
            if ([BLOCK.grass, BLOCK.soil, BLOCK.sand, BLOCK.snow].includes(blocks[tx][y][tz]) && blocks[tx][y+1][tz] == null)
                break;
        if (y < 4) continue;

        // pillar biome: do not place normal plants; instead generate some stone pillars here later
        if (biome === "pillar") continue;

        if (biome === "desert") {
            if (Math.random() < CACTUS_SPAWN_PROB) {
                let cactusHeight = 2 + Math.floor(Math.random() * CACTUS_MAX_HEIGHT);
                for (let h2 = 1; h2 <= cactusHeight; ++h2) {
                    if (y + h2 >= WORLD_H) break;
                    if (blocks[tx][y+h2][tz] !== null) break;
                    blocks[tx][y+h2][tz] = BLOCK.cactus;
                }
            }
            continue;
        }

        let snowTree = (biome === "snow" || biome === "mountain");
        let woodType = snowTree ? BLOCK.fir_wood : BLOCK.banyan_wood;
        // pine/fir taller in cold areas
        let height = snowTree ? 4 + Math.floor(valueNoise.noise(tx*0.23, tz*0.28) * 4.0)
                              : 4 + Math.floor(valueNoise.noise(tx*0.23, tz*0.28) * 2.8);
        if (height < 2) height = 2;

        // check space
        let spaceOk = true;
        for (let h2 = 1; h2 <= height + 2; ++h2) {
            let ty = y + h2;
            if (ty >= WORLD_H || blocks[tx][ty][tz] !== null) { spaceOk = false; break; }
        }
        if (!spaceOk) continue;

        // place trunk
        for (let h2 = 1; h2 <= height; ++h2) blocks[tx][y+h2][tz] = woodType;

        // determine if this is a "bald" tree (no leaves)
        const isBald = (Math.random() < BALD_TREE_PROB);

        if (!isBald) {
            // place leaves
            for (let lx = -2; lx <= 2; ++lx)
             for (let ly = Math.floor(height/2); ly <= height + 2; ++ly)
              for (let lz = -2; lz <= 2; ++lz) {
                if (Math.abs(lx) + Math.abs(lz) > 3 || (lx === 0 && ly === Math.floor(height/2) && lz === 0)) continue;
                let px = tx + lx, py = y + ly, pz = tz + lz;
                if (px < 0 || py >= WORLD_H || pz < 0 || px >= WORLD_W || pz >= WORLD_D) continue;
                let dist = Math.abs(lx) + Math.abs(ly - height) + Math.abs(lz);
                let dropP = snowTree ? 0.25 + 0.07 * dist : 0.10 + 0.04 * dist;
                if (Math.random() < dropP) continue;
                if (blocks[px][py][pz] == null) blocks[px][py][pz] = snowTree ? BLOCK.leaf_07 : BLOCK.leaf_00;
             }
        }
    }

    // -------------------------
    // Pillar biome: generate stone pillars at some positions
    // -------------------------
    // We do this after plants so we can ensure pillars stand on surface and avoid overwriting trees.
    const PILLAR_ATTEMPTS = 300;
    for (let attempt = 0; attempt < PILLAR_ATTEMPTS; attempt++) {
        const px = Math.floor(Math.random() * (WORLD_W - 6)) + 3;
        const pz = Math.floor(Math.random() * (WORLD_D - 6)) + 3;
        if (getBiome(px, pz) !== "pillar") continue;
        // find surface
        let sy = -1;
        for (let yy = WORLD_H - 5; yy > 2; --yy) {
            if (blocks[px][yy][pz] !== null && blocks[px][yy+1][pz] == null) { sy = yy; break; }
        }
        if (sy < 4) continue;
        // require surface is stone or close to stone
        if (blocks[px][sy][pz] !== BLOCK.stone && blocks[px][sy][pz] !== BLOCK.deep_stone) continue;
        const height = 8 + Math.floor(Math.random() * 8); // 8..15
        for (let h = 1; h <= height; ++h) {
            let yy = sy + h;
            if (yy >= WORLD_H - 1) break;
            // keep top as stone & quartz; avoid overwriting liquids
            if (blocks[px][yy][pz] === BLOCK.water || blocks[px][yy][pz] === BLOCK.lava) break;
            blocks[px][yy][pz] = BLOCK.stone;
            blocks[px][yy+1][pz] = BLOCK.quartz_block;
            blocks[px+1][yy+1][pz] = BLOCK.quartz_block;
            blocks[px][yy+1][pz+1] = BLOCK.quartz_block;
            blocks[px-1][yy+1][pz] = BLOCK.quartz_block;
            blocks[px][yy+1][pz-1] = BLOCK.quartz_block;
        }
    }

    return blocks;
}

// ============ 游戏状态 & 初始化 ============
const HOTBAR_SIZE = 8;
const DEFAULT_HOTBAR = [
    BLOCK.grass, BLOCK.soil, BLOCK.stone, BLOCK.sand,
    BLOCK.deep_stone, BLOCK.coal_mine, BLOCK.banyan_wood, BLOCK.cactus
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

// helper: 判断方块是否不透明（用于遮挡剔除）
// 认为 water/lava/transparent textures (按 BLOCK_TEXTURE_MAP transparent 标注) 为非不透明
function isOpaque(blockId) {
    if (blockId == null) return false;
    if (blockId === BLOCK.water || blockId === BLOCK.lava) return false;
    const desc = BLOCK_TEXTURE_MAP[blockId];
    if (desc && desc.transparent) return false;
    return true;
}

// 判断方块是否被六面完全遮挡（六个相邻方向都有不透明方块）
// 边界处的不可访问视作不透明（以保守为主）
function isBlockOccluded(x, y, z) {
    // if block itself is null or not opaque, it's not occluded (we only occlude opaque blocks)
    const id = gameState.blocks[x][y][z];
    if (id == null) return false;
    if (!isOpaque(id)) return false;

    const neighbors = [
        [x+1,y,z],[x-1,y,z],[x,y+1,z],[x,y-1,z],[x,y,z+1],[x,y,z-1]
    ];
    for (let [nx,ny,nz] of neighbors) {
        if (nx < 0 || nx >= WORLD_W || ny < 0 || ny >= WORLD_H || nz < 0 || nz >= WORLD_D) {
            // treat out-of-bounds as opaque so we keep occluding inside world
            continue;
        }
        const nid = gameState.blocks[nx][ny][nz];
        if (!isOpaque(nid)) return false;
    }
    return true;
}

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

    // resize handling (minimal safe addition)
    window.addEventListener('resize', () => {
        if (!camera || !renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
}

// animation loop (added to fix "animate is not defined")
function animate() {
    requestAnimationFrame(animate);
    // update player physics / movement
    try {
        stepPlayer();
    } catch (err) {
        // swallow errors to avoid breaking the loop in unexpected states
        console.error("stepPlayer error:", err);
    }

    // update visible blocks when camera cell changes (cheap check)
    const camX = Math.floor(gameState.px), camY = Math.floor(gameState.py), camZ = Math.floor(gameState.pz);
    if (camX !== lastCameraCell.x || camY !== lastCameraCell.y || camZ !== lastCameraCell.z) {
        try {
            renderVisibleBlocks();
        } catch (err) {
            console.error("renderVisibleBlocks error:", err);
        }
        lastCameraCell.x = camX; lastCameraCell.y = camY; lastCameraCell.z = camZ;
    }

    // update camera transform and render
    try {
        updateCamera();
        renderer.render(scene, camera);
    } catch (err) {
        console.error("render error:", err);
    }
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

function removeBlockMesh(x, y, z) {
    const key = `${x}_${y}_${z}`;
    const mesh = blockMeshes.get(key);
    if (mesh) {
        scene.remove(mesh);
        blockMeshes.delete(key);
    }
}

// 新的 renderVisibleBlocks: 避免渲染完全被六面遮挡的方块（occlusion culling）
function renderVisibleBlocks() {
    const camX = Math.floor(gameState.px), camY = Math.floor(gameState.py), camZ = Math.floor(gameState.pz);
    const minX = Math.max(0, camX - RENDER_DIST), maxX = Math.min(WORLD_W - 1, camX + RENDER_DIST);
    const minY = Math.max(0, camY - RENDER_DIST), maxY = Math.min(WORLD_H - 1, camY + RENDER_DIST);
    const minZ = Math.max(0, camZ - RENDER_DIST), maxZ = Math.min(WORLD_D - 1, camZ + RENDER_DIST);

    // add / update
    for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
            for (let z = minZ; z <= maxZ; z++) {
                const id = gameState.blocks[x][y][z];
                const key = `${x}_${y}_${z}`;
                if (id !== null) {
                    // occlusion culling
                    const occluded = isBlockOccluded(x, y, z);
                    if (occluded) {
                        // if currently rendered, remove it
                        if (blockMeshes.has(key)) removeBlockMesh(x, y, z);
                        continue; // skip rendering occluded blocks
                    }

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
                } else {
                    // if null but mesh exists (shouldn't normally), remove it
                    if (blockMeshes.has(key)) removeBlockMesh(x, y, z);
                }
            }
        }
    }

    // remove out-of-range
    for (const key of Array.from(blockMeshes.keys())) {
        const [sx, sy, sz] = key.split('_').map(Number);
        if (sx < minX || sx > maxX || sy < minY || sy > maxY || sz < minZ || sz > maxZ) {
            const mesh = blockMeshes.get(key);
            if (mesh) {
                scene.remove(mesh);
                blockMeshes.delete(key);
            }
        } else {
            // also remove if occluded now
            if (isBlockOccluded(sx, sy, sz)) {
                removeBlockMesh(sx, sy, sz);
            }
        }
    }
}

// ===== Collision & movement (AABB + step-up) =====
// Collides: axis-aligned capsule/AABB check. liquids ignored.
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

// 更稳健的地面检测：检测脚下一点是否有实块接触（用于允许跳跃）
function isOnGround(px, py, pz) {
    const r = 0.29;
    // player foot approximate height offset: feet are around py - 0.8..py - 0.9
    const footCheckY = py - 0.9;
    const checkY = Math.floor(footCheckY);
    const minX = Math.floor(px - r), maxX = Math.floor(px + r);
    const minZ = Math.floor(pz - r), maxZ = Math.floor(pz + r);
    for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
            if (x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D) continue;
            const b = gameState.blocks[x][checkY] || null;
            if (b !== null && b !== BLOCK.water && b !== BLOCK.lava) {
                return true;
            }
        }
    }
    return false;
}

function updateCamera() {
    camera.position.set(gameState.px, gameState.py, gameState.pz);
    let lx = Math.cos(gameState.lookV) * Math.sin(gameState.lookH);
    let ly = Math.sin(gameState.lookV);
    let lz = Math.cos(gameState.lookV) * Math.cos(gameState.lookH);
    camera.lookAt(gameState.px + lx, gameState.py + ly, gameState.pz + lz);
}

// improved stepPlayer: use camera forward/right projected to XZ, normalize composite vector
// and robust vertical collision handling to avoid getting stuck and to enable consistent jumps.
function stepPlayer() {
    // Build forward vector from look angles, then project to XZ plane and normalize
    const lx = Math.cos(gameState.lookV) * Math.sin(gameState.lookH);
    const lz = Math.cos(gameState.lookV) * Math.cos(gameState.lookH);
    let forward = { x: lx, z: lz };
    // project to XZ and normalize
    const fLen = Math.sqrt(forward.x*forward.x + forward.z*forward.z) || 1;
    forward.x /= fLen; forward.z /= fLen;
    // right is perpendicular on XZ plane
    const right = { x: -forward.z, z: forward.x };

    // input
    const fwInput = (gameState.move.w ? 1 : 0) - (gameState.move.s ? 1 : 0);
    const sdInput = (gameState.move.d ? 1 : 0) - (gameState.move.a ? 1 : 0);
    const speed = gameState.speed;

    // compose movement vector in world XZ using forward/right basis
    let mvx = forward.x * fwInput + right.x * sdInput;
    let mvz = forward.z * fwInput + right.z * sdInput;

    // normalize if magnitude > 0 to avoid diagonal fast/slow depending on direction
    const mvLen = Math.sqrt(mvx*mvx + mvz*mvz);
    if (mvLen > 1e-6) {
        mvx = (mvx / mvLen) * speed;
        mvz = (mvz / mvLen) * speed;
    } else { mvx = 0; mvz = 0; }

    let px = gameState.px, py = gameState.py, pz = gameState.pz;

    // gravity / vertical velocity
    if (!gameState.fly) gameState.vy -= 0.011;
    const dyRaw = gameState.fly ? ((gameState.move.up ? speed : 0) - (gameState.move.down ? speed : 0)) : gameState.vy;

    // robust vertical movement: step through dy in small increments to find collision
    function applyVertical(px, py, pz, dy) {
        if (Math.abs(dy) < 1e-6) return { py: py, landed: false, hitHead: false };
        const steps = Math.max(1, Math.ceil(Math.abs(dy) / 0.05));
        for (let i = 1; i <= steps; i++) {
            const ny = py + dy * (i / steps);
            if (!collidesAt(px, ny, pz)) {
                // continue until last step
                if (i === steps) return { py: ny, landed: false, hitHead: false };
                continue;
            } else {
                // collision occurred at this intermediate step
                if (dy < 0) {
                    // falling — place player just above the block we collided with
                    // find the highest non-colliding y below ny
                    // place at floor(ny) + 1 + tiny epsilon
                    const landY = Math.floor(ny) + 1 + 0.001;
                    return { py: landY, landed: true, hitHead: false };
                } else {
                    // going up and hit ceiling — place just below the block
                    const stopY = Math.floor(ny) - 0.001;
                    return { py: stopY, landed: false, hitHead: true };
                }
            }
        }
        return { py: py + dy, landed: false, hitHead: false };
    }

    const vertRes = applyVertical(px, py, pz, dyRaw);
    py = vertRes.py;
    if (vertRes.landed) {
        if (!gameState.fly) gameState.vy = 0;
    }
    if (vertRes.hitHead) {
        gameState.vy = 0;
    }

    // helper: try horizontal move with step-up (ensure foot and head clearance)
    const tryStepMove = (targetX, targetY, targetZ, maxStep = 0.5) => {
        // if no collision at same Y, ok
        if (!collidesAt(targetX, targetY, targetZ)) return { success: true, nx: targetX, ny: targetY, nz: targetZ };
        // try to step up small amounts
        for (let step = 0.05; step <= maxStep; step += 0.05) {
            // foot at targetY + step, head at targetY + step + bodyHeight
            const footY = targetY + step;
            const headY = targetY + step + 1.64; // player height used in collidesAt
            if (!collidesAt(targetX, footY, targetZ) && !collidesAt(targetX, headY, targetZ)) {
                return { success: true, nx: targetX, ny: targetY + step, nz: targetZ };
            }
        }
        return { success: false };
    };

    // horizontal movement attempts (separately on x and z to allow sliding)
    if (Math.abs(mvx) > 1e-6) {
        const res = tryStepMove(px + mvx, py, pz);
        if (res.success) { px = res.nx; py = res.ny; pz = res.nz; }
    }
    if (Math.abs(mvz) > 1e-6) {
        const res = tryStepMove(px, py, pz + mvz);
        if (res.success) { px = res.nx; py = res.ny; pz = res.nz; }
        else {
            // try diagonal move as fallback
            const res2 = tryStepMove(px + mvx, py, pz + mvz);
            if (res2.success) { px = res2.nx; py = res2.ny; pz = res2.nz; }
        }
    }

    // clamp into world safely
    px = Math.max(1, Math.min(WORLD_W - 2, px));
    py = Math.max(2, Math.min(WORLD_H - 2, py));
    pz = Math.max(1, Math.min(WORLD_D - 2, pz));
    Object.assign(gameState, { px, py, pz });
}

// ===== Raycast & Input (liquids ignored) =====
// improved raycast: returns hit block coords plus a safe placement coordinate (adjacent cell by face)
function raycastBlock(maxDist = 6) {
    let ox = gameState.px, oy = gameState.py + 0.6, oz = gameState.pz;
    let lx = Math.cos(gameState.lookV) * Math.sin(gameState.lookH);
    let ly = Math.sin(gameState.lookV);
    let lz = Math.cos(gameState.lookV) * Math.cos(gameState.lookH);
    const step = 0.07;
    const steps = Math.ceil(maxDist / step);

    for (let i = 0; i < steps; i++) {
        let d = i * step;
        let x = ox + lx * d, y = oy + ly * d, z = oz + lz * d;
        let xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
        if (xi < 0 || xi >= WORLD_W || yi < 0 || yi >= WORLD_H || zi < 0 || zi >= WORLD_D) continue;
        let t = gameState.blocks[xi][yi][zi];
        if (t !== null) {
            if (t === BLOCK.water || t === BLOCK.lava) continue; // ignore liquids

            // 确定主导轴以计算被击中的面，然后选择相邻格作为放置位置
            const ax = Math.abs(lx), ay = Math.abs(ly), az = Math.abs(lz);
            let px = xi, py = yi, pz = zi;
            if (ax >= ay && ax >= az) {
                // x 主导
                px = xi - Math.sign(lx);
            } else if (ay >= ax && ay >= az) {
                // y 主导
                py = yi - Math.sign(ly);
            } else {
                // z 主导
                pz = zi - Math.sign(lz);
            }

            // 保证在世界范围内
            px = clamp(px, 0, WORLD_W - 1);
            py = clamp(py, 0, WORLD_H - 1);
            pz = clamp(pz, 0, WORLD_D - 1);

            return { x: xi, y: yi, z: zi, px, py, pz };
        }
    }
    return null;
}

function onMousedown(e) {
    if (!gameState.pointerLocked) return;
    const hit = raycastBlock();
    if (!hit) return;
    if (e.button == 0) {
        // left click: dig
        if (gameState.blocks[hit.x][hit.y][hit.z] !== BLOCK.bedrock) {
            gameState.blocks[hit.x][hit.y][hit.z] = null;
            removeBlockMesh(hit.x, hit.y, hit.z);
            // update nearby because occlusion might change
            renderVisibleBlocks();
        }
    }
    if (e.button == 2) {
        // right click: place into previous empty spot
        let { px, py, pz } = hit;
        if (px < 0 || px >= WORLD_W || py < 0 || py >= WORLD_H || pz < 0 || pz >= WORLD_D) return;
        // relax distance checks slightly but still prevent placing inside player
        if (Math.abs(px + 0.5 - gameState.px) < 0.6 && Math.abs(py + 0.5 - gameState.py) < 1.1 && Math.abs(pz + 0.5 - gameState.pz) < 0.6) {
            return;
        }
        if (gameState.blocks[px][py][pz] == null) {
            let id = gameState.hotbar[gameState.selectedSlot];
            gameState.blocks[px][py][pz] = id;
            // update nearby because occlusion might change
            renderVisibleBlocks();
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
            else if (isOnGround(gameState.px, gameState.py, gameState.pz)) gameState.vy = 0.32;
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
