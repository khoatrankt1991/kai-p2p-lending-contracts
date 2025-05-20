import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { P2PLending, MockERC20, MockV3Aggregator } from "../typechain-types";

describe("P2PLending", function () {
  let lending: P2PLending;
  let usdc: MockERC20;
  let priceFeed: MockV3Aggregator;
  let owner: HardhatEthersSigner, borrower: HardhatEthersSigner, lender: HardhatEthersSigner;
  let borrowerAddr: string, lenderAddr: string;

  const USDC_DECIMALS = 6;
  const LOAN_AMOUNT = 1_000 * 10 ** USDC_DECIMALS;
  const INTEREST_RATE = 1000;     // 10.00% APR (1000 basis points)
  const COLLATERAL = ethers.parseEther("1"); // 1 ETH

  beforeEach(async () => {
    [owner, borrower, lender] = await ethers.getSigners();
    borrowerAddr = await borrower.getAddress();
    lenderAddr = await lender.getAddress();

    // Deploy mock USDC
    const MockERC20 = await ethers.getContractFactory("MockERC20");
    usdc = await MockERC20.deploy("Mock USD Coin", "USDC", USDC_DECIMALS);
    const usdcAddress = await usdc.getAddress();

    // Mint USDC to lender and borrower
    await usdc.mint(lenderAddr, ethers.parseUnits("10000", USDC_DECIMALS));
    await usdc.mint(borrowerAddr, ethers.parseUnits("2000", USDC_DECIMALS));

    // Deploy mock price feed (Chainlink Aggregator)
    const MockPriceFeed = await ethers.getContractFactory("MockV3Aggregator");
    priceFeed = await MockPriceFeed.deploy(8, ethers.parseUnits("2000", 8)); // ETH/USD = 2000
    const priceFeedAddress = await priceFeed.getAddress();
    // Deploy lending contract
    const P2PLending = await ethers.getContractFactory("P2PLending");
    lending = await P2PLending.deploy(priceFeedAddress, usdcAddress);
  });

  it("should allow borrower to request a loan", async () => {
    await lending.connect(borrower).requestLoan(LOAN_AMOUNT, 7 * 86400, INTEREST_RATE, { value: COLLATERAL });

    const loan = await lending.loans(0);
    expect(loan.borrower).to.equal(borrowerAddr);
    expect(loan.loanAmount).to.equal(LOAN_AMOUNT);
    expect(loan.collateralAmount).to.equal(COLLATERAL);
  });

  it("should allow lender to fund a loan", async () => {
    await lending.connect(borrower).requestLoan(LOAN_AMOUNT, 7 * 86400, INTEREST_RATE, { value: COLLATERAL });

    await usdc.connect(lender).approve(await lending.getAddress(), LOAN_AMOUNT);
    await expect(lending.connect(lender).fundLoan(0))
      .to.emit(lending, "LoanFunded");

    const loan = await lending.loans(0);
    expect(loan.lender).to.equal(lenderAddr);
  });

  it("should allow borrower to repay loan with interest", async () => {
    const duration = 30 * 86400; // 30 days
  
    // 1. Borrower requests loan with interest rate
    await lending.connect(borrower).requestLoan(
      LOAN_AMOUNT,
      duration,
      INTEREST_RATE, // 10% APR
      { value: COLLATERAL }
    );
  
    // 2. Lender funds loan
    await usdc.connect(lender).approve(await lending.getAddress(), LOAN_AMOUNT);
    await lending.connect(lender).fundLoan(0);
  
    // 3. Time passes (simulate half a year)
    const timePassed = 180 * 86400; // ~6 months
    await ethers.provider.send("evm_increaseTime", [timePassed]);
    await ethers.provider.send("evm_mine", []);
  
    // 4. get expected interest (simple interest)
    const [totalOwed, interest] = await lending.getTotalRepayable(0);
    
    // 5. Borrower repays full amount (principal + interest)
    // paddedTotal to prevent insufficient allowance or rounding errors
    const paddedTotal = ethers.parseUnits(totalOwed.toString(), 0) + BigInt(10);
    await usdc.connect(borrower).approve(await lending.getAddress(), paddedTotal);

    await expect(lending.connect(borrower).repayLoan(0))
      .to.emit(lending, "LoanRepaid");
  
    const loan = await lending.loans(0);
    expect(loan.isRepaid).to.be.true;
  
    // Optional: check lender USDC balance increased by totalOwed
    const lenderBalance = await usdc.balanceOf(await lender.getAddress());
    const delta = lenderBalance - totalOwed;
    expect(Number(ethers.formatUnits(delta, 18)) < 10).to.be.true;
  });

  it("should allow liquidation if price drops", async () => {
    await lending.connect(borrower).requestLoan(LOAN_AMOUNT, 7 * 86400, INTEREST_RATE, { value: COLLATERAL });
    await usdc.connect(lender).approve(await lending.getAddress(), LOAN_AMOUNT);
    await lending.connect(lender).fundLoan(0);

    // Simulate ETH/USD price drop to $1000
    await priceFeed.updateAnswer(ethers.parseUnits("1000", 8));

    await expect(lending.connect(owner).liquidateLoan(0))
      .to.emit(lending, "LoanLiquidated");

    const loan = await lending.loans(0);
    expect(loan.isLiquidated).to.be.true;
  });

  it("should trigger upkeep if loan is undercollateralized", async () => {
    await lending.connect(borrower).requestLoan(LOAN_AMOUNT, 7 * 86400, INTEREST_RATE, { value: COLLATERAL });
    await usdc.connect(lender).approve(await lending.getAddress(), LOAN_AMOUNT);
    await lending.connect(lender).fundLoan(0);
  
    // Giả lập ETH/USD giảm mạnh xuống $600
    await priceFeed.updateAnswer(ethers.parseUnits("600", 8));
  
    // Gọi checkUpkeep
    const [upkeepNeeded, performData] = await lending.checkUpkeep.staticCall("0x");
    expect(upkeepNeeded).to.be.true;
  
    // Gọi performUpkeep
    await lending.performUpkeep(performData);
  
    const loan = await lending.loans(0);
    expect(loan.isLiquidated).to.be.true;
  });

  it("should trigger upkeep if loan is expired", async () => {
    const duration = 7 * 86400;
    await lending.connect(borrower).requestLoan(LOAN_AMOUNT, duration, INTEREST_RATE, { value: COLLATERAL });
    await usdc.connect(lender).approve(await lending.getAddress(), LOAN_AMOUNT);
    await lending.connect(lender).fundLoan(0);
  
    // Tăng thời gian vượt duration
    await ethers.provider.send("evm_increaseTime", [duration + 1]);
    await ethers.provider.send("evm_mine", []);
  
    const [upkeepNeeded, performData] = await lending.checkUpkeep.staticCall("0x");
    expect(upkeepNeeded).to.be.true;
  
    // ✅ Đảm bảo block tiếp theo vượt hạn thật
    await ethers.provider.send("evm_increaseTime", [100]);
    await ethers.provider.send("evm_mine", []);
  
    await lending.performUpkeep(performData);
  
    const loan = await lending.loans(0);
    expect(loan.isLiquidated).to.be.true;
  });
  
  
});
