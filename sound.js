export class SoundManager {
    constructor() {
        console.log('Initializing SoundManager...');
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('AudioContext created:', this.audioContext.state);
        
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.5; // Master volume
        this.masterGain.connect(this.audioContext.destination);
        console.log('Master gain set to:', this.masterGain.gain.value);

        // Create gain nodes for different sound categories
        this.sfxGain = this.audioContext.createGain();
        this.sfxGain.gain.value = 0.7;
        this.sfxGain.connect(this.masterGain);
        console.log('SFX gain set to:', this.sfxGain.gain.value);

        // Initialize sound buffers
        this.sounds = {};
        this.currentFootstep = null;
        this.loadSounds();
    }

    async loadSounds() {
        console.log('Starting to load sounds...');
        const soundFiles = {
            wallRun: 'sounds/wall_run.wav',
            death: 'sounds/death.wav',
            footstep: 'sounds/footstep.wav',
            jump: 'sounds/jump.wav',
            coin: 'sounds/coin.wav'
        };

        for (const [name, path] of Object.entries(soundFiles)) {
            try {
                console.log(`Loading sound: ${path}`);
                const response = await fetch(path);
                if (!response.ok) {
                    throw new Error(`Failed to fetch ${path}: ${response.status} ${response.statusText}`);
                }
                const arrayBuffer = await response.arrayBuffer();
                console.log(`Decoding audio data for ${name}...`);
                const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
                this.sounds[name] = audioBuffer;
                console.log(`Successfully loaded sound: ${name} (duration: ${audioBuffer.duration}s)`);
            } catch (error) {
                console.error(`Failed to load sound ${name}:`, error);
            }
        }
        console.log('Finished loading sounds. Loaded sounds:', Object.keys(this.sounds));
    }

    playSound(name, options = {}) {
        if (!this.sounds[name]) {
            console.warn(`Sound ${name} not loaded`);
            return;
        }

        const {
            volume = 1,
            pitch = 1,
            loop = false,
            pan = 0
        } = options;

        console.log(`Playing sound: ${name} with options:`, { volume, pitch, loop, pan });

        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        const panNode = this.audioContext.createStereoPanner();

        source.buffer = this.sounds[name];
        source.loop = loop;
        source.playbackRate.value = pitch;

        gainNode.gain.value = volume;
        panNode.pan.value = pan;

        source.connect(gainNode);
        gainNode.connect(panNode);
        panNode.connect(this.sfxGain);

        try {
            source.start();
            console.log(`Successfully started sound: ${name}`);
        } catch (error) {
            console.error(`Failed to play sound ${name}:`, error);
        }
        return source;
    }

    stopSound(source) {
        if (source) {
            try {
                source.stop();
                console.log('Stopped sound');
            } catch (error) {
                console.error('Failed to stop sound:', error);
            }
        }
    }

    playWallRun() {
        this.playSound('wallRun', { volume: 0.4, pitch: 1.1 });
    }

    playDeath() {
        this.playSound('death', { volume: 0.8, pitch: 0.8 });
    }

    playJump() {
        this.playSound('jump', { volume: 0.5, pitch: 1.0 });
    }
    
    playCoinSound() {
        this.playSound('coin', { volume: 0.6, pitch: 1.2 });
    }

    playFootstep(isRunning = false) {
        // Stop any existing footstep sound
        this.stopSound(this.currentFootstep);
        
        // Play new footstep sound
        this.currentFootstep = this.playSound('footstep', {
            volume: isRunning ? 0.4 : 0.3,
            pitch: isRunning ? 1.2 : 1
        });
    }

    stopFootsteps() {
        this.stopSound(this.currentFootstep);
        this.currentFootstep = null;
    }

    setMasterVolume(volume) {
        this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }

    setSFXVolume(volume) {
        this.sfxGain.gain.value = Math.max(0, Math.min(1, volume));
    }
} 