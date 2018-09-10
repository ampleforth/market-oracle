pragma solidity 0.4.24;

import "./MarketSource.sol";


/**
 * @title Market Source Factory
 */
contract MarketSourceFactory {
    event LogSourceCreated(address owner, string name, MarketSource source);

    /**
     * @param name A human readable identifier for the source.
     * @return The address of the created MarketSource contract.
     */
    function createSource(string name) public returns (MarketSource) {
        MarketSource source = new MarketSource(name);
        emit LogSourceCreated(msg.sender, name, source);
        source.transferOwnership(msg.sender);
        return source;
    }
}
