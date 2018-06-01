pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/lifecycle/Destructible.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


/**
 * @title Exchange rate source contract
 * @notice https://www.fragments.org/protocol/
 *
 * @dev This contract interacts with off chain exchange rate providers and records
 * the latest fragments to USD exchange rates onto the blockchain.
 */
contract ExchangeRateSource is Destructible {
    using SafeMath for uint256;

    // It signifies the number of decimal places in the reported exchange rate
    uint8 public constant DECIMALS = 18;

    // Name of the source reporting exchange rates
    string public name;

    uint256 public constant REPORT_EXPIRATION_TIME = 1 hours;

    struct Report {
        uint256 exchangeRate;
        uint256 volume;
        uint256 timestamp;
    }

    // Most recent report from the source
    Report public report;

    event ExchangeRateReported(uint256 exchangeRate, uint256 volume, uint256 indexed timestamp);

    constructor(string _name) public {
        name = _name;
    }

    /**
     * @dev Source reports the most recent exchange rate to the blockchain.
     * @param exchangeRate the fragments to USD exchange rate (eg) 105
     * @param volume the total trade volume traded at the given rate
     */
    function reportRate(uint256 exchangeRate, uint256 volume) public onlyOwner {
        report = Report({
            exchangeRate: exchangeRate,
            volume: volume,
            timestamp: now
        });
        emit ExchangeRateReported(exchangeRate, volume, now);
    }

    /**
     * @return The most recently reported exchange rate.
     */
    function exchangeRate() public view returns (uint256) {
        return report.exchangeRate;
    }

    /**
     * @return The most recently reported trade volume.
     */
    function volume() public view returns (uint256) {
        return report.volume;
    }

    /**
     * @return If the most recent report was made atmost {REPORT_EXPIRATION_TIME}
     * from the current block.
     */
    function isValid() public view returns (bool) {
        return (report.timestamp + REPORT_EXPIRATION_TIME > now);
    }
}
