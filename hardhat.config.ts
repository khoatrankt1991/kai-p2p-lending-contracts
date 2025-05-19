import * as dotenv from "dotenv";
dotenv.config();

import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Alchemy API Key
const AICHEMY_KEY = process.env.AICHEMY_KEY || ''
const ACCOUNT_PRIVATE_KEY = process.env.ACCOUNT_PRIVATE_KEY || ''
const LOCALHOST_PRIVATE_KEY = process.env.LOCALHOST_PRIVATE_KEY || ''

// Verify Contract: npx hardhat verify --network sepoliaTestnet 0x709e141B3e4411D235D6E3736d763e7545F1916B
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || ''
const OPTIMISM_SCAN_API_KEY = process.env.OPTIMISM_SCAN_API_KEY || ''
const POLYGON_SCAN_API_KEY = process.env.POLYGON_SCAN_API_KEY || ''
const BSC_SCAN_API_KEY = process.env.BSC_SCAN_API_KEY || ''

const config: HardhatUserConfig = {
  networks: {
    ganacheLocalhost: {
      url: `http://127.0.0.1:8545`,
      accounts: [LOCALHOST_PRIVATE_KEY]
    },
    sepolia: {
      url: `https://eth-sepolia.g.alchemy.com/v2/${AICHEMY_KEY}`,
      accounts: [ACCOUNT_PRIVATE_KEY],
    },
    mainnet: {
      url: `https://eth-mainnet.g.alchemy.com/v2/${AICHEMY_KEY}`,
      accounts: [ACCOUNT_PRIVATE_KEY],
    },
    optimismSepolia: {
      url: `https://opt-sepolia.g.alchemy.com/v2/${AICHEMY_KEY}`,
      accounts: [ACCOUNT_PRIVATE_KEY],
    },
    optimism: {
      url: `https://opt-mainnet.g.alchemy.com/v2/${AICHEMY_KEY}`,
      accounts: [ACCOUNT_PRIVATE_KEY],
    },
    polygonAmoy: {
      url: `https://polygon-amoy.g.alchemy.com/v2/${AICHEMY_KEY}`,
      accounts: [ACCOUNT_PRIVATE_KEY],
    },
    polygon: {
      url: `https://polygon-mainnet.g.alchemy.com/v2/${AICHEMY_KEY}`,
      accounts: [ACCOUNT_PRIVATE_KEY],
    },
    bscTestnet: {
      url: `https://bnb-testnet.g.alchemy.com/v2/${AICHEMY_KEY}`,
      accounts: [ACCOUNT_PRIVATE_KEY],
    },
    bsc: {
      url: `https://bnb-mainnet.g.alchemy.com/v2/${AICHEMY_KEY}`,
      accounts: [ACCOUNT_PRIVATE_KEY],
    },
    zkSyncSepoliaTestnet: {
      url: `https://zksync-sepolia.g.alchemy.com/v2/${AICHEMY_KEY}`,
      accounts: [ACCOUNT_PRIVATE_KEY],
    },
    zkSyncEraMainnet: {
      url: `https://zksync-mainnet.g.alchemy.com/v2/${AICHEMY_KEY}`,
      accounts: [ACCOUNT_PRIVATE_KEY],
    },
  },
  etherscan: {
    apiKey: {
      sepolia: ETHERSCAN_API_KEY,
      mainnet: ETHERSCAN_API_KEY,
      optimismSepolia: OPTIMISM_SCAN_API_KEY,
      optimism: OPTIMISM_SCAN_API_KEY,
      polygonAmoy: POLYGON_SCAN_API_KEY,
      polygon: POLYGON_SCAN_API_KEY,
      bscTestnet: BSC_SCAN_API_KEY,
      bsc: BSC_SCAN_API_KEY,
    },
    customChains: [
      {
        network: "mainnet",
        chainId: 1,
        urls: {
          apiURL: "https://etherscan.io/api",
          browserURL: "https://etherscan.io/",
        },
      },
      {
        network: "sepolia",
        chainId: 11155111,
        urls: {
          apiURL: "https://api-sepolia.etherscan.io/api",
          browserURL: "https://sepolia.etherscan.io/",
        },
      },
      {
        network: "optimismSepolia",
        chainId: 11155420,
        urls: {
          apiURL: "https://api-sepolia-optimistic.etherscan.io/api",
          browserURL: "https://sepolia-optimism.etherscan.io/",
        },
      },
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://docs.polygonscan.com/v/amoy-polygonscan",
        },
      },
      {
        network: "polygon",
        chainId: 137,
        urls: {
          apiURL: "https://api.polygonscan.com/api",
          browserURL: "https://docs.polygonscan.com",
        },
      },
      {
        network: "bscTestnet",
        chainId: 97,
        urls: {
          apiURL: "https://api-testnet.bscscan.com/api",
          browserURL: "https://testnet.bscscan.com/",
        },
      },
      {
        network: "bsc",
        chainId: 56,
        urls: {
          apiURL: "https://api.bscscan.com/api",
          browserURL: "https://docs.bscscan.com/",
        },
      },
    ],
  },
  solidity: "0.8.28",
  
};

export default config;
