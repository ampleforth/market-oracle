pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./lib/Select.sol";


interface IOracle {
    function getData() external returns (uint256, bool);
}


/**
 * @title Median Oracle
 *
 * @dev Provides a value onchain that's aggregated from a whitelisted set of
        providers.
 */
contract MedianOracle is Ownable, IOracle {
    using SafeMath for uint256;

    struct Report {
        uint256 timestamp;
        uint256 payload;
    }

    // Addresses of providers authorized to push reports.
    address[] public providers;

    // Reports indexed by provider address. Report.timestamp > 0 indicates entry
    // existence.
    mapping (address => Report[2]) public providerReports;

    event ProviderAdded(address provider);
    event ProviderRemoved(address provider);
    event ReportTimestampOutOfRange(address provider);

    // The number of seconds after which the report is deemed expired.
    uint256 public reportExpirationTimeSec = 6 hours;

    uint256 public reportSecurityDelaySec = 1 hours;

    uint256 public minimumProviders = 1;

    function setReportExpirationTimeSec(uint256 reportExpirationTimeSec_)
    external
    onlyOwner
    {
        reportExpirationTimeSec = reportExpirationTimeSec_;
    }

    function setReportSecurityDelaySec(uint256 reportSecurityDelaySec_)
    external
    onlyOwner
    {
        reportSecurityDelaySec = reportSecurityDelaySec_;
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
        address providerAddress = msg.sender;
        Report[2] memory reports = providerReports[providerAddress];

        require(reports[0].timestamp > 0);

        uint8 index_recent;
        if (reports[0].timestamp >= reports[1].timestamp) {
            index_recent = 0;
        } else {
            index_recent = 1;
        }
        uint8 index_older = 1 - index_recent;
        uint256 nowTimestamp = now;

        require(reports[index_recent].timestamp.add(reportSecurityDelaySec) <= nowTimestamp);

        providerReports[providerAddress][index_older].timestamp = nowTimestamp;
        providerReports[providerAddress][index_older].payload = payload;
    }

    function purgeReports() external
    {
        address providerAddress = msg.sender;
        require (providerReports[providerAddress][0].timestamp > 0);
        providerReports[providerAddress][0].timestamp=1;
        providerReports[providerAddress][1].timestamp=1;
    }

    function getData()
        external
        returns (uint256, bool)
    {
        uint256 reportsCount = providers.length;
        uint256[] memory validReports = new uint256[](reportsCount);
        uint256 size = 0;
        uint256 minValidTimestamp =  now.sub(reportExpirationTimeSec);
        uint256 maxValidTimestamp =  now.sub(reportSecurityDelaySec);

        for (uint256 i = 0; i < reportsCount; i++) {
            address providerAddress = providers[i];
            Report[2] memory reports = providerReports[providerAddress];
            uint8 index_recent;
            if (reports[0].timestamp >= reports[1].timestamp) {
                index_recent = 0;
            } else {
                index_recent = 1;
            }
            uint8 index_older = 1 - index_recent;


            if (reports[index_recent].timestamp <= maxValidTimestamp) { // Not too recent
                if(reports[index_recent].timestamp < minValidTimestamp) { // Too old
                    emit ReportTimestampOutOfRange(providerAddress);
                } else {
                    // Valid
                    validReports[size++] = providerReports[providerAddress][index_recent].payload;
                }
            } else { // Newer is too recent
                uint256 reportTimestampRecent = providerReports[providerAddress][index_older].timestamp;
                if (reportTimestampRecent < minValidTimestamp) {
                    emit ReportTimestampOutOfRange(providerAddress);
                } else if (reportTimestampRecent > maxValidTimestamp) {
                    emit ReportTimestampOutOfRange(providerAddress);
                } else {
                    validReports[size++] = providerReports[providerAddress][index_older].payload;
                }
            }
        }

        if (size < minimumProviders) {
            return (0, false);
        }

        return (Select.computeMedian(validReports, size), true);
    }

    /**
     * @dev Authorizes a provider.
     * @param provider Address of the provider.
     */
    function addProvider(address provider)
        external
        onlyOwner
    {
        require(providerReports[provider][0].timestamp == 0 && providerReports[provider][1].timestamp == 0);
        providers.push(provider);
        providerReports[provider][0].timestamp = 1;
        providerReports[provider][1].timestamp = 1;
        emit ProviderAdded(provider);
    }

    /**
     * @dev Revokes provider authorization.
     * @param provider Address of the provider.
     */
    function removeProvider(address provider)
        public
        onlyOwner
    {
        delete providerReports[provider];
        for (uint256 i = 0; i < providers.length; i++) {
            if (providers[i] == provider) {
                if (i + 1  != providers.length) {
                    providers[i] = providers[providers.length-1];
                }
                providers.length--;
                emit ProviderRemoved(provider);
                break;
            }
        }
    }

    /**
     * @return The number of providers.
     */
    function providersSize()
        public
        view
        returns (uint256)
    {
        return providers.length;
    }
}
