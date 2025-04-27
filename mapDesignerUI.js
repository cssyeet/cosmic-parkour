import * as THREE from 'three';

export class MapDesignerUI {
    constructor(mapDesigner) {
        this.mapDesigner = mapDesigner;
        this.isVisible = false;
        this.createUI();
    }

    createUI() {
        // Create main container
        this.container = document.createElement('div');
        this.container.className = 'map-designer-ui';
        this.container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(10, 14, 26, 0.92);
            padding: 20px;
            border-radius: 16px;
            color: #aaf6ff;
            font-family: "'Orbitron', 'Segoe UI', system-ui, sans-serif";
            z-index: 1000;
            display: none;
        `;

        // Create title
        const title = document.createElement('h2');
        title.textContent = 'Map Designer';
        title.style.cssText = `
            margin: 0 0 20px 0;
            font-size: 24px;
            color: #7eeeff;
            text-align: center;
        `;
        this.container.appendChild(title);

        // Create prefab selection section
        const prefabSection = this.createSection('Prefabs');
        this.createPrefabButtons(prefabSection);
        this.container.appendChild(prefabSection);

        // Create grid controls section
        const gridSection = this.createSection('Grid Controls');
        this.createGridControls(gridSection);
        this.container.appendChild(gridSection);

        // Create object controls section
        const objectSection = this.createSection('Object Controls');
        this.createObjectControls(objectSection);
        this.container.appendChild(objectSection);

        // Create save/load section
        const saveSection = this.createSection('Save/Load');
        this.createSaveLoadControls(saveSection);
        this.container.appendChild(saveSection);

        // Add to document
        document.body.appendChild(this.container);
    }

    createSection(title) {
        const section = document.createElement('div');
        section.className = 'map-designer-section';
        section.style.cssText = `
            margin-bottom: 20px;
            padding: 10px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 5px;
        `;

        const sectionTitle = document.createElement('h3');
        sectionTitle.textContent = title;
        sectionTitle.style.cssText = `
            margin: 0 0 10px 0;
            font-size: 18px;
            color: #aaf6ff;
        `;
        section.appendChild(sectionTitle);

        return section;
    }

    createPrefabButtons(section) {
        const prefabs = [
            { key: '1', name: 'Platform', type: 'platform' },
            { key: '2', name: 'Wall', type: 'wall' },
            { key: '3', name: 'Ramp', type: 'ramp' },
            { key: '4', name: 'Pole', type: 'pole' },
            { key: '5', name: 'Obstacle', type: 'obstacle' }
        ];

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        `;

        prefabs.forEach(prefab => {
            const button = document.createElement('button');
            button.textContent = `${prefab.name} (${prefab.key})`;
            button.style.cssText = `
                padding: 10px;
                background: linear-gradient(90deg, #0a0e1a 0%, #00f2fe 100%);
                border: 2px solid #00f2fe99;
                border-radius: 50px;
                color: #e0e6ff;
                cursor: pointer;
                transition: background 0.3s;
                font-family: "'Orbitron', 'Segoe UI', system-ui, sans-serif";
            `;
            button.onmouseover = () => button.style.background = 'linear-gradient(90deg, #00f2fe 0%, #0a0e1a 100%)';
            button.onmouseout = () => button.style.background = 'linear-gradient(90deg, #0a0e1a 0%, #00f2fe 100%)';
            button.onclick = () => this.mapDesigner.selectedPrefab = prefab.type;
            buttonContainer.appendChild(button);
        });

        section.appendChild(buttonContainer);
    }

    createGridControls(section) {
        const controls = [
            { name: 'Grid Size', type: 'range', min: 10, max: 100, value: 50, step: 10 },
            { name: 'Grid Divisions', type: 'range', min: 10, max: 100, value: 50, step: 10 },
            { name: 'Snap to Grid', type: 'checkbox', checked: true }
        ];

        controls.forEach(control => {
            const controlContainer = document.createElement('div');
            controlContainer.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
            `;

            const label = document.createElement('label');
            label.textContent = control.name;
            label.style.cssText = `
                color: #aaf6ff;
                margin-right: 10px;
            `;

            let input;
            if (control.type === 'range') {
                input = document.createElement('input');
                input.type = 'range';
                input.min = control.min;
                input.max = control.max;
                input.value = control.value;
                input.step = control.step;
                input.style.cssText = `
                    width: 150px;
                    background: rgba(20, 30, 60, 0.4);
                    border-radius: 8px;
                `;
                input.onchange = (e) => {
                    if (control.name === 'Grid Size') {
                        this.mapDesigner.gridSize = parseInt(e.target.value);
                        this.mapDesigner.setupGrid();
                    } else if (control.name === 'Grid Divisions') {
                        this.mapDesigner.gridDivisions = parseInt(e.target.value);
                        this.mapDesigner.setupGrid();
                    }
                };
            } else if (control.type === 'checkbox') {
                input = document.createElement('input');
                input.type = 'checkbox';
                input.checked = control.checked;
                input.onchange = (e) => {
                    this.mapDesigner.snapToGrid = e.target.checked;
                };
            }

            controlContainer.appendChild(label);
            controlContainer.appendChild(input);
            section.appendChild(controlContainer);
        });
    }

    createObjectControls(section) {
        const controls = [
            { name: 'Rotate (R)', key: 'r' },
            { name: 'Scale (S)', key: 's' },
            { name: 'Delete (Del)', key: 'Delete' }
        ];

        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        `;

        controls.forEach(control => {
            const button = document.createElement('button');
            button.textContent = control.name;
            button.style.cssText = `
                padding: 10px;
                background: linear-gradient(90deg, #0a0e1a 0%, #00f2fe 100%);
                border: 2px solid #00f2fe99;
                border-radius: 50px;
                color: #e0e6ff;
                cursor: pointer;
                transition: background 0.3s;
                font-family: "'Orbitron', 'Segoe UI', system-ui, sans-serif";
            `;
            button.onmouseover = () => button.style.background = 'linear-gradient(90deg, #00f2fe 0%, #0a0e1a 100%)';
            button.onmouseout = () => button.style.background = 'linear-gradient(90deg, #0a0e1a 0%, #00f2fe 100%)';
            button.onclick = () => {
                if (control.key === 'Delete') {
                    this.mapDesigner.deleteSelectedObject();
                }
            };
            buttonContainer.appendChild(button);
        });

        section.appendChild(buttonContainer);
    }

    createSaveLoadControls(section) {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 10px;
        `;

        const saveButton = document.createElement('button');
        saveButton.textContent = 'Save Map';
        saveButton.style.cssText = `
            padding: 10px;
            background: linear-gradient(90deg, #0a0e1a 0%, #00f2fe 100%);
            border: 2px solid #00f2fe99;
            border-radius: 50px;
            color: #e0e6ff;
            cursor: pointer;
            transition: background 0.3s;
            font-family: "'Orbitron', 'Segoe UI', system-ui, sans-serif";
        `;
        saveButton.onmouseover = () => saveButton.style.background = 'linear-gradient(90deg, #00f2fe 0%, #0a0e1a 100%)';
        saveButton.onmouseout = () => saveButton.style.background = 'linear-gradient(90deg, #0a0e1a 0%, #00f2fe 100%)';
        saveButton.onclick = () => this.mapDesigner.saveMap();

        const loadButton = document.createElement('button');
        loadButton.textContent = 'Load Map';
        loadButton.style.cssText = `
            padding: 10px;
            background: linear-gradient(90deg, #0a0e1a 0%, #7eeeff 100%);
            border: 2px solid #7eeeff99;
            border-radius: 50px;
            color: #e0e6ff;
            cursor: pointer;
            transition: background 0.3s;
            font-family: "'Orbitron', 'Segoe UI', system-ui, sans-serif";
        `;
        loadButton.onmouseover = () => loadButton.style.background = 'linear-gradient(90deg, #7eeeff 0%, #0a0e1a 100%)';
        loadButton.onmouseout = () => loadButton.style.background = 'linear-gradient(90deg, #0a0e1a 0%, #7eeeff 100%)';
        loadButton.onclick = () => this.mapDesigner.loadMap();

        buttonContainer.appendChild(saveButton);
        buttonContainer.appendChild(loadButton);
        section.appendChild(buttonContainer);
    }

    show() {
        this.container.style.display = 'block';
        this.isVisible = true;
    }

    hide() {
        this.container.style.display = 'none';
        this.isVisible = false;
    }

    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
} 