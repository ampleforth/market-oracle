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

    event LogExchangeRateReported(uint128 exchangeRate, uint128 volume24hrs, uint64 indexed posixTimestamp);

    // Name of the source reporting exchange rates
    string public name;

    // The amount of time after which the report must be deemed expired
    uint256 public constant REPORT_EXPIRATION_TIME = 1 hours;

    // These are the three oracle values that are continuously updated.
    // Smaller types are used here locally to save on storage gas.
    uint128 private exchangeRate;
    uint128 private volume24hrs;
    uint64 private posixTimestamp;

    constructor(string _name) public {
        name = _name;
    }

    /**
     * @dev The MarketSource receives offchain information about the state of the market and
     *      provides it to downstream onchain consumers.
     * @param _exchangeRate The average UFragments-USD exchange rate over 24-hours.
     *        Submitted as an fixed point number scaled by {1/10**18}.
     *        (eg) 1500000000000000000 (1.5e18) means the rate is [1.5 USD = 1 UFragments]
     * @param _volume24hrs The total trade volume of UFragments over 24-hours,
     *        up to the time of observation. Submitted as a fixed point number scaled by {1/10**2}.
     *        (eg) 12350032 means 123500.32 UFragments were being traded.
     * @param _posixTimestamp The date and time when the observation was made. Sumbitted
     *        as a UNIX timestamp, (ie) number of seconds since Jan 01 1970(UTC).
     */
    function reportRate(uint128 _exchangeRate, uint128 _volume24hrs, uint64 _posixTimestamp) external onlyOwner {
        require(_exchangeRate > 0);
        require(_volume24hrs > 0);

        exchangeRate = _exchangeRate;
        volume24hrs = _volume24hrs;
        posixTimestamp = _posixTimestamp;

        emit LogExchangeRateReported(exchangeRate, volume24hrs, posixTimestamp);
    }

    /**
     * @return Most recently reported exchange rate as a uint256.
     */
    function getExchangeRate() public view returns (uint256) {
        return uint256(exchangeRate);
    }

    /**
     * @return Most recently reported trade volume as a uint256.
     */
    function getVolume24hrs() public view returns (uint256) {
        return uint256(volume24hrs);
    }

    /**
     * @return If less than {REPORT_EXPIRATION_TIME} has passed since the most recent report.
     */
    function isActive() public view returns (bool) {
        return (REPORT_EXPIRATION_TIME.add(posixTimestamp) > now);
    }
}
