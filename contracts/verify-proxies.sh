#!/bin/bash
set -e

# Load env
source ../.env

# ── Addresses ────────────────────────────────────────────────────────────────
DEPLOYER=0x7191EAe87142DF900DBB2Cfec7b2674Bad109C4d
AGENT=0x327D93521F470fAcA96b852d004c39DA33A45b45

AECTOKEN_PROXY=0x4EbACf161bae6e52Ff52F12ab217c175f1D856D4
HEARTBEAT_PROXY=0x2199C72E411ed90fB10772259E3194791406EAd9
SENTIMENT_PROXY=0x0684191E2e8Ac149F0073875242af19eC08D0724
PREDICTION_PROXY=0xD72AFE68Bfb0651A9AE6d641aBD66400a168EdeC

AECTOKEN_IMPL=0xf18F0526030b9B4C8a0c7D9aC450F78569C5368d
HEARTBEAT_IMPL=0xceaCAacDb84B585ac8b658051f4F13aF881B58d1
SENTIMENT_IMPL=0xb82Fb0Fe1CAa3bc609017ecAb2fEe85162f3d394
PREDICTION_IMPL=0x622DaCfc9e6F6984575371C7660764AcD5Ed8122

# ── Also need these for PredictionGame init ──────────────────────────────────
SENTIMENTFEED_PROXY=0x0684191E2e8Ac149F0073875242af19eC08D0724
AECTOKEN_PROXY_ADDR=0x4EbACf161bae6e52Ff52F12ab217c175f1D856D4

PROXY_CONTRACT="../node_modules/@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol:ERC1967Proxy"

echo "============================================"
echo " Verifying Aeco proxy contracts on Celo"
echo "============================================"

# ── AECToken proxy ────────────────────────────────────────────────────────────
echo ""
echo "1/4 AECToken proxy ($AECTOKEN_PROXY)..."
INIT=$(cast calldata "initialize(address,address,address)" $DEPLOYER $DEPLOYER $DEPLOYER)
forge verify-contract \
  $AECTOKEN_PROXY \
  $PROXY_CONTRACT \
  --constructor-args $(cast abi-encode "constructor(address,bytes)" $AECTOKEN_IMPL $INIT) \
  --chain-id 42220 \
  --etherscan-api-key $CELOSCAN_API_KEY \
  --rpc-url $RPC_URL \
  --compiler-version 0.8.33+commit.64118f21 \
  --retries 5 --delay 3

# ── HeartbeatOracle proxy ─────────────────────────────────────────────────────
echo ""
echo "2/4 HeartbeatOracle proxy ($HEARTBEAT_PROXY)..."
INIT=$(cast calldata "initialize(address,address)" $DEPLOYER $AGENT)
forge verify-contract \
  $HEARTBEAT_PROXY \
  $PROXY_CONTRACT \
  --constructor-args $(cast abi-encode "constructor(address,bytes)" $HEARTBEAT_IMPL $INIT) \
  --chain-id 42220 \
  --etherscan-api-key $CELOSCAN_API_KEY \
  --rpc-url $RPC_URL \
  --compiler-version 0.8.33+commit.64118f21 \
  --retries 5 --delay 3

# ── SentimentFeed proxy ───────────────────────────────────────────────────────
echo ""
echo "3/4 SentimentFeed proxy ($SENTIMENT_PROXY)..."
INIT=$(cast calldata "initialize(address,address)" $DEPLOYER $AGENT)
forge verify-contract \
  $SENTIMENT_PROXY \
  $PROXY_CONTRACT \
  --constructor-args $(cast abi-encode "constructor(address,bytes)" $SENTIMENT_IMPL $INIT) \
  --chain-id 42220 \
  --etherscan-api-key $CELOSCAN_API_KEY \
  --rpc-url $RPC_URL \
  --compiler-version 0.8.33+commit.64118f21 \
  --retries 5 --delay 3

# ── PredictionGame proxy ──────────────────────────────────────────────────────
echo ""
echo "4/4 PredictionGame proxy ($PREDICTION_PROXY)..."
INIT=$(cast calldata "initialize(address,address,address)" $DEPLOYER $SENTIMENTFEED_PROXY $AECTOKEN_PROXY_ADDR)
forge verify-contract \
  $PREDICTION_PROXY \
  $PROXY_CONTRACT \
  --constructor-args $(cast abi-encode "constructor(address,bytes)" $PREDICTION_IMPL $INIT) \
  --chain-id 42220 \
  --etherscan-api-key $CELOSCAN_API_KEY \
  --rpc-url $RPC_URL \
  --compiler-version 0.8.33+commit.64118f21 \
  --retries 5 --delay 3

echo ""
echo "============================================"
echo " Done. Check https://celoscan.io to confirm"
echo "============================================"
