pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./ExchangeRateSource.sol";


/**
 * @title Exchange rate aggregator contract
 * @notice https://www.fragments.org/protocol/
 *
 * @dev The aggregator contract maintains a public whitelist of valid exchange rate sources
 * Only the contract owner can add/remove sources from this whitelist.
 * The aggregated exchange rate is computed as the volume weighted average of valid
 * exchange rates from whitelisted sources.
 */
contract ExchangeRateAggregator is Ownable {
    using SafeMath for uint256;

    // The maximum number of sources which can be added
    uint8 public constant MAX_SOURCES = 255;

    // It signifies the number of decimal places in the aggregated exchange rate returned by this aggregator
    uint8 public constant DECIMALS = 18;

    // Whitelist of sources
    ExchangeRateSource[] public whitelist;

    event SourceAdded(ExchangeRateSource source);
    event SourceRemoved(ExchangeRateSource source);
    event SourceExpired(ExchangeRateSource source);
    event AggregatedExchangeRate(uint256 exchangeRate);

    /**
     * @dev Adds source to whitelist
     * @param source Reference to the ExchangeRateSource contract which is to be added.
     */
    function addSource(ExchangeRateSource source) public onlyOwner {
        require(whitelist.length < MAX_SOURCES);
        require(source.DECIMALS() == DECIMALS);
        whitelist.push(source);
        emit SourceAdded(source);
    }

    /**
     * @dev Performs a linear scan and removes the provided source from whitelist
     * @param source Reference to the ExchangeRateSource contract which is to be removed.
     */
    function removeSource(ExchangeRateSource source) public onlyOwner {
        for (uint8 i = 0; i < whitelist.length; i++) {
            if (whitelist[i] == source) {
                removeSource(i);
            }
        }
    }

    /**
     * @dev Computes the volume weighted average of valid exchange rates from whitelisted sources.
     */
    function aggregateExchangeRates() public returns (uint256) {
        uint256 weightedSum = 0;
        uint256 sumOfWeights = 0;
        for (uint8 i = 0; i < whitelist.length; i++) {
            if (!whitelist[i].isValid()) {
                emit SourceExpired(whitelist[i]);
                continue;
            }
            weightedSum = whitelist[i].exchangeRate()
                .mul(whitelist[i].volume())
                .add(weightedSum);
            sumOfWeights = sumOfWeights.add(whitelist[i].volume());
        }
        uint256 exchangeRate = weightedSum.div(sumOfWeights);
        emit AggregatedExchangeRate(exchangeRate);
        return exchangeRate;
    }

    /**
     * @dev Performs a linear scan on the whitelisted sources and removes dead sources
     */
    function removeDeadSources() public {
        for (uint8 i = 0; i < whitelist.length; i++) {
            if (isContractDead(address(whitelist[i]))) {
                removeSource(i);
            }
        }
    }

    /**
     * @dev Checks if the contract at the given address has been destroyed
     */
    function isContractDead(address _address) private view returns (bool) {
        uint size;
        assembly { size := extcodesize(_address) }
        return size == 0;
    }

   /**
    * @dev Given an index removes source at that index from the whitelist
    */
    function removeSource(uint8 index) private {
        require(index < whitelist.length);
        emit SourceRemoved(whitelist[index]);
        if (index != whitelist.length-1) {
            whitelist[index] = whitelist[whitelist.length-1];
        }
        whitelist.length--;
    }
}
