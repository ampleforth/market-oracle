pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

/**
 * @title DataFeeder
 *
 * @dev Feeds outside data on to the blockchain, from a single trusted source (ie) the owner address.
 *
 */

contract DataFeeder is Ownable {
    using SafeMath for uint128;

    event LogDataFed(
        uint128 data,
        uint64 indexed timestampSec
    );

    // Smaller types are used here locally to save on storage gas.
    uint128 private _data;
    uint64 private _timestampSec;

    // The number of seconds after which the fed data must be deemed expired.
    uint64 public dataExpirationTimeSec;

    constructor(uint64 dataExpirationTimeSec_) public {
        dataExpirationTimeSec = dataExpirationTimeSec_;
    }

    /**
     * @param data The integer data value fed on to the blockchain.
     */
    function feed(uint128 data)
        external
        onlyOwner
    {
        _data = data;
        _timestampSec = uint64(now);
        emit LogDataFed(data, _timestampSec);
    }

    /**
     * @dev In case that in-correct data is fed, the trusted source can choose to
     *      exclude it by marking it as 'un-fresh'.
     */
    function void()
        external
        onlyOwner
    {
        _data = 0;
        _timestampSec = 0;
        emit LogDataFed(_data, _timestampSec);
    }

    /**
     * @return Most recently reported market information.
     *         isFresh: Is true if the most recent data feed is within the expiration window and
     *                  false if the feed has expired.
     *         data: The most recent data feed.
     */
    function getFeed()
        public
        view
        returns (bool, uint256)
    {
        bool isFresh = (uint128(_timestampSec).add(dataExpirationTimeSec) > now);
        return (
            isFresh,
            uint256(_data)
        );
    }

    /**
     * @dev Terminates the contract and transfers eth to the owner.
     */
    function destroy() public onlyOwner {
        selfdestruct(owner());
    }
}
