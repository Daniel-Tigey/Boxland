// ----------- 参数配置 ------------
const WORLD_W = 32, WORLD_D = 32, WORLD_H = 16;
const BLOCK_SIZE = 1;

// 方块颜色（纯色材质）
const COLORS = [
    0x8BDB81, // 草地
    0x63C74D, // 绿
    0xC2B280, // 沙土
    0xB97A57, // 棕土
    0x777,    // 石头
    0xFFF     // 白色雪
];

// ----------- 噪声地形 ------------
const noise = new ValueNoise(2026);
// blocks[x][y][z] = 0/1/...
let blocks = [];
for (let x = 0; x < WORLD_W; x++) {
blocks[x] = [];
for (let z = 0; z < WORLD_D; z++) {
    blocks[x][z] = [];
    const height = Math.floor(noise.octaved(x/18, z/18, 5, 0.5, 2) * (WORLD_H - 3) + 4);
    for (let y = 0; y < WORLD_H; y++) {
        if (y > height) { blocks[x][z][y] = null; continue; }
        let id = 3; // 默认泥土
        if (y === height) id = (height > WORLD_H - 2)?5:0;
        else if (y > height-1) id = 1;
        else if (y < 2) id = 2; // 底部沙
        else if (y < height-2) id = 4;
        blocks[x][z][y] = id;
    }
}
}

// ----------- ThreeJS 基本场景 --------
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const ambient = new THREE.AmbientLight(0xcccccc, 0.75);
scene.add(ambient);

const dir = new THREE.DirectionalLight(0xffffff, 0.9);
dir.position.set(40,80,20);
scene.add(dir);

// ----------- 地形Mesh生成 -------------
const blockMeshes = new Map(); // key: `${x}_${y}_${z}`
function addBlockMesh(x, y, z, id, update=true) {
    const color = COLORS[id];
    const geometry = new THREE.BoxGeometry(BLOCK_SIZE,BLOCK_SIZE,BLOCK_SIZE);
    const material = new THREE.MeshLambertMaterial({color});
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x*BLOCK_SIZE, y*BLOCK_SIZE, z*BLOCK_SIZE);
    mesh.userData = {x, y, z, id};
    scene.add(mesh);
    blockMeshes.set(`${x}_${y}_${z}`, mesh);
    if (update) mesh.castShadow = false;
}
function removeBlockMesh(x, y, z) {
    let key = `${x}_${y}_${z}`;
    let mesh = blockMeshes.get(key);
    if (mesh) {
        scene.remove(mesh);
        blockMeshes.delete(key);
    }
}

// 初始生成
for (let x = 0; x < WORLD_W; x++)
    for (let z = 0; z < WORLD_D; z++)
        for (let y = 0; y < WORLD_H; y++)
            if (blocks[x][z][y] !== null) addBlockMesh(x, y, z, blocks[x][z][y], false);

// ----------- 玩家 (自由视角) -------------
let px = WORLD_W/2, py = WORLD_H + 2, pz = WORLD_D/2, lookH = 0, lookV = 0;

function updateCamera() {
    // 摄像机在玩家身上
    camera.position.set(px, py, pz);
    // 计算指向
    const lx = Math.cos(lookV) * Math.sin(lookH);
    const ly = Math.sin(lookV);
    const lz = Math.cos(lookV) * Math.cos(lookH);
    camera.lookAt(px + lx, py + ly, pz + lz);
}
updateCamera();

// ----------- 控制 WASD/鼠标转向/按键 -------------
const move = {w:0, a:0, s:0, d:0, up:0, down:0};
document.addEventListener('keydown', e=>{
    if(e.code==='KeyW')move.w=1;
    if(e.code==='KeyS')move.s=1;
    if(e.code==='KeyA')move.a=1;
    if(e.code==='KeyD')move.d=1;
    if(e.code==='Space')move.up=1;
    if(e.code==='ShiftLeft')move.down=1;
});
document.addEventListener('keyup', e=>{
    if(e.code==='KeyW')move.w=0;
    if(e.code==='KeyS')move.s=0;
    if(e.code==='KeyA')move.a=0;
    if(e.code==='KeyD')move.d=0;
    if(e.code==='Space')move.up=0;
    if(e.code==='ShiftLeft')move.down=0;
});
let pointerLocked=false;
renderer.domElement.addEventListener('click',()=>{
    renderer.domElement.requestPointerLock();
});
document.addEventListener('pointerlockchange',()=>{
    pointerLocked=document.pointerLockElement===renderer.domElement;
});
document.addEventListener('mousemove',e=>{
    if(!pointerLocked)return;
    lookH -= e.movementX * 0.002;
    lookV -= e.movementY * 0.002;
    lookV = Math.max(-Math.PI/2, Math.min(Math.PI/2, lookV));
});

// ----------- 碰撞体 & 地面 -------------
function checkBlock(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if(x<0||x>=WORLD_W||y<0||y>=WORLD_H||z<0||z>=WORLD_D) return true;
    return blocks[x][z][y] !== null;
}
function tryMove(dx, dy, dz) {
    let npx = px+dx, npy=py+dy, npz=pz+dz;
    // 碰撞检测 (简单，检测小人球心)
    if(checkBlock(npx, Math.round(npy), npz)) return false;
    px=npx; py=npy; pz=npz;
    return true;
}

// ----------- 主循环/移动 -------------
function animate() {
    requestAnimationFrame(animate);
    // 移动
    let dir = 0, speed = 0.15;
    let dx=0, dz=0, dy=0;
    if(move.w)dz -= Math.cos(lookH)*speed, dx -= Math.sin(lookH)*speed;
    if(move.s)dz += Math.cos(lookH)*speed, dx += Math.sin(lookH)*speed;
    if(move.a)dz -= Math.cos(lookH+Math.PI/2)*speed, dx -= Math.sin(lookH+Math.PI/2)*speed;
    if(move.d)dz -= Math.cos(lookH-Math.PI/2)*speed, dx -= Math.sin(lookH-Math.PI/2)*speed;
    if(move.up) dy += speed;
    if(move.down) dy -= speed;
    tryMove(dx, dy, dz);
    updateCamera();
    renderer.render(scene, camera);
}
animate();

// ----------- 方块放置 & 挖掘 -------------
// 射线检测
function raycastBlock(maxDist = 6) {
    let ox = px, oy = py, oz = pz;
    let lx = Math.cos(lookV)*Math.sin(lookH);
    let ly = Math.sin(lookV);
    let lz = Math.cos(lookV)*Math.cos(lookH);
    for(let i=0; i<maxDist*10; i++) {
        let d = i*0.1;
        let x = ox + lx * d;
        let y = oy + ly * d;
        let z = oz + lz * d;
        let xi = Math.floor(x), yi=Math.floor(y), zi=Math.floor(z);
        if (xi<0||xi>=WORLD_W||yi<0||yi>=WORLD_H||zi<0||zi>=WORLD_D) continue;
        if (blocks[xi][zi][yi]!==null)
            return {x:xi,y:yi,z:zi, // 选中方块
                nx:Math.floor(x-lx*0.1), ny:Math.floor(y-ly*0.1), nz:Math.floor(z-lz*0.1)
            };
    }
    return null;
}

// 左键挖掘/右键放置
window.addEventListener('mousedown', e=>{
    if(!pointerLocked)return;
    if(e.button===0||e.button===2){
        const hit = raycastBlock();
        if(!hit) return;
        if(e.button===0){
            // 挖掉
            blocks[hit.x][hit.z][hit.y] = null;
            removeBlockMesh(hit.x, hit.y, hit.z);
        } else if(e.button===2){
            // 放置（朝向空位）
            let tx = hit.x, ty = hit.y, tz = hit.z;
            // 朝外一格
            let dx = tx - px, dy = ty - py, dz = tz - pz;
            let side = [
                Math.round(tx + dx/(Math.abs(dx)||1)),
                Math.round(ty + dy/(Math.abs(dy)||1)),
                Math.round(tz + dz/(Math.abs(dz)||1))
            ];
            let [sx, sy, sz] = side;
            if (
                sx<0||sx>=WORLD_W||sy<0||sy>=WORLD_H||sz<0||sz>=WORLD_D
                || blocks[sx][sz][sy]!==null
                || (Math.abs(sx-px)<0.5&&Math.abs(sy-py)<1.5&&Math.abs(sz-pz)<0.5)
            ) return;
            blocks[sx][sz][sy]=0;//草地方块
            addBlockMesh(sx, sy, sz, 0);
        }
    }
});
window.addEventListener('contextmenu',e=>e.preventDefault());
