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
        this.jumpForce = 10;
        this.gravity = 30;
        this.airControl = 0.5;
        this.friction = 10;
        this.acceleration = 20;

        // Wall run properties
        this.wallRunGravity = 10;
        this.wallRunTime = 0;
        this.maxWallRunTime = 1.5;
        this.wallJumpForce = 6;

        // Player state
        this.position = new THREE.Vector3(0, 4, 0);
        this.velocity = new THREE.Vector3();
        this.isGrounded = false;
        this.isWallRunning = false;
        this.wallNormal = new THREE.Vector3();
        this.isDead = false;
        this.respawnPoint = new THREE.Vector3(0, 4, 0);
        this.lastPlatform = null;
        this.deathCount = 0;

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

        this.initControls();
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
            sprint: false
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
        }
    }

    update(deltaTime) {
        this.handleMovement(deltaTime);
        this.updatePhysics(deltaTime);
        this.checkCollisions();
        this.updateCamera();
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

        if (moveDirection.lengthSq() > 0) {
            moveDirection.normalize();
            const targetSpeed = this.keys.sprint ? this.sprintSpeed : this.moveSpeed;

            if (this.isGrounded || this.isWallRunning) {
                const acceleration = this.acceleration * deltaTime;
                this.velocity.x = THREE.MathUtils.lerp(this.velocity.x, moveDirection.x * targetSpeed, acceleration);
                this.velocity.z = THREE.MathUtils.lerp(this.velocity.z, moveDirection.z * targetSpeed, acceleration);

                // Play footstep sounds only when actually moving
                const currentTime = performance.now() / 1000;
                const isMoving = Math.abs(this.velocity.x) > 0.1 || Math.abs(this.velocity.z) > 0.1;
                if (this.isGrounded && isMoving && currentTime - this.lastFootstepTime > this.footstepInterval) {
                    this.soundManager.playFootstep(this.keys.sprint);
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

        // Jumping
        if (this.keys.jump) {
            if (this.isGrounded) {
                this.velocity.y = this.jumpForce;
                this.isGrounded = false;
            } else if (this.isWallRunning) {
                this.velocity.y = this.wallJumpForce;
                this.velocity.add(this.wallNormal.clone().multiplyScalar(5));
                this.isWallRunning = false;
                this.soundManager.playWallRun();
            }
        }
    }

    updatePhysics(deltaTime) {
        if (!this.isGrounded && !this.isWallRunning) {
            this.velocity.y -= this.gravity * deltaTime;
        } else if (this.isWallRunning) {
            this.velocity.y -= this.wallRunGravity * deltaTime;
            this.wallRunTime += deltaTime;
            if (this.wallRunTime > this.maxWallRunTime) {
                this.isWallRunning = false;
            }
        }
        this.position.add(this.velocity.clone().multiplyScalar(deltaTime));
    }

    checkCollisions() {
        this.isGrounded = false;
        this.isWallRunning = false;

        const collider = this.getColliderBox();
        let wallRunCandidate = null;
        let isOverPlatform = false;
        let wasGrounded = this.isGrounded;

        // Platform collisions
        for (const platform of this.world.platforms) {
            const platformBox = new THREE.Box3().setFromObject(platform);
            const feetY = this.position.y;
            const platformTop = platformBox.max.y;
            const epsilon = 0.5;

            // Check if player is over any platform
            if (
                this.position.x > platformBox.min.x &&
                this.position.x < platformBox.max.x &&
                this.position.z > platformBox.min.z &&
                this.position.z < platformBox.max.z
            ) {
                isOverPlatform = true;
                this.lastPlatform = platform;
            }

            // Check if landing on platform
            if (
                this.position.x > platformBox.min.x &&
                this.position.x < platformBox.max.x &&
                this.position.z > platformBox.min.z &&
                this.position.z < platformBox.max.z &&
                this.velocity.y <= 0 &&
                feetY > platformTop - epsilon &&
                feetY < platformTop + epsilon
            ) {
                this.position.y = platformTop;
                this.velocity.y = 0;
                this.isGrounded = true;
                this.wallRunTime = 0;
            }
        }

        // Die if falling into the void (below y = -10)
        if (this.position.y < -10) {
            this.die();
            return;
        }

        // Wall collisions and wall run detection
        for (const wall of this.world.walls) {
            const wallBox = new THREE.Box3().setFromObject(wall);
            const sideDist = 0.6;
            
            // Check for wall collisions
            if (this.checkWallCollision(wallBox)) {
                // Handle wall collision
                this.handleWallCollision(wallBox);
            }
            
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

        // Simple ground collision
        if (this.position.y < 0) {
            this.position.y = 0;
            this.velocity.y = 0;
            this.isGrounded = true;
        }
    }

    checkWallCollision(wallBox) {
        const playerBox = this.getColliderBox();
        return playerBox.intersectsBox(wallBox);
    }

    handleWallCollision(wallBox) {
        const playerBox = this.getColliderBox();
        const overlap = new THREE.Box3();
        overlap.copy(playerBox).intersect(wallBox);

        // Calculate overlap in each direction
        const xOverlap = overlap.max.x - overlap.min.x;
        const zOverlap = overlap.max.z - overlap.min.z;

        // Push player out in the direction of least overlap
        if (xOverlap < zOverlap) {
            if (this.position.x < wallBox.getCenter(new THREE.Vector3()).x) {
                this.position.x = wallBox.min.x - this.colliderSize.x;
            } else {
                this.position.x = wallBox.max.x + this.colliderSize.x;
            }
            this.velocity.x = 0;
        } else {
            if (this.position.z < wallBox.getCenter(new THREE.Vector3()).z) {
                this.position.z = wallBox.min.z - this.colliderSize.z;
            } else {
                this.position.z = wallBox.max.z + this.colliderSize.z;
            }
            this.velocity.z = 0;
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
        this.camera.position.copy(this.position);
        this.camera.position.y += 1.6;
        this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
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
}