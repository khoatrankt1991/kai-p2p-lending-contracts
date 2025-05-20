// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MockV3Aggregator {
    int256 public answer;
    uint8 public decimals_;

    constructor(uint8 _decimals, int256 _initialAnswer) {
        decimals_ = _decimals;
        answer = _initialAnswer;
    }

    function decimals() public view returns (uint8) {
        return decimals_;
    }

    function latestRoundData()
        external
        view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (0, answer, 0, 0, 0);
    }

    function updateAnswer(int256 _newAnswer) external {
        answer = _newAnswer;
    }
}
