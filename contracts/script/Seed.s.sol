// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "../src/SentimentFeed.sol";

/**
 * @title Seed
 * @notice Foundry broadcast script that registers the initial tracked subjects on an
 *         already-deployed SentimentFeed proxy. Run this after Deploy.s.sol.
 *
 * Required environment variables:
 *   PRIVATE_KEY_DEPLOYER     — private key of the deployer wallet (must hold DEFAULT_ADMIN_ROLE).
 *   SENTIMENT_FEED_ADDRESS   — proxy address of the deployed SentimentFeed contract.
 *
 * Run on Celo Sepolia testnet:
 *   forge script script/Seed.s.sol --rpc-url celo_testnet --broadcast
 *
 * Run on mainnet:
 *   forge script script/Seed.s.sol --rpc-url celo_mainnet --broadcast
 */
contract Seed is Script {
    function run() external {
        // ── Read environment ─────────────────────────────────────────────────
        uint256 deployerKey        = vm.envUint("PRIVATE_KEY_DEPLOYER");
        address sentimentFeedAddr  = vm.envAddress("SENTIMENT_FEED_ADDRESS");

        SentimentFeed feed = SentimentFeed(sentimentFeedAddr);

        // ── Begin broadcast ──────────────────────────────────────────────────
        vm.startBroadcast(deployerKey);

        // ── Crypto assets (category 1) ───────────────────────────────────────
        feed.addSubject("CELO", 1);
        console.log("Added subject: CELO (category 1)");

        feed.addSubject("cUSD", 1);
        console.log("Added subject: cUSD (category 1)");

        feed.addSubject("cKES", 1);
        console.log("Added subject: cKES (category 1)");

        feed.addSubject("BTC", 1);
        console.log("Added subject: BTC (category 1)");

        feed.addSubject("ETH", 1);
        console.log("Added subject: ETH (category 1)");

        // ── Public figures (category 2) ──────────────────────────────────────
        feed.addSubject("Vitalik Buterin", 2);
        console.log("Added subject: Vitalik Buterin (category 2)");

        // ── Narratives (category 3) ──────────────────────────────────────────
        feed.addSubject("Stablecoin Regulation", 3);
        console.log("Added subject: Stablecoin Regulation (category 3)");

        feed.addSubject("Africa Crypto Adoption", 3);
        console.log("Added subject: Africa Crypto Adoption (category 3)");

        vm.stopBroadcast();

        // ── Summary ──────────────────────────────────────────────────────────
        console.log("");
        console.log("=======================================================");
        console.log("           Aeco Subject Seeding Complete               ");
        console.log("=======================================================");
        console.log("  SentimentFeed: ", sentimentFeedAddr);
        console.log("  Subjects added: 8");
        console.log("=======================================================");
    }
}
