// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {NoOpNaming} from "../src/naming/NoOpNaming.sol";

contract NoOpNamingTest is Test {
    NoOpNaming naming;

    function setUp() public {
        naming = new NoOpNaming();
    }

    function test_IsNotLive() public view {
        assertFalse(naming.isLiveNaming());
    }

    function test_RegisterCallsAreNoOpAndDoNotRevert() public {
        naming.registerPool(0);
        naming.registerMember(0, makeAddr("m"), keccak256("m"));
    }
}
