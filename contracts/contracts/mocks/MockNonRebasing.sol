// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import { IVault } from "../interfaces/IVault.sol";

import { TRILLEST } from "../token/TRILLEST.sol";

contract MockNonRebasing {
    TRILLEST sTRILL;

    function setTRILLEST(address _sTRILLAddress) public {
        sTRILL = TRILLEST(_sTRILLAddress);
    }

    function rebaseOptIn() public {
        sTRILL.rebaseOptIn();
    }

    function rebaseOptOut() public {
        sTRILL.rebaseOptOut();
    }

    function transfer(address _to, uint256 _value) public {
        sTRILL.transfer(_to, _value);
    }

    function transferFrom(
        address _from,
        address _to,
        uint256 _value
    ) public {
        sTRILL.transferFrom(_from, _to, _value);
    }

    function increaseAllowance(address _spender, uint256 _addedValue) public {
        sTRILL.increaseAllowance(_spender, _addedValue);
    }

    function mintTrillest(
        address _vaultContract,
        address _asset,
        uint256 _amount
    ) public {
        IVault(_vaultContract).mint(_asset, _amount, 0);
    }

    function redeemTrillest(address _vaultContract, uint256 _amount) public {
        IVault(_vaultContract).redeem(_amount, 0);
    }

    function approveFor(
        address _contract,
        address _spender,
        uint256 _addedValue
    ) public {
        IERC20(_contract).approve(_spender, _addedValue);
    }
}
