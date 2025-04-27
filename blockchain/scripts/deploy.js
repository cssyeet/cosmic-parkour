const hre = require("hardhat");

async function main() {
  const AchievementBadges = await hre.ethers.getContractFactory("AchievementBadges");
  const badges = await AchievementBadges.deploy();

  await badges.waitForDeployment();
  const address = await badges.getAddress();
  console.log("AchievementBadges deployed to:", address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });