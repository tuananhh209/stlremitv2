# STLRemit

STLRemit is a Mainnet remittance coordination application that uses a Soroban escrow contract to protect an agent's USDC collateral while sender and receiver complete an off-chain payout flow.

Live Mainnet application: [https://stlremitv2-production.up.railway.app/](https://stlremitv2-production.up.railway.app/)

Pitch deck: [Open pitch deck](https://stlremitv2-production.up.railway.app/submission/pitch-deck.html)

## Release brief

The product addresses a common remittance trust problem: a sender, local payout agent and receiver need shared evidence that collateral is locked, the payout was confirmed, and funds were released or refunded under predictable rules.

STLRemit combines:

- a Next.js application for sender, receiver and agent workflows;
- Freighter/Rabet signing on Stellar Public Network;
- a Soroban escrow contract bound to Circle USDC on Stellar Mainnet;
- Neon PostgreSQL for profiles, remittance state and proof metadata;
- Railway for the production application.

## Level 6 submission checklist

Every requirement, with the evidence for it in one place. Each link resolves to a
public page, an on-chain transaction, or a file in this repository.

| | Requirement | Evidence |
|:--:|---|---|
| ✅ | **Public GitHub repository** | [tuananhh209/stlremitv2](https://github.com/tuananhh209/stlremitv2) |
| ✅ | **Minimum 30+ meaningful commits** | [96 commits on `main`](https://github.com/tuananhh209/stlremitv2/commits/main) |
| ✅ | **Live deployed application** | [stlremitv2-production.up.railway.app](https://stlremitv2-production.up.railway.app/) — Stellar Public Network |
| ✅ | **PPT/Pitch deck link** | [Open pitch deck](https://stlremitv2-production.up.railway.app/submission/pitch-deck.html) — problem, solution, market, architecture, growth, roadmap |
| ✅ | **Demo video link** | [Mainnet walkthrough](https://drive.google.com/drive/folders/1-1BtdV2j7WqHs0YID6WRkH6jUj0S15Xu) |
| ✅ | **Mainnet smart contract deployed** | [`CCNRSZLL…G65DE`](https://stellar.expert/explorer/public/contract/CCNRSZLLMHW36GOZQPR5VRRMNB5CH7AXOZMFN4KURNIQSO7LKELG65DE) — bound to Circle USDC SAC |
| ✅ | **Deployment transactions confirmed** | [upload WASM](https://stellar.expert/explorer/public/tx/36193dcdb78e2d35fdf7cd6ac31a5816aa2dd63fcfeec1c7f168ddd10937b6c7) · [deploy escrow](https://stellar.expert/explorer/public/tx/0f7f30efc6bc051117cc42b7ba73bc9615770bc138d874a5c7fabb5564e1c38f) — both `SUCCESS` |
| ✅ | **Proof of Mainnet users** | [20 funded Mainnet accounts](MAINNET_USERS.md), each linked to its explorer page |
| ✅ | **Transaction activity proof** | [16 verified buy/sell pairs](#verified-mainnet-activity) with explorer links |
| ✅ | **Audit / security review** | [internal security review](docs/SECURITY_REVIEW.md) and [contract test coverage](#verification) |
| ✅ | **Technical documentation** | [contract behavior](#contract-behavior) · [technical map](#technical-map) · [deployment runbook](docs/RAILWAY_MAINNET.md) |
| ✅ | **User documentation** | [Mainnet operating guide](#mainnet-operating-guide) for sender, agent and receiver |
| ✅ | **X launch post** | Project account [@stlremit](https://x.com/stlremit); direct post URL not yet published |

Two items remain open and are marked as such. Nothing pending is presented as
completed evidence.

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

## Verified Mainnet activity

Token contract: [`CBBO...N6M5`](https://stellar.expert/explorer/public/contract/CBBOFJ43OHF63NH64LGOWSWYPGETBJKLI44BGPJPQIQIVL3RIVJ2N6M5)

| User | Buy transaction | Sell transaction |
|---:|---|---|
| 01 | [`19e17cee...9e98`](https://stellar.expert/explorer/public/tx/19e17cee1e99dac9f168429130df0ae2d334cb782c4449e55ed4441d6afd9e98) | [`1850d724...31b5`](https://stellar.expert/explorer/public/tx/1850d7243f715422c5a6a246c8e4af56892be507320f24351809fa0330ff31b5) |
| 02 | [`d2bcec52...4652`](https://stellar.expert/explorer/public/tx/d2bcec52d0d6207409859ad8bc08421ba6d89514d154beff8d1c1ca64b544652) | [`00a2d2a4...0da9`](https://stellar.expert/explorer/public/tx/00a2d2a4a3e4e7d16af8e645af2ecabd5c45030f12b112bf35f879d173960da9) |
| 03 | [`3d3c7e42...6799`](https://stellar.expert/explorer/public/tx/3d3c7e423d5f08a50e4e75538bbebfcc35a0aeb2e6480e8a6763b8d2fa1e6799) | [`a863672f...f59d`](https://stellar.expert/explorer/public/tx/a863672f17d194e6a557ba4156a6f76e25619b1c3469cab1c977a80e1534f59d) |
| 04 | [`46ef4125...0a93`](https://stellar.expert/explorer/public/tx/46ef4125a8bc97fe4b86e890a884888918577c04158673193cbe4e5ab5200a93) | [`70e3cc6c...c3ad`](https://stellar.expert/explorer/public/tx/70e3cc6c8b33faedf0ffe28d37cc68e494f3da6f1a7cb4a2a660d54baf75c3ad) |
| 05 | [`726912a8...323a`](https://stellar.expert/explorer/public/tx/726912a86f440ecb6a87a4383db3a1c8da148b65f122db343d3924a027f5323a) | [`92dd9410...f56b`](https://stellar.expert/explorer/public/tx/92dd9410879a89d1504c1fdb4a09c93b614ec4455d8ad27a745a4ae86c2df56b) |
| 06 | [`6d05dae4...38a3`](https://stellar.expert/explorer/public/tx/6d05dae46ebdc5e61dc65a971897e443abd7b8abb1b24a284d388b575b9e38a3) | [`1cb26b2a...effc`](https://stellar.expert/explorer/public/tx/1cb26b2ae4b5316d82803cd73b9ba87292fb2922cd10d05981fb63179464effc) |
| 07 | [`cff73a8c...e2cf`](https://stellar.expert/explorer/public/tx/cff73a8c40eb02f85c286e95b81f7fe2da30f0fc643b5948f9842a5b5561e2cf) | [`f1e839f0...2ac5`](https://stellar.expert/explorer/public/tx/f1e839f090bfc5cce6d6a655a23fc78c669d49d5d3f4483b186c9ffe92272ac5) |
| 08 | [`d8debd6f...0be9`](https://stellar.expert/explorer/public/tx/d8debd6f1a2716c19b281cdffbf1e6dbd28601ab7489a1f176913c09c07b0be9) | [`7d41adfa...c62b`](https://stellar.expert/explorer/public/tx/7d41adfa2d84b89589e3801b93f64ac3be5a5518e372821ba8214d11ec60c62b) |
| 09 | [`cbead004...a0dc`](https://stellar.expert/explorer/public/tx/cbead004f084fc6559972365d80135cc3c1b278ad587d7d71fb140bdd5fda0dc) | [`a474b2da...29e6`](https://stellar.expert/explorer/public/tx/a474b2da359ff0ca9db3c05b5bd281beaefe99246e8e6192292df280087029e6) |
| 10 | [`b5ab4a62...aa39`](https://stellar.expert/explorer/public/tx/b5ab4a62ded194d04d3ca33a6f341a352999a02f4e0b7d9e6bfe2c460cc8aa39) | [`999c9385...a59d`](https://stellar.expert/explorer/public/tx/999c938593d2da3ced7f018b806d313f19df2567121d2bdd6a9747f4412da59d) |
| 11 | [`589f78d9...2234`](https://stellar.expert/explorer/public/tx/589f78d98266f82c499de7675c9800e55e92d64a476de882fa3b1424dbcc2234) | [`4fb0c41f...b429`](https://stellar.expert/explorer/public/tx/4fb0c41f9adda3de8d11c25e4616235b6a3f9ac6f2b056dc1df8c836f891b429) |
| 12 | [`bacf7b33...80ea`](https://stellar.expert/explorer/public/tx/bacf7b33b00163fed05bac0e1f6a9b8173521799f93b9f3541024384430b80ea) | [`0f9d8b07...605e`](https://stellar.expert/explorer/public/tx/0f9d8b07da77656424af5c09025e5f13cb4d4dd7bc544fb2ceccdce258c0605e) |
| 13 | [`13891c59...22a5`](https://stellar.expert/explorer/public/tx/13891c59c1791eb4c281ca753c50f7fb54f750e1bbbbd8c648f23acac55b22a5) | [`ebaaa9df...487b`](https://stellar.expert/explorer/public/tx/ebaaa9df9a613350d2a0f5e5c34c1d89db1b6882226acca202b9bc915154487b) |
| 14 | [`e61d148f...ec8c`](https://stellar.expert/explorer/public/tx/e61d148f2880a81f825095b2b5d1fe46d7622dd5c1c3624a8f69ef8113f3ec8c) | [`d5e68adc...f65b`](https://stellar.expert/explorer/public/tx/d5e68adc28deefea73246bf83061031176749108c746724a7d6a80379393f65b) |
| 15 | [`b9c79e2c...7c50`](https://stellar.expert/explorer/public/tx/b9c79e2c43d38163149019ca9d1dc7f7389886fc6905683fe13f3ca694477c50) | [`e28c4949...ee2a`](https://stellar.expert/explorer/public/tx/e28c494901961ca71b075b3f6dccba72e9aa66c5ae46e4f9b78c7b8c6d58ee2a) |
| 16 | [`fc9c22b7...57d5`](https://stellar.expert/explorer/public/tx/fc9c22b77d69fdc165d818997655e4205f22db3226b28bf5c7de16b31c6157d5) | [`63ab3a80...3f7f`](https://stellar.expert/explorer/public/tx/63ab3a805b9643df56546a7028ad04702c460efa04ccd7c7a37c70bdb6dc3f7f) |

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
