pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/lifecycle/Destructible.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


/**
 * @title Market Source
 *
 * @dev Provides the exchange rate and 24 hour trade volume for a trading pair on a market.
 *      This can only receive data from a single trusted source, the owner address.
 *
 */
contract MarketSource is Destructible {
    using SafeMath for uint256;

    event LogExchangeRateReported(uint128 exchangeRate, uint128 volume24hrs, uint64 indexed timestampSecs);

    // Name of the source reporting exchange rates
    string public _name;

    // These are the three oracle values that are continuously reported.
    // Smaller types are used here locally to save on storage gas.
    uint128 private _exchangeRate;
    uint128 private _volume24hrs;
    uint64 private _timestampSecs;

    // The number of seconds after which the report must be deemed expired
    uint64 public _reportExpirationTimeSec;

    constructor(string name, uint64 reportExpirationTimeSec) public {
        _name = name;
        _reportExpirationTimeSec = reportExpirationTimeSec;
    }

    /**
     * @param exchangeRate The average exchange rate over 24 hours represented by an 18 decimal
     *                      fixed point number.
     * @param volume24hrs The trade volume in the last 24 hours represented by a 2 decimal fixed
     *                     point number.
     * @param timestampSecs The off chain timestamp of the observation.
     */
    function reportRate(uint128 exchangeRate, uint128 volume24hrs, uint64 timestampSecs) external onlyOwner {
        require(exchangeRate > 0);
        require(volume24hrs > 0);

        _exchangeRate = exchangeRate;
        _volume24hrs = volume24hrs;
        _timestampSecs = timestampSecs;

        emit LogExchangeRateReported(exchangeRate, volume24hrs, timestampSecs);
    }

    /**
     * @return Most recently reported market information.
     *         isFresh: Is true if the last report is within the expiration window and
     *                  false if the report has expired.
     *         exchangeRate: The average exchange rate over 24 hours represented by an 18 decimal
     *                      fixed point number.
     *         volume24hrs: The trade volume in the last 24 hours represented by a 2 decimal fixed
     *                     point number.
     */
    function getReport() public view returns (bool, uint256, uint256) {
        bool isFresh = (uint256(_timestampSecs).add(_reportExpirationTimeSec) > now);
        return (
            isFresh,
            uint256(_exchangeRate),
            uint256(_volume24hrs)
        );
    }
}
