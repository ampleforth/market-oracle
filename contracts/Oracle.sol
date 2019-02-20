pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./DataFeeder.sol";

contract Oracle is Ownable {
    using SafeMath for uint256;

    // Whitelist of data feeders
    DataFeeder[] public whitelist;

    event LogDataFeederAdded(DataFeeder feeder);
    event LogDataFeederRemoved(DataFeeder feeder);
    event LogDataFeederExpired(DataFeeder feeder);

    function quickselectMedian(uint256[] a, uint256 len) private returns (uint256) {
      if(len % 2 == 1){
        return quickselect(a, len, len/2);
      } else {
        return (
          quickselect(a, len, len/2 - 1)
            .mul(quickselect(a, len, len/2))
            .div(2)
        );
      }
    }

    function quickselect(uint256[] a, uint256 len, uint256 k) private returns (uint256) {
      uint256[] memory ltPivot = new uint256[](len);
      uint256[] memory pivots = new uint256[](len);
      uint256[] memory gtPivot = new uint256[](len);

      uint256 i;
      uint256 pivot;
      uint256 li;
      uint256 gi;
      uint256 pi;

      while(true) {
        pivot = uint256(keccak256(block.timestamp))%len;
        i = 0;
        li = 0;
        gi = 0;
        pi = 0;

        for (; i < len; i++) {
          if(a[i] > a[pivot]){
            gtPivot[gi++] = a[i];
          } else if(a[i] < a[pivot]) {
            ltPivot[li++] = a[i];
          } else {
            pivots[pi++] = a[i];
          }
        }

        if(k < li){
          len = li;
          a = ltPivot;
        } else if(k < (li + pi)) {
          return pivots[0];
        } else {
          len = gi;
          k = k - li - pi;
          a = gtPivot;
        }
      }
    }

    function getMedianReport() external returns (uint256) {
        bool isReportFresh = false;
        uint256 reportedData;

        uint256[] memory reports = new uint256[](whitelist.length);

        // TODO: Replace the following with a better sorting/median alogrithm
        // Quick select median algorithm
        uint256 i;
        uint256 j;

        for (; i < whitelist.length; i++) {
            (isReportFresh, reportedData) = whitelist[i].getReport();
            if (!isReportFresh) {
                emit LogDataFeederExpired(whitelist[i]);
                continue;
            }
            reports[j] = reportedData;
            j++;
        }

        return quickselectMedian(reports, j);
    }

    function addDataFeeder(DataFeeder feeder)
        external
        onlyOwner
    {
        whitelist.push(feeder);
        emit LogDataFeederAdded(feeder);
    }

    function removeDataFeeder(DataFeeder feeder)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < whitelist.length; i++) {
            if (whitelist[i] == feeder) {
                removeDataFeederAtIndex(i);
                break;
            }
        }
    }

    function removeDestructedDataFeeders()
        external
    {
        uint256 i = 0;
        while (i < whitelist.length) {
            if (isContractDestructed(whitelist[i])) {
                removeDataFeederAtIndex(i);
            } else {
                i++;
            }
        }
    }

    function whitelistSize()
        public
        view
        returns (uint256)
    {
        return whitelist.length;
    }

    function isContractDestructed(address contractAddress)
        private
        view
        returns (bool)
    {
        uint256 size;
        assembly { size := extcodesize(contractAddress) }
        return size == 0;
    }

     function removeDataFeederAtIndex(uint256 index)
        private
    {
        // assert(whitelist.length > index);
        emit LogDataFeederRemoved(whitelist[index]);
        if (index != whitelist.length-1) {
            whitelist[index] = whitelist[whitelist.length-1];
        }
        whitelist.length--;
    }
}
