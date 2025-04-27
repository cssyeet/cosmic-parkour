import { formatTime } from './utils.js';
import { GameBlockchain } from './blockchain.js';

// Contract ABI
const CONTRACT_ABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "inputs": [
            {
                "internalType": "string",
                "name": "badgeType",
                "type": "string"
            },
            {
                "internalType": "string",
                "name": "badgeURI",
                "type": "string"
            }
        ],
        "name": "addBadgeType",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "address",
                "name": "recipient",
                "type": "address"
            },
            {
                "internalType": "string",
                "name": "badgeType",
                "type": "string"
            }
        ],
        "name": "mintBadge",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "tokenId",
                "type": "uint256"
            }
        ],
        "name": "tokenURI",
        "outputs": [
            {
                "internalType": "string",
                "name": "",
                "type": "string"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];

export class UIManager {
    constructor(game) {
        console.log('UIManager constructor called');
        this.game = game;
        this.startTimestamp = 0;
        this.isWalletConnected = false;
        
        // Initialize blockchain
        this.blockchain = new GameBlockchain(
            "0x8988E2c2B33833dA5c91fC194Ba57CaB3ecAcc19",
            CONTRACT_ABI
        );
        
        this.setupEventListeners();
    }

    setupEventListeners() {
        console.log('Setting up event listeners');
        
        // Start button
        const startButton = document.getElementById('start-button');
        console.log('Start button element:', startButton);
        startButton.addEventListener('click', () => {
            console.log('Start button clicked');
            if (this.isWalletConnected) {
                document.getElementById('start-screen').classList.add('hidden');
                document.getElementById('hud').classList.remove('hidden');
                this.game.startGame();
            } else {
                alert('Please connect your wallet first!');
            }
        });

        // Wallet connection
        const connectButton = document.getElementById('connect-wallet');
        const walletAddress = document.getElementById('wallet-address');
        console.log('Connect button element:', connectButton);
        
        connectButton.addEventListener('click', async () => {
            console.log('Connect wallet button clicked');
            try {
                const address = await this.blockchain.connectWallet();
                console.log('Wallet connected, address:', address);
                connectButton.textContent = 'CONNECTED';
                connectButton.classList.add('connected');
                walletAddress.textContent = address;
                walletAddress.classList.remove('hidden');
                walletAddress.classList.add('connected');
                this.isWalletConnected = true;
            } catch (error) {
                console.error('Wallet connection failed:', error);
                alert('Failed to connect wallet. Please make sure MetaMask is installed and unlocked.');
            }
        });

        // Pause button
        document.getElementById('resume-button').addEventListener('click', () => {
            document.getElementById('pause-screen').classList.add('hidden');
            this.game.resumeGame();
        });

        // Restart button
        document.getElementById('restart-button').addEventListener('click', () => {
            document.getElementById('pause-screen').classList.add('hidden');
            this.game.restartGame();
        });

        // Play again button
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