pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract Heap is Ownable {

  uint256[] public data;

  function top() public view returns (uint256) {
      return data[0];
  }

  function size() public view returns (uint256) {
      return data.length;
  }

  modifier notEmpty() {
      require(data.length > 0);
      _;
  }
  // TODO: implement delete function
}


contract MinHeap is Heap {

    function insert(uint256 v) public onlyOwner {
        data.length++;
        for (uint i = data.length - 1; i > 0 && v < data[i / 2]; i /= 2) {
            data[i] = data[i / 2];
        }
        data[i] = v;
    }

    function pop() public onlyOwner notEmpty returns (uint256) {
        uint256 _top = data[0];
        uint256 last = data[data.length - 1];
        for (uint i = 0; 2*i+1 < data.length;) {
            uint i_ = 2*i+1;
            if (i_+1 < data.length && data[i_+1] < data[i_])
                i_++;
            if (data[i_] < last)
                data[i] = data[i_];
            else
                break;
            i = i_;
        }
        data[i] = last;
        data.length--;
        return _top;
    }
}


contract MaxHeap is Heap {

    function insert(uint256 v) public onlyOwner {
        data.length++;
        for (uint i = data.length - 1; i > 0 && v > data[i / 2]; i /= 2) {
            data[i] = data[i / 2];
        }
        data[i] = v;
    }

    function pop() public onlyOwner notEmpty returns (uint256) {
        uint256 _top = data[0];
        uint256 last = data[data.length - 1];
        for (uint i = 0; 2*i+1 < data.length;) {
            uint i_ = 2*i+1;
            if (i_+1 < data.length && data[i_+1] > data[i_])
                i++;
            if (data[i_] > last)
                data[i] = data[i_];
            else
                break;
            i = i_;
        }
        data[i] = last;
        data.length--;
        return _top;
    }
}
