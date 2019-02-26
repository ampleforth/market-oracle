pragma solidity 0.4.24;

import "./DataProvider.sol";


/**
 * @title Data Provider Factory
 */
contract DataProviderFactory {
    event LogProviderCreated(address owner, DataProvider provider);

    /**
     * @param name A human readable identifier for the provider.
     * @param reportExpirationTimeSec The number of seconds after which the
     *        data reported to the provider is deemed expired.
     * @return The address of the created DataProvider contract.
     */
    function createProvider(string name, uint64 reportExpirationTimeSec)
        public
        returns (DataProvider)
    {
        DataProvider provider = new DataProvider(name, reportExpirationTimeSec);
        provider.transferOwnership(msg.sender);
        emit LogProviderCreated(msg.sender, provider);
        return provider;
    }
}
