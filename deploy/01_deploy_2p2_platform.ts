import { HardhatRuntimeEnvironment } from "hardhat/types";
import hre from 'hardhat'
const CHAINLINK_PRICE_FEED_ETH_USD_ADDRESS = process.env.CHAINLINK_PRICE_FEED_ETH_USD_ADDRESS || ''
const USDC_ADDRESS = process.env.USDC_ADDRESS || ''
/**
 * 
 * @param hre 
 */
// only can deploy to sepolia because usdc testnet only support on sepolia (official)
// npx hardhat verify --network sepolia 0x7AAbA50Cd2e32E23506c162094fD47849fBDC0AF "0x4Fb7619c7BDE8Dd4fd308A6CfC6a794e1327Ea6F" "0x7D98DF6357b07A3c0deDF849fD829f7296b818F5"
const deployContract = async (hre: HardhatRuntimeEnvironment) => {
    if (!CHAINLINK_PRICE_FEED_ETH_USD_ADDRESS || !USDC_ADDRESS) {
        throw new Error('CHAINLINK_PRICE_FEED_ETH_USD_ADDRESS or USDC_ADDRESS is not set')
    }
    const p2pLendingContract  = await hre.ethers.getContractFactory("P2PLending")
    const p2pLending = await p2pLendingContract.deploy(CHAINLINK_PRICE_FEED_ETH_USD_ADDRESS, USDC_ADDRESS);
    const p2pLendingAddress = await p2pLending.getAddress();
    console.log('p2pLendingAddress', p2pLendingAddress)

}
deployContract(hre).then().catch(err => {
    console.error(err);
    process.exitCode = 1;
})