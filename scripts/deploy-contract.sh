#!/bin/bash
# Deploy Soroban Escrow Contract to Stellar Testnet
# Usage: ./scripts/deploy-contract.sh <source-key-name> <agent-public-key>
#
# Example:
#   ./scripts/deploy-contract.sh alice GCCSYOOWH3QQAGTMOF4OP72EKHPMJLP6I7O7MGW5LEDYAOP52DQNYY47

set -e

SOURCE=${1:-alice}
AGENT_ADDRESS=${2:-$(stellar keys address alice)}
WASM_PATH="contracts/escrow/target/wasm32-unknown-unknown/release/escrow.wasm"

echo "Building contract..."
cd contracts/escrow
cargo build --target wasm32-unknown-unknown --release
cd ../..

echo "Deploying contract to testnet..."
CONTRACT_ID=$(stellar contract deploy \
  --wasm "$WASM_PATH" \
  --source "$SOURCE" \
  --network testnet 2>&1 | grep -E '^C[A-Z0-9]{55}$' | tail -1)

echo "Contract deployed: $CONTRACT_ID"

echo "Initializing contract with agent: $AGENT_ADDRESS"
stellar contract invoke \
  --id "$CONTRACT_ID" \
  --source "$SOURCE" \
  --network testnet \
  -- initialize \
  --agent "$AGENT_ADDRESS"

echo ""
echo "✅ Done! Add to .env.local:"
echo "ESCROW_CONTRACT_ID=$CONTRACT_ID"
echo "AGENT_PUBLIC_KEY=$AGENT_ADDRESS"
