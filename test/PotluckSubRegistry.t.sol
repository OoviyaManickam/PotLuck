// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PotluckSubRegistry} from "../src/naming/PotluckSubRegistry.sol";
import {IRegistry} from "../src/interfaces/IENSv2.sol";

contract PotluckSubRegistryTest is Test {
    PotluckSubRegistry reg;
    address controller = makeAddr("controller");

    function setUp() public {
        reg = new PotluckSubRegistry(controller);
    }

    function test_ControllerCanSetAndReadSub() public {
        PotluckSubRegistry child = new PotluckSubRegistry(controller);
        vm.prank(controller);
        reg.setSub("pool1", IRegistry(address(child)));
        assertEq(address(reg.getSubregistry("pool1")), address(child));
    }

    function test_ControllerCanSetResolver() public {
        vm.prank(controller);
        reg.setResolverFor("pool1", address(0xBEEF));
        assertEq(reg.getResolver("pool1"), address(0xBEEF));
    }

    function test_NonControllerCannotMutate() public {
        vm.prank(makeAddr("attacker"));
        vm.expectRevert(PotluckSubRegistry.NotController.selector);
        reg.setSub("pool1", IRegistry(address(0)));
    }

    function test_ParentReadback() public {
        vm.prank(controller);
        reg.setParent(IRegistry(address(0xAAA)), "potluck");
        (IRegistry p, string memory label) = reg.getParent();
        assertEq(address(p), address(0xAAA));
        assertEq(label, "potluck");
    }
}
