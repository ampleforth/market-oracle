pragma solidity 0.4.24;

import "./Heap.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";


contract Medianizer is Ownable {
  using SafeMath for uint256;

  MinHeap public minHeap;
  MaxHeap public maxHeap;
  uint256 public effectiveMedian = 0;

  mapping(address => bool) private _reportedAddresses;

  constructor() {
    minHeap = new MinHeap();
    minHeap.transferOwnership(address(this));

    maxHeap = new MaxHeap();
    maxHeap.transferOwnership(address(this));
  }

  function report(uint256 e, address from) public onlyOwner {
    // ensure that the same wallet doesnt get to report again
    require(!_reportedAddresses[from]);
    // There are more elements in left (max) heap
    if(maxHeap.size() > minHeap.size()){
      if( e < effectiveMedian ) {
          // current element fits in left (max) heap
          // Remore top element from left heap and
          // insert into right heap
          minHeap.insert(maxHeap.pop());
          // current element fits in left (max) heap
          maxHeap.insert(e);
      }
      else {
          // current element fits in right (min) heap
          minHeap.insert(e);
      }
      // Both heaps are balanced
      effectiveMedian = average(maxHeap.top(), minHeap.top());
    }
    // There are more elements in right (min) heap
    else if (maxHeap.size() < minHeap.size()) {
      if( e < effectiveMedian ) {
          // current element fits in left (max) heap
          maxHeap.insert(e);
      }
      else {
          // Remove top element from right heap and
          // insert into left heap
          maxHeap.insert(minHeap.pop());
          // current element fits in right (min) heap
          minHeap.insert(e);
      }
      // Both heaps are balanced
      effectiveMedian = average(maxHeap.top(), minHeap.top());
    }
    // The left and right heaps contain same number of elements
    else {
      if( e < effectiveMedian ) {
          // current element fits in left (max) heap
          maxHeap.insert(e);
          effectiveMedian = maxHeap.top();
      }
      else {
          // current element fits in right (min) heap
          minHeap.insert(e);
          effectiveMedian = minHeap.top();
      }
    }
    _reportedAddresses[from] = true;
  }

  function destroy() public onlyOwner {
    selfdestruct(owner());
  }

  function average(uint256 a, uint256 b) private constant returns (uint256) {
    return a.add(b).div(2);
  }
}
