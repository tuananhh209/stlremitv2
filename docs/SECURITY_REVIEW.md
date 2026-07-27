# STLRemit internal security review

Review scope: Mainnet network selection, wallet signatures, USDC escrow trust boundaries and deployment configuration.

## Controls verified

- Freighter signing is locked to Stellar `PUBLIC`.
- The contract is permanently bound to the official Mainnet USDC SAC at construction.
- `accept` requires agent authorization and rejects zero or negative collateral.
- A remittance identifier cannot be accepted twice.
- Only the assigned receiver can confirm a funded remittance.
- Confirmation returns collateral to the agent that originally locked it.
- Anyone may trigger an expired refund, but funds can return only to the recorded agent.
- Processed records cannot be released or refunded twice.
- Database, wallet secret and Cloudinary credentials remain server-side.

## Test evidence

Six contract tests cover multiple agents, correct release, refund, receiver authorization, duplicate prevention and invalid collateral. The optimized deployed WASM hash is:

`5d13258c3b823f8265652e7ca48a063e7dab02c12f826b0f858b9a43460201d6`

Deployment and contract links are recorded in the project README.

## Residual risks

- The application coordinates off-chain fiat transfers; the contract cannot independently verify bank settlement.
- The agent server secret is a high-impact credential and should be rotated if exposed.
- Uploaded payment evidence may contain personal information and requires an explicit retention policy.
- This document is an internal review and is not a third-party smart-contract audit.

Start with low-value Mainnet transactions and retain transaction hashes, application logs and proof metadata for incident review.
