require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    monad: {
      url: "https://testnet-rpc.monad.xyz",
      accounts: [process.env.PRIVATE_KEY],
      chainId: 10143
    }
  }
};