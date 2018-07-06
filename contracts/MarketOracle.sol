pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./MarketSource.sol";


/**
 * @title Market Oracle
 * @notice https://www.fragments.org/protocol/
 *
 * @dev This oracle provides price and volume data onchain via a whitelist of sources. The exchange
        rate is computed as a volume weighted average of valid exchange rates.
 */
contract MarketOracle is Ownable {
    using SafeMath for uint256;

    // Maximum number of whitelisted sources
    uint8 public constant MAX_SOURCES = 255;

    // Number of decimal places in the exchange rate provided by this oracle.
    uint8 public constant DECIMALS = 18;

    // Whitelist of sources
    MarketSource[] public whitelist;

    event SourceAdded(MarketSource source);
    event SourceRemoved(MarketSource source);
    event SourceExpired(MarketSource source);

    /**
     * @return The volume weighted average of valid exchange rates from whitelisted sources and
     *         the total trade volume.
     */
    function getPriceAndVolume() external returns (uint128, uint128) {
        uint256 volumeWeightedSum = 0;
        uint256 volume = 0;
        for (uint8 i = 0; i < whitelist.length; i++) {
            if (!whitelist[i].isValid()) {
                emit SourceExpired(whitelist[i]);
                continue;
            }
            volumeWeightedSum = whitelist[i].exchangeRate()
            .mul(whitelist[i].volume())
            .add(volumeWeightedSum);
            volume = volume.add(whitelist[i].volume());
        }
        uint256 exchangeRate = volumeWeightedSum.div(volume);
        return (uint128(exchangeRate), uint128(volume));
    }

    /**
     * @dev Adds a source to the whitelist
     * @param source Reference to the MarketSource contract which is to be added.
     */
    function addSource(MarketSource source) external onlyOwner {
        require(whitelist.length < MAX_SOURCES);
        require(source.DECIMALS() == DECIMALS);
        whitelist.push(source);
        emit SourceAdded(source);
    }

    /**
     * @dev Performs a linear scan and removes the provided source from whitelist
     * @param source Reference to the MarketSource contract which is to be removed.
     */
    function removeSource(MarketSource source) external onlyOwner {
        for (uint8 i = 0; i < whitelist.length; i++) {
            if (whitelist[i] == source) {
                removeSource(i);
            }
        }
    }

    /**
     * @dev Performs a linear scan on the whitelisted sources and removes any dead sources
     */
    function removeDeadSources() external {
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
