import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { CopyShader } from 'three/examples/jsm/shaders/CopyShader.js';
import { LuminosityHighPassShader } from 'three/examples/jsm/shaders/LuminosityHighPassShader.js';

// Custom motion blur shader
const MotionBlurShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "velocity": { value: new THREE.Vector2(0, 0) },
        "intensity": { value: 0.1 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform vec2 velocity;
        uniform float intensity;
        varying vec2 vUv;
        
        void main() {
            vec4 color = vec4(0.0);
            vec2 uv = vUv;
            float samples = 8.0;
            
            for (float i = 0.0; i < samples; i++) {
                vec2 offset = velocity * (i / samples - 0.5) * intensity;
                color += texture2D(tDiffuse, uv + offset);
            }
            
            gl_FragColor = color / samples;
        }
    `
};

// Custom vignette shader
const VignetteShader = {
    uniforms: {
        "tDiffuse": { value: null },
        "offset": { value: 1.0 },
        "darkness": { value: 1.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;
        
        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            vec2 uv = (vUv - 0.5) * 2.0;
            float vignetteAmount = 1.0 - dot(uv, uv) * offset;
            vignetteAmount = pow(vignetteAmount, darkness);
            color.rgb *= vignetteAmount;
            gl_FragColor = color;
        }
    `
};

export class EffectsManager {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        
        // Set up composer
        this.composer = new EffectComposer(renderer);
        
        // Add render pass
        this.renderPass = new RenderPass(scene, camera);
        this.composer.addPass(this.renderPass);
        
        // Add custom passes
        this.setupEffects();
        
        // Add copy pass (final render)
        this.copyPass = new ShaderPass(CopyShader);
        this.copyPass.renderToScreen = true;
        this.composer.addPass(this.copyPass);
        
        // Performance mode flag - starts with high quality
        this.highQualityMode = true;
        
        // Add listener for quality toggle
        document.addEventListener('keydown', (e) => {
            if (e.code === 'KeyQ') {
                this.toggleQualityMode();
            }
        });
    }
    
    setupEffects() {
        // Bloom effect - adjusted for better clarity
        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.4,  // strength - reduced from 1.0
            0.4,  // radius - reduced from 0.7
            0.7   // threshold - increased from 0.3
        );
        this.composer.addPass(this.bloomPass);
        
        // Custom sharpening pass to improve clarity
        this.sharpenPass = new ShaderPass({
            uniforms: {
                "tDiffuse": { value: null },
                "sharpness": { value: 0.3 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float sharpness;
                varying vec2 vUv;
                
                void main() {
                    vec2 texelSize = vec2(1.0 / 1920.0, 1.0 / 1080.0);
                    vec3 center = texture2D(tDiffuse, vUv).rgb;
                    
                    vec3 up = texture2D(tDiffuse, vUv + vec2(0.0, texelSize.y)).rgb;
                    vec3 down = texture2D(tDiffuse, vUv - vec2(0.0, texelSize.y)).rgb;
                    vec3 left = texture2D(tDiffuse, vUv - vec2(texelSize.x, 0.0)).rgb;
                    vec3 right = texture2D(tDiffuse, vUv + vec2(texelSize.x, 0.0)).rgb;
                    
                    vec3 edges = center * 5.0 - up - down - left - right;
                    gl_FragColor = vec4(center + edges * sharpness, 1.0);
                }
            `
        });
        this.composer.addPass(this.sharpenPass);
        
        // Color correction pass for better visuals
        this.colorCorrectionPass = new ShaderPass({
            uniforms: {
                "tDiffuse": { value: null },
                "contrast": { value: 1.05 },
                "brightness": { value: 0.02 },
                "saturation": { value: 1.05 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float contrast;
                uniform float brightness;
                uniform float saturation;
                varying vec2 vUv;
                
                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    
                    // Brightness adjustment
                    color.rgb += brightness;
                    
                    // Contrast adjustment
                    color.rgb = (color.rgb - 0.5) * contrast + 0.5;
                    
                    // Saturation adjustment
                    float luma = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
                    color.rgb = mix(vec3(luma), color.rgb, saturation);
                    
                    gl_FragColor = color;
                }
            `
        });
        this.composer.addPass(this.colorCorrectionPass);
    }
    
    toggleQualityMode() {
        this.highQualityMode = !this.highQualityMode;
        console.log(`Quality mode: ${this.highQualityMode ? 'HIGH' : 'PERFORMANCE'}`);
        
        if (this.highQualityMode) {
            // High quality settings
            this.bloomPass.strength = 0.4;
            this.bloomPass.radius = 0.4;
            this.bloomPass.threshold = 0.7;
            this.sharpenPass.uniforms.sharpness.value = 0.3;
        } else {
            // Performance mode - reduce effects
            this.bloomPass.strength = 0.2;
            this.bloomPass.radius = 0.2;
            this.bloomPass.threshold = 0.9;
            this.sharpenPass.uniforms.sharpness.value = 0.1;
        }
        
        // Show a notification to the user
        const notification = document.createElement('div');
        notification.className = 'quality-notification';
        notification.textContent = `Quality: ${this.highQualityMode ? 'HIGH' : 'PERFORMANCE'} (Press Q to toggle)`;
        document.body.appendChild(notification);
        
        // Remove notification after 2 seconds
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }
    
    update(delta, playerVelocity) {
        // Nothing to update here for now
    }
    
    render() {
        // Render using the composer for post-processing
        this.composer.render();
    }
    
    resize(width, height) {
        // Update composer on resize
        this.composer.setSize(width, height);
        
        // Update uniform for sharpening pass
        if (this.sharpenPass) {
            // Update texel size based on new resolution
            const texelSize = new THREE.Vector2(1.0 / width, 1.0 / height);
            // We don't have a direct uniform for texelSize, but we could add one if needed
        }
    }
}

// Add the missing setupPostProcessing function that's imported in main.js
export function setupPostProcessing(scene, camera, renderer) {
    // Create a new EffectsManager instance
    const effectsManager = new EffectsManager(renderer, scene, camera);
    
    // Return the manager so it can be stored and accessed
    return {
        composer: effectsManager.composer,
        manager: effectsManager,
        render: () => effectsManager.render(),
        resize: (width, height) => effectsManager.resize(width, height),
        update: (delta, velocity) => effectsManager.update(delta, velocity)
    };
} 