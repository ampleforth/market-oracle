pragma solidity 0.4.24;

import "./ExchangeRateSource.sol";


/**
 * @title Exchange rate factory contract
 * @notice https://www.fragments.org/protocol/
 *
 * @dev A factory which creates exchange rate source contracts.
 */
contract ExchangeRateFactory {
    event SourceCreated(address owner, string name, ExchangeRateSource source);

    /**
     * @dev Any ethereum user can call this function create an ExchangeRateSource,
     * which they could use to report exchange rates.
     * @param name a human readable identifier for the source.
     * @return The address of the created ExchangeRateSource contract.
     */
    function createSource(string name) public returns (ExchangeRateSource) {
        ExchangeRateSource source = new ExchangeRateSource(name);
        emit SourceCreated(msg.sender, name, source);
        source.transferOwnership(msg.sender);
        return source;
    }
}
