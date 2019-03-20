pragma solidity ^0.4.24 ;
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

library Select {
    using SafeMath for uint256;

    function computeMedian(uint256[] data, uint256 size) internal pure returns (uint256) {
        assert(size > 0 && data.length >= size);
        for (uint256 i = 1; i < size; i++) {
            for (uint256 j = i; j > 0 && data[j-1]  > data[j]; j--) {
                uint256 tmp = data[j];
                data[j] = data[j-1];
                data[j-1] = tmp;
            }
        }
        if (size % 2 == 1) {
            return data[size / 2];
        } else {
            return data[size / 2].add(data[size / 2 - 1]) / 2;
        }
    }
}
