pragma solidity 0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./Medianizer.sol";


contract Whitelistable is Ownable {
  mapping(address => bool) private _whitelist;

  function isWhitelisted(address w) public view returns (bool) {
      return _whitelist[w];
  }

  function whitelist(address w) public onlyOwner {
      _whitelist[w] = true;
  }

  function delist(address w) public onlyOwner {
      _whitelist[w] = false;
  }

  modifier onlyWhitelist() {
    require(_whitelist[msg.sender]);
    _;
  }
}


contract Oracle is Whitelistable {
    uint256 public lastReportTimestampSec;

    // How long reporting is open
    uint256 public reportWindowSec;

    // Time after reporing interval is closed up to which reported values are valid
    uint256 public reportValidTimeSec;

    Medianizer private _medianizer;

    constructor(uint256 reportWindowSec_, uint256 reportValidTimeSec_){
      reportWindowSec = reportWindowSec_;
      reportValidTimeSec = reportValidTimeSec_;
    }

    event LogBeganReportingWindow(uint256 timestamp, address medianizer);

    function beginReportingCycle() public onlyOwner outsideReportingCycle {
      if(address(_medianizer) != address(0)){
        _medianizer.destroy();
      }

      _medianizer = new Medianizer();
      _medianizer.transferOwnership(address(this));
      lastReportTimestampSec = now;

      emit LogBeganReportingWindow(now, address(_medianizer));
    }

    function report(uint256 dt) public onlyWhitelist withinReportingWindow {
      _medianizer.report(dt, msg.sender);
    }

    function getMedianReport() public withinReportValidityWindow returns (uint256) {
      return _medianizer.effectiveMedian();
    }

    modifier withinReportingWindow() {
      require(lastReportTimestampSec + reportWindowSec >= now);
      _;
    }

    modifier withinReportValidityWindow() {
      require(
        lastReportTimestampSec + reportWindowSec + reportValidTimeSec >= now &&
        now >= lastReportTimestampSec + reportWindowSec);
      _;
    }

    modifier outsideReportingCycle() {
      require(lastReportTimestampSec + reportWindowSec + reportValidTimeSec <= now);
      _;
    }
}
