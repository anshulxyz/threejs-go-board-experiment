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

// Add a simple Box (Cube)
const geometry = new THREE.BoxGeometry(10, 1, 10);
const material = new THREE.MeshNormalMaterial(); // Great for debugging!
const cube = new THREE.Mesh(geometry, material);
scene.add(cube);

camera.position.z = 5;

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
  const x = Math.sin(time) * (window.innerWidth / 3);
  const y = Math.sin(time * 2) * (window.innerHeight / 4);
  
  // Center the text and apply the offset
  const centerX = window.innerWidth / 2;
  const centerY = window.innerHeight / 2;
  
  butterflyText.style.transform = `translate(${centerX + x}px, ${centerY + y}px) translate(-50%, -50%) rotate(${Math.cos(time) * 20}deg)`;

  renderer.render(scene, camera);
}

animate();
