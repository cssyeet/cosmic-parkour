import { ethers } from 'https://cdn.jsdelivr.net/npm/ethers@5.7.2/dist/ethers.esm.js';

// Achievement Badges Minting Interface
export class BadgeMinter {
    constructor(contractAddress, contractABI) {
      this.contractAddress = contractAddress;
      this.contractABI = contractABI;
      this.contract = null;
      this.signer = null;
    }
  
    async connectWallet() {
      if (window.ethereum) {
        try {
          // Request account access
          const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
          const provider = new ethers.providers.Web3Provider(window.ethereum);
          this.signer = provider.getSigner();
          this.contract = new ethers.Contract(this.contractAddress, this.contractABI, this.signer);
          return accounts[0];
        } catch (error) {
          console.error("User denied account access", error);
          throw error;
        }
      } else {
        throw new Error("MetaMask not detected");
      }
    }
  
    async mintBadge(badgeType) {
      if (!this.contract) {
        await this.connectWallet();
      }
      
      try {
        const tx = await this.contract.mintBadge(await this.signer.getAddress(), badgeType);
        await tx.wait();
        return { success: true, txHash: tx.hash };
      } catch (error) {
        console.error("Minting failed", error);
        return { success: false, error: error.message };
      }
    }
}
  
// Example usage:
// const minter = new BadgeMinter("0x123...", abi);
// await minter.connectWallet();
// const result = await minter.mintBadge("Level Master");