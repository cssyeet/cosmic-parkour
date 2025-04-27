import { ethers } from 'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.js';
import { BadgeMinter } from './blockchain/frontend-snippet.js';

class GameBlockchain extends BadgeMinter {
    constructor(contractAddress, contractABI) {
        console.log('GameBlockchain constructor called with address:', contractAddress);
        super(contractAddress, contractABI);
        this.connectedAddress = null;
    }

    async connectWallet() {
        console.log('Attempting to connect wallet');
        try {
            this.connectedAddress = await super.connectWallet();
            console.log('Wallet connected successfully:', this.connectedAddress);
            return this.connectedAddress;
        } catch (error) {
            console.error("Wallet connection failed:", error);
            throw error;
        }
    }

    async mintAchievement(achievementType) {
        console.log('Attempting to mint achievement:', achievementType);
        try {
            const result = await this.mintBadge(achievementType);
            console.log('Achievement minted successfully:', result);
            return result;
        } catch (error) {
            console.error("Achievement minting failed:", error);
            return { success: false, error: error.message };
        }
    }

    getConnectedAddress() {
        return this.connectedAddress;
    }
}

// Export the class for use in other modules
export { GameBlockchain }; 