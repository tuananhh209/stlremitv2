# STLRemit

STLRemit is a Mainnet remittance coordination application that uses a Soroban escrow contract to protect an agent's USDC collateral while sender and receiver complete an off-chain payout flow.

Live Mainnet application: [https://stlremitv2-production.up.railway.app/](https://stlremitv2-production.up.railway.app/)

## Release brief

The product addresses a common remittance trust problem: a sender, local payout agent and receiver need shared evidence that collateral is locked, the payout was confirmed, and funds were released or refunded under predictable rules.

STLRemit combines:

- a Next.js application for sender, receiver and agent workflows;
- Freighter/Rabet signing on Stellar Public Network;
- a Soroban escrow contract bound to Circle USDC on Stellar Mainnet;
- Neon PostgreSQL for profiles, remittance state and proof metadata;
- Railway for the production application.

## Current Level 6 submission status

### Ready and verifiable

- [x] Public repository: [tuananhh209/stlremitv2](https://github.com/tuananhh209/stlremitv2)
- [x] More than 30 meaningful commits: [72+ commits](https://github.com/tuananhh209/stlremitv2/commits/main)
- [x] Mainnet escrow contract deployed
- [x] Mainnet deployment transactions confirmed
- [x] [20 funded Mainnet accounts documented](MAINNET_USERS.md)
- [x] Technical documentation
- [x] User documentation
- [x] Internal security review and contract test evidence

### Evidence still to collect

- [x] Live Mainnet application: [Railway production](https://stlremitv2-production.up.railway.app/)
- [ ] Project-specific Mainnet escrow activity from the documented cohort
- [ ] Direct X launch-post URL; project account: [@stlremit](https://x.com/stlremit)
- [ ] Mainnet walkthrough video
- [ ] Community contribution URL

No pending item is counted as completed submission evidence.

## On-chain record

The contract is deployed on Stellar Public Network with Circle USDC's official Stellar Asset Contract.

```text
Escrow contract
CCNRSZLLMHW36GOZQPR5VRRMNB5CH7AXOZMFN4KURNIQSO7LKELG65DE

USDC SAC
CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75

Optimized WASM hash
5d13258c3b823f8265652e7ca48a063e7dab02c12f826b0f858b9a43460201d6
```

Deployment evidence:

1. [Upload WASM transaction — `36193dcd...b6c7`](https://stellar.expert/explorer/public/tx/36193dcdb78e2d35fdf7cd6ac31a5816aa2dd63fcfeec1c7f168ddd10937b6c7)
2. [Deploy escrow transaction — `0f7f30ef...c38f`](https://stellar.expert/explorer/public/tx/0f7f30efc6bc051117cc42b7ba73bc9615770bc138d874a5c7fabb5564e1c38f)
3. [Inspect the contract on Stellar Expert](https://stellar.expert/explorer/public/contract/CCNRSZLLMHW36GOZQPR5VRRMNB5CH7AXOZMFN4KURNIQSO7LKELG65DE)

Both deployment transactions returned `SUCCESS`. Post-deployment read checks returned the expected USDC contract and an initial escrow balance of `0`.

## How a remittance moves

```text
Sender creates request
        │
        ▼
Agent reviews request ── accepts + locks USDC collateral
        │
        ▼
Sender completes local transfer and uploads proof
        │
        ▼
Receiver verifies payout and signs confirmation
        │
        ├── confirmed within 5 minutes ──► collateral released to agent
        │
        └── timeout ─────────────────────► collateral refundable to agent
```

The escrow contract never stores private banking credentials. On-chain state contains the remittance identifier, collateral amount, agent, receiver, timestamp and status.

## Mainnet operating guide

### Sender

1. Open the production application and connect Freighter on **PUBLIC** network.
2. Choose the destination, enter the remittance amount and receiver details.
3. Submit the request and retain its tracking identifier.
4. After an agent accepts, complete the instructed local transfer.
5. Upload payout evidence and monitor the status page.

### Agent

1. Connect the registered Mainnet agent wallet.
2. Ensure the wallet holds USDC and enough XLM for transaction fees.
3. Review an open request and select **Accept & Lock USDC**.
4. Verify the contract ID in Freighter before signing.
5. Complete the destination payout and attach the required proof.

### Receiver

1. Open the remittance tracking page.
2. Confirm that the destination funds were actually received.
3. Connect the assigned receiver wallet.
4. Sign the receiver-confirm transaction to release the agent's collateral.

> USDC and XLM on Mainnet have real value. Never approve a transaction whose contract ID, network or amount differs from the application summary.

## Contract behavior

| Contract function | Result |
|---|---|
| `accept` | Authenticates the agent, rejects non-positive collateral and locks USDC |
| `receiver_confirm` | Authenticates the assigned receiver and returns collateral to the correct agent |
| `refund` | Returns collateral after the timeout |
| `get_tx_record` | Returns the stored escrow record |
| `get_tx_status` | Returns `Funded`, `Completed` or `Expired` |
| `get_balance` | Returns the USDC currently held by the contract |
| `get_usdc_token` | Returns the configured Mainnet USDC SAC |

## Technical map

| Concern | Implementation |
|---|---|
| Web application | Next.js 16, React 19, TypeScript |
| Wallets | Freighter API and Rabet, locked to `PUBLIC` |
| Contract | Rust `no_std`, Soroban SDK 22 |
| Token | Circle USDC SAC on Stellar Mainnet |
| Database | Neon PostgreSQL with Drizzle ORM |
| Image evidence | Cloudinary |
| Hosting | Railway Docker deployment |
| CI | GitHub Actions production build |

## Production environment

The committed [`.env.example`](.env.example) contains Mainnet public values and placeholders only.

```env
DATABASE_URL=postgresql://...
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_RPC_URL=https://mainnet.sorobanrpc.com
ESCROW_CONTRACT_ID=CCNRSZLLMHW36GOZQPR5VRRMNB5CH7AXOZMFN4KURNIQSO7LKELG65DE
USDC_TOKEN_ID=CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75
AGENT_PUBLIC_KEY=G...
AGENT_SECRET_KEY=S...
NEXT_PUBLIC_APP_URL=https://YOUR-DOMAIN.up.railway.app
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
PORT=3000
```

Never commit the database URL, agent secret or Cloudinary credentials. Railway instructions are in [the Mainnet deployment runbook](docs/RAILWAY_MAINNET.md).

## Verification

```bash
npm ci
npm run lint
npm run build

cd contracts/escrow
cargo test
stellar contract build --optimize
```

Verified contract coverage includes:

- collateral locked by multiple agents;
- release to the correct agent;
- timeout refund;
- rejection of the wrong receiver;
- duplicate acceptance prevention;
- rejection of zero and negative collateral.

See [the internal security review](docs/SECURITY_REVIEW.md) for trust boundaries and residual risks.

## Mainnet onboarding evidence plan

The [20-account Mainnet cohort](MAINNET_USERS.md) is documented. Project-specific evidence will be populated only after those users sign STLRemit Mainnet transactions. Each activity record will include a public wallet address, role, successful transaction hash, timestamp and completed flow. Deployment transactions are not counted as user activity.

## Local development

```bash
git clone https://github.com/tuananhh209/stlremitv2.git
cd stlremitv2
npm ci
cp .env.example .env.local
npm run dev
```

## License

MIT © 2026 STLRemit
