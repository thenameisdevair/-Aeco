// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

import "../src/AECToken.sol";
import "../src/HeartbeatOracle.sol";
import "../src/SentimentFeed.sol";
import "../src/PredictionGame.sol";

/**
 * @title Deploy
 * @notice Foundry broadcast script that deploys all four Aeco contracts as UUPS proxies
 *         and wires roles between them. Subject seeding is handled separately by Seed.s.sol.
 *
 * Required environment variables:
 *   PRIVATE_KEY_DEPLOYER  — private key of the deployer/owner wallet (hex, 0x-prefixed).
 *   AGENT_WALLET          — address of the pre-existing autonomous AI agent wallet.
 *
 * Run on Celo Sepolia testnet:
 *   forge script script/Deploy.s.sol --rpc-url celo_testnet --broadcast --verify
 *
 * Run on mainnet:
 *   forge script script/Deploy.s.sol --rpc-url celo_mainnet --broadcast --verify
 */
contract Deploy is Script {
    // ─────────────────────────────────────────────────────────────────────────
    // Role constants — must match the values declared in each contract.
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 internal constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Entry point
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Main deploy function invoked by `forge script`.
     * @dev Deployment order matters:
     *        1. AECToken   — standalone, no external deps.
     *        2. HeartbeatOracle — standalone.
     *        3. SentimentFeed  — standalone; address needed by PredictionGame.
     *        4. PredictionGame — depends on SentimentFeed + AECToken addresses.
     *      After all proxies are live, MINTER_ROLE is granted to PredictionGame and
     *      the agent wallet on AECToken. Run Seed.s.sol separately to register subjects.
     */
    function run() external {
        // ── Read environment ─────────────────────────────────────────────────
        uint256 deployerKey  = vm.envUint("PRIVATE_KEY_DEPLOYER");
        address agentWallet  = vm.envAddress("AGENT_WALLET");
        address deployer     = vm.addr(deployerKey);

        // ── Begin broadcast ──────────────────────────────────────────────────
        vm.startBroadcast(deployerKey);

        // ── 1. AECToken ──────────────────────────────────────────────────────
        // admin = deployer, minter = deployer, burner = deployer.
        // MINTER_ROLE is re-granted to PredictionGame and agentWallet below.
        AECToken aecImpl = new AECToken();
        AECToken aecToken = AECToken(
            address(
                new ERC1967Proxy(
                    address(aecImpl),
                    abi.encodeCall(AECToken.initialize, (deployer, deployer, deployer))
                )
            )
        );

        // ── 2. HeartbeatOracle ───────────────────────────────────────────────
        HeartbeatOracle heartbeatImpl = new HeartbeatOracle();
        HeartbeatOracle heartbeat = HeartbeatOracle(
            address(
                new ERC1967Proxy(
                    address(heartbeatImpl),
                    abi.encodeCall(HeartbeatOracle.initialize, (deployer, agentWallet))
                )
            )
        );

        // ── 3. SentimentFeed ─────────────────────────────────────────────────
        SentimentFeed feedImpl = new SentimentFeed();
        SentimentFeed feed = SentimentFeed(
            address(
                new ERC1967Proxy(
                    address(feedImpl),
                    abi.encodeCall(SentimentFeed.initialize, (deployer, agentWallet))
                )
            )
        );

        // ── 4. PredictionGame ────────────────────────────────────────────────
        PredictionGame gameImpl = new PredictionGame();
        PredictionGame game = PredictionGame(
            address(
                new ERC1967Proxy(
                    address(gameImpl),
                    abi.encodeCall(
                        PredictionGame.initialize,
                        (deployer, address(feed), address(aecToken))
                    )
                )
            )
        );

        // ── 5. Grant MINTER_ROLE ─────────────────────────────────────────────
        // PredictionGame mints rewards on correct predictions.
        // The agent wallet may also mint tokens (e.g. oracle participation rewards).
        aecToken.grantRole(MINTER_ROLE, address(game));
        aecToken.grantRole(MINTER_ROLE, agentWallet);

        vm.stopBroadcast();

        // ── 7. Log deployed addresses ────────────────────────────────────────
        // Printed after stopBroadcast so they appear in the terminal summary.
        console.log("");
        console.log("=======================================================");
        console.log("             Aeco Deployment Complete                  ");
        console.log("=======================================================");
        console.log("");
        console.log("  Deployer:              ", deployer);
        console.log("  Agent wallet:          ", agentWallet);
        console.log("");
        console.log("  --- Proxy addresses ---");
        console.log("  AECToken:              ", address(aecToken));
        console.log("  HeartbeatOracle:       ", address(heartbeat));
        console.log("  SentimentFeed:         ", address(feed));
        console.log("  PredictionGame:        ", address(game));
        console.log("");
        console.log("  --- Implementation addresses ---");
        console.log("  AECToken impl:         ", address(aecImpl));
        console.log("  HeartbeatOracle impl:  ", address(heartbeatImpl));
        console.log("  SentimentFeed impl:    ", address(feedImpl));
        console.log("  PredictionGame impl:   ", address(gameImpl));
        console.log("");
        console.log("=======================================================");
    }
}
