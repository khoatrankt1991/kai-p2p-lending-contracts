# 🏦 P2P Lending Smart Contract

A decentralized peer-to-peer lending platform built with Solidity and Hardhat, supporting:

- ✅ Collateralized loans using ETH
- ✅ Repayment with real-time interest (simple interest model)
- ✅ Chainlink oracle integration for price-based liquidation
- ✅ Chainlink Automation-compatible upkeep for auto-liquidation
- ✅ USDC (ERC20) stablecoin support

---

## 🚀 Features

### 📌 Core Functionality

- Borrowers can request loans by locking ETH as collateral
- Lenders can fund loans with USDC (6 decimals)
- Loans accrue interest over time (simple interest)
- Borrowers repay full principal + interest to reclaim their collateral
- Loans can be liquidated if:
  - Collateral drops below 120% of loan value (based on Chainlink ETH/USD price)
  - OR loan duration expires

### 🔗 Chainlink Integration

- Uses Chainlink Price Feed (ETH/USD) to determine collateral value
- Chainlink Automation-compatible:
  - `checkUpkeep()` scans active loans
  - `performUpkeep()` liquidates expired or undercollateralized loans

### 📊 Subgraph Integration

Compatible with [The Graph](https://thegraph.com/) for indexing and querying on-chain events such as:
- `LoanRequested`
- `LoanFunded`
- `LoanRepaid`
- `LoanLiquidated`

You can implement a subgraph to support efficient frontend queries and historical tracking.

---

## 🧠 Interest Model

- Interest rate is expressed in **basis points** (`1000 = 10% annual APR`)
- Accrued interest is calculated using simple interest:

  \[
  \text{Interest} = \frac{\text{LoanAmount} \times \text{InterestRate} \times \text{ElapsedTime}}{365 \times 86400 \times 10000}
  \]

- Repayment transfers `principal + interest` from borrower to lender

---

## 🧪 Testing (Hardhat + TypeScript)

### ✅ Includes tests for:

- Loan request / funding
- Interest accumulation over time
- Partial/full repayment with correct interest
- Auto-liquidation after expiry or collateral drop
- Permission controls (e.g., only borrower can repay)

### ▶ Run tests:

```bash
npx hardhat test
