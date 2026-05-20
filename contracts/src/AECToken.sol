// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/**
 * @title AECToken
 * @notice UUPS upgradeable ERC20 token for the Aeco AI sentiment oracle on Celo.
 * @dev Minting and burning are permission-gated via AccessControl. Upgrades require UPGRADER_ROLE.
 */
contract AECToken is Initializable, ERC20Upgradeable, AccessControlUpgradeable, UUPSUpgradeable {
    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant MINTER_ROLE   = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE   = keccak256("BURNER_ROLE");
    bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Absolute cap on token supply: 100 million AEC (18 decimals).
    uint256 public constant MAX_SUPPLY = 100_000_000 * 10 ** 18;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when tokens are minted.
     * @param to     Recipient of the newly minted tokens.
     * @param amount Number of tokens minted (in wei).
     * @param reason Human-readable context describing why the mint occurred.
     */
    event TokensMinted(address indexed to, uint256 amount, string reason);

    /**
     * @notice Emitted when tokens are burned.
     * @param from   Account whose tokens were burned.
     * @param amount Number of tokens burned (in wei).
     * @param reason Human-readable context describing why the burn occurred.
     */
    event TokensBurned(address indexed from, uint256 amount, string reason);

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
     * @notice Initializes the proxy with roles and ERC20 metadata.
     * @dev Called once via the proxy immediately after deployment. Grants DEFAULT_ADMIN_ROLE,
     *      MINTER_ROLE, BURNER_ROLE, and UPGRADER_ROLE to the specified accounts.
     * @param admin  Account that receives DEFAULT_ADMIN_ROLE and UPGRADER_ROLE.
     * @param minter Account that receives MINTER_ROLE.
     * @param burner Account that receives BURNER_ROLE.
     */
    function initialize(address admin, address minter, address burner) external initializer {
        __ERC20_init("AIOracle", "AEC");
        __AccessControl_init();
        

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPGRADER_ROLE,      admin);
        _grantRole(MINTER_ROLE,        minter);
        _grantRole(BURNER_ROLE,        burner);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core token operations
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mints `amount` tokens to `to`.
     * @dev Reverts if the resulting total supply would exceed MAX_SUPPLY.
     *      Only accounts holding MINTER_ROLE may call this function.
     * @param to     Address that will receive the minted tokens.
     * @param amount Number of tokens to mint (in wei).
     * @param reason Human-readable rationale for this mint (e.g. "oracle reward epoch 42").
     */
    function mint(address to, uint256 amount, string calldata reason)
        external
        onlyRole(MINTER_ROLE)
    {
        require(totalSupply() + amount <= MAX_SUPPLY, "AECToken: max supply exceeded");
        _mint(to, amount);
        emit TokensMinted(to, amount, reason);
    }

    /**
     * @notice Burns `amount` tokens from `from`.
     * @dev Uses `_burn` directly; the caller must hold BURNER_ROLE. No allowance check is
     *      performed — the role itself is the authorisation mechanism.
     * @param from   Address whose tokens will be burned.
     * @param amount Number of tokens to burn (in wei).
     * @param reason Human-readable rationale for this burn (e.g. "penalty slash round 7").
     */
    function burn(address from, uint256 amount, string calldata reason)
        external
        onlyRole(BURNER_ROLE)
    {
        _burn(from, amount);
        emit TokensBurned(from, amount, reason);
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
