import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; 
controls.dampingFactor = 0.05;

// --- BOARD GROUP SETUP ---
const boardGroup = new THREE.Group();
scene.add(boardGroup); // Sitting on XZ plane by default (Y is up)

// Board Configuration
const gridArea = 10; 
const borderSize = 0.8; 
const boardSize = gridArea + borderSize * 2;
const gridLines = 19;
const divisions = gridLines - 1;
const boardColor = 0xdbb06d;
const gridColor = 0x4d3e26;

// --- CREATE TOP TEXTURE ---
const topCanvas = document.createElement('canvas');
topCanvas.width = 1024; topCanvas.height = 1024;
const topCtx = topCanvas.getContext('2d');
topCtx.fillStyle = '#dbb06d'; topCtx.fillRect(0, 0, 1024, 1024);
const padding = (borderSize / boardSize) * 1024;
const cellSize = (1024 - 2 * padding) / divisions;
topCtx.strokeStyle = '#4d3e26'; topCtx.lineWidth = 3;
for (let i = 0; i < gridLines; i++) {
  const pos = padding + i * cellSize;
  topCtx.beginPath(); topCtx.moveTo(pos, padding); topCtx.lineTo(pos, 1024 - padding); topCtx.stroke();
  topCtx.beginPath(); topCtx.moveTo(padding, pos); topCtx.lineTo(1024 - padding, pos); topCtx.stroke();
}
topCtx.fillStyle = '#362c1b';
[3, 9, 15].forEach(x => [3, 9, 15].forEach(y => {
  topCtx.beginPath(); topCtx.arc(padding + x * cellSize, padding + y * cellSize, 10, 0, Math.PI * 2); topCtx.fill();
}));
topCtx.fillStyle = '#4d3e26'; topCtx.font = 'bold 35px "Times New Roman", serif';
topCtx.textAlign = 'center'; topCtx.textBaseline = 'middle';
const letters = "ABCDEFGHJKLMNOPQRST".split(""); 
for (let i = 0; i < gridLines; i++) {
  const pos = padding + i * cellSize;
  topCtx.fillText(letters[i], pos, padding / 2);
  topCtx.fillText(letters[i], pos, 1024 - padding / 2);
  topCtx.fillText(19 - i, padding / 2, pos);
  topCtx.fillText(19 - i, 1024 - padding / 2, pos);
}
const topTexture = new THREE.CanvasTexture(topCanvas);

// --- CREATE BACK TEXTURE ---
const backCanvas = document.createElement('canvas');
backCanvas.width = 512; backCanvas.height = 512;
const backCtx = backCanvas.getContext('2d');
backCtx.fillStyle = '#dbb06d'; backCtx.fillRect(0, 0, 512, 512);
backCtx.fillStyle = '#4d3e26'; backCtx.font = 'bold 40px "Times New Roman", serif';
backCtx.textAlign = 'center'; backCtx.textBaseline = 'middle';
backCtx.fillText('online-go.com', 256, 256);
const backTexture = new THREE.CanvasTexture(backCanvas);

// --- BOARD MESH ---
const geometry = new THREE.BoxGeometry(boardSize, 1, boardSize);
const boardMaterials = [
  new THREE.MeshStandardMaterial({ color: boardColor }), // +X
  new THREE.MeshStandardMaterial({ color: boardColor }), // -X
  new THREE.MeshStandardMaterial({ map: topTexture }),    // +Y (Top Face)
  new THREE.MeshStandardMaterial({ map: backTexture }),   // -Y (Bottom Face)
  new THREE.MeshStandardMaterial({ color: boardColor }), // +Z
  new THREE.MeshStandardMaterial({ color: boardColor })  // -Z
];

const cube = new THREE.Mesh(geometry, boardMaterials);
boardGroup.add(cube);

// --- LIGHTING ---
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 5);
scene.add(directionalLight);

camera.position.set(0, 12, 10);
camera.lookAt(0, 0, 0);

// --- INTERACTION & STATE ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clickBuffer = 0.25;

let moveNumber = 0;
let nextStoneColor = 'black';
const placedStones = new Map();
let lastStoneRuby = null;

let targetRotationY = 0;
let isAnimatingRotation = false;

const stoneGeometry = new THREE.SphereGeometry(0.24, 32, 32);
stoneGeometry.scale(1, 0.5, 1);
const blackMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
const whiteMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2 });
const rubyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000, emissive: 0xff0000, emissiveIntensity: 0.5, metalness: 0.9, transparent: true, opacity: 0.8 });

const hoverSquare = new THREE.Mesh(
    new THREE.PlaneGeometry(gridArea / divisions, gridArea / divisions),
    new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 })
);
hoverSquare.rotation.x = -Math.PI / 2;
hoverSquare.visible = false;
boardGroup.add(hoverSquare);

const statusText = document.getElementById('status-text');
const rotateBtn = document.getElementById('rotate-btn');
const resetBtn = document.getElementById('reset-btn');

// --- ROTATE BUTTON LOGIC ---
rotateBtn.addEventListener('click', () => {
  targetRotationY += Math.PI / 2;
  isAnimatingRotation = true;
});

// --- RESET VIEW LOGIC ---
resetBtn.addEventListener('click', () => {
  // Reset board rotation
  targetRotationY = 0;
  boardGroup.rotation.y = 0;
  isAnimatingRotation = false;

  // Reset camera position and controls target
  camera.position.set(0, 12, 10);
  controls.target.set(0, 0, 0);
  controls.update();
});

window.addEventListener('mousemove', (event) => {
    if (isAnimatingRotation) {
        hoverSquare.visible = false;
        return;
    }

    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(cube);

    if (intersects.length > 0) {
        const hit = intersects[0];
        if (hit.faceIndex === 4 || hit.faceIndex === 5) {
            const localPoint = cube.worldToLocal(hit.point.clone());
            const step = gridArea / divisions;
            const gridX = (localPoint.x + gridArea / 2) / step;
            const gridZ = (localPoint.z + gridArea / 2) / step;
            const nearestX = Math.round(gridX);
            const nearestZ = Math.round(gridZ);
            
            if (nearestX >= 0 && nearestX < gridLines && nearestZ >= 0 && nearestZ < gridLines) {
                if (Math.abs(gridX - nearestX) * step < clickBuffer && Math.abs(gridZ - nearestZ) * step < clickBuffer) {
                    const key = `${nearestX},${nearestZ}`;
                    if (!placedStones.has(key)) {
                        const posX = (nearestX * step) - (gridArea / 2);
                        const posZ = (nearestZ * step) - (gridArea / 2);
                        hoverSquare.position.set(posX, 0.51, posZ);
                        hoverSquare.visible = true;
                        return;
                    }
                }
            }
        }
    }

    hoverSquare.visible = false;
});

window.addEventListener('click', (event) => {
  if (event.target === rotateBtn || event.target === resetBtn) return;
  if (isAnimatingRotation) return; // Prevent clicking while board is spinning

  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(cube);

  if (intersects.length > 0) {
    const hit = intersects[0];
    if (hit.faceIndex === 4 || hit.faceIndex === 5) {
      const localPoint = cube.worldToLocal(hit.point.clone());
      const step = gridArea / divisions;
      const gridX = (localPoint.x + gridArea / 2) / step;
      const gridZ = (localPoint.z + gridArea / 2) / step;
      const nearestX = Math.round(gridX);
      const nearestZ = Math.round(gridZ);
      
      if (nearestX >= 0 && nearestX < gridLines && nearestZ >= 0 && nearestZ < gridLines) {
        if (Math.abs(gridX - nearestX) * step < clickBuffer && Math.abs(gridZ - nearestZ) * step < clickBuffer) {
          const key = `${nearestX},${nearestZ}`;
          if (!placedStones.has(key)) {
            hoverSquare.visible = false;
            moveNumber++;
            const stone = new THREE.Mesh(stoneGeometry, nextStoneColor === 'black' ? blackMaterial : whiteMaterial);
            const posX = (nearestX * step) - (gridArea / 2);
            const posZ = (nearestZ * step) - (gridArea / 2);
            
            stone.position.set(posX, 0.6, posZ);
            boardGroup.add(stone);
            placedStones.set(key, stone);

            const textCanvas = document.createElement('canvas');
            const size = 64;
            textCanvas.width = size;
            textCanvas.height = size;
            const context = textCanvas.getContext('2d');
            context.fillStyle = nextStoneColor === 'black' ? 'white' : 'black';
            context.font = 'bold 40px Arial';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(moveNumber.toString(), size/2, size/2 + 2);
            const numberTexture = new THREE.CanvasTexture(textCanvas);
            const numberMaterial = new THREE.MeshBasicMaterial({ map: numberTexture, transparent: true });
            const numberGeometry = new THREE.PlaneGeometry(0.4, 0.4);
            const numberMesh = new THREE.Mesh(numberGeometry, numberMaterial);
            numberMesh.position.set(posX, 0.725, posZ);
            numberMesh.rotation.x = -Math.PI / 2;
            boardGroup.add(numberMesh);

            if (!lastStoneRuby) {
              const coneGeometry = new THREE.ConeGeometry(0.12, 0.25, 4);
              coneGeometry.rotateX(Math.PI);
              lastStoneRuby = new THREE.Mesh(coneGeometry, rubyMaterial);
              boardGroup.add(lastStoneRuby);
            }
            lastStoneRuby.position.set(posX, 0.88, posZ);

            const notation = `${letters[nearestX]}${19 - nearestZ}`;
            statusText.innerText = `Last move: ${notation} (${nextStoneColor.charAt(0).toUpperCase() + nextStoneColor.slice(1)})`;
            nextStoneColor = nextStoneColor === 'black' ? 'white' : 'black';
          }
        }
      }
    }
  }
});

let time = 0;
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  time += 0.02;

  // --- SMOOTH ROTATION ANIMATION ---
  if (isAnimatingRotation) {
    const diff = targetRotationY - boardGroup.rotation.y;
    if (Math.abs(diff) > 0.01) {
      boardGroup.rotation.y += diff * 0.1; // Smoothly interpolate
    } else {
      boardGroup.rotation.y = targetRotationY;
      isAnimatingRotation = false;
    }
  }

  // --- RUBY ANIMATION ---
  if (lastStoneRuby) {
    lastStoneRuby.rotation.y += 0.03;
    lastStoneRuby.position.y = 0.88 + Math.sin(time * 4) * 0.04;
  }
  renderer.render(scene, camera);
}
animate();
