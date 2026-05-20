// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title HeartbeatOracle
 * @notice Records liveness signals from the Aeco autonomous AI agent. Each heartbeat
 *         captures metadata about a single agent run: how many subjects were scanned,
 *         whether a significant sentiment change was detected, and a human-readable
 *         status message.
 * @dev Completely independent from AECToken. Stores up to MAX_HISTORY records in a
 *      bounded circular-style history (oldest entry is dropped when the cap is hit).
 *      Upgradeable via UUPS; only UPGRADER_ROLE may authorise a new implementation.
 */
contract HeartbeatOracle is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Role granted to the autonomous AI agent wallet that writes heartbeats.
    bytes32 public constant AGENT_ROLE   = keccak256("AGENT_ROLE");

    /// @notice Role granted to the owner who may authorise contract upgrades.
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice A single snapshot of the AI agent's state at the time it ran.
     * @param timestamp         Block timestamp when the heartbeat was recorded.
     * @param subjectsScanned   Number of sentiment subjects the agent processed in this run.
     * @param significantChange Whether the agent detected a sentiment shift above its threshold.
     * @param statusMessage     Free-form human-readable summary produced by the agent.
     */
    struct HeartbeatRecord {
        uint256 timestamp;
        uint256 subjectsScanned;
        bool    significantChange;
        string  statusMessage;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Maximum number of heartbeat records retained in history.
    uint256 public constant MAX_HISTORY = 100;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice The most recently recorded heartbeat.
    HeartbeatRecord public lastHeartbeat;

    /// @notice Bounded history of heartbeats; oldest entry is evicted once MAX_HISTORY is reached.
    HeartbeatRecord[] public heartbeatHistory;

    /// @notice Cumulative count of all heartbeats ever recorded (never decremented).
    uint256 public totalHeartbeats;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted each time the AI agent successfully records a heartbeat.
     * @param timestamp         Block timestamp of the heartbeat.
     * @param subjectsScanned   Number of subjects processed during this agent run.
     * @param significantChange Whether a significant sentiment change was detected.
     * @param statusMessage     Agent-provided status summary.
     */
    event HeartbeatRecorded(
        uint256 indexed timestamp,
        uint256 subjectsScanned,
        bool    significantChange,
        string  statusMessage
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // Prevent the implementation contract from being initialized directly.
        _disableInitializers();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Initializer
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Initializes the proxy with access-control roles.
     * @dev Called once via the proxy immediately after deployment.
     *      `admin` receives DEFAULT_ADMIN_ROLE and UPGRADER_ROLE.
     *      `agent` receives AGENT_ROLE and is the only address permitted to call
     *      `recordHeartbeat`.
     * @param admin Account that can manage roles and authorise upgrades.
     * @param agent Autonomous AI agent wallet that writes heartbeat data.
     */
    function initialize(address admin, address agent) external initializer {
        __AccessControl_init();
        

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE,      admin);
        _grantRole(AGENT_ROLE,         agent);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Agent-facing write operations
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Records a new heartbeat from the autonomous AI agent.
     * @dev Only callable by an account holding AGENT_ROLE. Stores the record as
     *      `lastHeartbeat`, appends it to `heartbeatHistory`, and removes the oldest
     *      entry if the history length would exceed MAX_HISTORY. Increments
     *      `totalHeartbeats` unconditionally.
     * @param subjectsScanned   Number of sentiment subjects processed in this agent run.
     * @param significantChange True if the agent detected a sentiment shift above its threshold.
     * @param statusMessage     Human-readable summary of the agent run.
     */
    function recordHeartbeat(
        uint256        subjectsScanned,
        bool           significantChange,
        string calldata statusMessage
    )
        external
        onlyRole(AGENT_ROLE)
    {
        HeartbeatRecord memory record = HeartbeatRecord({
            timestamp:         block.timestamp,
            subjectsScanned:   subjectsScanned,
            significantChange: significantChange,
            statusMessage:     statusMessage
        });

        lastHeartbeat = record;
        heartbeatHistory.push(record);

        // Evict the oldest entry when the cap is exceeded.
        if (heartbeatHistory.length > MAX_HISTORY) {
            _shiftHistory();
        }

        totalHeartbeats += 1;

        emit HeartbeatRecorded(block.timestamp, subjectsScanned, significantChange, statusMessage);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the last `count` heartbeat records in chronological order.
     * @dev If `count` exceeds the number of stored records, all stored records are
     *      returned. Returns an empty array if no heartbeats have been recorded yet.
     * @param count Maximum number of recent records to retrieve.
     * @return records Array of up to `count` HeartbeatRecord entries, oldest first.
     */
    function getHistory(uint256 count) external view returns (HeartbeatRecord[] memory records) {
        uint256 total = heartbeatHistory.length;
        if (total == 0 || count == 0) {
            return new HeartbeatRecord[](0);
        }

        uint256 size = count < total ? count : total;
        records = new HeartbeatRecord[](size);

        uint256 start = total - size;
        for (uint256 i = 0; i < size; i++) {
            records[i] = heartbeatHistory[start + i];
        }
    }

    /**
     * @notice Checks whether the AI agent has posted a heartbeat within the given window.
     * @dev Returns false if no heartbeat has ever been recorded (timestamp == 0).
     * @param maxAgeSeconds Maximum acceptable age of the last heartbeat, in seconds.
     * @return True if `lastHeartbeat.timestamp >= block.timestamp - maxAgeSeconds`.
     */
    function isAgentAlive(uint256 maxAgeSeconds) external view returns (bool) {
        if (lastHeartbeat.timestamp == 0) {
            return false;
        }
        return block.timestamp - lastHeartbeat.timestamp <= maxAgeSeconds;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Removes the element at index 0 of `heartbeatHistory` by shifting every
     *      subsequent element one position left, then popping the now-duplicate tail.
     *      O(n) on history length; acceptable given MAX_HISTORY == 100.
     */
    function _shiftHistory() internal {
        uint256 len = heartbeatHistory.length;
        for (uint256 i = 0; i < len - 1; i++) {
            heartbeatHistory[i] = heartbeatHistory[i + 1];
        }
        heartbeatHistory.pop();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // UUPS upgrade authorisation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Guards upgrade execution to accounts holding UPGRADER_ROLE.
     * @dev Required override for UUPSUpgradeable. Called internally by `upgradeTo` /
     *      `upgradeToAndCall` before applying the new implementation.
     * @param newImplementation Address of the incoming implementation contract.
     */
    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyRole(UPGRADER_ROLE)
    {}

    // ─────────────────────────────────────────────────────────────────────────
    // Storage gap
    // ─────────────────────────────────────────────────────────────────────────

    // Reserve 50 slots for future state variables in upgraded implementations.
    uint256[50] private __gap;
}
