import * as THREE from 'three';
import { World } from './world.js';
import { MapDesignerUI } from './mapDesignerUI.js';

export class MapDesigner {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.world = new World(scene);
        this.isDesignMode = false;
        this.selectedPrefab = null;
        this.prefabs = [];
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.gridHelper = null;
        this.gridSize = 50;
        this.gridDivisions = 50;
        this.snapToGrid = true;
        this.selectedObject = null;
        this.isRotating = false;
        this.isScaling = false;
        this.previewMesh = null;
        
        // Prefab types and their creation functions
        this.prefabTypes = {
            platform: (x, y, z) => this.world.createPlatform(x, y, z, 5, 0.5, 5),
            wall: (x, y, z) => this.world.createWall(x, y, z, 5, 5, 0.2),
            ramp: (x, y, z) => this.world.createRamp(x, y, z, 5, 2, 5),
            pole: (x, y, z) => this.world.createPole(x, y, z, 0.1, 5, this.world.colors.accent),
            obstacle: (x, y, z) => this.world.createObstacle(x, y, z, 2, 2, 2, this.world.colors.accent)
        };
        
        // Create UI
        this.ui = new MapDesignerUI(this);
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Mouse move for raycasting
        this.renderer.domElement.addEventListener('mousemove', (event) => {
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        });
        
        // Click to place prefab or select object
        this.renderer.domElement.addEventListener('click', (event) => {
            if (!this.isDesignMode) return;
            
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.scene.children);
            
            if (intersects.length > 0) {
                const object = intersects[0].object;
                
                // If we're in placement mode
                if (this.selectedPrefab) {
                    const point = intersects[0].point;
                    const x = this.snapToGrid ? Math.round(point.x / 1) * 1 : point.x;
                    const y = this.snapToGrid ? Math.round(point.y / 1) * 1 : point.y;
                    const z = this.snapToGrid ? Math.round(point.z / 1) * 1 : point.z;
                    
                    this.placePrefab(x, y, z);
                }
                // If we're in selection mode
                else if (object !== this.gridHelper) {
                    this.selectObject(object);
                }
            }
        });
        
        // Key controls
        window.addEventListener('keydown', (event) => {
            if (event.key === 'e') {
                this.toggleDesignMode();
            }
            if (event.key === '1') this.selectedPrefab = 'platform';
            if (event.key === '2') this.selectedPrefab = 'wall';
            if (event.key === '3') this.selectedPrefab = 'ramp';
            if (event.key === '4') this.selectedPrefab = 'pole';
            if (event.key === '5') this.selectedPrefab = 'obstacle';
            if (event.key === 'Delete') this.deleteSelectedObject();
            if (event.key === 'r') this.toggleRotateMode();
            if (event.key === 's') this.toggleScaleMode();
            if (event.key === 'Escape') {
                this.selectedPrefab = null;
                this.selectedObject = null;
                this.isRotating = false;
                this.isScaling = false;
            }
        });
    }
    
    toggleDesignMode() {
        this.isDesignMode = !this.isDesignMode;
        if (this.isDesignMode) {
            this.setupGrid();
            this.ui.show();
        } else {
            this.removeGrid();
            this.ui.hide();
            this.selectedPrefab = null;
            this.selectedObject = null;
            this.isRotating = false;
            this.isScaling = false;
        }
    }
    
    setupGrid() {
        this.gridHelper = new THREE.GridHelper(this.gridSize, this.gridDivisions);
        this.scene.add(this.gridHelper);
    }
    
    removeGrid() {
        if (this.gridHelper) {
            this.scene.remove(this.gridHelper);
            this.gridHelper = null;
        }
    }
    
    placePrefab(x, y, z) {
        if (!this.selectedPrefab || !this.prefabTypes[this.selectedPrefab]) return;
        
        const prefab = this.prefabTypes[this.selectedPrefab](x, y, z);
        this.prefabs.push(prefab);
    }
    
    selectObject(object) {
        this.selectedObject = object;
        this.selectedPrefab = null;
    }
    
    deleteSelectedObject() {
        if (!this.isDesignMode || !this.selectedObject) return;
        
        this.scene.remove(this.selectedObject);
        const index = this.prefabs.indexOf(this.selectedObject);
        if (index !== -1) {
            this.prefabs.splice(index, 1);
        }
        this.selectedObject = null;
    }
    
    toggleRotateMode() {
        if (!this.selectedObject) return;
        this.isRotating = !this.isRotating;
        this.isScaling = false;
    }
    
    toggleScaleMode() {
        if (!this.selectedObject) return;
        this.isScaling = !this.isScaling;
        this.isRotating = false;
    }
    
    update() {
        if (!this.isDesignMode) return;
        
        // Update raycasting for hover effects
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children);
        
        // Update preview mesh
        if (intersects.length > 0 && this.selectedPrefab) {
            const point = intersects[0].point;
            const x = this.snapToGrid ? Math.round(point.x / 1) * 1 : point.x;
            const y = this.snapToGrid ? Math.round(point.y / 1) * 1 : point.y;
            const z = this.snapToGrid ? Math.round(point.z / 1) * 1 : point.z;
            
            if (!this.previewMesh) {
                this.previewMesh = this.prefabTypes[this.selectedPrefab](x, y, z);
                this.previewMesh.material = this.previewMesh.material.clone();
                this.previewMesh.material.transparent = true;
                this.previewMesh.material.opacity = 0.5;
                this.scene.add(this.previewMesh);
            } else {
                this.previewMesh.position.set(x, y, z);
            }
        } else if (this.previewMesh) {
            this.scene.remove(this.previewMesh);
            this.previewMesh = null;
        }
        
        // Handle rotation and scaling
        if (this.selectedObject) {
            if (this.isRotating) {
                this.selectedObject.rotation.y += 0.1;
            }
            if (this.isScaling) {
                const scale = this.selectedObject.scale.x + 0.1;
                this.selectedObject.scale.set(scale, scale, scale);
            }
        }
    }
    
    saveMap() {
        const mapData = {
            prefabs: this.prefabs.map(prefab => ({
                type: this.getPrefabType(prefab),
                position: prefab.position.toArray(),
                rotation: prefab.rotation.toArray(),
                scale: prefab.scale.toArray()
            }))
        };
        
        const json = JSON.stringify(mapData);
        localStorage.setItem('customMap', json);
    }
    
    loadMap() {
        const json = localStorage.getItem('customMap');
        if (!json) return;
        
        const mapData = JSON.parse(json);
        
        this.prefabs.forEach(prefab => this.scene.remove(prefab));
        this.prefabs = [];
        
        mapData.prefabs.forEach(prefabData => {
            const prefab = this.prefabTypes[prefabData.type](
                prefabData.position[0],
                prefabData.position[1],
                prefabData.position[2]
            );
            
            prefab.rotation.set(
                prefabData.rotation[0],
                prefabData.rotation[1],
                prefabData.rotation[2]
            );
            
            prefab.scale.set(
                prefabData.scale[0],
                prefabData.scale[1],
                prefabData.scale[2]
            );
            
            this.prefabs.push(prefab);
        });
    }
    
    getPrefabType(prefab) {
        for (const [type, createFn] of Object.entries(this.prefabTypes)) {
            if (prefab.geometry.type === createFn(0, 0, 0).geometry.type) {
                return type;
            }
        }
        return null;
    }
} 