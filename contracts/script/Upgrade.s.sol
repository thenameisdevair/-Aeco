// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/SentimentFeed.sol";

/**
 * @title Upgrade
 * @notice Foundry broadcast script that upgrades the SentimentFeed proxy to a new
 *         implementation. Deploys V2 (hybrid oracle fields) and calls upgradeToAndCall
 *         on the existing ERC1967 proxy.
 *
 * Required environment variables:
 *   PRIVATE_KEY            — private key of the account holding UPGRADER_ROLE (hex, 0x-prefixed).
 *   SENTIMENT_FEED_PROXY   — address of the deployed SentimentFeed ERC1967 proxy.
 *
 * Run on Celo Sepolia testnet:
 *   forge script script/Upgrade.s.sol --rpc-url celo_testnet --broadcast --verify
 *
 * Run on mainnet:
 *   forge script script/Upgrade.s.sol --rpc-url celo_mainnet --broadcast --verify
 */
contract Upgrade is Script {
    function run() external {
        // ── Read environment ─────────────────────────────────────────────────
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address proxy       = vm.envAddress("SENTIMENT_FEED_PROXY");

        // ── Begin broadcast ──────────────────────────────────────────────────
        vm.startBroadcast(deployerKey);

        // ── Deploy new implementation ────────────────────────────────────────
        SentimentFeed newImpl = new SentimentFeed();

        // ── Upgrade proxy to new implementation ──────────────────────────────
        // upgradeToAndCall is guarded by UPGRADER_ROLE in _authorizeUpgrade.
        // No re-initialisation is needed — storage is append-only.
        SentimentFeed(proxy).upgradeToAndCall(address(newImpl), "");

        vm.stopBroadcast();

        // ── Log result ───────────────────────────────────────────────────────
        console.log("");
        console.log("=======================================================");
        console.log("         SentimentFeed Upgrade Complete                 ");
        console.log("=======================================================");
        console.log("");
        console.log("  Proxy:               ", proxy);
        console.log("  New implementation:  ", address(newImpl));
        console.log("  Contract version:    ", newImpl.CONTRACT_VERSION());
        console.log("");
        console.log("=======================================================");
    }
}
