// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract P2PLending is Ownable {
    AggregatorV3Interface public priceFeed;
    IERC20 public stableCoin;

    struct Loan {
        address borrower;
        address lender;
        uint256 collateralAmount; // in ETH (wei)
        uint256 loanAmount; // in USDC (6 decimals)
        uint256 startTime;
        uint256 duration;
        bool isRepaid;
        bool isLiquidated;
    }

    uint256 public loanId;
    mapping(uint256 => Loan) public loans;

    event LoanRequested(uint256 indexed loanId, address indexed borrower, uint256 collateral, uint256 loanAmount);
    event LoanFunded(uint256 indexed loanId, address indexed lender);
    event LoanRepaid(uint256 indexed loanId);
    event LoanLiquidated(uint256 indexed loanId);

    constructor(address _priceFeed, address _stableCoin) Ownable(msg.sender) {
        priceFeed = AggregatorV3Interface(_priceFeed);
        stableCoin = IERC20(_stableCoin);
    }

    // Borrower creates a loan request by sending ETH collateral
    function requestLoan(uint256 _loanAmount, uint256 _duration) external payable {
        require(msg.value > 0, "Collateral required");
        require(_loanAmount > 0, "Loan amount required");

        loans[loanId] = Loan({
            borrower: msg.sender,
            lender: address(0),
            collateralAmount: msg.value,
            loanAmount: _loanAmount,
            startTime: 0,
            duration: _duration,
            isRepaid: false,
            isLiquidated: false
        });

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

        require(stableCoin.transferFrom(msg.sender, loan.lender, loan.loanAmount), "Repay transfer failed");

        loan.isRepaid = true;

        // Return collateral
        payable(loan.borrower).transfer(loan.collateralAmount);

        emit LoanRepaid(_loanId);
    }

    // Check and perform liquidation
    function liquidateLoan(uint256 _loanId) external {
        Loan storage loan = loans[_loanId];
        require(!loan.isRepaid && !loan.isLiquidated, "Loan closed");

        (, int price,,,) = priceFeed.latestRoundData();
        require(price > 0, "Invalid price");

        // ETH/USD price is typically 8 decimals
        uint256 ethPrice = uint256(price);
        uint256 collateralUSD = (loan.collateralAmount * ethPrice) / 1e18;

        // Normalize loanAmount (6 decimals) to 8 decimals to compare (IMPORTANT)
        uint256 normalizedLoan = loan.loanAmount * 1e2;
        // Liquidation threshold: if collateral < 120% of loan
        require(collateralUSD * 100 < normalizedLoan * 120, "Not eligible for liquidation");

        loan.isLiquidated = true;

        // Send collateral to lender
        payable(loan.lender).transfer(loan.collateralAmount);

        emit LoanLiquidated(_loanId);
    }

    // Helper: get ETH/USD price
    function getLatestPrice() public view returns (int) {
        (, int price,,,) = priceFeed.latestRoundData();
        return price;
    }
}
