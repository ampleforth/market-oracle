pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


/**
 * @title Data Provider
 *
 * @dev Provides external numeric data on-chain from a single trusted source, the owner address.
 *
 */
contract DataProvider is Ownable {
    using SafeMath for uint256;

    event LogDataReported(
        uint128 data,
        uint128 weight,
        uint64 indexed timestampSec
    );

    // Name of the data provider
    string public name;

    // These are the three oracle values that are continuously reported.
    // Smaller types are used here locally to save on storage gas.
    uint128 private _data;
    uint128 private _weight;
    uint64 private _timestampSec;

    // The number of seconds after which the reported data must be deemed expired.
    uint64 public reportExpirationTimeSec;

    constructor(string name_, uint64 reportExpirationTimeSec_) public {
        name = name_;
        reportExpirationTimeSec = reportExpirationTimeSec_;
    }

    /**
     * @param data The data observed and reported by the data provider owner,
     *             indicated as a 18 decimal fixed point number.
     * @param weight A factor reflecting the importance of this report over others
     *               indicated as a 18 decimal fixed point number.
     * @param timestampSec The off-chain timestamp of the observation.
     */
    function report(uint128 data, uint128 weight, uint64 timestampSec)
        external
        onlyOwner
    {
        require(data > 0);
        require(weight > 0);

        _data = data;
        _weight = weight;
        _timestampSec = timestampSec;

        emit LogDataReported(data, weight, timestampSec);
    }

    /**
     * @return Most recently reported data.
     *         isFresh: Is true if the last report is within the expiration window and
     *                  false if the report has expired.
     *         data: The data as reported by the owner
     *               18 decimal fixed point number.
     *         weight: The weight as reported by the owner
     *                 18 decimal fixed point number.
     */
    function getReport()
        public
        view
        returns (bool, uint256, uint256)
    {
        bool isFresh = (uint256(_timestampSec).add(reportExpirationTimeSec) > now);
        return (
            isFresh,
            uint256(_data),
            uint256(_weight)
        );
    }

    /**
     * @dev Terminates the contract and transfers eth to the owner.
     */
    function destroy() public onlyOwner {
        selfdestruct(owner());
    }
}
