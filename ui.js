import { formatTime } from './utils.js';

export class UIManager {
    constructor(game) {
        this.game = game;
        this.startTimestamp = 0;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('start-button').addEventListener('click', () => {
            document.getElementById('start-screen').classList.add('hidden');
            document.getElementById('hud').classList.remove('hidden');
            this.game.startGame();
        });

        document.getElementById('resume-button').addEventListener('click', () => {
            document.getElementById('pause-screen').classList.add('hidden');
            this.game.resumeGame();
        });

        document.getElementById('restart-button').addEventListener('click', () => {
            document.getElementById('pause-screen').classList.add('hidden');
            this.game.restartGame();
        });

        document.getElementById('play-again-button').addEventListener('click', () => {
            document.getElementById('end-screen').classList.add('hidden');
            document.getElementById('start-screen').classList.remove('hidden');
        });

        // Pause on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.game.isRunning && !this.game.isPaused) {
                    this.game.pauseGame();
                } else if (this.game.isPaused) {
                    document.getElementById('pause-screen').classList.add('hidden');
                    this.game.resumeGame();
                }
            }
        });
    }

    showPauseScreen() {
        document.getElementById('pause-screen').classList.remove('hidden');
    }

    showEndScreen(time, platforms) {
        document.getElementById('end-screen').classList.remove('hidden');
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('final-time').textContent = formatTime(time);
        document.getElementById('platforms-count').textContent = `${platforms} PLATFORMS`;
    }

    updateTimer(time) {
        // Always show mm:ss.SSS
        if (!this.startTimestamp) this.startTimestamp = performance.now();
        const elapsed = Math.max(0, time);
        document.getElementById('timer').textContent = formatTime(elapsed);
    }

    resetTimer() {
        this.startTimestamp = performance.now();
        document.getElementById('timer').textContent = '00:00.000';
    }

    updateStaminaBar(stamina) {
        document.getElementById('stamina-bar').style.width = `${stamina * 100}%`;
    }
} 