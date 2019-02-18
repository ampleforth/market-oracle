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

    function getMedianReport() external returns (uint256) {
        bool isReportFresh = false;
        uint256 reportedData;

        uint256 freshReportsLength = whitelist.length;
        uint256[] memory reports = new uint256[](freshReportsLength);


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
        freshReportsLength = j;

        uint256 t;
        for (i = 0; i < freshReportsLength; i++) {
          for (j = i + 1; j < freshReportsLength; j++) {
            if(reports[i] > reports[j]) {
              t = reports[i];
              reports[i] = reports[j];
              reports[j] = t;
            }
          }
        }

        if(freshReportsLength % 2 != 0){
          return reports[freshReportsLength/2];
        } else {
          return reports[freshReportsLength/2].add(reports[freshReportsLength/2+1]).div(2);
        }
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
