// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract P2PLending is Ownable, AutomationCompatibleInterface {
    AggregatorV3Interface public priceFeed;
    IERC20 public stableCoin;

    // Loan struct
    // ✅ interestRate: Use basis points (BPS) or percent * 100 or * 10000 to avoid floating point numbers in Solidity
    struct Loan {
        address borrower;
        address lender;
        uint256 collateralAmount; // in ETH (wei)
        uint256 loanAmount; // in USDC (6 decimals)
        uint256 startTime;
        uint256 duration;
        uint256 interestRate;     // e.g. 1000 = 10.00% APR (x10000 scale) 
        bool isRepaid;
        bool isLiquidated;
    }

    uint256 public loanId;
    mapping(uint256 => Loan) public loans;

    // Automation state
    uint256[] public activeLoanIds;
    mapping(uint256 => bool) public isActiveLoan;

    // Events
    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 collateral, uint256 loanAmount);
    event LoanFunded(uint256 indexed loanId, address indexed lender);
    event LoanRepaid(uint256 indexed loanId);
    event LoanLiquidated(uint256 indexed loanId);

    constructor(address _priceFeed, address _stableCoin) Ownable(msg.sender) {
        priceFeed = AggregatorV3Interface(_priceFeed);
        stableCoin = IERC20(_stableCoin);
    }

    // Borrower creates a loan request by sending ETH collateral
    function requestLoan(uint256 _loanAmount, uint256 _duration, uint256 _interestRate) external payable {
        require(msg.value > 0, "Collateral required");
        require(_loanAmount > 0, "Loan amount required");

        loans[loanId] = Loan({
            borrower: msg.sender,
            lender: address(0),
            collateralAmount: msg.value,
            loanAmount: _loanAmount,
            startTime: 0,
            duration: _duration,
            interestRate: _interestRate,
            isRepaid: false,
            isLiquidated: false
        });
        // Add to active loan list
        activeLoanIds.push(loanId);
        isActiveLoan[loanId] = true;

        emit LoanRequested(loanId, msg.sender, msg.value, _loanAmount);
        loanId++;
    }

    // Lender funds the loan
    function fundLoan(uint256 _loanId) external {
        Loan storage loan = loans[_loanId];
        require(loan.lender == address(0), "Already funded");

        loan.lender = msg.sender;
        loan.startTime = block.timestamp;

        require(stableCoin.transferFrom(msg.sender, loan.borrower, loan.loanAmount), "Transfer failed");

        emit LoanFunded(_loanId, msg.sender);
    }

    // Borrower repays the loan
    function repayLoan(uint256 _loanId) external {
        Loan storage loan = loans[_loanId];
        require(msg.sender == loan.borrower, "Not borrower");
        require(!loan.isRepaid && !loan.isLiquidated, "Loan closed");

        // Calculate interest in real-time using simple interest
        uint256 elapsed = block.timestamp - loan.startTime;
        uint256 interest = (loan.loanAmount * loan.interestRate * elapsed) / (365 days * 10000);
        uint256 totalOwed = loan.loanAmount + interest;
        require(stableCoin.transferFrom(msg.sender, loan.lender, totalOwed), "Repay transfer failed");

        loan.isRepaid = true;

        // Return collateral
        payable(loan.borrower).transfer(loan.collateralAmount);

        emit LoanRepaid(_loanId);
    }

    // Chainlink Automation - checkUpkeep
    function checkUpkeep(bytes calldata) external view override returns (bool upkeepNeeded, bytes memory performData) {
        for (uint256 i = 0; i < activeLoanIds.length; i++) {
            uint256 id = activeLoanIds[i];
            Loan storage loan = loans[id];

            if (!loan.isRepaid && !loan.isLiquidated) {
                (, int price,,,) = priceFeed.latestRoundData();
                if (price <= 0) continue;

                uint256 ethPrice = uint256(price);
                uint256 collateralUSD = (loan.collateralAmount * ethPrice) / 1e18;
                uint256 loanAmountUSD = loan.loanAmount * 1e2; // USDC 6 -> 8 decimals

                bool underCollateralized = collateralUSD * 100 < loanAmountUSD * 120;
                bool expired = block.timestamp > loan.startTime + loan.duration;

                if (underCollateralized || expired) {
                    return (true, abi.encode(id));
                }
            }
        }

        return (false, bytes(""));
    }

    // Chainlink Automation - performUpkeep
    function performUpkeep(bytes calldata performData) external override {
        uint256 id = abi.decode(performData, (uint256));
        liquidateLoan(id);
    }

    // Check and perform liquidation
    function liquidateLoan(uint256 _loanId) public {
        Loan storage loan = loans[_loanId];
        require(!loan.isRepaid && !loan.isLiquidated, "Loan closed");

        (, int price,,,) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");

        // ETH/USD price is typically 8 decimals
        uint256 ethPrice = uint256(price);
        uint256 collateralUSD = (loan.collateralAmount * ethPrice) / 1e18;

        // Normalize loanAmount (6 decimals) to 8 decimals to compare (IMPORTANT)
        uint256 loanAmountUSD = loan.loanAmount * 1e2;
    
        // ✅ Make sure collateralUSD * 100 < normalizedLoan * 120
        bool underCollateralized = collateralUSD * 100 < loanAmountUSD * 120;
        
        // ✅ Make sure loan is expired
        bool expired = block.timestamp > loan.startTime + loan.duration;

        require(underCollateralized || expired, "Not eligible for liquidation");
        loan.isLiquidated = true;

        // Remove from active loan list
        isActiveLoan[_loanId] = false;

        // Send collateral to lender
        payable(loan.lender).transfer(loan.collateralAmount);

        emit LoanLiquidated(_loanId);
    }

    // Helper: get ETH/USD price
    function getLatestPrice() public view returns (int) {
        (, int price,,,) = priceFeed.latestRoundData();
        return price;
    }

    // View helper
    function getActiveLoans() external view returns (uint256[] memory) {
        return activeLoanIds;
    }

    // getTotalRepayable (because of simple interest)
    function getTotalRepayable(uint256 _loanId) public view returns (uint256 totalOwed, uint256 interest) {
        Loan storage loan = loans[_loanId];
        if (loan.isRepaid || loan.isLiquidated || loan.startTime == 0) {
            return (0, 0); // loan chưa bắt đầu hoặc đã đóng
        }

        uint256 elapsed = block.timestamp - loan.startTime;

        // interestRate is basis points (1000 = 10%)
        interest = (loan.loanAmount * loan.interestRate * elapsed) / (365 days * 10000);
        totalOwed = loan.loanAmount + interest;

        return (totalOwed, interest);
    }
}
