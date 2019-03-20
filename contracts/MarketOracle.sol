pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./lib/Select.sol";


interface IOracle {
    function getData() external returns (uint256, bool);
}


/**
 * @title Market Oracle
 *
 * @dev Provides the aggregated rate data onchain using data from a whitelisted
 *      set of providers.
 */
contract MarketOracle is Ownable, IOracle {
    using SafeMath for uint256;

    struct Report {
        uint256 timestamp;
        uint256 payload;
    }

    address [] public whitelist;
    mapping (address => Report) public reportsMap;

    event LogSourceAdded(address source);
    event LogSourceRemoved(address source);
    event LogSourceExpired(address source);


    // The number of seconds after which the report must be deemed expired.
    uint256 public reportExpirationTimeSec = 6 hours;

    uint256 public minimumProviders = 1;

    function setReportExpirationTimeSec(uint256 reportExpirationTimeSec_)
    external
    onlyOwner
    {
        require(reportExpirationTimeSec_ > 0);
        reportExpirationTimeSec = reportExpirationTimeSec_;
    }

    function setMinimumProviders(uint256 minimumProviders_)
    external
    onlyOwner
    {
        require(minimumProviders_ > 0);
        minimumProviders = minimumProviders_;
    }

    function pushReport(uint256 payload) external
    {
        address sender = msg.sender;
        require(reportsMap[sender].timestamp > 0);
        reportsMap[sender].timestamp = now;
        reportsMap[sender].payload = payload;
    }

    function getData()
        external
        returns (uint256, bool)
    {
        uint256 reportsCount = whitelist.length;
        uint256[] memory validReports = new uint256[](reportsCount);
        uint256 size = 0;
        uint256 validTimestampLimit =  now.sub(reportExpirationTimeSec);

        for (uint256 i = 0; i < reportsCount; i++) {
            address providerAddress = whitelist[i];
            if (validTimestampLimit <= reportsMap[providerAddress].timestamp) {
                validReports[size++] = reportsMap[providerAddress].payload;
            } else {
                emit LogSourceExpired(providerAddress);
            }
        }

        if (size < minimumProviders) {
            return (0, false);
        }
        uint256 median =  Select.computeMedian(validReports, size);
        return (median, true);
    }

    /**
     * @dev Adds a provider to the whitelist.
     * @param provider Address of the provider.
     */
    function addSource(address provider)
        external
        onlyOwner
    {
        require(reportsMap[provider].timestamp == 0);
        whitelist.push(provider);
        reportsMap[provider].timestamp = 1;
        emit LogSourceAdded(provider);
    }

    /**
     * @dev Removes a provider from the whitelist.
     * @param provider Address of the provider.
     */
    function removeSource(address provider)
        public
        onlyOwner
    {
        delete reportsMap[provider];
        for (uint256 i = 0; i < whitelist.length; i++) {
            if (whitelist[i] == provider) {
                if (i != whitelist.length-1) {
                    whitelist[i] = whitelist[whitelist.length-1];
                }
                whitelist.length--;
                emit LogSourceRemoved(provider);
                break;
            }
        }
    }

    /**
     * @return The number of market sources in the whitelist.
     */
    function whitelistSize()
        public
        view
        returns (uint256)
    {
        return whitelist.length;
    }
}
