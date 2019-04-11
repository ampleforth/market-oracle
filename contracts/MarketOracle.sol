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
    using Select for uint256[];

    struct Report {
        uint256 timestamp;
        uint256 payload;
    }

    address[] public providers;
    mapping (address => Report) public providerReports;

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
        require(providerReports[sender].timestamp > 0);
        providerReports[sender].timestamp = now;
        providerReports[sender].payload = payload;
    }

    function getData()
        external
        returns (uint256, bool)
    {
        uint256 reportsCount = providers.length;
        uint256[] memory validReports = new uint256[](reportsCount);
        uint256 size = 0;
        uint256 minValidTimestamp =  now.sub(reportExpirationTimeSec);

        for (uint256 i = 0; i < reportsCount; i++) {
            address providerAddress = providers[i];
            if (minValidTimestamp <= providerReports[providerAddress].timestamp) {
                validReports[size++] = providerReports[providerAddress].payload;
            } else {
                emit LogSourceExpired(providerAddress);
            }
        }

        if (size < minimumProviders) {
            return (0, false);
        }

        return (validReports.computeMedian(size), true);
    }

    /**
     * @dev Adds a provider to the whitelist.
     * @param provider Address of the provider.
     */
    function addSource(address provider)
        external
        onlyOwner
    {
        require(providerReports[provider].timestamp == 0);
        providers.push(provider);
        providerReports[provider].timestamp = 1;
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
        delete providerReports[provider];
        for (uint256 i = 0; i < providers.length; i++) {
            if (providers[i] == provider) {
                if (i != providers.length-1) {
                    providers[i] = providers[providers.length-1];
                }
                providers.length--;
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
        return providers.length;
    }
}
