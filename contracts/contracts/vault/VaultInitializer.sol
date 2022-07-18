// SPDX-License-Identifier: agpl-3.0
pragma solidity ^0.8.0;

/**
 * @title TRILLEST VaultInitializer Contract
 * @notice The Vault contract initializes the vault.
 * @author Origin Protocol Inc
 */

import "./VaultStorage.sol";

contract VaultInitializer is VaultStorage {
    function initialize(address _priceProvider, address _trillest)
        external
        onlyGovernor
        initializer
    {
        require(_priceProvider != address(0), "PriceProvider address is zero");
        require(_trillest != address(0), "sTRILL address is zero");

        sTRILL = TRILLEST(_trillest);

        priceProvider = _priceProvider;

        rebasePaused = false;
        capitalPaused = true;

        // Initial redeem fee of 0 basis points
        redeemFeeBps = 0;
        // Initial Vault buffer of 0%
        vaultBuffer = 0;
        // Initial allocate threshold of 25,000 TRILLEST
        autoAllocateThreshold = 25000e18;
        // Threshold for rebasing
        rebaseThreshold = 1000e18;
        // Initialize all strategies
        allStrategies = new address[](0);
    }
}
