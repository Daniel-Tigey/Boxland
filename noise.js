const { createApp, ref } = Vue;

// ================== 方块定义 ===================
// 草、土、石、树（木/叶）、水、基岩
const BLOCK = { grass:0, dirt:1, stone:2, log:3, leaf:4, water:5,bedrock:6 };
const COLORS = [
    0x4CAF50, // grass
    0x8B5A2B, // dirt
    0x888888, // stone
    0x8B4513, // log
    0x19cc19, // leaf
    0x4091F7, // water
    0x000000, // bedrock
];

// ================== 世界生成 ====================
const WORLD_W = 40, WORLD_D = 40, WORLD_H = 20;
const BLOCK_SIZE = 1;
const noise = new ValueNoise(2109);

function createWorld() {
    // blocks[x][y][z] 三维数组
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
            const e = noise.octaved(x/20, z/20, 4, 0.5, 2.2);
            let h = Math.floor(5 + e * 10); // 地形高度
            // 基岩
            blocks[x][0][z] = BLOCK.stone;
            // 土、石
            for(let y=1; y<=h; ++y){
                if(y<4) blocks[x][y][z]=BLOCK.stone;
                else if(y<h) blocks[x][y][z]=BLOCK.dirt;
                else blocks[x][y][z]=BLOCK.grass;
            }
            // 水面
            if(h<9) for(let y=h+1; y<10;++y) blocks[x][y][z]=BLOCK.water;
        }
    }
    // 树
    for(let i=0;i<20;++i){
        let x = Math.floor(Math.random()*(WORLD_W-4)+2), z = Math.floor(Math.random()*(WORLD_D-4)+2);
        // 找地表
        let y;
        for(y=WORLD_H-2;y>2;--y) {
            if([BLOCK.grass,BLOCK.dirt].includes(blocks[x][y][z]))break;
        }
        if(y<4) continue;
        // 树干
        for(let h=1;h<=3;++h){
            blocks[x][y+h][z]=BLOCK.log;
        }
        // 树叶
        for(let lx=-2;lx<=2;++lx){
          for(let ly=2;ly<=5;++ly){
            for(let lz=-2;lz<=2;++lz){
              if(Math.abs(lx)+Math.abs(lz)>3||(lx==0&&ly==2&&lz==0)) continue;
              let tx = x+lx, ty = y+ly, tz = z+lz;
              if(tx<0||ty>=WORLD_H||tz<0||tx>=WORLD_W||tz>=WORLD_D) continue;
              if(!blocks[tx][ty][tz]) blocks[tx][ty][tz]=BLOCK.leaf;
            }
          }
        }
    }
    return blocks;
}

// ================== 游戏主对象 ===================
const gameState = {
    pointerLocked: false,
    showInfo: true,
    // 玩家设置与状态
    px: WORLD_W/2, py: 14, pz: WORLD_D/2,
    vx: 0, vy: 0, vz: 0,
    lookH: Math.PI/2, lookV: 0,
    fly: false,
    move: {w:0, a:0, s:0, d:0, up:0, down:0},
    speed: 0.17,
    size: 0.6,
    blocks: createWorld(),
};

window.gameState = gameState;

// ================== ThreeJS 场景画面 ====================
let camera, scene, renderer, blockMeshes;
function setupThree() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x81D4FA);
    camera = new THREE.PerspectiveCamera(82, window.innerWidth/window.innerHeight, 0.1, 1000);
    renderer = new THREE.WebGLRenderer({antialias:true});
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.domElement.style.zIndex=5;
    document.body.appendChild(renderer.domElement);
    // 灯光
    const ambient = new THREE.AmbientLight(0xffffff, 0.72); scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffee, 1.1); dir.position.set(60,80,5); scene.add(dir);
    // block mesh
    blockMeshes = new Map();
    for(let x=0;x<WORLD_W;++x)
     for(let y=0;y<WORLD_H;++y)
      for(let z=0;z<WORLD_D;++z){
       let id = gameState.blocks[x][y][z];
       if(id!==null) addBlockMesh(x,y,z,id,false);
      }
}

// Mesh 添加与删除
function addBlockMesh(x, y, z, id, cast=true) {
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

// 窗口大小自适应
window.addEventListener('resize',()=>{
    if(!renderer||!camera)return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
});

// ================== 玩家位置/视角控制 ====================
function updateCamera() {
    camera.position.set(gameState.px, gameState.py, gameState.pz);
    // 目光线（前方向）
    let lx = Math.cos(gameState.lookV) * Math.cos(gameState.lookH);
    let ly = Math.sin(gameState.lookV);
    let lz = Math.cos(gameState.lookV) * Math.sin(gameState.lookH);
    camera.lookAt(gameState.px+lx, gameState.py+ly, gameState.pz+lz);
}

// 碰撞/世界判定
function isSolid(x, y, z) {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    if(x<0||x>=WORLD_W||y<0||y>=WORLD_H||z<0||z>=WORLD_D) return true;
    let val = gameState.blocks[x][y][z];
    // 水可穿过
    return val!==null && val!==BLOCK.water && val!==BLOCK.leaf;
}

// 胶囊体碰撞检测
function canStand(nx, ny, nz) {
    let h = 1.64, r = 0.28;
    for(let y=ny-0.8; y<ny+h; y+=0.38)
    for(let dx=-r; dx<=r; dx+=0.35)
    for(let dz=-r; dz<=r; dz+=0.35) {
        if(isSolid(nx+dx, y, nz+dz))return false;
    }
    return true;
}

// ================== 玩家运动物理主循环 ====================
function stepPlayer() {
    // 方向
    let ang = gameState.lookH, speed = gameState.speed;
    let dx = 0, dz = 0;
    if(gameState.move.w) dz -= Math.cos(ang)*speed, dx -= Math.sin(ang)*speed;
    if(gameState.move.s) dz += Math.cos(ang)*speed, dx += Math.sin(ang)*speed;
    if(gameState.move.a) dz -= Math.cos(ang+Math.PI/2)*speed, dx -= Math.sin(ang+Math.PI/2)*speed;
    if(gameState.move.d) dz -= Math.cos(ang-Math.PI/2)*speed, dx -= Math.sin(ang-Math.PI/2)*speed;
    let px = gameState.px, py = gameState.py, pz = gameState.pz;

    // Y移动: 空格/shift
    let dy = 0;
    if(gameState.fly){
      if(gameState.move.up) dy += speed;
      if(gameState.move.down) dy -= speed;
    } else {
      gameState.vy -= 0.011; // 重力
      dy = gameState.vy;
    }

    // 按顺序x/y/z分步尝试
    let tryMove = (nx, ny, nz) => canStand(nx, ny, nz);
    // x
    if(tryMove(px+dx, py, pz)) px += dx;
    // z
    if(tryMove(px, py, pz+dz)) pz += dz;
    // y
    if(tryMove(px, py+dy, pz)) { py += dy; }
    else {
      if(dy<0) { py = Math.floor(py)+0.01; gameState.vy=0; } // 落地
      if(dy>0) gameState.vy=0;
    }
    // 落水反弹
    if (gameState.blocks[Math.floor(px)][Math.floor(py)][Math.floor(pz)] === BLOCK.water) {
      gameState.vy = 0.04;
    }
    // 越界保护
    px = Math.max(1, Math.min(WORLD_W-2, px));
    py = Math.max(2, Math.min(WORLD_H-2, py));
    pz = Math.max(1, Math.min(WORLD_D-2, pz));
    Object.assign(gameState, {px,py,pz});
}

// ================== 游戏循环渲染 ====================
function animate() {
    requestAnimationFrame(animate);
    stepPlayer();
    updateCamera();
    renderer && renderer.render(scene, camera);
}

// ================== 方块“挖掘/放置”交互 ====================
// 射线查找
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
            // 为防抖，返回面内点
            let bx = x-lx*0.08, by = y-ly*0.08, bz = z-lz*0.08;
            return {x:xi,y:yi,z:zi, px:Math.floor(bx),py:Math.floor(by),pz:Math.floor(bz)};
        }
    }
    return null;
}

// 鼠标事件
function onMousedown(e) {
    if (!gameState.pointerLocked) return;
    const hit = raycastBlock();
    if (!hit) return;
    if(e.button==0) {
        // 左键挖掘（不挖基岩）
        if(gameState.blocks[hit.x][hit.y][hit.z]!==BLOCK.stone || hit.y>1){
            gameState.blocks[hit.x][hit.y][hit.z]=null;
            removeBlockMesh(hit.x,hit.y,hit.z);
        }
    }
    if(e.button==2) {
        // 右键放置草方块（不放入玩家碰撞体）
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

// ================== 鼠标视角锁定/输入处理 ====================
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
        gameState.lookH -= e.movementX*0.002;
        gameState.lookV -= e.movementY*0.002;
        let V=Math.PI/2*0.99;
        if(gameState.lookV<-V)gameState.lookV=-V;
        if(gameState.lookV>V)gameState.lookV=V;
    });
    // 按键
    document.addEventListener('keydown',e=>{
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
        if(e.code==='Escape'){
            document.exitPointerLock && document.exitPointerLock();
        }
    });
    document.addEventListener('keyup',e=>{
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

// ================== Vue界面显示、行为 ====================
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
