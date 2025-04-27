import * as THREE from 'three';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.platforms = [];
        this.walls = [];
        this.obstacles = [];
        this.platformsPassed = 0;
        
        // Enhanced Mirror's Edge inspired colors
        this.colors = {
            platform: 0xffffff,      // Pure white
            wall: 0xf5f5f5,         // Off-white
            building: 0xe0e0e0,     // Light gray
            window: 0x88ccff,       // Light blue
            ground: 0x333333,      // Dark gray
            accent: 0xff0000,      // Mirror's Edge red
            sky: 0x87CEEB          // Sky blue
        };
        
        // Setup lighting first
        this.setupLighting();
        
        // Setup skybox
        this.setupSkybox();
        
        // Generate the world
        this.generate();
    }

    setupLighting() {
        // Clear existing lights
        while(this.scene.children.find(c => c instanceof THREE.Light)) {
            this.scene.remove(this.scene.children.find(c => c instanceof THREE.Light));
        }

        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);
        
        // Directional light (sun)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 1);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -100;
        directionalLight.shadow.camera.right = 100;
        directionalLight.shadow.camera.top = 100;
        directionalLight.shadow.camera.bottom = -100;
        this.scene.add(directionalLight);
        
        // Hemisphere light for natural outdoor feel
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
        this.scene.add(hemisphereLight);
    }

    setupSkybox() {
        // Clear existing skybox/fog
        this.scene.background = new THREE.Color(this.colors.sky);
        this.scene.fog = new THREE.FogExp2(this.colors.sky, 0.002);
    }

    generate() {
        // Clear existing platforms and walls
        this.clear();
        
        // Create a modern city environment
        this.createCityEnvironment();
    }

    createCityEnvironment() {
        // Create ground with Mirror's Edge style
        this.createPlatform(0, -0.5, 0, 200, 1, 200, this.colors.ground);
        
        // Create starting area
        this.createStartingArea();
        
        // Create main parkour route
        this.createParkourRoute();
        
        // Create surrounding buildings
        this.createSurroundingBuildings();
        
        // Add some parkour props
        this.addParkourProps();
    }

    createStartingArea() {
        // Starting platform (larger for better visibility)
        this.createPlatform(0, 2, 0, 10, 0.5, 10, this.colors.platform);
        
        // Starting wall for wall run (with visual indicator)
        const startWall = this.createWall(-5, 2, 0, 0.2, 6, 10, this.colors.wall);
        
        // Add red accent to indicate wall run surface
        this.addWallRunIndicator(startWall);
        
        // Ramp to first platform (with safety rails)
        this.createRamp(0, 2, 10, 6, 2, 4, this.colors.platform);
        this.createWall(0, 4, 12, 6, 0.2, 0.2, this.colors.accent); // Safety rail
    }

    addWallRunIndicator(wall) {
        // Add red stripe at optimal wall run height
        const stripeGeometry = new THREE.PlaneGeometry(wall.geometry.parameters.depth, 0.5);
        const stripeMaterial = new THREE.MeshStandardMaterial({
            color: this.colors.accent,
            emissive: this.colors.accent,
            emissiveIntensity: 0.3
        });
        
        const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
        stripe.position.set(wall.position.x, wall.position.y, wall.position.z);
        stripe.rotation.y = Math.PI / 2;
        stripe.position.y += 1.5; // Optimal wall run height
        
        // Offset slightly from wall surface
        if (wall.position.x > 0) {
            stripe.position.x -= 0.1;
        } else {
            stripe.position.x += 0.1;
        }
        
        this.scene.add(stripe);
        this.obstacles.push(stripe);
    }

    createParkourRoute() {
        // First section - Wall runs and platforms
        this.createWallRunSection(0, 4, 15);
        
        // Second section - Gaps and jumps
        this.createGapSection(0, 6, 30);
        
        // Third section - Vertical climbing
        this.createVerticalSection(0, 8, 45);
        
        // Fourth section - Technical parkour
        this.createTechnicalSection(0, 10, 60);
        
        // Final platform
        this.createPlatform(0, 10, 80, 15, 0.5, 15, this.colors.platform);
        this.createWall(0, 13, 80, 15, 6, 0.2, this.colors.accent); // Finish line
    }

    createWallRunSection(x, y, z) {
        // Main platform
        this.createPlatform(x, y, z, 8, 0.5, 8, this.colors.platform);
        
        // Wall run walls with indicators
        const leftWall = this.createWall(x - 4, y, z, 0.2, 6, 8, this.colors.wall);
        const rightWall = this.createWall(x + 4, y, z, 0.2, 6, 8, this.colors.wall);
        this.addWallRunIndicator(leftWall);
        this.addWallRunIndicator(rightWall);
        
        // Connecting platform with a gap
        this.createPlatform(x, y, z + 10, 6, 0.5, 6, this.colors.platform);
        
        // Pole for wall jump
        this.createPole(x - 3, y + 1, z + 5, 0.1, 4, this.colors.accent);
    }

    createGapSection(x, y, z) {
        // Series of platforms with gaps
        for (let i = 0; i < 4; i++) {
            const platform = this.createPlatform(x, y, z + i * 7, 5, 0.5, 5, this.colors.platform);
            
            // Add visual indicators for jump distance
            if (i > 0) {
                this.createPlatform(x, y - 0.4, z + (i - 0.5) * 7, 5, 0.1, 0.5, this.colors.accent);
            }
        }
        
        // Wall for wall run between gaps
        const gapWall = this.createWall(x + 3, y, z, 0.2, 6, 25, this.colors.wall);
        this.addWallRunIndicator(gapWall);
        
        // Add some vaultable obstacles
        this.createObstacle(x - 2, y + 0.5, z + 3, 1, 1, 1, this.colors.accent);
        this.createObstacle(x - 2, y + 0.5, z + 10, 1, 1, 1, this.colors.accent);
    }

    createVerticalSection(x, y, z) {
        // Vertical climbing section with multiple paths
        for (let i = 0; i < 4; i++) {
            // Main climbing platforms
            const platform = this.createPlatform(x, y + i * 3, z, 5, 0.5, 5, this.colors.platform);
            
            // Walls for wall jumps
            if (i > 0) {
                const wall = this.createWall(x - 3, y + (i - 0.5) * 3, z, 0.2, 3, 5, this.colors.wall);
                this.addWallRunIndicator(wall);
            }
            
            // Add some pipes for alternative climbing
            if (i < 3) {
                this.createPole(x + 2, y + i * 3 + 1.5, z, 0.1, 3, this.colors.accent);
            }
        }
        
        // Add a slide down option
        this.createRamp(x + 3, y + 9, z + 5, 4, 2, 8, this.colors.platform);
    }

    createTechnicalSection(x, y, z) {
        // Complex parkour section with various elements
        this.createPlatform(x, y, z, 6, 0.5, 6, this.colors.platform);
        
        // Precision jumps
        this.createPlatform(x - 5, y, z + 5, 2, 0.5, 2, this.colors.platform);
        this.createPlatform(x + 5, y, z + 5, 2, 0.5, 2, this.colors.platform);
        
        // Wall run transfer
        const transferWall = this.createWall(x, y, z + 8, 6, 6, 0.2, this.colors.wall);
        this.addWallRunIndicator(transferWall);
        this.createPlatform(x, y, z + 10, 6, 0.5, 6, this.colors.platform);
        
        // Monkey bars area
        this.createMonkeyBars(x, y + 3, z + 15);
        
        // Rolling obstacle
        this.createRollingObstacle(x, y + 0.5, z + 20);
    }

    createMonkeyBars(x, y, z) {
        // Horizontal bar
        this.createPole(x, y, z, 5, 0.1, 0.1, this.colors.accent);
        
        // Support poles
        this.createPole(x - 2.5, y - 2, z, 0.1, 2, 0.1, this.colors.accent);
        this.createPole(x + 2.5, y - 2, z, 0.1, 2, 0.1, this.colors.accent);
        
        // Landing platform
        this.createPlatform(x, y - 2, z + 3, 4, 0.5, 4, this.colors.platform);
    }

    createRollingObstacle(x, y, z) {
        // Cylinder obstacle that can be rolled over
        const geometry = new THREE.CylinderGeometry(1, 1, 2, 16);
        const material = new THREE.MeshStandardMaterial({
            color: this.colors.accent,
            metalness: 0.5,
            roughness: 0.7
        });
        
        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.position.set(x, y, z);
        obstacle.rotation.z = Math.PI / 2; // Lay it horizontally
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        
        this.scene.add(obstacle);
        this.obstacles.push(obstacle);
    }

    createSurroundingBuildings() {
        // Create modern buildings around the parkour route
        const buildingPositions = [
            { x: -30, z: 0 }, { x: 30, z: 0 },
            { x: 0, z: -30 }, { x: 0, z: 30 },
            { x: -25, z: -25 }, { x: 25, z: -25 },
            { x: -25, z: 25 }, { x: 25, z: 25 }
        ];
        
        buildingPositions.forEach(pos => {
            this.createBuilding(pos.x, 0, pos.z);
        });
    }

    createBuilding(x, y, z) {
        const height = 20 + Math.random() * 30;
        const width = 8 + Math.random() * 10;
        const depth = 8 + Math.random() * 10;
        
        // Main building structure
        const building = this.createWall(x, y + height/2, z, width, height, depth, this.colors.building);
        
        // Add some architectural details
        this.addBuildingDetails(x, y, z, width, height, depth);
        
        // Occasionally add a rooftop platform
        if (Math.random() > 0.7) {
            this.createPlatform(x, y + height, z, width * 0.8, 0.5, depth * 0.8, this.colors.platform);
        }
    }

    addBuildingDetails(x, y, z, width, height, depth) {
        // Add windows in grid pattern
        const windowSize = 1.5;
        const windowSpacing = 2.5;
        
        for (let h = 2; h < height; h += windowSpacing) {
            for (let w = -width/2 + 1; w < width/2; w += windowSpacing) {
                // Front and back windows
                this.createWindow(x + w, y + h, z + depth/2 + 0.1, windowSize, windowSize);
                this.createWindow(x + w, y + h, z - depth/2 - 0.1, windowSize, windowSize);
                
                // Side windows (for square buildings)
                if (width === depth) {
                    this.createWindow(x + width/2 + 0.1, y + h, z + w, windowSize, windowSize);
                    this.createWindow(x - width/2 - 0.1, y + h, z + w, windowSize, windowSize);
                }
            }
        }
        
        // Add some vertical accents
        for (let i = 0; i < 4; i++) {
            const accentX = x - width/2 + (width / 3) * i;
            this.createWall(accentX, y + height/2, z + depth/2 + 0.2, 0.3, height, 0.1, this.colors.accent);
        }
    }

    addParkourProps() {
        // Add some miscellaneous parkour props
        this.createPole(10, 3, 15, 0.1, 4, this.colors.accent);
        this.createPole(-8, 5, 25, 0.1, 4, this.colors.accent);
        
        // Add some platforms between buildings
        this.createPlatform(-20, 15, 0, 5, 0.5, 5, this.colors.platform);
        this.createPlatform(20, 15, 0, 5, 0.5, 5, this.colors.platform);
        
        // Add some ziplines or ropes (visual only)
        this.createRope(-20, 16, 0, 20, 16, 0);
    }

    createWindow(x, y, z, width, height) {
        const geometry = new THREE.PlaneGeometry(width, height);
        const material = new THREE.MeshStandardMaterial({
            color: this.colors.window,
            metalness: 0.9,
            roughness: 0.1,
            emissive: this.colors.window,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.8
        });
        
        const window = new THREE.Mesh(geometry, material);
        window.position.set(x, y, z);
        this.scene.add(window);
        this.obstacles.push(window);
    }

    createPole(x, y, z, radius, height, color) {
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 8);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.5,
            roughness: 0.5
        });
        
        const pole = new THREE.Mesh(geometry, material);
        pole.position.set(x, y + height/2, z);
        pole.castShadow = true;
        pole.receiveShadow = true;
        
        this.scene.add(pole);
        this.obstacles.push(pole);
        return pole;
    }

    createRope(x1, y1, z1, x2, y2, z2) {
        const curve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(x1, y1, z1),
            new THREE.Vector3((x1+x2)/2, (y1+y2)/2 - 2, (z1+z2)/2),
            new THREE.Vector3(x2, y2, z2)
        ]);
        
        const points = curve.getPoints(20);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: this.colors.accent });
        
        const rope = new THREE.Line(geometry, material);
        this.scene.add(rope);
        this.obstacles.push(rope);
    }

    createObstacle(x, y, z, width, height, depth, color) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.3,
            roughness: 0.4
        });
        
        const obstacle = new THREE.Mesh(geometry, material);
        obstacle.position.set(x, y, z);
        obstacle.castShadow = true;
        obstacle.receiveShadow = true;
        
        this.scene.add(obstacle);
        this.obstacles.push(obstacle);
        return obstacle;
    }

    createRamp(x, y, z, width, height, depth, color = this.colors.platform) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.2,
            roughness: 0.3,
            emissive: color,
            emissiveIntensity: 0.1
        });
        
        const ramp = new THREE.Mesh(geometry, material);
        ramp.position.set(x, y, z);
        ramp.rotation.x = -Math.PI / 6; // 30-degree angle
        ramp.castShadow = true;
        ramp.receiveShadow = true;
        
        this.scene.add(ramp);
        this.platforms.push(ramp);
        return ramp;
    }

    createPlatform(x, y, z, width, height, depth, color = this.colors.platform) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.2,
            roughness: 0.3,
            emissive: color,
            emissiveIntensity: 0.1
        });
        
        const platform = new THREE.Mesh(geometry, material);
        platform.position.set(x, y, z);
        platform.castShadow = true;
        platform.receiveShadow = true;
        
        this.scene.add(platform);
        this.platforms.push(platform);
        return platform;
    }

    createWall(x, y, z, width, height, depth, color = this.colors.wall) {
        const geometry = new THREE.BoxGeometry(width, height, depth);
        const material = new THREE.MeshStandardMaterial({
            color: color,
            metalness: 0.2,
            roughness: 0.3,
            emissive: color,
            emissiveIntensity: 0.1
        });
        
        const wall = new THREE.Mesh(geometry, material);
        wall.position.set(x, y, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        
        this.scene.add(wall);
        this.walls.push(wall);
        return wall;
    }

    clear() {
        this.platforms.forEach(platform => this.scene.remove(platform));
        this.walls.forEach(wall => this.scene.remove(wall));
        this.obstacles.forEach(obstacle => this.scene.remove(obstacle));
        this.platforms = [];
        this.walls = [];
        this.obstacles = [];
    }

    update(deltaTime) {
        // Update any dynamic elements here
    }
}