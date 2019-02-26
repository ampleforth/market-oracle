pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./DataProvider.sol";


/**
 * @title Oracle
 *
 * @dev Provides the aggregated numeric data on-chain from a whitelisted set of data provider contracts.
 */
contract Oracle is Ownable {
    using SafeMath for uint256;

    // Whitelist of data providers
    DataProvider[] public whitelist;

    event LogProviderAdded(DataProvider provider);
    event LogProviderRemoved(DataProvider provider);
    event LogProviderExpired(DataProvider provider);

    /**
     * @dev Calculates the volume weighted average from whitelisted data providers.
     *      Expired data providers are ignored. If there has been no trade volume in the last
     *      24hrs, then there is effectively no exchange rate and that value should be ignored by
     *      the client.
     * @return The volume weighted average of data from whitelisted data providers.
     */
    function getAggregatedData()
        external
        returns (uint256)
    {
        uint256 weightedSum = 0;
        uint256 sumOfWeights = 0;
        uint256 partialData = 0;
        uint256 partialWeight = 0;
        bool isProviderFresh = false;

        for (uint256 i = 0; i < whitelist.length; i++) {
            (isProviderFresh, partialData, partialWeight) = whitelist[i].getReport();

            if (!isProviderFresh) {
                emit LogProviderExpired(whitelist[i]);
                continue;
            }

            weightedSum = weightedSum.add(partialData.mul(partialWeight));
            sumOfWeights = sumOfWeights.add(partialWeight);
        }

        // No explicit fixed point normalization is done as dividing by sumOfWeights normalizes
        // to data's format.
        return sumOfWeights > 0 ? weightedSum.div(sumOfWeights) : 0;
    }

    /**
     * @dev Adds a data provider to the whitelist.
     * Upgradeable contracts should never be added,
     * because the logic could be changed after the whitelisting process.
     * @param provider Address of the DataProvider.
     */
    function addProvider(DataProvider provider)
        external
        onlyOwner
    {
        whitelist.push(provider);
        emit LogProviderAdded(provider);
    }

    /**
     * @dev Removes the provided data provider from the whitelist.
     * @param provider Address of the DataProvider.
     */
    function removeProvider(DataProvider provider)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < whitelist.length; i++) {
            if (whitelist[i] == provider) {
                removeProviderAtIndex(i);
                break;
            }
        }
    }

    /**
     * @dev Expunges from the whitelist any DataProvider whose associated contracts have been
     *      destructed.
     */
    function removeDestructedProviders()
        external
    {
        uint256 i = 0;
        while (i < whitelist.length) {
            if (isContractDestructed(whitelist[i])) {
                removeProviderAtIndex(i);
            } else {
                i++;
            }
        }
    }

    /**
     * @return The number of data providers in the whitelist.
     */
    function whitelistSize()
        public
        view
        returns (uint256)
    {
        return whitelist.length;
    }

    /**
     * @dev Checks if a contract has been destructed.
     * @param contractAddress Address of the contract.
     */
    function isContractDestructed(address contractAddress)
        private
        view
        returns (bool)
    {
        uint256 size;
        assembly { size := extcodesize(contractAddress) }
        return size == 0;
    }

   /**
    * Whitelist must be non-empty before calling.
    * @param index Index of the DataProvider to be removed from the whitelist.
    */
    function removeProviderAtIndex(uint256 index)
        private
    {
        // assert(whitelist.length > index);
        emit LogProviderRemoved(whitelist[index]);
        if (index != whitelist.length-1) {
            whitelist[index] = whitelist[whitelist.length-1];
        }
        whitelist.length--;
    }
}
