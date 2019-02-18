pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract DataFeeder is Ownable {
    using SafeMath for uint256;

    event LogDataReported(
        uint256 data,
        uint64 indexed timestampSec
    );

    uint256 private _data;
    uint64 private _timestampSec;

    // The number of seconds after which the report must be deemed expired.
    uint64 public reportExpirationTimeSec;

    constructor(uint64 reportExpirationTimeSec_) public {
        reportExpirationTimeSec = reportExpirationTimeSec_;
    }

    function report(uint256 data, uint64 timestampSec)
        external
        onlyOwner
    {
        _data = data;
        _timestampSec = timestampSec;
        emit LogDataReported(data, timestampSec);
    }

    function getReport()
        public
        view
        returns (bool, uint256)
    {
        bool isFresh = (uint256(_timestampSec).add(reportExpirationTimeSec) > now);
        return (
            isFresh,
            _data
        );
    }

    function destroy() public onlyOwner {
        selfdestruct(owner());
    }
}
