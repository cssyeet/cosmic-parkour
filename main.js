import * as THREE from 'three';
import { World } from './world.js';
import { PlayerController } from './player.js';
import { UIManager } from './ui.js';
import { setupPostProcessing } from './effects.js';
import { MapDesigner } from './mapDesigner.js';

// Game class
class Game {
    constructor() {
        console.log('Game constructor called');
        this.init();
    }

    init() {
        console.log('Game init called');
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue background

        // Create camera
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 4, 0); // Start at player height
        this.camera.lookAt(0, 4, 10); // Look forward

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        document.getElementById('game-container').appendChild(this.renderer.domElement);

        // Add lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0); // Brighter ambient light
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 3.0);
        directionalLight.position.set(5, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        this.scene.add(directionalLight);

        // Add hemisphere light for better ambient lighting
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 2.0);
        this.scene.add(hemisphereLight);

        // Add debug objects
        const debugCube = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial({ color: 0xff0000 })
        );
        debugCube.position.set(0, 4, 5);
        this.scene.add(debugCube);

        const debugSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 32, 32),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        debugSphere.position.set(2, 4, 5);
        this.scene.add(debugSphere);

        // Initialize game components
        console.log('Initializing game components');
        this.world = new World(this.scene);
        this.player = new PlayerController(this.camera, this.scene, this.world);
        this.ui = new UIManager(this);
        this.mapDesigner = new MapDesigner(this.scene, this.camera, this.renderer);
        
        // Set initial player position based on first platform
        if (this.world.platforms.length > 0) {
            const firstPlatform = this.world.platforms[0];
            const spawnPos = new THREE.Vector3(
                firstPlatform.position.x,
                firstPlatform.position.y + 2,
                firstPlatform.position.z
            );
            this.player.position.copy(spawnPos);
            this.player.setRespawnPoint(spawnPos.clone());
        }

        // Temporarily disable post-processing
        this.postProcessing = null;

        // Game state
        this.isRunning = false;
        this.isPaused = false;
        this.startTime = 0;
        this.platformsPassed = 0;
        this.lastTime = 0;
        this.currentLevel = 1;

        // Debug: Log number of platforms
        console.log("Number of platforms in scene:", this.world.platforms.length);
        console.log("Camera position:", this.camera.position);
        console.log("Camera rotation:", this.camera.rotation);
        console.log("Scene background color:", this.scene.background);

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());

        // Start animation loop
        this.animate();
    }

    startGame() {
        console.log('Game started');
        this.isRunning = true;
        this.isPaused = false;
        this.startTime = performance.now();
        this.platformsPassed = 0;
        this.currentLevel = 1;
        this.world.generate();
        this.ui.updatePlatformCounter(0);
        
        // Position player above first platform
        if (this.world.platforms.length > 0) {
            const firstPlatform = this.world.platforms[0];
            this.player.position.set(
                firstPlatform.position.x,
                firstPlatform.position.y + 2,
                firstPlatform.position.z
            );
            this.player.velocity.set(0, 0, 0);
        }
    }

    pauseGame() {
        if (this.isRunning) {
            this.isPaused = true;
            this.ui.showPauseScreen();
        }
    }

    resumeGame() {
        if (this.isPaused) {
            this.isPaused = false;
            this.startTime = performance.now() - (this.startTime - performance.now());
        }
    }

    restartGame() {
        this.startGame();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate(currentTime = 0) {
        requestAnimationFrame((time) => this.animate(time));

        if (this.isRunning && !this.isPaused) {
            // Calculate delta time
            const deltaTime = (currentTime - this.lastTime) / 1000;
            this.lastTime = currentTime;

            // Update game state
            this.player.update(deltaTime);
            this.world.update(deltaTime);
            this.mapDesigner.update();
            
            // Update UI
            this.ui.updateTimer((currentTime - this.startTime) / 1000);
            this.ui.updateStaminaBar(1.0);
            
            // Debug: Log camera position every second
            if (Math.floor(currentTime / 1000) > Math.floor(this.lastTime / 1000)) {
                console.log("Camera position:", this.camera.position);
                console.log("Camera rotation:", this.camera.rotation);
            }
            
            // Render scene directly
            this.renderer.render(this.scene, this.camera);
        } else {
            // Render scene when paused
            this.renderer.render(this.scene, this.camera);
        }
    }
}

// Create the game instance
console.log('Creating game instance');
const game = new Game();

// Debug: Log key events
document.addEventListener('keydown', (e) => { console.log('keydown', e.code); });
document.addEventListener('keyup', (e) => { console.log('keyup', e.code); });
