import * as THREE from 'three';
import { SoundManager } from './sound.js';

export class PlayerController {
    constructor(camera, scene, world) {
        this.camera = camera;
        this.scene = scene;
        this.world = world;
        
        // Movement properties
        this.moveSpeed = 5;
        this.sprintSpeed = 8;
        this.jumpForce = 14;
        this.gravity = 25;
        this.airControl = 0.7;
        this.friction = 10;
        this.acceleration = 20;

        // Wall run properties
        this.wallRunGravity = 8;
        this.wallRunTime = 0;
        this.maxWallRunTime = 1.5;
        this.wallJumpForce = 8;

        // Camera effects
        this.jumpCameraOffset = 0;
        this.cameraEffects = {
            jumpRise: 0.2,     // How much camera rises during jump
            jumpFall: 0.15,    // How much camera lowers on landing
            landingShake: 0.05, // Camera shake on landing
            bobStrength: 0.015, // How much camera bobs during movement
            fallVelocity: 0     // Tracks fall velocity for landing impact
        };

        // Stamina system
        this.stamina = 1.0; // 0.0 to 1.0
        this.staminaRegenRate = 0.2; // per second
        this.sprintStaminaDrain = 0.3; // per second
        this.wallRunStaminaDrain = 0.4; // per second
        this.jumpStaminaCost = 0.1; // immediate cost

        // Player state
        this.position = new THREE.Vector3(0, 4, 0);
        this.velocity = new THREE.Vector3();
        this.isGrounded = false;
        this.wasGrounded = false; // Track previous grounded state for landing effects
        this.isWallRunning = false;
        this.wallNormal = new THREE.Vector3();
        this.isDead = false;
        this.respawnPoint = new THREE.Vector3(0, 4, 0);
        this.lastPlatform = null;
        this.deathCount = 0;
        
        // Character visibility
        this.characterVisible = false; // Start with character hidden

        // Mouse controls
        this.yaw = 0;
        this.pitch = 0;
        this.mouseSensitivity = 0.002;

        // Collider size
        this.colliderSize = { x: 0.3, y: 1.8, z: 0.3 };

        // Sound system
        this.soundManager = new SoundManager();
        this.lastFootstepTime = 0;
        this.footstepInterval = 0.4; // seconds between footsteps
        this.initCharacter();
        this.initControls();
        
        // Jump feedback
        this.canJump = true;
        this.jumpCooldown = 0.2; // seconds
        this.jumpTimer = 0;
    }

    initCharacter() {
        // Simple character model (replace with your actual model)
        this.character = new THREE.Group();
        
        // Body
        const bodyGeo = new THREE.BoxGeometry(0.5, 1.5, 0.3);
        const bodyMat = new THREE.MeshStandardMaterial({ 
            color: 0x00f2fe,
            emissive: 0x00f2fe,
            emissiveIntensity: 0.3,
            transparent: true,
            opacity: 0.7
        });
        this.body = new THREE.Mesh(bodyGeo, bodyMat);
        this.body.position.y = 0.75;
        this.character.add(this.body);
        
        // Head
        const headGeo = new THREE.SphereGeometry(0.25, 16, 16);
        const headMat = new THREE.MeshStandardMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.7
        });
        this.head = new THREE.Mesh(headGeo, headMat);
        this.head.position.y = 1.6;
        this.character.add(this.head);
        
        // Arms and legs (simple boxes)
        this.createLimb(0.2, 0.6, 0.15, 0.3, 1.4, 0, 0x00f2fe); // Right arm
        this.createLimb(0.2, 0.6, 0.15, -0.3, 1.4, 0, 0x00f2fe); // Left arm
        this.createLimb(0.25, 0.7, 0.2, 0.15, 0, 0, 0x7eeeff); // Right leg
        this.createLimb(0.25, 0.7, 0.2, -0.15, 0, 0, 0x7eeeff); // Left leg
        
        // Make the character transparent and position it slightly offset from camera
        this.character.position.z = -0.5; // Position slightly in front
        
        // Set initial visibility
        this.character.traverse(child => {
            if (child.isMesh) {
                child.visible = this.characterVisible;
            }
        });
        
        this.scene.add(this.character);
    }

    createLimb(w, h, d, x, y, z, color) {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshStandardMaterial({ 
            color, 
            transparent: true, 
            opacity: 0.7
        });
        const limb = new THREE.Mesh(geo, mat);
        limb.position.set(x, y, z);
        this.character.add(limb);
        return limb;
    }

    getColliderBox() {
        // Always recalculate collider based on position
        return new THREE.Box3(
            new THREE.Vector3(
                this.position.x - this.colliderSize.x,
                this.position.y,
                this.position.z - this.colliderSize.z
            ),
            new THREE.Vector3(
                this.position.x + this.colliderSize.x,
                this.position.y + this.colliderSize.y,
                this.position.z + this.colliderSize.z
            )
        );
    }

    initControls() {
        this.keys = {
            forward: false,
            backward: false,
            left: false,
            right: false,
            jump: false,
            sprint: false,
            toggleCharacter: false
        };

        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        document.addEventListener('click', () => {
            document.body.requestPointerLock();
        });
        document.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === document.body) {
                this.yaw -= e.movementX * this.mouseSensitivity;
                this.pitch -= e.movementY * this.mouseSensitivity;
                // Clamp pitch to -85 to +85 degrees
                const maxPitch = Math.PI / 2 * 0.95;
                this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));
            }
        });
    }

    onKeyDown(e) {
        switch (e.code) {
            case 'KeyW': this.keys.forward = true; break;
            case 'KeyS': this.keys.backward = true; break;
            case 'KeyA': this.keys.left = true; break;
            case 'KeyD': this.keys.right = true; break;
            case 'Space': this.keys.jump = true; break;
            case 'ShiftLeft': this.keys.sprint = true; break;
            case 'KeyV': 
                if (!this.keys.toggleCharacter) {
                    this.keys.toggleCharacter = true;
                    this.toggleCharacterVisibility();
                }
                break;
        }
    }

    onKeyUp(e) {
        switch (e.code) {
            case 'KeyW': this.keys.forward = false; break;
            case 'KeyS': this.keys.backward = false; break;
            case 'KeyA': this.keys.left = false; break;
            case 'KeyD': this.keys.right = false; break;
            case 'Space': this.keys.jump = false; break;
            case 'ShiftLeft': this.keys.sprint = false; break;
            case 'KeyV': this.keys.toggleCharacter = false; break;
        }
    }

    toggleCharacterVisibility() {
        this.characterVisible = !this.characterVisible;
        
        // Set the visibility of all character parts
        this.character.traverse(child => {
            if (child.isMesh) {
                child.visible = this.characterVisible;
            }
        });
        
        console.log(`Character visibility: ${this.characterVisible ? 'VISIBLE' : 'HIDDEN'}`);
    }

    update(deltaTime) {
        if (this.isDead) return;
        
        // Update jump cooldown timer
        if (!this.canJump) {
            this.jumpTimer += deltaTime;
            if (this.jumpTimer >= this.jumpCooldown) {
                this.canJump = true;
                this.jumpTimer = 0;
            }
        }
        
        this.handleMovement(deltaTime);
        this.updatePhysics(deltaTime);
        this.checkCollisions();
        this.updateCamera();
        this.updateCharacterAnimation(deltaTime);
    }

    handleMovement(deltaTime) {
        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        forward.normalize();

        const right = new THREE.Vector3();
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0));

        const moveDirection = new THREE.Vector3();
        if (this.keys.forward) moveDirection.add(forward);
        if (this.keys.backward) moveDirection.sub(forward);
        if (this.keys.left) moveDirection.sub(right);
        if (this.keys.right) moveDirection.add(right);

        // Handle stamina regeneration and drain
        this.updateStamina(deltaTime);

        if (moveDirection.lengthSq() > 0) {
            moveDirection.normalize();
            // Determine if player can sprint based on stamina
            const canSprint = this.keys.sprint && this.stamina > 0;
            const targetSpeed = canSprint ? this.sprintSpeed : this.moveSpeed;

            if (this.isGrounded || this.isWallRunning) {
                const acceleration = this.acceleration * deltaTime;
                this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveDirection.x * targetSpeed, acceleration);
                this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveDirection.z * targetSpeed, acceleration);

                // Play footstep sounds only when actually moving
                const currentTime = performance.now() / 1000;
                const isMoving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1;
                if (this.isGrounded && isMoving && currentTime - this.lastFootstepTime > this.footstepInterval) {
                    this.soundManager.playFootstep(canSprint);
                    this.lastFootstepTime = currentTime;
                } else if (!isMoving) {
                    this.soundManager.stopFootsteps();
                }
            } else {
                const airAcceleration = this.acceleration * this.airControl * deltaTime;
                this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveDirection.x * targetSpeed, airAcceleration);
                this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveDirection.z * targetSpeed, airAcceleration);
                this.soundManager.stopFootsteps();
            }
        } else if (this.isGrounded) {
            const frictionFactor = Math.min(1, this.friction * deltaTime);
            this.velocity.x *= 1 - frictionFactor;
            this.velocity.z *= 1 - frictionFactor;
            this.soundManager.stopFootsteps();
        }

        // Improved jumping with better responsiveness
        this.handleJumping(deltaTime);
    }

    // New method to handle jumping separately for better control
    handleJumping(deltaTime) {
        // Track previous grounded state
        this.wasGrounded = this.isGrounded;
        
        // Process jump key
        if (this.keys.jump) {
            // Normal jump from ground
            if (this.isGrounded && this.stamina >= this.jumpStaminaCost) {
                // Apply immediate jump force with higher value
                this.velocity.y = this.jumpForce;
                this.isGrounded = false;
                this.stamina -= this.jumpStaminaCost;
                this.soundManager.playSound('jump', { volume: 0.5 });
                
                // Camera rise effect - prepare for upward movement
                this.cameraEffects.fallVelocity = 0; // Reset fall velocity
                this.jumpCameraOffset = -0.1; // Initial dip before rise
            } 
            // Wall jump
            else if (this.isWallRunning && this.stamina >= this.jumpStaminaCost * 2) {
                this.velocity.y = this.wallJumpForce;
                this.velocity.add(this.wallNormal.clone().multiplyScalar(5));
                this.isWallRunning = false;
                this.stamina -= this.jumpStaminaCost * 2;
                this.soundManager.playWallRun();
                
                // Camera effect for wall jump
                this.jumpCameraOffset = -0.15;
            }
        }
        
        // Check for landing
        if (!this.wasGrounded && this.isGrounded) {
            // We just landed
            const landingIntensity = Math.min(1.0, Math.abs(this.cameraEffects.fallVelocity) / 20);
            this.jumpCameraOffset = -this.cameraEffects.jumpFall * landingIntensity;
            
            // Play landing sound with volume based on fall speed
            if (landingIntensity > 0.3) {
                this.soundManager.playSound('land', { volume: Math.min(1.0, landingIntensity * 0.8) });
            }
        }
        
        // Track fall velocity for landing effects
        if (!this.isGrounded) {
            this.cameraEffects.fallVelocity = this.velocity.y;
        }
        
        // Update camera offset for jump/land effects
        if (this.jumpCameraOffset < 0) {
            // Camera is dipped down, bring it back up
            this.jumpCameraOffset = Math.min(0, this.jumpCameraOffset + deltaTime * 2);
        } else if (this.jumpCameraOffset > 0) {
            // Camera is lifted up, bring it back down
            this.jumpCameraOffset = Math.max(0, this.jumpCameraOffset - deltaTime * 2);
        }
        
        // When rising in a jump, add extra camera lift
        if (!this.isGrounded && this.velocity.y > 0) {
            // Apply stronger upward camera motion during jump rise
            this.jumpCameraOffset = this.cameraEffects.jumpRise * (this.velocity.y / this.jumpForce);
        }
    }

    updateStamina(deltaTime) {
        // Regenerate stamina when not sprinting or wall running
        if (!this.keys.sprint && !this.isWallRunning) {
            this.stamina = Math.min(1.0, this.stamina + this.staminaRegenRate * deltaTime);
        }
        
        // Drain stamina when sprinting
        if (this.keys.sprint && (this.isGrounded || this.isWallRunning) && this.velocity.lengthSq() > 0.1) {
            this.stamina = Math.max(0, this.stamina - this.sprintStaminaDrain * deltaTime);
        }
        
        // Drain stamina when wall running
        if (this.isWallRunning) {
            this.stamina = Math.max(0, this.stamina - this.wallRunStaminaDrain * deltaTime);
            
            // If out of stamina, stop wall running
            if (this.stamina <= 0) {
                this.isWallRunning = false;
            }
        }
    }

    updateCharacterAnimation(deltaTime) {
        if (!this.character) return;
        // Position character at player position
        this.character.position.copy(this.position);
        // Running animation
        if (this.isGrounded && this.velocity.length() > 0.5) {
            const runSpeed = this.velocity.length() * 0.5;
            const legAngle = Math.sin(Date.now() * 0.01 * runSpeed) * 0.5;
            // Animate legs
            this.character.children[3].rotation.x = legAngle; // Right leg
            this.character.children[4].rotation.x = -legAngle; // Left leg
            // Animate arms
            this.character.children[1].rotation.x = -legAngle; // Right arm
            this.character.children[2].rotation.x = legAngle; // Left arm
        } else {
            // Reset to idle position
            this.character.children[3].rotation.x = 0;
            this.character.children[4].rotation.x = 0;
            this.character.children[1].rotation.x = 0;
            this.character.children[2].rotation.x = 0;
        }
        // Jump/wallrun animation
        if (!this.isGrounded) {
            const airTime = Math.min(1, this.velocity.y * 0.1);
            this.character.rotation.x = airTime * 0.5;
        } else {
            this.character.rotation.x = 0;
        }
    }

    updatePhysics(deltaTime) {
        // Apply appropriate gravity
        if (!this.isGrounded && !this.isWallRunning) {
            // Improved gravity application for better jump feel
            if (this.velocity.y > 0) {
                // Rising - reduced gravity for more floaty jumps 
                this.velocity.y -= this.gravity * 0.8 * deltaTime;
            } else {
                // Falling - increased gravity for faster falls
                this.velocity.y -= this.gravity * 1.4 * deltaTime;
            }
        } else if (this.isWallRunning) {
            // Wall running has reduced gravity
            this.velocity.y -= this.wallRunGravity * deltaTime;
            this.wallRunTime += deltaTime;
            if (this.wallRunTime > this.maxWallRunTime) {
                this.isWallRunning = false;
            }
        }
        
        // Apply velocity with clamping to prevent extreme values
        const maxHorizontalSpeed = 20; // Max horizontal speed cap
        const maxVerticalSpeed = 30;   // Max vertical speed cap
        
        // Clamp horizontal velocity
        const horizontalVelocity = new THREE.Vector2(this.velocity.x, this.velocity.z);
        if (horizontalVelocity.length() > maxHorizontalSpeed) {
            horizontalVelocity.normalize().multiplyScalar(maxHorizontalSpeed);
            this.velocity.x = horizontalVelocity.x;
            this.velocity.z = horizontalVelocity.y;
        }
        
        // Clamp vertical velocity
        this.velocity.y = Math.max(-maxVerticalSpeed, Math.min(maxVerticalSpeed, this.velocity.y));
        
        // Create a copy of the velocity for this frame's movement
        const frameVelocity = this.velocity.clone().multiplyScalar(deltaTime);
        
        // First move horizontally and check for collisions
        const originalY = this.position.y;
        this.position.x += frameVelocity.x;
        this.position.z += frameVelocity.z;
        
        // Check for horizontal collisions and adjust
        this.checkHorizontalCollisions();
        
        // Then move vertically and check for collisions
        this.position.y += frameVelocity.y;
        this.checkVerticalCollisions();
    }
    
    checkHorizontalCollisions() {
        // Check walls for horizontal collisions
        for (const wall of this.world.walls) {
            const wallBox = new THREE.Box3().setFromObject(wall);
            const playerBox = this.getColliderBox();
            
            if (playerBox.intersectsBox(wallBox)) {
                // Determine which axis has the smallest overlap
                const overlap = new THREE.Box3();
                overlap.copy(playerBox).intersect(wallBox);
                
                const overlapSize = new THREE.Vector3(
                    overlap.max.x - overlap.min.x,
                    overlap.max.y - overlap.min.y,
                    overlap.max.z - overlap.min.z
                );
                
                // Determine which direction to push the player
                // Move in the direction of minimal overlap
                if (overlapSize.x < overlapSize.z) {
                    // X-axis collision
                    const pushDirection = this.position.x < wallBox.getCenter(new THREE.Vector3()).x ? -1 : 1;
                    this.position.x += pushDirection * (overlapSize.x + 0.01); // Push out with small extra margin
                    this.velocity.x = 0;
                } else {
                    // Z-axis collision
                    const pushDirection = this.position.z < wallBox.getCenter(new THREE.Vector3()).z ? -1 : 1;
                    this.position.z += pushDirection * (overlapSize.z + 0.01); // Push out with small extra margin
                    this.velocity.z = 0;
                }
            }
        }
    }
    
    checkVerticalCollisions() {
        // Ground collision detection
        if (this.position.y < 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
        }
        
        // Platform collisions
        for (let platform of this.world.platforms.values()) {
            const box = new THREE.Box3().setFromObject(platform);
            const feetY = this.position.y;
            const platformTop = box.max.y;
            const headY = this.position.y + this.colliderSize.y;
            const epsilon = 0.5;

            // Check if player is over any platform
            if (
                this.position.x > box.min.x &&
                this.position.x < box.max.x &&
                this.position.z > box.min.z &&
                this.position.z < box.max.z
            ) {
                // Land on platform when falling
                if (
                    this.velocity.y <= 0 &&
                    feetY > platformTop - epsilon &&
                    feetY < platformTop + epsilon
                ) {
                    this.position.y = platformTop;
                    this.velocity.y = 0;
                    this.isGrounded = true;
                    this.wallRunTime = 0;
                    this.lastPlatform = platform;
                }
                // Hit head on platform above
                else if (
                    this.velocity.y > 0 &&
                    headY > box.min.y - epsilon &&
                    headY < box.min.y + this.colliderSize.y
                ) {
                    this.position.y = box.min.y - this.colliderSize.y;
                    this.velocity.y = 0;
                }
            }
        }
        
        // Moving platform collisions
        if (this.world.movingPlatforms) {
            for (const platform of this.world.movingPlatforms) {
                const box = new THREE.Box3().setFromObject(platform);
                const feetY = this.position.y;
                const platformTop = box.max.y;
                const headY = this.position.y + this.colliderSize.y;
                const epsilon = 0.5;
                
                // Check if player is over any platform
                if (
                    this.position.x > box.min.x &&
                    this.position.x < box.max.x &&
                    this.position.z > box.min.z &&
                    this.position.z < box.max.z
                ) {
                    // Land on platform when falling
                    if (
                        this.velocity.y <= 0 &&
                        feetY > platformTop - epsilon &&
                        feetY < platformTop + epsilon
                    ) {
                        this.position.y = platformTop;
                        this.velocity.y = 0;
                        this.isGrounded = true;
                        this.wallRunTime = 0;
                        this.lastPlatform = platform;
                        
                        // If the platform is moving, apply its movement to the player
                        if (platform.userData && platform.userData.direction) {
                            // Get platform velocity
                            const speed = platform.userData.speed || 1;
                            const dir = platform.userData.direction;
                            const time = Date.now() * 0.001 * speed;
                            const platformVelocity = dir.clone().multiplyScalar(Math.cos(time) * speed * 2);
                            
                            // Apply to player
                            this.velocity.x += platformVelocity.x * 0.5;
                            this.velocity.z += platformVelocity.z * 0.5;
                        }
                    }
                    // Hit head on platform above
                    else if (
                        this.velocity.y > 0 &&
                        headY > box.min.y - epsilon &&
                        headY < box.min.y + this.colliderSize.y
                    ) {
                        this.position.y = box.min.y - this.colliderSize.y;
                        this.velocity.y = 0;
                    }
                }
            }
        }
    }

    checkCollisions() {
        this.isGrounded = false;
        this.isWallRunning = false;
        
        let wallRunCandidate = null;
        let wasGrounded = this.isGrounded;

        // Check for wall running
        for (const wall of this.world.walls) {
            const wallBox = new THREE.Box3().setFromObject(wall);
            const sideDist = 0.6;
            
            // Wall run detection
            if (
                !this.isGrounded && 
                this.velocity.y < 0 &&
                this.checkWallRunEligibility(wallBox, sideDist)
            ) {
                wallRunCandidate = this.getWallRunNormal(wallBox);
            }
        }

        if (wallRunCandidate) {
            this.startWallRun(wallRunCandidate);
        }
        
        // Die if falling into the void (below y = -10)
        if (this.position.y < -10) {
            this.die();
            return;
        }
        
        // Check if we should increase difficulty or give score for traveling
        if (!wasGrounded && this.isGrounded && this.lastPlatform) {
            // Player just landed on a platform after jumping
            // Player is making progress - give a small score boost
            if (this.lastScore) {
                // Compute distance from last scored platform
                const dist = this.lastScore.distanceTo(this.lastPlatform.position);
                if (dist > 8) {  // Only score for new platforms, not just jumping in place
                    // Trigger event in main game
                    const event = new CustomEvent('platform_reached', { 
                        detail: { platform: this.lastPlatform } 
                    });
                    document.dispatchEvent(event);
                    
                    // Remember this platform
                    this.lastScore = this.lastPlatform.position.clone();
                }
            } else {
                this.lastScore = this.lastPlatform.position.clone();
            }
        }
    }

    checkWallRunEligibility(wallBox, sideDist) {
        return (
            (this.position.x < wallBox.max.x && this.position.x > wallBox.min.x - sideDist &&
             this.position.z > wallBox.min.z && this.position.z < wallBox.max.z) ||
            (this.position.x > wallBox.min.x && this.position.x < wallBox.max.x + sideDist &&
             this.position.z > wallBox.min.z && this.position.z < wallBox.max.z)
        );
    }

    getWallRunNormal(wallBox) {
        const wallCenter = wallBox.getCenter(new THREE.Vector3());
        const playerToWall = new THREE.Vector3().subVectors(this.position, wallCenter);
        return new THREE.Vector3(
            Math.sign(playerToWall.x),
            0,
            0
        );
    }

    startWallRun(normal) {
        if (!this.isWallRunning) {
            this.isWallRunning = true;
            this.wallNormal.copy(normal);
            this.wallRunTime = 0;
            this.velocity.y = Math.max(0, this.velocity.y * 0.5);
            this.soundManager.playWallRun();
        }
    }

    updateCamera() {
        // Position camera slightly above and behind the player's head for better visibility
        const targetPosition = this.position.clone();
        targetPosition.y += 2.0; // Higher eye height
        targetPosition.z -= 0.5; // Slightly behind
        
        // Add jump camera offset to y position
        targetPosition.y += this.jumpCameraOffset;
        
        // Smoothly interpolate camera position (reduces jerkiness)
        this.camera.position.lerp(targetPosition, 0.5);
        
        // Set camera rotation based on yaw and pitch
        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
        
        // Add subtle camera sway while moving
        if (!this.isGrounded) {
            // Add more pronounced movement in the air
            const airSway = Math.sin(Date.now() * 0.002) * 0.01;
            this.camera.rotation.z = airSway;
        } else if (Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1) {
            // Add subtle head bob when walking/running
            const speed = new THREE.Vector2(this.velocity.x, this.velocity.z).length();
            const bobFrequency = this.keys.sprint ? 12 : 8; // Faster head bob when sprinting
            const bobAmount = this.cameraEffects.bobStrength * (this.keys.sprint ? 1.5 : 1.0);
            const verticalBob = Math.sin(Date.now() * 0.01 * bobFrequency) * bobAmount * speed;
            const horizontalBob = Math.cos(Date.now() * 0.01 * bobFrequency * 0.5) * bobAmount * 0.5 * speed;
            
            this.camera.position.y += verticalBob;
            this.camera.rotation.z = horizontalBob;
        } else {
            // Reset when standing still
            this.camera.rotation.z = 0;
        }
        
        // Update character position to follow camera but offset forward
        this.character.position.copy(this.camera.position);
        this.character.position.y -= 1.7; // Position at feet level
        
        // Position character in front of camera
        const forward = new THREE.Vector3(0, 0, -1);
        forward.applyQuaternion(this.camera.quaternion);
        forward.multiplyScalar(0.7); // Distance in front of camera
        this.character.position.add(forward);
        
        // Make character face same direction as camera
        this.character.rotation.y = this.yaw;
    }

    die() {
        if (!this.isDead) {
            this.isDead = true;
            this.deathCount++;
            console.log("Player died! Death count:", this.deathCount);
            this.soundManager.playDeath();
            this.respawn();
        }
    }

    respawn() {
        if (this.lastPlatform) {
            // Respawn on the last platform
            const platformBox = new THREE.Box3().setFromObject(this.lastPlatform);
            this.position.set(
                this.lastPlatform.position.x,
                platformBox.max.y + 1,
                this.lastPlatform.position.z
            );
        } else {
            // Respawn at the start if no last platform
            this.position.copy(this.respawnPoint);
        }
        
        this.velocity.set(0, 0, 0);
        this.isDead = false;
        this.isGrounded = true;
        this.isWallRunning = false;
        this.wallRunTime = 0;
    }

    setRespawnPoint(position) {
        this.respawnPoint.copy(position);
    }

    // Method to handle taking damage
    takeDamage(amount) {
        // Simple implementation - just die when taking any damage
        this.die();
    }
}