import * as THREE from 'three';

class JumpPad {
    constructor(x, y, z, scene) {
        this.scene = scene;
        
        // Create the base
        const baseGeo = new THREE.CylinderGeometry(1.2, 1.5, 0.3, 16);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x232b3a,
            emissive: 0x00f2fe,
            emissiveIntensity: 0.2,
            metalness: 0.7,
            roughness: 0.2
        });
        this.base = new THREE.Mesh(baseGeo, baseMat);
        this.base.position.set(x, y, z);
        this.base.receiveShadow = true;
        scene.add(this.base);
        
        // Create the pad top
        const geometry = new THREE.CylinderGeometry(1, 1.2, 0.2, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0x00f2fe,
            emissive: 0x00f2fe,
            emissiveIntensity: 0.8,
            metalness: 0.9,
            roughness: 0.1
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(x, y + 0.25, z);
        this.mesh.castShadow = true;
        scene.add(this.mesh);
        
        // Add particles
        this.particles = [];
        for (let i = 0; i < 8; i++) {
            const particleGeo = new THREE.SphereGeometry(0.1, 8, 8);
            const particleMat = new THREE.MeshStandardMaterial({
                color: 0x7eeeff,
                emissive: 0x7eeeff,
                emissiveIntensity: 1.0,
                transparent: true,
                opacity: 0.7
            });
            const particle = new THREE.Mesh(particleGeo, particleMat);
            
            // Distribute in a circle
            const angle = (i / 8) * Math.PI * 2;
            particle.position.set(
                x + Math.cos(angle) * 0.8,
                y + 0.3,
                z + Math.sin(angle) * 0.8
            );
            
            particle.userData = {
                baseY: y + 0.3,
                angle: angle,
                speed: 0.5 + Math.random() * 0.5,
                range: 0.3 + Math.random() * 0.3
            };
            
            scene.add(particle);
            this.particles.push(particle);
        }
        
        this.timer = 0;
        this.boostStrength = 15; // Default boost strength
    }

    applyBoost(playerVelocity) {
        playerVelocity.y = this.boostStrength;
        
        // Also add a slight forward boost
        if (playerVelocity.z !== 0 || playerVelocity.x !== 0) {
            // Normalize x and z components and add boost
            const magnitude = Math.sqrt(playerVelocity.x * playerVelocity.x + playerVelocity.z * playerVelocity.z);
            if (magnitude > 0) {
                playerVelocity.x = playerVelocity.x / magnitude * 8;
                playerVelocity.z = playerVelocity.z / magnitude * 8;
            }
        } else {
            // If player isn't moving, give a small random direction
            playerVelocity.x = (Math.random() - 0.5) * 4;
            playerVelocity.z = (Math.random() - 0.5) * 4;
        }
    }

    update(deltaTime) {
        this.timer += deltaTime;
        
        // Pulse the main pad
        this.mesh.position.y = this.base.position.y + 0.25 + Math.sin(this.timer * 5) * 0.15;
        this.mesh.scale.y = 1 + Math.sin(this.timer * 5) * 0.2;
        
        // Update particles
        for (let i = 0; i < this.particles.length; i++) {
            const particle = this.particles[i];
            const data = particle.userData;
            
            // Move up and down
            particle.position.y = data.baseY + Math.sin(this.timer * data.speed) * data.range;
            
            // Rotate around center
            const angle = data.angle + this.timer * 0.5;
            particle.position.x = this.base.position.x + Math.cos(angle) * 0.8;
            particle.position.z = this.base.position.z + Math.sin(angle) * 0.8;
            
            // Pulse size
            const scale = 0.7 + Math.sin(this.timer * data.speed + i) * 0.3;
            particle.scale.set(scale, scale, scale);
        }
    }
}

function gridKey(x, z) {
    return `${x},${z}`;
}

export class World {
    constructor(scene) {
        this.scene = scene;
        this.platforms = new Map(); // key: gridKey(x, z), value: mesh
        this.walls = [];
        this.obstacles = [];
        this.jumpPads = new Map(); // key: gridKey(x, z), value: JumpPad
        this.edgeLines = [];
        this.coins = new Set(); // Initialize coins collection
        this.movingPlatforms = new Set();
        this.specialStructures = new Set(); // For unique structures
        
        this.colors = {
            platform: 0x232b3a, // bluish dark gray
            wall: 0x2e3a5c,     // deep blue
            ground: 0x10131a,   // almost black with blue tint
            accent: 0x00f2fe,   // neon cyan
            edge: 0x7eeeff,     // neon blue
            sky: 0x0a0e1a,       // deep cosmic blue/black
            highlight: 0x7d5fff // purple highlight
        };

        // World generation parameters
        this.gridSize = 12; // Distance between grid cells
        this.gridRadius = 4; // How many cells to generate around player
        this.platformHeight = 0.5;
        this.platformY = 0; // Base platform height
        this.generatedCells = new Set();
        this.obstacleChance = 0.1;
        this.platformVariation = 0; // Height variation
        
        // Progression path
        this.pathDirection = new THREE.Vector3(0, 0, 1); // Start along Z-axis
        this.pathWidth = 2; // How many platforms wide the path is
        
        // Level design variation
        this.sectionTypes = ['narrow', 'open', 'climbing', 'descent', 'zigzag', 'stepped', 'islands', 'floating'];
        this.currentSectionType = 'open';
        this.sectionLength = 15; // How many cells before changing section type
        this.cellsInSection = 0;
        this.structureTimer = 0; // For tracking when to generate special structures

        this.setupLighting();
        this.setupSkybox();
        this.createGround();
        this.generateInitial();
    }

    adjustDifficulty(level) {
        // Adjust generation parameters based on difficulty
        switch(level) {
            case 1:
                this.platformSpacing = 10;
                this.obstacleChance = 0.1;
                this.platformVariation = 0;
                this.pathWidth = 2; // Wide path
                this.sectionLength = 15;
                break;
            case 2:
                this.platformSpacing = 8;
                this.obstacleChance = 0.2;
                this.platformVariation = 1;
                this.pathWidth = 1; // Narrower path
                this.sectionLength = 12;
                break;
            case 3:
                this.platformSpacing = 7;
                this.obstacleChance = 0.3;
                this.platformVariation = 2;
                this.gridSize = 10; // Closer platforms
                this.pathWidth = 1;
                this.sectionLength = 10;
                break;
            case 4:
                this.platformSpacing = 6;
                this.obstacleChance = 0.4;
                this.platformVariation = 3;
                this.pathWidth = 1;
                this.sectionLength = 8;
                break;
            case 5:
                this.platformSpacing = 5;
                this.obstacleChance = 0.5;
                this.platformVariation = 4;
                this.gridSize = 8;
                this.pathWidth = 1;
                this.sectionLength = 6;
                break;
        }
        
        // Update existing moving platforms speed
        if (this.movingPlatforms) {
            for (const platform of this.movingPlatforms) {
                if (platform.userData && platform.userData.speed) {
                    platform.userData.speed *= 1.2;
                }
            }
        }
        
        // Update current section type
        this.changePathSection();
    }

    setupLighting() {
        while(this.scene.children.find(c => c instanceof THREE.Light)) {
            this.scene.remove(this.scene.children.find(c => c instanceof THREE.Light));
        }
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const sun = new THREE.DirectionalLight(0xffffff, 1);
        sun.position.set(30, 100, 50);
        sun.castShadow = true;
        sun.shadow.mapSize.width = 2048;
        sun.shadow.mapSize.height = 2048;
        this.scene.add(sun);
    }

    setupSkybox() {
        this.scene.background = new THREE.Color(this.colors.sky);
        this.scene.fog = new THREE.FogExp2(0x1a223a, 0.012); // subtle cosmic fog
    }

    generateCollectibles(gridX, gridZ, platformY = this.platformY) {
        // Create more intentional coin patterns rather than random distribution
        const px = gridX * this.gridSize;
        const pz = gridZ * this.gridSize;
        const py = platformY + 1.5;
        
        // Different coin patterns based on section type and distance
        const distanceFromOrigin = Math.sqrt(gridX * gridX + gridZ * gridZ);
        const patternType = this.getPatternType(distanceFromOrigin);
        
        // Create pattern based on section type
        switch(patternType) {
            case 'circle':
                this.createCirclePattern(px, py, pz);
                break;
            case 'line':
                this.createLinePattern(px, py, pz, gridX, gridZ);
                break;
            case 'zigzag':
                this.createZigzagPattern(px, py, pz);
                break;
            case 'arc':
                this.createArcPattern(px, py, pz);
                break;
            case 'single':
                // Just place a single coin
                this.createCoin(px, py, pz);
                break;
            case 'none':
            default:
                // Don't place any coins
                break;
        }
    }
    
    getPatternType(distance) {
        // Choose pattern based on distance and current section
        if (distance < 5) {
            // Near the start, simpler patterns - reduce coin frequency
            return Math.random() < 0.4 ? 'single' : 'none';
        }
        
        // Significantly reduce coin spawn rate based on section
        const rng = Math.random();
        
        // Different patterns based on section type
        switch(this.currentSectionType) {
            case 'narrow':
                // Less coins in narrow sections
                if (rng < 0.3) return 'line';
                else if (rng < 0.4) return 'zigzag';
                else return 'none';
            case 'open':
                // Medium coins in open areas
                if (rng < 0.2) return 'circle';
                else if (rng < 0.35) return 'arc';
                else if (rng < 0.5) return 'single';
                else return 'none';
            case 'climbing':
                // More coins in climbing sections as rewards
                if (rng < 0.3) return 'zigzag';
                else if (rng < 0.5) return 'line';
                else return 'none';
            case 'descent':
                // Medium coins in descent areas
                if (rng < 0.25) return 'arc';
                else if (rng < 0.35) return 'circle';
                else if (rng < 0.5) return 'single';
                else return 'none';
            case 'zigzag':
                // More coins in zigzag to guide the path
                if (rng < 0.4) return 'zigzag';
                else if (rng < 0.5) return 'line';
                else return 'none';
            default:
                // Reduced overall chance for patterns
                if (rng < 0.3) return ['single', 'line', 'circle', 'zigzag', 'arc'][Math.floor(Math.random() * 5)];
                else return 'none';
        }
    }
    
    createCoin(x, y, z, value = 10) {
        // Create a single coin with animations
        const coinGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.1, 16);
        const coinMat = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            emissive: 0xffd700,
            emissiveIntensity: 0.5,
            metalness: 1.0,
            roughness: 0.3
        });
        const coin = new THREE.Mesh(coinGeo, coinMat);
        coin.rotation.x = Math.PI/2;
        coin.position.set(x, y, z);
        coin.userData.type = 'coin';
        coin.userData.value = value;
        this.scene.add(coin);
        this.coins.add(coin);
        
        // Animation system
        coin.userData.rotationSpeed = 2 + Math.random() * 3;
        coin.userData.floatHeight = 0.3;
        coin.userData.floatSpeed = 1 + Math.random();
        coin.userData.originalY = y;
        
        return coin;
    }
    
    createCirclePattern(centerX, centerY, centerZ) {
        // Create a circle of coins - reduced count
        const radius = 2.5;
        const numCoins = 5; // Reduced from 8
        
        for (let i = 0; i < numCoins; i++) {
            const angle = (i / numCoins) * Math.PI * 2;
            const x = centerX + Math.cos(angle) * radius;
            const z = centerZ + Math.sin(angle) * radius;
            this.createCoin(x, centerY, z);
        }
        
        // Add a bonus coin in the middle
        this.createCoin(centerX, centerY, centerZ, 25);
    }
    
    createLinePattern(centerX, centerY, centerZ, gridX, gridZ) {
        // Create a straight line of coins in the direction of the path - reduced count
        const dirX = Math.round(this.pathDirection.x);
        const dirZ = Math.round(this.pathDirection.z);
        const length = 2; // Reduced from 3
        
        for (let i = -length; i <= length; i += 2) { // Increased step to add gaps
            const x = centerX + dirX * i;
            const z = centerZ + dirZ * i;
            this.createCoin(x, centerY, z);
        }
    }
    
    createZigzagPattern(centerX, centerY, centerZ) {
        // Create a zigzag pattern of coins - reduced density
        const dirX = Math.round(this.pathDirection.x);
        const dirZ = Math.round(this.pathDirection.z);
        const perpX = dirZ; // Perpendicular direction
        const perpZ = -dirX;
        const zigLength = 3; // Reduced from 4
        
        for (let i = -zigLength; i <= zigLength; i += 2) { // Increased step to add gaps
            const offset = (i % 2 === 0) ? 1.5 : -1.5;
            const x = centerX + dirX * i + perpX * offset;
            const z = centerZ + dirZ * i + perpZ * offset;
            this.createCoin(x, centerY, z);
        }
    }
    
    createArcPattern(centerX, centerY, centerZ) {
        // Create an arc pattern of coins - reduced count
        const radius = 3;
        const numCoins = 3; // Reduced from 6
        const startAngle = Math.PI * 0.25;
        const endAngle = Math.PI * 0.75;
        
        for (let i = 0; i < numCoins; i++) {
            const t = i / (numCoins - 1);
            const angle = startAngle + t * (endAngle - startAngle);
            const x = centerX + Math.cos(angle) * radius;
            const z = centerZ + Math.sin(angle) * radius;
            const y = centerY + Math.sin(t * Math.PI) * 1.5; // Arc height
            this.createCoin(x, y, z);
        }
    }

    checkCollectibles(player) {
        const playerBox = player.getColliderBox();
        
        for (const coin of this.coins) {
            const coinBox = new THREE.Box3().setFromObject(coin);
            if (playerBox.intersectsBox(coinBox)) {
                this.scene.remove(coin);
                this.coins.delete(coin);
                return { type: 'coin', value: coin.userData.value };
            }
        }
        return null;
    }

    createGround() {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(500, 500),
            new THREE.MeshStandardMaterial({ 
                color: this.colors.ground, 
                metalness: 0.7, 
                roughness: 0.3,
                emissive: 0x232b3a,
                emissiveIntensity: 0.1
            })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = this.platformY - 0.5;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    generateInitial() {
        this.clear();
        
        // Create initial platform
        this.generateCell(0, 0);
        
        // Generate first section of the path
        this.pathDirection = new THREE.Vector3(0, 0, 1); // Start heading forward
        this.currentSectionType = 'open';
        this.cellsInSection = 0;
        
        // Generate some platforms ahead in the starting area
        for (let z = 1; z <= 5; z++) {
            this.generateCell(0, z);
            // Add some width to the starting area
            this.generateCell(-1, z);
            this.generateCell(1, z);
        }
    }
    
    changePathSection() {
        // Change the current section type and reset counter
        const previousType = this.currentSectionType;
        
        // Don't repeat the same section type
        let availableTypes = this.sectionTypes.filter(type => type !== previousType);
        
        // Selection logic based on progression
        const directionChange = Math.random() < 0.5; // Increased chance of direction change
        
        if (directionChange) {
            // Change direction occasionally
            this.updatePathDirection();
        }
        
        // Select the new section based on logical progression
        if (previousType === 'climbing') {
            // After climbing, prefer open area, floating or descent
            const choices = ['descent', 'open', 'floating'];
            this.currentSectionType = choices[Math.floor(Math.random() * choices.length)];
        } else if (previousType === 'descent') {
            // After descent, prefer open area, islands or stepped
            const choices = ['open', 'islands', 'stepped'];
            this.currentSectionType = choices[Math.floor(Math.random() * choices.length)];
        } else if (previousType === 'narrow') {
            // After narrow, prefer climbing, zigzag or floating
            const choices = ['climbing', 'zigzag', 'floating'];
            this.currentSectionType = choices[Math.floor(Math.random() * choices.length)];
        } else if (previousType === 'zigzag') {
            // After zigzag, prefer open, climbing or islands
            const choices = ['open', 'climbing', 'islands'];
            this.currentSectionType = choices[Math.floor(Math.random() * choices.length)];
        } else if (previousType === 'islands') {
            // After islands, prefer open or stepped
            const choices = ['open', 'stepped', 'narrow'];
            this.currentSectionType = choices[Math.floor(Math.random() * choices.length)];
        } else if (previousType === 'stepped') {
            // After stepped, prefer climbing or zigzag
            const choices = ['climbing', 'zigzag', 'narrow'];
            this.currentSectionType = choices[Math.floor(Math.random() * choices.length)];
        } else if (previousType === 'floating') {
            // After floating, prefer descent or open
            const choices = ['descent', 'open', 'islands'];
            this.currentSectionType = choices[Math.floor(Math.random() * choices.length)];
        } else {
            // Random selection from available types
            this.currentSectionType = availableTypes[Math.floor(Math.random() * availableTypes.length)];
        }
        
        // Reset counter
        this.cellsInSection = 0;
        
        console.log(`Changed section from ${previousType} to ${this.currentSectionType}`);
        
        // Add a signpost or indicator to show players the section is changing
        this.createSectionTransitionMarker();
        
        // Every other section change, create a special landmark structure
        if (Math.random() < 0.5) {
            // Create a special landmark at the transition point
            this.createLandmarkStructure();
        }
    }
    
    createSectionTransitionMarker() {
        // Create a visual marker at section transitions
        // Determine the position based on player's expected position
        const dirX = Math.round(this.pathDirection.x);
        const dirZ = Math.round(this.pathDirection.z);
        
        // Calculate a position ahead on the path
        const playerGridX = Math.round(this.scene.getObjectByName('player').position.x / this.gridSize);
        const playerGridZ = Math.round(this.scene.getObjectByName('player').position.z / this.gridSize);
        
        const markerGridX = playerGridX + dirX * (this.gridRadius - 1);
        const markerGridZ = playerGridZ + dirZ * (this.gridRadius - 1);
        
        const markerX = markerGridX * this.gridSize;
        const markerZ = markerGridZ * this.gridSize;
        
        // Get the platform at this position if it exists
        const key = gridKey(markerGridX, markerGridZ);
        const platform = this.platforms.get(key);
        
        if (platform) {
            const markerY = platform.position.y + 5;
            
            // Create a distinctive marker based on the next section type
            const markerGeo = new THREE.TorusGeometry(1.5, 0.2, 16, 50);
            const markerMat = new THREE.MeshStandardMaterial({
                color: this.getColorForSectionType(this.currentSectionType),
                emissive: this.getColorForSectionType(this.currentSectionType),
                emissiveIntensity: 0.5,
                metalness: 0.7,
                roughness: 0.3
            });
            
            const marker = new THREE.Mesh(markerGeo, markerMat);
            marker.position.set(markerX, markerY, markerZ);
            
            // Rotate based on path direction
            if (Math.abs(dirX) > Math.abs(dirZ)) {
                marker.rotation.y = Math.PI / 2;
            }
            
            marker.userData.type = 'sectionMarker';
            marker.userData.rotationSpeed = 1;
            marker.userData.floatHeight = 0.5;
            marker.userData.floatSpeed = 0.8;
            marker.userData.originalY = markerY;
            marker.userData.creationTime = Date.now();
            marker.userData.lifespan = 15000; // 15 seconds
            
            this.scene.add(marker);
            
            // Add to a collection for updates/cleanup
            if (!this.sectionMarkers) this.sectionMarkers = new Set();
            this.sectionMarkers.add(marker);
        }
    }
    
    getColorForSectionType(type) {
        // Return color based on section type
        switch(type) {
            case 'narrow': return 0xff3333; // Red
            case 'open': return 0x33ff33;   // Green
            case 'climbing': return 0x3333ff; // Blue
            case 'descent': return 0xff33ff;  // Purple
            case 'zigzag': return 0xffff33;   // Yellow
            default: return 0xffffff;        // White
        }
    }
    
    // Update to clean up markers
    updateSectionMarkers(deltaTime) {
        if (!this.sectionMarkers) return;
        
        const now = Date.now();
        const markersToRemove = [];
        
        for (const marker of this.sectionMarkers) {
            // Rotate and float
            marker.rotation.y += marker.userData.rotationSpeed * deltaTime;
            
            const age = now - marker.userData.creationTime;
            
            // Float up and down
            marker.position.y = marker.userData.originalY + 
                               Math.sin(age * 0.001 * marker.userData.floatSpeed) * 
                               marker.userData.floatHeight;
            
            // Check if marker should be removed
            if (age > marker.userData.lifespan) {
                markersToRemove.push(marker);
            }
        }
        
        // Remove expired markers
        for (const marker of markersToRemove) {
            this.scene.remove(marker);
            this.sectionMarkers.delete(marker);
        }
    }

    update(player, deltaTime) {
        // Determine player's grid position
        const playerGridX = Math.round(player.position.x / this.gridSize);
        const playerGridZ = Math.round(player.position.z / this.gridSize);
        
        // Generate the level based on the current section type
        switch (this.currentSectionType) {
            case 'narrow':
                this.generateNarrowPath(playerGridX, playerGridZ);
                break;
            case 'open':
                this.generateOpenArea(playerGridX, playerGridZ);
                break;
            case 'climbing':
                this.generateClimbingArea(playerGridX, playerGridZ);
                break;
            case 'descent':
                this.generateDescentArea(playerGridX, playerGridZ);
                break;
            case 'zigzag':
                this.generateZigzagPath(playerGridX, playerGridZ);
                break;
            case 'stepped':
                this.generateSteppedArea(playerGridX, playerGridZ);
                break;
            case 'islands':
                this.generateIslands(playerGridX, playerGridZ);
                break;
            case 'floating':
                this.generateFloatingIslands(playerGridX, playerGridZ);
                break;
            default:
                this.generateOpenArea(playerGridX, playerGridZ);
        }
        
        // Update the section counter
        this.cellsInSection++;
        
        // Check if we need to transition to a new section
        if (this.cellsInSection >= this.sectionLength) {
            this.changePathSection();
        }
        
        // Update jump pads
        for (const pad of this.jumpPads.values()) {
            pad.update(deltaTime);
        }
        
        // Check for jump pad collision
        this.checkJumpPadCollision(player);
        
        // Update collectibles
        this.updateCollectibles(deltaTime);
        
        // Update obstacles
        this.updateObstacles(deltaTime);
        
        // Update section markers
        this.updateSectionMarkers(deltaTime);
        
        // Update special structures
        this.updateSpecialStructures(deltaTime);
        
        // Edge highlight effect
        const time = Date.now() * 0.002;
        for (let edge of this.edgeLines) {
            edge.material.opacity = 0.6 + 0.3 * Math.sin(time * 0.75);
        }
    }
    
    generateNarrowPath(playerGridX, playerGridZ) {
        // Generate a narrow corridor extending forward
        const dirX = Math.round(this.pathDirection.x);
        const dirZ = Math.round(this.pathDirection.z);
        
        // Generate platforms ahead in the path
        for (let i = 1; i <= this.gridRadius; i++) {
            const pathX = playerGridX + dirX * i;
            const pathZ = playerGridZ + dirZ * i;
            
            // Create the main path
            this.generateCell(pathX, pathZ);
            
            // Add walls on both sides
            if (dirZ !== 0) { // Path along Z-axis
                this.generateWallCell(pathX - 1, pathZ);
                this.generateWallCell(pathX + 1, pathZ);
            } else { // Path along X-axis
                this.generateWallCell(pathX, pathZ - 1);
                this.generateWallCell(pathX, pathZ + 1);
            }
        }
    }
    
    generateOpenArea(playerGridX, playerGridZ) {
        // Generate a wider open area with scattered platforms
        const dirX = Math.round(this.pathDirection.x);
        const dirZ = Math.round(this.pathDirection.z);
        const width = this.pathWidth + 1;
        
        // Generate main path forward
        for (let i = 1; i <= this.gridRadius; i++) {
            const pathX = playerGridX + dirX * i;
            const pathZ = playerGridZ + dirZ * i;
            
            // Create platforms in a wider formation
            for (let w = -width; w <= width; w++) {
                const offsetX = dirZ !== 0 ? w : 0;
                const offsetZ = dirX !== 0 ? w : 0;
                
                // Random gaps
                if (Math.random() < 0.2 && w !== 0) continue;
                
                this.generateCell(pathX + offsetX, pathZ + offsetZ);
            }
        }
    }
    
    generateClimbingArea(playerGridX, playerGridZ) {
        // Generate an upward climbing section
        const dirX = Math.round(this.pathDirection.x);
        const dirZ = Math.round(this.pathDirection.z);
        
        // Higher elevation as we go forward
        for (let i = 1; i <= this.gridRadius; i++) {
            const pathX = playerGridX + dirX * i;
            const pathZ = playerGridZ + dirZ * i;
            
            // Manually set increasing heights
            const heightMultiplier = 2 + this.platformVariation;
            const customHeight = this.platformY + i * heightMultiplier;
            
            this.generateCell(pathX, pathZ, customHeight);
            
            // Add jump pads to help with climbing
            if (i % 2 === 0) {
                const prevX = playerGridX + dirX * (i-1);
                const prevZ = playerGridZ + dirZ * (i-1);
                this.generateJumpPadCell(prevX, prevZ);
            }
        }
    }
    
    generateDescentArea(playerGridX, playerGridZ) {
        // Generate a downward section
        const dirX = Math.round(this.pathDirection.x);
        const dirZ = Math.round(this.pathDirection.z);
        
        // Lower elevation as we go forward
        for (let i = 1; i <= this.gridRadius; i++) {
            const pathX = playerGridX + dirX * i;
            const pathZ = playerGridZ + dirZ * i;
            
            // Manually set decreasing heights
            const heightMultiplier = -1.5 - this.platformVariation * 0.5;
            const customHeight = this.platformY + i * heightMultiplier;
            
            this.generateCell(pathX, pathZ, customHeight);
            
            // Add walls on sides occasionally
            if (i % 3 === 0) {
                if (dirZ !== 0) { // Path along Z-axis
                    this.generateWallCell(pathX - 1, pathZ, customHeight);
                    this.generateWallCell(pathX + 1, pathZ, customHeight);
                } else { // Path along X-axis
                    this.generateWallCell(pathX, pathZ - 1, customHeight);
                    this.generateWallCell(pathX, pathZ + 1, customHeight);
                }
            }
        }
    }
    
    generateZigzagPath(playerGridX, playerGridZ) {
        // Generate a zigzag pattern of platforms
        const mainDirX = Math.round(this.pathDirection.x);
        const mainDirZ = Math.round(this.pathDirection.z);
        
        // Secondary direction (perpendicular to main)
        const secDirX = mainDirZ !== 0 ? 1 : 0;
        const secDirZ = mainDirX !== 0 ? 1 : 0;
        
        for (let i = 1; i <= this.gridRadius; i++) {
            const isZigOrZag = i % 2 === 0;
            
            // Alternate between main direction and offset
            const pathX = playerGridX + mainDirX * i + (isZigOrZag ? secDirX : -secDirX);
            const pathZ = playerGridZ + mainDirZ * i + (isZigOrZag ? secDirZ : -secDirZ);
            
            this.generateCell(pathX, pathZ);
            
            // Occasionally add a jump pad on zigzag turns
            if (i % 3 === 0) {
                this.generateJumpPadCell(pathX, pathZ);
            }
        }
    }
    
    generateWallCell(gridX, gridZ, customHeight = null) {
        const key = gridKey(gridX, gridZ);
        if (this.generatedCells.has(key)) return;
        
        // Mark as generated
        this.generatedCells.add(key);
        
        // Calculate position
        const px = gridX * this.gridSize;
        const pz = gridZ * this.gridSize;
        const py = customHeight !== null ? customHeight : this.platformY;
        
        // Create a tall wall instead of a platform
        const wallHeight = 6 + Math.random() * 2;
        const wall = this.createWall(px, py + wallHeight/2, pz, 
                                    this.gridSize * 0.8, wallHeight, this.gridSize * 0.8, 
                                    this.colors.wall);
        
        // Add wall run indicator
        this.addWallRunIndicator(wall);
    }
    
    generateJumpPadCell(gridX, gridZ, customHeight = null) {
        const key = gridKey(gridX, gridZ);
        if (!this.platforms.has(key)) return;
        
        // Get platform position
        const platform = this.platforms.get(key);
        const px = platform.position.x;
        const pz = platform.position.z;
        const py = platform.position.y;
        
        // Create jump pad on this platform if doesn't already exist
        if (!this.jumpPads.has(key)) {
            const pad = new JumpPad(px, py + 0.3, pz, this.scene);
            this.jumpPads.set(key, pad);
        }
    }

    generateCell(gridX, gridZ, customHeight = null) {
        const key = gridKey(gridX, gridZ);
        if (this.generatedCells.has(key)) return;
        this.generatedCells.add(key);
        
        // Calculate platform height based on distance and noise
        const distanceFromOrigin = Math.sqrt(gridX * gridX + gridZ * gridZ);
        let platformY = this.platformY;
        
        // Use custom height if provided
        if (customHeight !== null) {
            platformY = customHeight;
        }
        // Otherwise add height variation if enabled
        else if (this.platformVariation > 0) {
            // Use simple pseudorandom noise based on grid position
            const noise = Math.sin(gridX * 0.5) * Math.cos(gridZ * 0.5) * this.platformVariation;
            platformY += noise;
            
            // Higher platforms further from the center
            if (distanceFromOrigin > 5) {
                platformY += Math.min(this.platformVariation, distanceFromOrigin * 0.1);
            }
        }
        
        // Place a platform
        const px = gridX * this.gridSize;
        const pz = gridZ * this.gridSize;
        
        // Add variation to platform design based on section type and distance
        let platformWidth = this.gridSize * 0.8;
        let platformDepth = this.gridSize * 0.8;
        let platformColor = this.colors.platform;
        
        // Add visual diversity based on section type
        switch(this.currentSectionType) {
            case 'narrow':
                // Longer platforms for narrow sections
                if (Math.round(this.pathDirection.z) !== 0) {
                    platformWidth = this.gridSize * 0.5; // Narrower
                    platformDepth = this.gridSize * 0.9; // Longer
                } else {
                    platformWidth = this.gridSize * 0.9; // Longer
                    platformDepth = this.gridSize * 0.5; // Narrower
                }
                platformColor = 0x283044; // Darker blue
                break;
                
            case 'open':
                // Wider, more spacious platforms
                platformWidth = this.gridSize * 0.85;
                platformDepth = this.gridSize * 0.85;
                platformColor = 0x232b3a; // Standard color
                break;
                
            case 'climbing':
                // Smaller platforms for climbing sections
                platformWidth = this.gridSize * 0.75;
                platformDepth = this.gridSize * 0.75;
                platformColor = 0x2f3e5c; // Blueish purple
                break;
                
            case 'descent':
                // Wider platforms for descent
                platformWidth = this.gridSize * 0.9;
                platformDepth = this.gridSize * 0.9;
                platformColor = 0x1a2639; // Deep blue
                break;
                
            case 'zigzag':
                // Angled platforms for zigzag
                platformWidth = this.gridSize * 0.7;
                platformDepth = this.gridSize * 0.7;
                platformColor = 0x293655; // Medium blue
                break;
        }
        
        // Apply distance-based variations
        if (distanceFromOrigin > 10) {
            // More exotic colors further from start
            const hue = (distanceFromOrigin * 0.02) % 1;
            const saturation = 0.3;
            const lightness = 0.2;
            platformColor = new THREE.Color().setHSL(hue, saturation, lightness).getHex();
        }
        
        // Create the platform with custom dimensions
        const platform = this.createPlatform(
            px, platformY, pz, 
            platformWidth, this.platformHeight, platformDepth, 
            platformColor
        );
        this.platforms.set(key, platform);
        
        // Generate collectibles on the platform - with reduced chance
        if (Math.random() < 0.4) { // Reduced from 100% to 40% chance
            this.generateCollectibles(gridX, gridZ, platformY);
        }
        
        // Randomly add features based on distance from origin
        const rand = Math.random();
        const obstacleThreshold = 0.3 + this.obstacleChance;
        
        // Higher chance of obstacles further from origin
        const scaledObstacleChance = Math.min(0.4, this.obstacleChance * (1 + distanceFromOrigin * 0.05));
        
        if (rand < 0.1 && distanceFromOrigin > 3) {
            // Wall (less frequent)
            const height = 4 + Math.random() * 2;
            const wall = this.createWall(px, platformY + height/2, pz, 0.5, height, this.gridSize * 0.7, this.colors.accent);
            this.addWallRunIndicator(wall);
        } else if (rand < 0.2 && distanceFromOrigin > 2) {
            // Jump pad
            const pad = new JumpPad(px, platformY + 0.3, pz, this.scene);
            this.jumpPads.set(key, pad);
        } else if (rand < obstacleThreshold && distanceFromOrigin > 4) {
            // Obstacle - only if far enough from origin
            this.generateObstacles(gridX, gridZ, platformY);
        } else if (rand < 0.35 + scaledObstacleChance && distanceFromOrigin > 5) {
            // Moving platform (at higher difficulties)
            if (this.platformVariation >= 2) {
                this.createMovingPlatform(px, platformY + 3, pz);
            }
        }
    }

    generateObstacles(gridX, gridZ, platformY = this.platformY) {
        const px = gridX * this.gridSize;
        const pz = gridZ * this.gridSize;
        const py = platformY;
        
        // Different obstacle types based on difficulty
        const obstacleType = Math.floor(Math.random() * 3);
        
        switch(obstacleType) {
            case 0: // Spinning blades
                const bladeGeo = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
                const bladeMat = new THREE.MeshStandardMaterial({
                    color: 0xff0000,
                    emissive: 0xff3333,
                    emissiveIntensity: 0.7
                });
                const blade = new THREE.Mesh(bladeGeo, bladeMat);
                blade.position.set(px, py + 1, pz);
                blade.userData = {
                    type: 'obstacle',
                    damage: 1,
                    rotationSpeed: 5 + Math.random() * 5
                };
                this.scene.add(blade);
                this.obstacles.push(blade);
                break;
                
            case 1: // Energy barrier
                const barrierGeo = new THREE.PlaneGeometry(3, 3);
                const barrierMat = new THREE.MeshStandardMaterial({
                    color: 0x00f2fe,
                    transparent: true,
                    opacity: 0.3,
                    side: THREE.DoubleSide,
                    emissive: 0x00f2fe,
                    emissiveIntensity: 0.8
                });
                const barrier = new THREE.Mesh(barrierGeo, barrierMat);
                barrier.position.set(px, py + 1.5, pz);
                barrier.rotation.y = Math.random() * Math.PI;
                barrier.userData = {
                    type: 'energy_barrier',
                    damage: 0.5
                };
                this.scene.add(barrier);
                this.obstacles.push(barrier);
                break;
                
            case 2: // Spike trap
                const spikeGeo = new THREE.ConeGeometry(0.2, 1, 8);
                const spikeMat = new THREE.MeshStandardMaterial({
                    color: 0xff0000,
                    emissive: 0xff0000,
                    emissiveIntensity: 0.3
                });
                
                // Create a group of spikes
                const spikeGroup = new THREE.Group();
                spikeGroup.position.set(px, py + 0.5, pz);
                
                // Add multiple spikes
                for (let i = 0; i < 5; i++) {
                    const spike = new THREE.Mesh(spikeGeo, spikeMat);
                    spike.position.set(
                        (Math.random() - 0.5) * 2,
                        0,
                        (Math.random() - 0.5) * 2
                    );
                    spike.rotation.x = Math.PI;
                    spikeGroup.add(spike);
                }
                
                spikeGroup.userData = {
                    type: 'spike_trap',
                    damage: 1
                };
                
                this.scene.add(spikeGroup);
                this.obstacles.push(spikeGroup);
                break;
        }
    }

    updateObstacles(deltaTime) {
        // Update spinning obstacles
        for (const obstacle of this.obstacles) {
            if (obstacle.userData && obstacle.userData.rotationSpeed) {
                obstacle.rotation.y += obstacle.userData.rotationSpeed * deltaTime;
            }
        }
        
        // Update moving platforms
        if (this.movingPlatforms) {
            for (const platform of this.movingPlatforms) {
                if (platform.userData && platform.userData.originalPos) {
                    const time = Date.now() * 0.001 * platform.userData.speed;
                    const offset = platform.userData.direction.clone()
                        .multiplyScalar(Math.sin(time) * platform.userData.distance);
                    platform.position.copy(platform.userData.originalPos).add(offset);
                }
            }
        }
    }

    checkObstacleCollision(player) {
        const playerBox = player.getColliderBox();
        
        for (const obstacle of this.obstacles) {
            const obstacleBox = new THREE.Box3().setFromObject(obstacle);
            if (playerBox.intersectsBox(obstacleBox)) {
                return obstacle.userData;
            }
        }
        return null;
    }

    checkJumpPadCollision(player) {
        // Check if player is on top of a jump pad
        if (player.isGrounded) {
            for (const [key, pad] of this.jumpPads.entries()) {
                const padPos = pad.mesh.position;
                const dx = player.position.x - padPos.x;
                const dz = player.position.z - padPos.z;
                const dist = Math.sqrt(dx * dx + dz * dz);
                
                if (dist < 1) {
                    // Player on jump pad - apply boost
                    pad.applyBoost(player.velocity);
                    player.isGrounded = false;
                    return true;
                }
            }
        }
        return false;
    }

    createPlatform(x, y, z, width, height, depth, color = this.colors.platform) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.6,
            roughness: 0.25,
            emissive: 0x00f2fe,
            emissiveIntensity: 0.08
        });
        const platform = new THREE.Mesh(geometry, material);
        platform.position.set(x, y, z);
        platform.castShadow = true;
        platform.receiveShadow = true;
        this.scene.add(platform);
        // Edge highlight
        const edges = new THREE.EdgesGeometry(geometry);
        const lineMat = new THREE.LineBasicMaterial({ 
            color: this.colors.edge,
            transparent: true,
            opacity: 0.85,
            linewidth: 2
        });
        const line = new THREE.LineSegments(edges, lineMat);
        line.position.set(x, y, z);
        this.scene.add(line);
        this.edgeLines.push(line);
        return platform;
    }

    createWall(x, y, z, width, height, depth, color = this.colors.wall) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: this.colors.wall,
            metalness: 0.7,
            roughness: 0.2,
            emissive: this.colors.accent,
            emissiveIntensity: 0.25
        });
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(x, y, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        this.scene.add(wall);
        this.walls.push(wall);
        return wall;
    }

    addWallRunIndicator(wall) {
        const stripeGeo = new THREE.PlaneGeometry(wall.geometry.parameters.depth, 0.5);
        const stripeMat = new THREE.MeshStandardMaterial({
            color: 0x7d5fff, // cosmic purple accent
            emissive: 0x7d5fff,
            emissiveIntensity: 0.7
        });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.rotation.y = Math.PI/2;
        stripe.position.set(
            wall.position.x + (wall.position.x > 0 ? -0.1 : 0.1),
            wall.position.y + 1.5,
            wall.position.z
        );
        this.scene.add(stripe);
        this.obstacles.push(stripe);
    }

    createMovingPlatform(x, y, z) {
        // Create a smaller platform that moves
        const size = this.gridSize * 0.4;
        const platform = this.createPlatform(
            x, y, z, 
            size, 0.3, size,
            0x3c4c67
        );
        
        // Setup movement parameters
        platform.userData = {
            type: 'moving_platform',
            speed: 0.5 + Math.random() * 1.5,
            direction: new THREE.Vector3(
                Math.random() - 0.5,
                Math.random() * 0.5, // Allow some vertical movement
                Math.random() - 0.5
            ).normalize(),
            distance: 3 + Math.random() * 3,
            originalPos: platform.position.clone()
        };
        
        this.movingPlatforms.add(platform);
        return platform;
    }

    updateCollectibles(deltaTime) {
        for (const coin of this.coins) {
            // Rotate coin
            coin.rotation.z += coin.userData.rotationSpeed * deltaTime;
            
            // Float animation
            coin.position.y = coin.userData.originalY + 
                Math.sin(Date.now() * 0.001 * coin.userData.floatSpeed) * 
                coin.userData.floatHeight;
        }
    }

    clear() {
        for (let platform of this.platforms.values()) this.scene.remove(platform);
        for (let wall of this.walls) this.scene.remove(wall);
        for (let obstacle of this.obstacles) this.scene.remove(obstacle);
        for (let pad of this.jumpPads.values()) this.scene.remove(pad.mesh);
        for (let edge of this.edgeLines) this.scene.remove(edge);
        this.platforms.clear();
        this.walls = [];
        this.obstacles = [];
        this.jumpPads.clear();
        this.edgeLines = [];
        this.generatedCells = new Set();
        this.coins.clear();
        
        // Clear special structures
        for (const structure of this.specialStructures) {
            this.scene.remove(structure);
        }
        this.specialStructures.clear();
        
        // Clear moving platforms if they exist
        if (this.movingPlatforms) {
            for (const platform of this.movingPlatforms) {
                this.scene.remove(platform);
            }
            this.movingPlatforms.clear();
        } else {
            this.movingPlatforms = new Set();
        }
    }

    updatePathDirection() {
        // Change the direction of the path intelligently
        // Store current direction
        const oldDirX = Math.round(this.pathDirection.x);
        const oldDirZ = Math.round(this.pathDirection.z);
        
        // Choose a new direction that's different from the current one
        const possibleDirections = [];
        
        // Add all 4 directions except the current and opposite direction
        if (oldDirX !== 1 && oldDirX !== -1) possibleDirections.push({x: 1, z: 0});
        if (oldDirX !== -1 && oldDirX !== 1) possibleDirections.push({x: -1, z: 0});
        if (oldDirZ !== 1 && oldDirZ !== -1) possibleDirections.push({x: 0, z: 1});
        if (oldDirZ !== -1 && oldDirZ !== 1) possibleDirections.push({x: 0, z: -1});
        
        // Select randomly from possible choices
        const newDir = possibleDirections[Math.floor(Math.random() * possibleDirections.length)];
        
        // Update direction
        this.pathDirection.set(newDir.x, 0, newDir.z);
        
        console.log(`Path direction changed from (${oldDirX}, ${oldDirZ}) to (${newDir.x}, ${newDir.z})`);
    }

    updateSpecialStructures(deltaTime) {
        // Update special structures animations
        for (const structure of this.specialStructures) {
            if (structure.userData) {
                // Rotating crystal formations
                if (structure.userData.rotationSpeed) {
                    structure.rotation.y += structure.userData.rotationSpeed * deltaTime;
                }
                
                // Floating structures
                if (structure.userData.floatHeight && structure.userData.originalY) {
                    structure.position.y = structure.userData.originalY + 
                        Math.sin(Date.now() * 0.001 * structure.userData.floatSpeed) * 
                        structure.userData.floatHeight;
                }
                
                // Pulsing effects (for energy orbs)
                if (structure.userData.pulseSpeed) {
                    const scale = 0.9 + 0.2 * Math.sin(Date.now() * 0.001 * structure.userData.pulseSpeed);
                    structure.scale.set(scale, scale, scale);
                    
                    // Also adjust emissive intensity
                    if (structure.material && structure.material.emissiveIntensity) {
                        structure.material.emissiveIntensity = 0.5 + 0.3 * Math.sin(Date.now() * 0.001 * structure.userData.pulseSpeed);
                    }
                }
            }
        }
    }
    
    createLandmarkStructure() {
        // Create a distinctive landmark to help with navigation
        const dirX = Math.round(this.pathDirection.x);
        const dirZ = Math.round(this.pathDirection.z);
        
        // Find a position for the landmark
        const playerGridX = Math.round(this.scene.getObjectByName('player').position.x / this.gridSize);
        const playerGridZ = Math.round(this.scene.getObjectByName('player').position.z / this.gridSize);
        
        // Place it a bit to the side of the path
        const sideX = dirZ !== 0 ? 3 : 0;
        const sideZ = dirX !== 0 ? 3 : 0;
        
        const markerGridX = playerGridX + dirX * 3 + sideX;
        const markerGridZ = playerGridZ + dirZ * 3 + sideZ;
        
        const markerX = markerGridX * this.gridSize;
        const markerZ = markerGridZ * this.gridSize;
        
        // Determine the type of landmark
        const landmarkType = Math.floor(Math.random() * 4);
        
        switch(landmarkType) {
            case 0: // Tall obelisk
                this.createObelisk(markerX, this.platformY, markerZ);
                break;
            case 1: // Floating crystal formation
                this.createCrystalFormation(markerX, this.platformY + 5, markerZ);
                break;
            case 2: // Arch gateway
                this.createArchway(markerX, this.platformY, markerZ, dirX, dirZ);
                break;
            case 3: // Energy beacon
                this.createEnergyBeacon(markerX, this.platformY, markerZ);
                break;
        }
    }
    
    createObelisk(x, y, z) {
        // Create a tall obelisk structure
        const baseGeo = new THREE.BoxGeometry(3, 1, 3);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x283044,
            metalness: 0.7,
            roughness: 0.2
        });
        
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(x, y + 0.5, z);
        base.castShadow = true;
        base.receiveShadow = true;
        this.scene.add(base);
        
        // Tall spire
        const spireGeo = new THREE.CylinderGeometry(0.2, 1, 15, 6);
        const spireMat = new THREE.MeshStandardMaterial({
            color: this.colors.accent,
            emissive: this.colors.accent,
            emissiveIntensity: 0.5,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const spire = new THREE.Mesh(spireGeo, spireMat);
        spire.position.set(x, y + 8, z);
        spire.castShadow = true;
        this.scene.add(spire);
        
        // Add this to special structures
        this.specialStructures.add(base);
        this.specialStructures.add(spire);
        
        return { base, spire };
    }
    
    createCrystalFormation(x, y, z) {
        // Create a group for all crystals
        const crystalGroup = new THREE.Group();
        crystalGroup.position.set(x, y, z);
        
        // Create multiple crystals in formation
        const crystallineGeo = new THREE.DodecahedronGeometry(1);
        
        for (let i = 0; i < 7; i++) {
            const color = new THREE.Color().setHSL(0.6 + Math.random() * 0.1, 0.7, 0.5);
            const crystallineMat = new THREE.MeshStandardMaterial({
                color: color,
                emissive: color,
                emissiveIntensity: 0.5,
                metalness: 0.9,
                roughness: 0.2,
                transparent: true,
                opacity: 0.9
            });
            
            const crystal = new THREE.Mesh(crystallineGeo, crystallineMat);
            
            // Position crystals in a formation
            const angle = (i / 7) * Math.PI * 2;
            const radius = 2 + Math.random();
            crystal.position.set(
                Math.cos(angle) * radius,
                Math.sin(i * 1.5) * 2,
                Math.sin(angle) * radius
            );
            
            // Random rotation and scale
            crystal.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            
            const scale = 0.5 + Math.random() * 1.5;
            crystal.scale.set(scale, scale * 1.5, scale);
            
            crystalGroup.add(crystal);
        }
        
        // Add animation properties
        crystalGroup.userData = {
            rotationSpeed: 0.1,
            floatHeight: 1,
            floatSpeed: 0.2,
            originalY: y
        };
        
        this.scene.add(crystalGroup);
        this.specialStructures.add(crystalGroup);
        
        return crystalGroup;
    }
    
    createArchway(x, y, z, dirX, dirZ) {
        // Create an archway spanning the path
        const archGroup = new THREE.Group();
        archGroup.position.set(x, y, z);
        
        // Determine orientation based on path direction
        const isZAxis = Math.abs(dirZ) > Math.abs(dirX);
        
        // Create pillars
        const pillarGeo = new THREE.BoxGeometry(1, 8, 1);
        const pillarMat = new THREE.MeshStandardMaterial({
            color: 0x283044,
            metalness: 0.6,
            roughness: 0.3
        });
        
        const leftPillar = new THREE.Mesh(pillarGeo, pillarMat);
        const rightPillar = new THREE.Mesh(pillarGeo, pillarMat);
        
        // Position pillars
        const offset = 4;
        if (isZAxis) {
            leftPillar.position.set(-offset, 4, 0);
            rightPillar.position.set(offset, 4, 0);
        } else {
            leftPillar.position.set(0, 4, -offset);
            rightPillar.position.set(0, 4, offset);
        }
        
        archGroup.add(leftPillar);
        archGroup.add(rightPillar);
        
        // Create arch
        const archShape = new THREE.Shape();
        archShape.moveTo(-offset, 0);
        archShape.quadraticCurveTo(0, 5, offset, 0);
        
        const extrudeSettings = {
            steps: 30,
            depth: 1,
            bevelEnabled: true,
            bevelThickness: 0.1,
            bevelSize: 0.2,
            bevelSegments: 3
        };
        
        const archGeo = new THREE.ExtrudeGeometry(archShape, extrudeSettings);
        const archMat = new THREE.MeshStandardMaterial({
            color: this.colors.accent,
            emissive: this.colors.accent,
            emissiveIntensity: 0.3,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const arch = new THREE.Mesh(archGeo, archMat);
        arch.position.set(0, 8, 0);
        
        // Rotate arch to face the right direction
        if (!isZAxis) {
            arch.rotation.y = Math.PI / 2;
        }
        
        archGroup.add(arch);
        
        this.scene.add(archGroup);
        this.specialStructures.add(archGroup);
        
        return archGroup;
    }
    
    createEnergyBeacon(x, y, z) {
        // Create a energy beacon/lighthouse structure
        const baseGeo = new THREE.CylinderGeometry(2, 2.5, 1, 8);
        const baseMat = new THREE.MeshStandardMaterial({
            color: 0x283044,
            metalness: 0.7,
            roughness: 0.2
        });
        
        const base = new THREE.Mesh(baseGeo, baseMat);
        base.position.set(x, y + 0.5, z);
        base.castShadow = true;
        base.receiveShadow = true;
        
        // Tower
        const towerGeo = new THREE.CylinderGeometry(1.5, 2, 10, 8);
        const towerMat = new THREE.MeshStandardMaterial({
            color: 0x1a2639,
            metalness: 0.7,
            roughness: 0.3
        });
        
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.set(x, y + 6, z);
        tower.castShadow = true;
        
        // Energy orb
        const orbGeo = new THREE.SphereGeometry(2, 16, 16);
        const orbMat = new THREE.MeshStandardMaterial({
            color: 0x00f2fe,
            emissive: 0x00f2fe,
            emissiveIntensity: 0.8,
            metalness: 0.9,
            roughness: 0.1,
            transparent: true,
            opacity: 0.8
        });
        
        const orb = new THREE.Mesh(orbGeo, orbMat);
        orb.position.set(x, y + 13, z);
        
        // Add animation data
        orb.userData = {
            pulseSpeed: 1 + Math.random(),
            originalY: y + 13
        };
        
        this.scene.add(base);
        this.scene.add(tower);
        this.scene.add(orb);
        
        this.specialStructures.add(base);
        this.specialStructures.add(tower);
        this.specialStructures.add(orb);
        
        return { base, tower, orb };
    }

    generateSteppedArea(playerGridX, playerGridZ) {
        // Generate a series of platforms with increasing/decreasing heights
        const dirX = Math.round(this.pathDirection.x);
        const dirZ = Math.round(this.pathDirection.z);
        
        // Generate steps ahead in the path
        for (let i = 1; i <= this.gridRadius; i++) {
            const pathX = playerGridX + dirX * i;
            const pathZ = playerGridZ + dirZ * i;
            
            // Step height pattern - alternating between up and down
            const heightPattern = Math.sin(i * Math.PI / 3) * 3;
            const customHeight = this.platformY + heightPattern;
            
            // Main path block
            this.generateCell(pathX, pathZ, customHeight);
            
            // Add some platforms to the sides occasionally
            if (i % 2 === 0) {
                const sideX = dirZ !== 0 ? 1 : 0;
                const sideZ = dirX !== 0 ? 1 : 0;
                
                this.generateCell(pathX + sideX, pathZ + sideZ, customHeight - 1);
                this.generateCell(pathX - sideX, pathZ - sideZ, customHeight - 1);
            }
        }
    }
    
    generateIslands(playerGridX, playerGridZ) {
        // Generate scattered islands with irregular spacing
        const dirX = Math.round(this.pathDirection.x);
        const dirZ = Math.round(this.pathDirection.z);
        
        // Generate the main path first
        for (let i = 1; i <= this.gridRadius; i++) {
            // Skip some positions to create gaps
            if (i % 3 === 0) continue;
            
            const pathX = playerGridX + dirX * i;
            const pathZ = playerGridZ + dirZ * i;
            
            // Main platform with slight height variation
            const height = this.platformY + Math.sin(i * 0.7) * 2;
            this.generateCell(pathX, pathZ, height);
            
            // Add some islands around the main path
            for (let j = 0; j < 3; j++) {
                const offsetX = (Math.random() - 0.5) * 3;
                const offsetZ = (Math.random() - 0.5) * 3;
                const islandX = Math.round(pathX + offsetX);
                const islandZ = Math.round(pathZ + offsetZ);
                
                // Skip if it's on the main path
                if (islandX === pathX && islandZ === pathZ) continue;
                
                // Add island with varying height
                const islandHeight = height + (Math.random() - 0.5) * 2;
                this.generateCell(islandX, islandZ, islandHeight);
            }
        }
    }
    
    generateFloatingIslands(playerGridX, playerGridZ) {
        // Generate floating islands at different heights
        const dirX = Math.round(this.pathDirection.x);
        const dirZ = Math.round(this.pathDirection.z);
        
        // Base height for this section - elevated
        const baseHeight = this.platformY + 8;
        
        // Generate floating platforms along path
        for (let i = 1; i <= this.gridRadius; i++) {
            const pathX = playerGridX + dirX * i;
            const pathZ = playerGridZ + dirZ * i;
            
            // Floating height with sine wave variation
            const floatingHeight = baseHeight + Math.sin(i * 0.8) * 4;
            
            // Create main platform
            this.generateCell(pathX, pathZ, floatingHeight);
            
            // Add some platforms around
            if (i % 2 === 0) {
                // Side platforms
                const sideX = dirZ !== 0 ? 1 : 0;
                const sideZ = dirX !== 0 ? 1 : 0;
                
                this.generateCell(pathX + sideX, pathZ + sideZ, floatingHeight - 1.5);
                this.generateCell(pathX - sideX, pathZ - sideZ, floatingHeight - 1.5);
                
                // Add jump pads occasionally
                if (i % 4 === 0) {
                    const key = gridKey(pathX, pathZ);
                    if (this.platforms.has(key)) {
                        const platform = this.platforms.get(key);
                        const pad = new JumpPad(
                            platform.position.x, 
                            platform.position.y + 0.3, 
                            platform.position.z, 
                            this.scene
                        );
                        this.jumpPads.set(key, pad);
                    }
                }
            }
        }
    }
}