pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/lifecycle/Destructible.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


/**
 * @title Market Source
 * @notice https://www.fragments.org/protocol/
 *
 * @dev This contract provides the UFragments-USD exchange rate and total volume of
 *      UFragments traded over the past 24-hours, as reported by a single offchain market source.
 */
contract MarketSource is Destructible {
    using SafeMath for uint256;

    // Name of the source reporting exchange rates
    string public name;

    // The amount of time after which the report must be deemed expired
    uint256 public constant REPORT_EXPIRATION_TIME = 1 hours;

    struct Report {
        uint256 exchangeRate;
        uint256 volume24hrs;
        uint256 timestamp;
    }

    // Most recent report from the source
    Report public report;

    event ExchangeRateReported(uint256 exchangeRate, uint256 volume24hrs, uint256 indexed timestamp);

    constructor(string _name) public {
        name = _name;
    }

    /**
     * @dev The MarketSource receives offchain information about the state of the market and
     *      provides it to downstream onchain consumers.
     * @param exchangeRate The average UFragments-USD exchange rate over 24-hours.
     *        Submitted as an fixed point number scaled by {1/10**18}.
     *        (eg) 1500000000000000000 (1.5e18) means the rate is [1.5 USD = 1 UFragments]
     * @param volume24hrs The total trade volume of UFragments over 24-hours,
     *        up to the time of observation. Submitted as a fixed point number scaled by {1/10**2}.
     *        (eg) 12350032 means 123500.32 UFragments were being traded.
     * @param timestamp The date and time when the observation was made. Sumbitted
     *        as a UNIX timestamp, (ie) number of seconds since Jan 01 1970(UTC).
     */
    function reportRate(uint256 exchangeRate, uint256 volume24hrs, uint256 timestamp) public onlyOwner {
        require(exchangeRate > 0);
        require(volume24hrs > 0);

        report = Report({
            exchangeRate: exchangeRate,
            volume24hrs: volume24hrs,
            timestamp: timestamp
        });

        emit ExchangeRateReported(exchangeRate, volume24hrs, timestamp);
    }

    /**
     * @return Most recently reported exchange rate.
     */
    function exchangeRate() public view returns (uint256) {
        return report.exchangeRate;
    }

    /**
     * @return Most recently reported trade volume.
     */
    function volume() public view returns (uint256) {
        return report.volume24hrs;
    }

    /**
     * @return If less than {REPORT_EXPIRATION_TIME} has passed since the most recent report.
     */
    function isActive() public view returns (bool) {
        return (report.timestamp + REPORT_EXPIRATION_TIME > now);
    }
}
