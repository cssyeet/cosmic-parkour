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
        this.scene.background = new THREE.Color(0x0a0e1a); // Deep space background

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
            new THREE.MeshStandardMaterial({ color: 0x00f2fe, emissive: 0x00f2fe, emissiveIntensity: 0.7 })
        );
        debugCube.position.set(0, 4, 5);
        this.scene.add(debugCube);

        const debugSphere = new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 32, 32),
            new THREE.MeshStandardMaterial({ color: 0x7eeeff, emissive: 0x7eeeff, emissiveIntensity: 0.5 })
        );
        debugSphere.position.set(2, 4, 5);
        this.scene.add(debugSphere);

        // Initialize game state
        this.initGameState();

        // Initialize game components
        console.log('Initializing game components');
        this.world = new World(this.scene);
        this.player = new PlayerController(this.camera, this.scene, this.world);
        this.ui = new UIManager(this);
        this.mapDesigner = new MapDesigner(this.scene, this.camera, this.renderer);
        
        // Set initial player position based on first platform
        const spawnPlatform = this.world.platforms.get('0,0');
        if (spawnPlatform) {
            const spawnPos = new THREE.Vector3(
                spawnPlatform.position.x,
                spawnPlatform.position.y + 2,
                spawnPlatform.position.z
            );
            this.player.position.copy(spawnPos);
            this.player.setRespawnPoint(spawnPos.clone());
        }

        // Initialize post-processing
        this.postProcessing = setupPostProcessing(this.scene, this.camera, this.renderer);

        // Game state
        this.isRunning = false;
        this.isPaused = false;
        this.startTime = 0;
        this.platformsPassed = 0;
        this.lastTime = 0;
        this.currentLevel = 1;

        // Set up game events
        this.setupEvents();

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

    initGameState() {
        this.score = 0;
        this.coinsCollected = 0;
        this.currentCheckpoint = 0;
        this.difficultyLevel = 1;
        this.obstaclesPassed = 0;
        this.gameTime = 0;
        this.isGameOver = false;
        
        // Difficulty progression thresholds
        this.difficultyThresholds = [
            100, 300, 600, 1000, 1500 // Score thresholds
        ];
        
        // Add to your existing init()
        this.coins = new Set();
        this.obstacles = new Set();
        this.movingPlatforms = new Set();
    }

    startGame() {
        console.log('Game started');
        this.isRunning = true;
        this.isPaused = false;
        this.isGameOver = false;
        this.startTime = performance.now();
        this.platformsPassed = 0;
        this.gameTime = 0;
        this.score = 0;
        this.coinsCollected = 0;
        this.difficultyLevel = 1;
        
        // Clear and regenerate the world
        this.world.clear();
        this.world.generateInitial();
        
        // Update UI
        this.ui.updatePlatformCounter(0);
        this.ui.updateScore(0);
        this.ui.updateCoins(0);
        this.ui.updateTimer(0);
        this.ui.updateStaminaBar(1.0);
        
        // Position player above first platform
        const spawnPlatform = this.world.platforms.get('0,0');
        if (spawnPlatform) {
            this.player.position.set(
                spawnPlatform.position.x,
                spawnPlatform.position.y + 2,
                spawnPlatform.position.z
            );
            this.player.velocity.set(0, 0, 0);
            this.player.stamina = 1.0;
        }
    }

    updateGameState(deltaTime) {
        if (!this.isRunning || this.isPaused || this.isGameOver) return;
        
        this.gameTime += deltaTime;
        
        // Update difficulty based on score
        let newDifficulty = 1;
        for (let i = 0; i < this.difficultyThresholds.length; i++) {
            if (this.score >= this.difficultyThresholds[i]) {
                newDifficulty = i + 2; // Levels start at 1
            }
        }
        
        if (newDifficulty !== this.difficultyLevel) {
            this.difficultyLevel = newDifficulty;
            this.world.adjustDifficulty(this.difficultyLevel);
            console.log(`Difficulty increased to level ${this.difficultyLevel}`);
        }
        
        // Update UI
        this.ui.updateScore(this.score);
        this.ui.updateCoins(this.coinsCollected);
        this.ui.updateTimer(this.gameTime);
        this.ui.updateStaminaBar(this.player.stamina);
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
            this.lastTime = performance.now(); // Reset time to avoid big delta
        }
    }

    restartGame() {
        this.startGame();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        
        // Update post-processing if available
        if (this.postProcessing && this.postProcessing.composer) {
            this.postProcessing.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }

    animate(currentTime = 0) {
        requestAnimationFrame((time) => this.animate(time));

        if (this.isRunning && !this.isPaused) {
            // Calculate delta time
            const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1); // Cap deltaTime
            this.lastTime = currentTime;

            // Update game systems
            this.player.update(deltaTime);
            this.world.update(this.player, deltaTime);
            this.updateGameState(deltaTime);
            
            // Check for collectibles
            const collected = this.world.checkCollectibles(this.player);
            if (collected) {
                this.handleCollectible(collected);
            }
            
            // Check for obstacle collisions
            const obstacleHit = this.world.checkObstacleCollision?.(this.player);
            if (obstacleHit) {
                this.handleObstacleCollision(obstacleHit);
            }
            
            // Update post-processing effects
            if (this.postProcessing) {
                // Motion blur based on player velocity
                this.postProcessing.updateMotionBlur?.(this.player.velocity);
                
                // Vignette effect - stronger when sprinting or low on stamina
                const staminaEffect = this.player.stamina < 0.3 ? (0.3 - this.player.stamina) * 2 : 0;
                const sprintEffect = this.player.keys.sprint && this.player.isGrounded ? 0.2 : 0;
                this.postProcessing.updateVignette?.(staminaEffect + sprintEffect);
            }
            
            // Render scene with post-processing if available
            if (this.postProcessing && this.postProcessing.composer) {
                this.postProcessing.composer.render();
            } else {
                this.renderer.render(this.scene, this.camera);
            }
        } else {
            // Render scene when paused
            if (this.postProcessing && this.postProcessing.composer) {
                this.postProcessing.composer.render();
            } else {
                this.renderer.render(this.scene, this.camera);
            }
        }
    }

    setupEvents() {
        // Platform reached event
        document.addEventListener('platform_reached', (e) => {
            if (!this.isRunning || this.isPaused || this.isGameOver) return;
            
            this.platformsPassed++;
            this.score += 20; // Award points for reaching a new platform
            
            // Update UI
            this.ui.updatePlatformCounter(this.platformsPassed);
            this.ui.updateScore(this.score);
            
            console.log(`Platform reached! Total platforms: ${this.platformsPassed}, Score: ${this.score}`);
        });
    }

    handleCollectible(collected) {
        switch(collected.type) {
            case 'coin':
                this.score += collected.value;
                this.coinsCollected += 1;
                this.player.soundManager.playCoinSound();
                
                // Update UI
                this.ui.updateScore(this.score);
                this.ui.updateCoins(this.coinsCollected);
                break;
            case 'powerup':
                // Handle powerups when implemented
                break;
        }
    }
    
    handleObstacleCollision(obstacleData) {
        this.player.takeDamage(obstacleData.damage || 1);
        
        // Push player back if hitting an energy barrier
        if (obstacleData.type === 'energy_barrier') {
            const pushDirection = new THREE.Vector3(
                Math.random() - 0.5,
                0.5,
                Math.random() - 0.5
            ).normalize();
            this.player.velocity.add(pushDirection.multiplyScalar(10));
        }
    }

    gameOver() {
        this.isGameOver = true;
        this.isRunning = false;
        this.ui.showEndScreen(this.gameTime, this.platformsPassed);
    }
}

// Create the game instance
console.log('Creating game instance');
const game = new Game();

// Debug: Log key events
document.addEventListener('keydown', (e) => { console.log('keydown', e.code); });
document.addEventListener('keyup', (e) => { console.log('keyup', e.code); });
