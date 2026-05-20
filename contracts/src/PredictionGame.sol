// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Minimal interfaces — avoids importing full contract artifacts and keeps
// the dependency surface explicit.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @dev Subset of SentimentFeed required by PredictionGame.
 */
interface ISentimentFeed {
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
    }

    function getLatest(uint256 subjectId) external view returns (SentimentRecord memory);
}

/**
 * @dev Subset of AECToken required by PredictionGame.
 */
interface IAECToken {
    function mint(address to, uint256 amount, string calldata reason) external;
}

/**
 * @title PredictionGame
 * @notice Lets any user stake their reputation by predicting whether a subject's
 *         sentiment score will be higher or lower after 24 hours. Correct predictions
 *         earn AEC token rewards; a winning streak of {STREAK_BONUS_THRESHOLD} or more
 *         doubles the payout. No user funds are ever transferred or held.
 * @dev Reads resolved scores from SentimentFeed and mints rewards via AECToken.
 *      PredictionGame must hold MINTER_ROLE on AECToken to issue rewards.
 *      UUPS upgradeable; fully independent from HeartbeatOracle.
 */
contract PredictionGame is Initializable, AccessControlUpgradeable, UUPSUpgradeable {
    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Role granted to the owner who may authorise contract upgrades.
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Types
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice A single user prediction on a subject's sentiment direction.
     * @param user                 Address that submitted this prediction.
     * @param subjectId            ID of the SentimentFeed subject being predicted on.
     * @param predictedDirection   1 = score will be higher, 2 = score will be lower.
     * @param madeAtScore          Sentiment score at the moment the prediction was made.
     * @param madeAtTimestamp      Block timestamp when the prediction was submitted.
     * @param resolveAfterTimestamp Earliest timestamp at which the prediction can be resolved.
     * @param resolved             True once `resolvePrediction` has been called for this ID.
     * @param correct              True if the prediction matched the observed direction.
     */
    struct Prediction {
        address user;
        uint256 subjectId;
        uint8   predictedDirection;
        uint8   madeAtScore;
        uint256 madeAtTimestamp;
        uint256 resolveAfterTimestamp;
        bool    resolved;
        bool    correct;
    }

    /**
     * @notice Cumulative performance statistics for a single user.
     * @param totalPredictions   Number of predictions the user has ever resolved.
     * @param correctPredictions Number of those that were correct.
     * @param currentStreak      Consecutive correct predictions without an incorrect one.
     * @param bestStreak         Highest `currentStreak` the user has ever reached.
     */
    struct UserStats {
        uint256 totalPredictions;
        uint256 correctPredictions;
        uint256 currentStreak;
        uint256 bestStreak;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Time that must elapse between making and resolving a prediction.
    uint256 public constant RESOLUTION_WINDOW = 24 hours;

    /// @notice Base AEC reward for a correct prediction (10 AEC, 18 decimals).
    uint256 public constant BASE_REWARD = 10 * 10 ** 18;

    /// @notice Consecutive correct predictions required to qualify for the streak bonus.
    uint256 public constant STREAK_BONUS_THRESHOLD = 5;

    /// @notice Multiplier applied to BASE_REWARD when the streak bonus is active.
    uint256 public constant STREAK_BONUS_MULTIPLIER = 2;

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Address of the deployed SentimentFeed contract.
    address public sentimentFeed;

    /// @notice Address of the deployed AECToken contract.
    address public aecToken;

    /// @notice All predictions keyed by their auto-assigned ID (1-indexed).
    mapping(uint256 => Prediction) public predictions;

    /// @notice Total number of predictions ever submitted.
    uint256 public predictionCount;

    /// @notice Ordered list of prediction IDs submitted by each user.
    mapping(address => uint256[]) public userPredictions;

    /// @notice Performance statistics per user address.
    mapping(address => UserStats) public userStats;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a user submits a new prediction.
     * @param predictionId          Unique ID assigned to this prediction.
     * @param user                  Address that made the prediction.
     * @param subjectId             SentimentFeed subject being predicted on.
     * @param predictedDirection    1 = higher, 2 = lower.
     * @param madeAtScore           Sentiment score at submission time.
     * @param resolveAfterTimestamp Earliest time the prediction can be resolved.
     */
    event PredictionMade(
        uint256 indexed predictionId,
        address indexed user,
        uint256 indexed subjectId,
        uint8   predictedDirection,
        uint8   madeAtScore,
        uint256 resolveAfterTimestamp
    );

    /**
     * @notice Emitted when a prediction is resolved.
     * @param predictionId  ID of the resolved prediction.
     * @param user          Address whose prediction was resolved.
     * @param correct       Whether the prediction was correct.
     * @param reward        AEC tokens minted as reward (0 if incorrect).
     * @param currentStreak User's winning streak after this resolution.
     */
    event PredictionResolved(
        uint256 indexed predictionId,
        address indexed user,
        bool    correct,
        uint256 reward,
        uint256 currentStreak
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
     * @notice Initializes the proxy with role assignments and contract references.
     * @dev Called once via the proxy immediately after deployment.
     *      `admin` receives DEFAULT_ADMIN_ROLE and UPGRADER_ROLE.
     *      The deployer must separately grant this contract MINTER_ROLE on AECToken
     *      so that `resolvePrediction` can issue rewards.
     * @param admin                Owner account that manages roles and upgrades.
     * @param sentimentFeedAddress Address of the deployed SentimentFeed proxy.
     * @param aecTokenAddress      Address of the deployed AECToken proxy.
     */
    function initialize(
        address admin,
        address sentimentFeedAddress,
        address aecTokenAddress
    )
        external
        initializer
    {
        require(sentimentFeedAddress != address(0), "PredictionGame: zero sentimentFeed");
        require(aecTokenAddress      != address(0), "PredictionGame: zero aecToken");

        __AccessControl_init();
        

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE,      admin);

        sentimentFeed = sentimentFeedAddress;
        aecToken      = aecTokenAddress;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core game functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Submits a prediction on whether a subject's sentiment score will be
     *         higher or lower after RESOLUTION_WINDOW seconds.
     * @dev Reads the subject's current score from SentimentFeed.getLatest(). Reverts
     *      if no sentiment record exists yet (timestamp == 0). Anyone may call this;
     *      no role is required.
     * @param subjectId  ID of the SentimentFeed subject to predict on.
     * @param direction  1 = score will be higher after 24 h, 2 = score will be lower.
     */
    function makePrediction(uint256 subjectId, uint8 direction) external {
        require(direction == 1 || direction == 2, "PredictionGame: invalid direction");

        ISentimentFeed.SentimentRecord memory latest =
            ISentimentFeed(sentimentFeed).getLatest(subjectId);

        require(latest.timestamp != 0, "PredictionGame: no sentiment data for subject");

        predictionCount += 1;
        uint256 id = predictionCount;

        uint256 resolveAfter = block.timestamp + RESOLUTION_WINDOW;

        predictions[id] = Prediction({
            user:                  msg.sender,
            subjectId:             subjectId,
            predictedDirection:    direction,
            madeAtScore:           latest.score,
            madeAtTimestamp:       block.timestamp,
            resolveAfterTimestamp: resolveAfter,
            resolved:              false,
            correct:               false
        });

        userPredictions[msg.sender].push(id);

        emit PredictionMade(id, msg.sender, subjectId, direction, latest.score, resolveAfter);
    }

    /**
     * @notice Resolves a prediction once RESOLUTION_WINDOW has elapsed.
     * @dev Callable by anyone — permissionless resolution removes the need for a
     *      keeper and lets the user resolve their own prediction. Reads the current
     *      score from SentimentFeed and compares it to the score at submission:
     *      - direction 1 (higher): correct if currentScore > madeAtScore.
     *      - direction 2 (lower):  correct if currentScore < madeAtScore.
     *      A tie (equal scores) is treated as incorrect for both directions.
     *      On a correct resolution the user earns BASE_REWARD AEC, doubled when their
     *      `currentStreak` is >= STREAK_BONUS_THRESHOLD. An incorrect resolution resets
     *      the streak to zero.
     * @param predictionId ID of the prediction to resolve.
     */
    function resolvePrediction(uint256 predictionId) external {
        Prediction storage pred = predictions[predictionId];

        require(pred.madeAtTimestamp != 0,          "PredictionGame: prediction does not exist");
        require(!pred.resolved,                      "PredictionGame: already resolved");
        require(
            block.timestamp >= pred.resolveAfterTimestamp,
            "PredictionGame: resolution window not elapsed"
        );

        ISentimentFeed.SentimentRecord memory latest =
            ISentimentFeed(sentimentFeed).getLatest(pred.subjectId);

        require(latest.timestamp != 0, "PredictionGame: no current sentiment data");

        // Determine correctness; ties are incorrect.
        bool correct;
        if (pred.predictedDirection == 1) {
            correct = latest.score > pred.madeAtScore;
        } else {
            correct = latest.score < pred.madeAtScore;
        }

        pred.resolved = true;
        pred.correct  = correct;

        // Update stats and compute reward.
        UserStats storage stats = userStats[pred.user];
        stats.totalPredictions += 1;

        uint256 reward = 0;

        if (correct) {
            stats.correctPredictions += 1;
            stats.currentStreak      += 1;

            if (stats.currentStreak > stats.bestStreak) {
                stats.bestStreak = stats.currentStreak;
            }

            reward = stats.currentStreak >= STREAK_BONUS_THRESHOLD
                ? BASE_REWARD * STREAK_BONUS_MULTIPLIER
                : BASE_REWARD;

            IAECToken(aecToken).mint(
                pred.user,
                reward,
                string(abi.encodePacked(
                    "prediction reward #",
                    _toString(predictionId)
                ))
            );
        } else {
            stats.currentStreak = 0;
        }

        emit PredictionResolved(predictionId, pred.user, correct, reward, stats.currentStreak);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the performance statistics for a given user.
     * @param user Address to look up.
     * @return The UserStats struct for that address.
     */
    function getUserStats(address user) public view returns (UserStats memory) {
        return userStats[user];
    }

    /**
     * @notice Returns the last `count` prediction IDs for a user, most-recent-last.
     * @dev If `count` exceeds the user's total predictions, all IDs are returned.
     *      Returns an empty array when the user has no predictions or `count` is zero.
     * @param user  Address to query.
     * @param count Maximum number of recent prediction IDs to return.
     * @return ids  Array of prediction IDs in chronological order (oldest first).
     */
    function getUserPredictions(address user, uint256 count)
        public
        view
        returns (uint256[] memory ids)
    {
        uint256[] storage all = userPredictions[user];
        uint256 total = all.length;

        if (total == 0 || count == 0) {
            return new uint256[](0);
        }

        uint256 size = count < total ? count : total;
        ids = new uint256[](size);

        uint256 start = total - size;
        for (uint256 i = 0; i < size; i++) {
            ids[i] = all[start + i];
        }
    }

    /**
     * @notice Returns the full Prediction struct for a given ID.
     * @dev Reverts if the prediction does not exist.
     * @param predictionId ID of the prediction to look up.
     * @return The Prediction struct stored under that ID.
     */
    function getPrediction(uint256 predictionId) public view returns (Prediction memory) {
        require(
            predictions[predictionId].madeAtTimestamp != 0,
            "PredictionGame: prediction does not exist"
        );
        return predictions[predictionId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Converts a uint256 to its decimal string representation.
     *      Used to build the human-readable mint reason without external libraries.
     */
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";

        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }

        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(buffer);
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
