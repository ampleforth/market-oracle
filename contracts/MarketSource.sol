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
     * @param _exchangeRate The average exchange rate over 24 hours represented by an 18 decimal
     *                      fixed point number.
     * @param _volume24hrs The trade volume in the last 24 hours represented by a 2 decimal fixed
     *                     point number.
     * @param _posixTimestamp The off chain timestamp of the observation.
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
     * @return Most recently reported market information.
     *         isFresh: Is true if the last report is within the expiration window and
     *                  false if the report has expired.
     *         exchangeRate: The average exchange rate over 24 hours represented by an 18 decimal
     *                      fixed point number.
     *         volume24hrs: The trade volume in the last 24 hours represented by a 2 decimal fixed
     *                     point number.
     */
    function getReport() public view returns (bool, uint256, uint256) {
        bool isFresh = (REPORT_EXPIRATION_TIME.add(posixTimestamp) > now);
        return (
            isFresh,
            uint256(exchangeRate),
            uint256(volume24hrs)
        );
    }
}
