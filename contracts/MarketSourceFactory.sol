pragma solidity 0.4.24;

import "./MarketSource.sol";


/**
 * @title Market Source Factory
 * @notice https://www.fragments.org/protocol/
 *
 * @dev A factory which spawns MarketSource contracts.
 */
contract MarketSourceFactory {
    event LogSourceCreated(address owner, string name, MarketSource source);

    /**
     * @dev Any user may call this function to create a MarketSource,
     *      which can be used to report market data.
     * @param name a human readable identifier for the source.
     * @return The address of the created MarketSource contract.
     */
    function createSource(string name) public returns (MarketSource) {
        MarketSource source = new MarketSource(name);
        emit LogSourceCreated(msg.sender, name, source);
        source.transferOwnership(msg.sender);
        return source;
    }
}
