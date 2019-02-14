pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/math/SafeMath.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./Medianizer.sol";


contract MarketOracle is Ownable {
    using SafeMath for uint256;

    Medianizer public exchangeRateSource;

    Medianizer public cpiSource;
    uint256 public baseCpi;

    constructor(Medianizer exchangeRateSource_, Medianizer cpiSource_, uint256 baseCpi_) public {
        exchangeRateSource = exchangeRateSource_;
        cpiSource = cpiSource_;
        baseCpi = baseCpi_;
    }

    function getInflationAdjustedPrice()
        external
        returns (uint256)
    {
        bytes32 medianExchangeRate;
        bool exchangeRateValid;
        (medianExchangeRate, exchangeRateValid) = exchangeRateSource.compute();
        require(exchangeRateValid);

        bytes32 medianCpi;
        bool cpiValid;
        (medianCpi, cpiValid) = cpiSource.compute();
        require(cpiValid);

        return uint256(medianExchangeRate).mul(baseCpi).div(uint256(medianCpi));
    }
}
