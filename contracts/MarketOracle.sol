pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./MarketSource.sol";


/**
 * @title Market Oracle
 * @notice https://www.fragments.org/protocol/
 *
 * @dev This oracle provides price and volume data onchain using data from a whitelisted
 *      set of market sources.
 */
contract MarketOracle is Ownable {
    using SafeMath for uint256;

    // Whitelist of sources
    MarketSource[] public whitelist;

    event LogSourceAdded(MarketSource source);
    event LogSourceRemoved(MarketSource source);
    event LogSourceExpired(MarketSource source);

    /**
     * @return The volume weighted average of active exchange rates and the total trade volume.
     *         The returned price is in an 18 decimal fixed point format.
     *         The returned volume parameter is in a 2 decimal fixed point format.
     */
    function getPriceAndVolume() external returns (uint256, uint256) {
        uint256 volumeWeightedSum = 0;
        uint256 volume = 0;

        for (uint8 i = 0; i < whitelist.length; i++) {
            if (!whitelist[i].isActive()) {
                emit LogSourceExpired(whitelist[i]);
                continue;
            }

            volumeWeightedSum = volumeWeightedSum.add(
                whitelist[i].getExchangeRate().mul(whitelist[i].getVolume24hrs())
            );

            volume = volume.add(whitelist[i].getVolume24hrs());
        }

        uint256 exchangeRate = volumeWeightedSum.div(volume);
        return (exchangeRate, volume);
    }

    /**
     * @dev Adds a market source to the whitelist
     * @param source Reference to the MarketSource contract to be whitelisted.
     */
    function addSource(MarketSource source) external onlyOwner {
        whitelist.push(source);
        emit LogSourceAdded(source);
    }

    /**
     * @dev Performs a linear scan and removes the provided market source from whitelist
     * @param source Reference to the MarketSource contract to be delisted.
     */
    function removeSource(MarketSource source) external onlyOwner {
        for (uint8 i = 0; i < whitelist.length; i++) {
            if (whitelist[i] == source) {
                removeSource(i);
            }
        }
    }

    /**
     * @dev Performs a linear scan on the whitelisted sources and removes any dead market sources
     */
    function removeDeadSources() external {
        uint8 i = 0;
        while (i < whitelist.length) {
            if (isContractDead(whitelist[i])) {
                removeSource(i);
            } else {
                i++;
            }
        }
    }

    /**
     * @return The number of sources in the whitelist
     */
    function whitelistCount() public view returns (uint256) {
        return whitelist.length;
    }

    /**
     * @param _address Address of a smart contract
     * @dev Checks if the contract has been destroyed
     */
    function isContractDead(address _address) private view returns (bool) {
        uint size;
        assembly { size := extcodesize(_address) }
        return size == 0;
    }

   /**
    * @param index Index of the Market Source form the whitelist
    * @dev Removes the market source at given index
    */
    function removeSource(uint8 index) private {
        emit LogSourceRemoved(whitelist[index]);
        if (index != whitelist.length-1) {
            whitelist[index] = whitelist[whitelist.length-1];
        }
        whitelist.length--;
    }
}
