// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title SentimentFeed
 * @notice Core oracle contract for the Aeco AI sentiment platform. Stores AI-generated
 *         sentiment data for registered subjects (crypto assets, public figures, narratives,
 *         or premium tracked entities) posted by an autonomous agent wallet.
 * @dev UUPS upgradeable; fully independent from AECToken and HeartbeatOracle.
 *      Each subject carries a bounded history of up to MAX_HISTORY records. The oldest
 *      entry is evicted when the cap is reached.
 */
contract SentimentFeed is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Role granted to the autonomous AI agent that posts sentiment data.
    bytes32 public constant AGENT_ROLE   = keccak256("AGENT_ROLE");

    /// @notice Role granted to the owner who may authorise contract upgrades.
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Describes a tracked entity that the AI agent produces sentiment for.
     * @param id       Auto-assigned identifier (1-indexed, matches the mapping key).
     * @param name     Human-readable label for the subject (e.g. "Bitcoin", "Vitalik Buterin").
     * @param category Classification: 1 = crypto asset, 2 = person, 3 = narrative, 4 = premium.
     * @param isActive Whether the subject currently accepts new sentiment posts.
     */
    struct Subject {
        uint256 id;
        string  name;
        uint8   category;
        bool    isActive;
    }

    /**
     * @notice A single AI-generated sentiment snapshot for one subject.
     * @param subjectId     ID of the subject this record belongs to.
     * @param score         Composite sentiment score in the range [0, 100].
     * @param signal        Directional signal: 0 = neutral, 1 = bullish, 2 = bearish.
     * @param confidence    Agent's self-reported confidence in this reading, [0, 100].
     * @param summary       Free-form narrative explanation produced by the AI model.
     * @param sourceType    Describes the data source (e.g. "twitter", "news", "on-chain").
     * @param timestamp     Block timestamp at which this record was posted.
     * @param deltaFromLast Change in score relative to the immediately preceding record.
     *                      Positive = improvement, negative = deterioration.
     * @param agentVersion  Semantic version string of the AI agent that produced this record.
     * @param socialScore   Raw Grok social sentiment score (0–100). Mirrors `score` for
     *                      Grok-only subjects; separated here so hybrid subjects expose
     *                      both components independently.
     * @param nansenFlow    Net smart-money flow in USD over the oracle cycle window,
     *                      computed as smartTraderFlow + topPnlFlow + 0.5 × whaleFlow
     *                      from Nansen's flow-intelligence endpoint. Positive = net
     *                      accumulation by skilled wallets. Zero for display-only subjects.
     * @param divergenceFlag True when Grok social signal and Nansen flow direction disagree.
     *                      Always false for display-only (Grok-only) subjects.
     */
    struct SentimentRecord {
        uint256 subjectId;
        uint8   score;
        uint8   signal;
        uint8   confidence;
        string  summary;
        string  sourceType;
        uint256 timestamp;
        int8    deltaFromLast;
        string  agentVersion;
        /// @notice Raw Grok social sentiment score (0–100). Mirrors `score` for
        ///         Grok-only subjects; separated here so hybrid subjects expose
        ///         both components independently.
        uint8   socialScore;
        /// @notice Net smart-money flow in USD over the oracle cycle window,
        ///         computed as smartTraderFlow + topPnlFlow + 0.5 × whaleFlow
        ///         from Nansen's flow-intelligence endpoint. Positive = net
        ///         accumulation by skilled wallets. Zero for display-only subjects.
        int256  nansenFlow;
        /// @notice True when Grok social signal and Nansen flow direction disagree.
        ///         e.g. social bullish (signal=1) but nansenFlow < 0, or vice versa.
        ///         Always false for display-only (Grok-only) subjects.
        bool    divergenceFlag;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Maximum number of historical records retained per subject.
    uint256 public constant MAX_HISTORY = 50;

    /// @notice Semantic version of this implementation contract.
    string public constant CONTRACT_VERSION = "2.3.0";

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Registry of all subjects keyed by their auto-assigned ID.
    mapping(uint256 => Subject) public subjects;

    /// @notice Total number of subjects ever registered (used to derive next ID).
    uint256 public subjectCount;

    /// @notice Most recent sentiment record per subject ID.
    mapping(uint256 => SentimentRecord) public latestRecord;

    /// @notice Bounded sentiment history per subject ID.
    mapping(uint256 => SentimentRecord[]) public recordHistory;

    /// @notice Cumulative count of every sentiment post ever made across all subjects.
    uint256 public totalPostCount;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a new subject is registered.
     * @param subjectId Auto-assigned ID of the new subject.
     * @param name      Human-readable label of the subject.
     * @param category  Classification code (1–4).
     */
    event SubjectAdded(uint256 indexed subjectId, string name, uint8 category);

    /**
     * @notice Emitted when a subject's active status is changed.
     * @param subjectId ID of the subject whose status changed.
     * @param isActive  New active state.
     */
    event SubjectToggled(uint256 indexed subjectId, bool isActive);

    /**
     * @notice Emitted each time a sentiment record is posted for a subject.
     * @param subjectId     ID of the subject.
     * @param score         Composite sentiment score [0, 100].
     * @param signal        Directional signal (0 = neutral, 1 = bullish, 2 = bearish).
     * @param confidence    Agent confidence [0, 100].
     * @param deltaFromLast Score delta versus the previous record.
     * @param timestamp     Block timestamp of the post.
     */
    event SentimentPosted(
        uint256 indexed subjectId,
        uint8   score,
        uint8   signal,
        uint8   confidence,
        int8    deltaFromLast,
        uint256 indexed timestamp
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
     *      `postSentiment`.
     * @param admin Account that manages subjects and authorises upgrades.
     * @param agent Autonomous AI agent wallet that posts sentiment data.
     */
    function initialize(address admin, address agent) external initializer {
        __AccessControl_init();
        

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE,      admin);
        _grantRole(AGENT_ROLE,         agent);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin — subject management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Registers a new subject that the AI agent can post sentiment for.
     * @dev Only callable by DEFAULT_ADMIN_ROLE. Subject IDs start at 1 and increment
     *      monotonically. Newly added subjects are active by default.
     * @param name     Human-readable label (e.g. "Ethereum", "Michael Saylor").
     * @param category Classification: 1 = crypto asset, 2 = person, 3 = narrative, 4 = premium.
     */
    function addSubject(string calldata name, uint8 category)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(bytes(name).length > 0,   "SentimentFeed: empty name");
        require(category >= 1 && category <= 4, "SentimentFeed: invalid category");

        subjectCount += 1;
        uint256 id = subjectCount;

        subjects[id] = Subject({
            id:       id,
            name:     name,
            category: category,
            isActive: true
        });

        emit SubjectAdded(id, name, category);
    }

    /**
     * @notice Activates or deactivates a subject.
     * @dev Only callable by DEFAULT_ADMIN_ROLE. Deactivated subjects reject new
     *      sentiment posts. The subject's historical data is preserved.
     * @param subjectId ID of the subject to toggle.
     * @param isActive  Desired active state.
     */
    function toggleSubject(uint256 subjectId, bool isActive)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(subjects[subjectId].id != 0, "SentimentFeed: subject does not exist");

        subjects[subjectId].isActive = isActive;

        emit SubjectToggled(subjectId, isActive);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Agent — sentiment posting
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Posts a new AI-generated sentiment record for a subject.
     * @dev Only callable by AGENT_ROLE. The subject must exist and be active.
     *      `score` and `confidence` are validated to lie within [0, 100].
     *      The record is stored as `latestRecord[subjectId]`, appended to
     *      `recordHistory[subjectId]`, and the oldest entry is evicted if the
     *      history exceeds MAX_HISTORY. `totalPostCount` is always incremented.
     * @param subjectId     ID of the subject being scored.
     * @param score         Composite sentiment score in [0, 100].
     * @param signal        Directional signal: 0 = neutral, 1 = bullish, 2 = bearish.
     * @param confidence    Agent confidence in this reading, [0, 100].
     * @param summary       Free-form AI-generated narrative explanation.
     * @param sourceType    Data source descriptor (e.g. "twitter", "news").
     * @param deltaFromLast  Score delta relative to the previous record for this subject.
     * @param agentVersion   Semantic version of the agent that produced this record.
     * @param socialScore    Raw Grok social score (0–100); mirrors `score` for Grok-only subjects.
     * @param nansenFlow     Signed USD net smart-money flow (0 for display-only subjects).
     * @param divergenceFlag True when social and Nansen flow signals disagree.
     */
    function postSentiment(
        uint256         subjectId,
        uint8           score,
        uint8           signal,
        uint8           confidence,
        string calldata summary,
        string calldata sourceType,
        int8            deltaFromLast,
        string calldata agentVersion,
        uint8           socialScore,
        int256          nansenFlow,
        bool            divergenceFlag
    )
        external
        onlyRole(AGENT_ROLE)
    {
        require(subjects[subjectId].id != 0,    "SentimentFeed: subject does not exist");
        require(subjects[subjectId].isActive,    "SentimentFeed: subject is not active");
        require(score      <= 100,               "SentimentFeed: score out of range");
        require(confidence <= 100,               "SentimentFeed: confidence out of range");
        require(signal     <= 2,                 "SentimentFeed: invalid signal");

        SentimentRecord memory record = SentimentRecord({
            subjectId:     subjectId,
            score:         score,
            signal:        signal,
            confidence:    confidence,
            summary:       summary,
            sourceType:    sourceType,
            timestamp:     block.timestamp,
            deltaFromLast: deltaFromLast,
            agentVersion:  agentVersion,
            socialScore:   socialScore,
            nansenFlow:    nansenFlow,
            divergenceFlag: divergenceFlag
        });

        latestRecord[subjectId] = record;

        recordHistory[subjectId].push(record);

        if (recordHistory[subjectId].length > MAX_HISTORY) {
            _shiftHistory(subjectId);
        }

        totalPostCount += 1;

        emit SentimentPosted(subjectId, score, signal, confidence, deltaFromLast, block.timestamp);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the most recent sentiment record for a subject.
     * @dev Returns a zeroed struct if no record has been posted yet.
     * @param subjectId ID of the subject to query.
     * @return The latest SentimentRecord for that subject.
     */
    function getLatest(uint256 subjectId) public view returns (SentimentRecord memory) {
        return latestRecord[subjectId];
    }

    /**
     * @notice Returns the last `count` sentiment records for a subject in chronological order.
     * @dev If `count` exceeds the number of stored records, all stored records are returned.
     *      Returns an empty array if no records exist or `count` is zero.
     * @param subjectId ID of the subject to query.
     * @param count     Maximum number of recent records to retrieve.
     * @return records  Array of up to `count` SentimentRecord entries, oldest first.
     */
    function getHistory(uint256 subjectId, uint256 count)
        public
        view
        returns (SentimentRecord[] memory records)
    {
        uint256 total = recordHistory[subjectId].length;
        if (total == 0 || count == 0) {
            return new SentimentRecord[](0);
        }

        uint256 size = count < total ? count : total;
        records = new SentimentRecord[](size);

        uint256 start = total - size;
        for (uint256 i = 0; i < size; i++) {
            records[i] = recordHistory[subjectId][start + i];
        }
    }

    /**
     * @notice Returns the Subject struct for a given ID.
     * @dev Reverts if the subject does not exist.
     * @param subjectId ID of the subject to look up.
     * @return The Subject registered under that ID.
     */
    function getSubject(uint256 subjectId) public view returns (Subject memory) {
        require(subjects[subjectId].id != 0, "SentimentFeed: subject does not exist");
        return subjects[subjectId];
    }

    /**
     * @notice Returns every registered subject in insertion order.
     * @dev Iterates from ID 1 to `subjectCount`. Returns an empty array if no subjects
     *      have been added yet. O(n) on total subject count.
     * @return all Array of all Subject structs.
     */
    function getAllSubjects() public view returns (Subject[] memory all) {
        all = new Subject[](subjectCount);
        for (uint256 i = 1; i <= subjectCount; i++) {
            all[i - 1] = subjects[i];
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Removes the element at index 0 of `recordHistory[subjectId]` by shifting
     *      every subsequent element one position left, then popping the tail.
     *      O(MAX_HISTORY) worst case — acceptable given the 50-record cap.
     * @param subjectId Subject whose history array needs trimming.
     */
    function _shiftHistory(uint256 subjectId) internal {
        SentimentRecord[] storage history = recordHistory[subjectId];
        uint256 len = history.length;
        for (uint256 i = 0; i < len - 1; i++) {
            history[i] = history[i + 1];
        }
        history.pop();
    }

    /**
     * @notice Clears the recordHistory array for a subject.
     * @dev Called once after a UUPS upgrade that changes the SentimentRecord
     *      struct layout, to remove old-format encoded records that would cause
     *      storage decoding errors when _shiftHistory copies them.
     *      Only callable by DEFAULT_ADMIN_ROLE.
     * @param subjectId Subject whose history to clear.
     */
    function clearHistory(uint256 subjectId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        // Use assembly to directly zero the array length slot in storage,
        // bypassing the element-by-element iteration that `delete` performs.
        // This avoids the storage decoding panic caused by V1-encoded records
        // that are incompatible with the V2 SentimentRecord struct layout.
        assembly {
            // Compute the storage slot of recordHistory[subjectId].
            // recordHistory is a mapping(uint256 => SentimentRecord[]).
            // The slot of recordHistory itself is its declared position in storage.
            // For a mapping, keccak256(abi.encode(key, slot)) gives the value slot.
            // For a dynamic array, that value slot holds the length.
            mstore(0x00, subjectId)
            mstore(0x20, recordHistory.slot)
            let arraySlot := keccak256(0x00, 0x40)
            sstore(arraySlot, 0)  // zero the length — array is now empty
        }
    }

    /**
     * @notice Clears the latestRecord mapping entry for a subject.
     * @dev Called alongside clearHistory after a UUPS upgrade that changes
     *      the SentimentRecord struct layout. The latestRecord mapping holds
     *      old V1-encoded records that cause storage decoding panics when
     *      postSentiment reads them to compute deltaFromLast.
     *      Only callable by DEFAULT_ADMIN_ROLE.
     * @param subjectId Subject whose latestRecord to clear.
     */
    function clearLatest(uint256 subjectId)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        // Use assembly to directly zero storage slots without reading them.
        // The struct contains string fields that may be corrupted (V1 encoding
        // incompatible with V2 layout). A Solidity `delete` would read the struct
        // first to free dynamic data — triggering a storage panic on corrupt data.
        // Instead we zero the struct's base slot range directly.
        //
        // SentimentRecord has 12 fields. Strings occupy 1 slot each (length/inline).
        // Long strings (>31 bytes) also have data at keccak256(slot) — we zero those too.
        // Struct base slot: keccak256(abi.encode(subjectId, latestRecord.slot))

        bytes32 baseSlot;
        assembly {
            mstore(0x00, subjectId)
            mstore(0x20, latestRecord.slot)
            baseSlot := keccak256(0x00, 0x40)
        }

        // Zero all 12 struct field slots (0 through 11)
        for (uint256 i = 0; i < 12; i++) {
            bytes32 slot = bytes32(uint256(baseSlot) + i);
            assembly { sstore(slot, 0) }
            // Also zero the long-string data slot for this position
            // (harmless if it was a short string or non-string field)
            assembly {
                mstore(0x00, slot)
                sstore(keccak256(0x00, 0x20), 0)
            }
        }
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
