import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });

renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Setup OrbitControls for interactivity
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Adds a smooth "weight" to the rotation
controls.dampingFactor = 0.05;

// Add a simple Box (Go Board)
const gridArea = 10; // The 19x19 grid will be exactly 10x10
const borderSize = 0.5; // About 1rem (approx 0.5 units in this world scale)
const boardSize = gridArea + borderSize * 2; // Total board size including border

const gridLines = 19;
const divisions = gridLines - 1; // 18 divisions create 19 lines

const geometry = new THREE.BoxGeometry(boardSize, 1, boardSize);
const material = new THREE.MeshStandardMaterial({ color: 0xdbb06d }); // Wood-like color for Go board
const cube = new THREE.Mesh(geometry, material);

// Rotate the cube so the flat surface faces the camera
cube.rotation.x = Math.PI / 2;
scene.add(cube);

// Add the Grid
const boardColor = 0xdbb06d;
const gridColor = 0x4d3e26; // Much darker to compensate for lighting
const grid = new THREE.GridHelper(gridArea, divisions, gridColor, gridColor);
grid.rotation.x = Math.PI / 2;
grid.position.z = 0.51; // Slightly in front of the surface to avoid flickering
scene.add(grid);

// Add lighting so the board is visible
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 10);
scene.add(directionalLight);

// Add Hoshi points (Star points)
const hoshiColor = 0x362c1b; // Much darker for a more distinct, classic look
const hoshiGeometry = new THREE.CircleGeometry(0.1, 32);
const hoshiMaterial = new THREE.MeshBasicMaterial({ color: hoshiColor });

const hoshiPositions = [3, 9, 15];
const step = gridArea / divisions;

hoshiPositions.forEach(xIndex => {
  hoshiPositions.forEach(yIndex => {
    const hoshi = new THREE.Mesh(hoshiGeometry, hoshiMaterial);
    
    // Calculate position: (index * step) - (gridArea / 2)
    const posX = (xIndex * step) - (gridArea / 2);
    const posY = (yIndex * step) - (gridArea / 2);
    
    hoshi.position.set(posX, posY, 0.52); // Slightly in front of grid lines (0.51)
    scene.add(hoshi);
  });
});

camera.position.z = 12;

// Raycaster for interaction
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const clickBuffer = 0.25; // How close to an intersection you need to click

// Go Game State
let nextStoneColor = 'black';
const placedStones = new Map(); // Keep track of occupied intersections
let lastStoneRuby = null; // Marker for the last stone

// Stone Geometry & Materials
const stoneGeometry = new THREE.SphereGeometry(0.24, 32, 32);
stoneGeometry.scale(1, 1, 0.5); // Flatten the sphere along Z to make it a flat disc/biconvex shape

const blackMaterial = new THREE.MeshStandardMaterial({ 
  color: 0x111111, 
  roughness: 0.2, 
  metalness: 0.1 
});
const whiteMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xffffff, 
  roughness: 0.2, 
  metalness: 0.1 
});

// Ruby Geometry & Material (Inverted Pyramid)
const rubyGeometry = new THREE.ConeGeometry(0.12, 0.25, 4);
const rubyMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xff0000, 
  emissive: 0x660000,
  metalness: 0.9, 
  roughness: 0.1,
  transparent: true,
  opacity: 0.9
});

// Ruby Light for flicker and reflection
const rubyLight = new THREE.PointLight(0xff0000, 1.5, 2);
rubyLight.decay = 2;

window.addEventListener('click', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObject(cube);

  if (intersects.length > 0) {
    const hit = intersects[0];
    
    if (hit.faceIndex === 4 || hit.faceIndex === 5) {
      const point = hit.point;
      
      const step = gridArea / divisions;
      const gridX = (point.x + gridArea / 2) / step;
      const gridY = (point.y + gridArea / 2) / step;
      
      const nearestX = Math.round(gridX);
      const nearestY = Math.round(gridY);
      
      if (nearestX >= 0 && nearestX < gridLines && nearestY >= 0 && nearestY < gridLines) {
        const distX = Math.abs(gridX - nearestX) * step;
        const distY = Math.abs(gridY - nearestY) * step;
        
        if (distX < clickBuffer && distY < clickBuffer) {
          const key = `${nearestX},${nearestY}`;
          
          // Check if stone already exists here
          if (!placedStones.has(key)) {
            // Place a new stone
            const stone = new THREE.Mesh(
              stoneGeometry, 
              nextStoneColor === 'black' ? blackMaterial : whiteMaterial
            );
            
            const posX = (nearestX * step) - (gridArea / 2);
            const posY = (nearestY * step) - (gridArea / 2);
            
            stone.position.set(posX, posY, 0.6); // Placed flat on the surface
            scene.add(stone);
            
            placedStones.set(key, stone);

            // Place or move the Ruby on top of the last stone
            if (!lastStoneRuby) {
              lastStoneRuby = new THREE.Mesh(rubyGeometry, rubyMaterial);
              lastStoneRuby.rotation.x = -Math.PI / 2; // Pointing "into" the board (inverted)
              scene.add(lastStoneRuby);
              
              // Add light as a child so it follows the ruby
              lastStoneRuby.add(rubyLight);
            }
            lastStoneRuby.position.set(posX, posY, 1.1); // Sit on top of the stone

            // Update UI/Notation
            const xCoord = String.fromCharCode(65 + (nearestX >= 8 ? nearestX + 1 : nearestX)); 
            const yCoord = nearestY + 1;
            const notation = `${xCoord}${yCoord}`;
            butterflyText.innerText = notation;
            butterflyText.style.color = nextStoneColor === 'black' ? '#ffffff' : '#000000';
            butterflyText.style.backgroundColor = nextStoneColor === 'black' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';
            butterflyText.style.padding = '0 10px';
            butterflyText.style.borderRadius = '5px';

            // Switch turn
            nextStoneColor = nextStoneColor === 'black' ? 'white' : 'black';
          }
        }
      }
    }
  }
});

// Butterfly text animation setup
const butterflyText = document.getElementById('butterfly-text');
let time = 0;

// Handle window resizing
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  
  // Update controls for damping to work
  controls.update();

  // Animate the butterfly text (Figure-eight / Lissajous curve)
  time += 0.02;

  // Animate the Ruby marker
  if (lastStoneRuby) {
    // Rotate slowly on its axis
    lastStoneRuby.rotation.y += 0.03;
    
    // Hover bounce effect (Up and down on Z axis)
    const bounceOffset = Math.sin(time * 4) * 0.08;
    lastStoneRuby.position.z = 1.1 + bounceOffset;

    // Flicker the light intensity
    rubyLight.intensity = 1.0 + Math.random() * 0.5 + Math.sin(time * 10) * 0.3;
  }

  const x = Math.sin(time) * (window.innerWidth / 3);
  const y = Math.sin(time * 2) * (window.innerHeight / 4);
  
  // Center the text and apply the offset
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  
  butterflyText.style.transform = `translate(${centerX + x}px, ${centerY + y}px) translate(-50%, -50%) rotate(${Math.cos(time) * 20}deg)`;

  renderer.render(scene, camera);
}

animate();
