pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract CPISource is Ownable {
    using SafeMath for uint256;

    event CPIReported(
        uint128 cpi,
        uint64 indexed timestampSec
    );

    uint128 public baseCpi;
    uint128 private _currentCpi;
    uint64 private _timestampSec;

    uint64 public cpiExpirationTimeSec;

    constructor(uint64 baseCpi_, uint64 cpiExpirationTimeSec_) public {
        baseCpi = baseCpi_;
        cpiExpirationTimeSec = cpiExpirationTimeSec_;
    }

    function report(uint128 currentCpi, uint64 timestampSec)
        external
        onlyOwner
    {
        _currentCpi = currentCpi;
        _timestampSec = timestampSec;

        emit CPIReported(currentCpi, timestampSec);
    }

    function getInflation()
        public
        view
        returns (bool, uint256)
    {
        return (
            (uint256(_timestampSec).add(cpiExpirationTimeSec) > now), // is data fresh?
            uint256(_currentCpi).div(baseCpi) //Inflation
        );
    }

    function destroy() public onlyOwner {
        selfdestruct(owner());
    }
}
