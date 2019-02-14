pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./MarketSource.sol";
import "./CPISource.sol";


/**
 * @title Market Oracle
 *
 * @dev Provides the exchange rate and volume data onchain using data from a whitelisted
 *      set of market source contracts.
 *      Exchange rate is the TOKEN:TARGET rate.
 *      Volume is a 24 hour trading volume in Token volume.
 */
contract MarketOracle is Ownable {
    using SafeMath for uint256;

    // Whitelist of market sources
    MarketSource[] public whitelist;
    CPISource public cpiSource;

    event LogSourceAdded(MarketSource source);
    event LogSourceRemoved(MarketSource source);
    event LogSourceExpired(MarketSource source);
    event LogCPISourceChanged(CPISource previousSource, NewSource newSource);


    function getInflationAdjustedPriceAnd24HourVolume()
      external
      returns (uint256, uint256)
    {
      uint256 inflation = 0;
      bool isCPISourceFresh = false;
      (isCPISourceFresh, inflation) =  cpiSource.getInflation();
      require(isCPISourceFresh);

      uint256 exchangeRate = 0;
      uint256 volumeRate = 0;
      (exchangeRate, volumeSum) = getPriceAnd24HourVolume();

      return(
        exchangeRate.div(inflation),
        volumeSum.div(inflation)
      );
    }


    /**
     * @dev Calculates the volume weighted average of exchange rates and total trade volume.
     *      Expired market sources are ignored. If there has been no trade volume in the last
     *      24hrs, then there is effectively no exchange rate and that value should be ignored by
     *      the client.
     * @return exchangeRate: Volume weighted average of exchange rates.
     *         volume: Total trade volume of the last reported 24 hours in Token volume.
     */
    function getPriceAnd24HourVolume()
        private
        returns (uint256, uint256)
    {
        uint256 volumeWeightedSum = 0;
        uint256 volumeSum = 0;
        uint256 partialRate = 0;
        uint256 partialVolume = 0;
        bool isSourceFresh = false;

        for (uint256 i = 0; i < whitelist.length; i++) {
            (isSourceFresh, partialRate, partialVolume) = whitelist[i].getReport();

            if (!isSourceFresh) {
                emit LogSourceExpired(whitelist[i]);
                continue;
            }

            volumeWeightedSum = volumeWeightedSum.add(partialRate.mul(partialVolume));
            volumeSum = volumeSum.add(partialVolume);
        }

        // No explicit fixed point normalization is done as dividing by volumeSum normalizes
        // to exchangeRate's format.
        uint256 exchangeRate = volumeSum > 0
            ? volumeWeightedSum.div(volumeSum)
            : 0;
        return (exchangeRate, volumeSum);
    }


    function setCPISource(CPISource newSource)
        external
        onlyOwner
    {
        emit LogCPISourceChanged(cpiSource, newSource);
        cpiSource = newSource;
    }

    /**
     * @dev Adds a market source to the whitelist.
     * Upgradeable contracts should never be added,
     * because the logic could be changed after the whitelisting process.
     * @param source Address of the MarketSource.
     */
    function addSource(MarketSource source)
        external
        onlyOwner
    {
        whitelist.push(source);
        emit LogSourceAdded(source);
    }

    /**
     * @dev Removes the provided market source from the whitelist.
     * @param source Address of the MarketSource.
     */
    function removeSource(MarketSource source)
        external
        onlyOwner
    {
        for (uint256 i = 0; i < whitelist.length; i++) {
            if (whitelist[i] == source) {
                removeSourceAtIndex(i);
                break;
            }
        }
    }

    /**
     * @dev Expunges from the whitelist any MarketSource whose associated contracts have been
     *      destructed.
     */
    function removeDestructedSources()
        external
    {
        uint256 i = 0;
        while (i < whitelist.length) {
            if (isContractDestructed(whitelist[i])) {
                removeSourceAtIndex(i);
            } else {
                i++;
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
    * @param index Index of the MarketSource to be removed from the whitelist.
    */
    function removeSourceAtIndex(uint256 index)
        private
    {
        // assert(whitelist.length > index);
        emit LogSourceRemoved(whitelist[index]);
        if (index != whitelist.length-1) {
            whitelist[index] = whitelist[whitelist.length-1];
        }
        whitelist.length--;
    }
}
