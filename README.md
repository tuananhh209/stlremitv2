# STLRemit - Stellar Remittance MVP

A decentralized remittance platform built on the Stellar blockchain that enables secure, fast, and low-cost money transfers through a trusted agent network.

## 1. Project Overview

**STLRemit** is a dApp that facilitates international remittances using the Stellar blockchain. The system enables:
- **Senders** to initiate remittance transactions in VND
- **Agents** to lock/unlock USDC collateral and facilitate cross-currency conversions
- **Receivers** to confirm and claim their payments in local currency (PHP)

The platform leverages smart contracts on Stellar for automated lock/unlock mechanisms and maintains real-time transaction tracking with a 5-minute timeout protection.

## 2. Live Demo

**Live Deployment:** https://stlremit.up.railway.app/

## 3. Demo Video

Full flow walkthrough available in:
https://drive.google.com/drive/folders/13KKKffw5nwtmjkUu3zdF6ckE-H3KX1eG?usp=sharing

Videos demonstrate:
- Wallet connection
- Lock mechanism
- Agent processing
- Unlock & confirmation

## 4. Architecture

### System Components:
```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Next.js 16)                     │
│  - Wallet Integration (Stellar Freighter/XBull)             │
│  - Transaction UI & Status Tracking                          │
│  - User Onboarding & Settings                               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  Backend API (Next.js Routes)                │
│  - Transaction Management                                    │
│  - Agent Balance & Operations                               │
│  - Proof Upload & Verification                              │
│  - Cron Jobs & Health Monitoring                            │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
┌───────────────────┐              ┌────────────────────────┐
│  Stellar Network  │              │  PostgreSQL Database   │
│  - Smart Contracts│              │  (Neon HTTP Queries)   │
│  - Token Transfers│              │  - Remittance Records  │
│  - On-chain State │              │  - User Profiles       │
└───────────────────┘              └────────────────────────┘
```

### Key Features:
- **Smart Contracts**: Soroban contracts for escrow & collateral management
- **State Machine**: 7-state transaction lifecycle management
- **Real-time Sync**: Cron jobs for timeout handling & contract state verification

## 5. Features

- **Send Remittance**: Initialize remittance with VND amount & receiver details
- **Agent Claim**: Lock USDC collateral & accept remittance
- **Wallet Connect**: Support for Stellar wallets (Freighter, XBull)
- **Payment Proof Upload**: VND & PHP proof image upload via QR scanning
- **Transaction Tracking**: Real-time status with 5-minute timeout protection
- **Automatic Unlock**: Smart contract-based USDC release on confirmation
- **Exchange Rate Integration**: Real-time VND/USD/PHP conversion rates
- **Agent Dashboard**: Balance, reserved USDC, & transaction history

## 6. User Onboarding

**User Data Export:** [Excel Sheet with responses](https://docs.google.com/spreadsheets/d/1C4nx9vrrxJrWqZYkJXC9dMDBzJulSW2AuJ-5wOiwir8/edit?resourcekey=&gid=1457921225#gid=1457921225)

## 7. User Validation

Validated testnet wallet addresses (tested & active):

```
GAEU3CLX3AZNNHB6ICCNMUN5VDMVRKJBP4CPQQGLRAXWKAFVBXAGLX32
GAVRZLSQR7CEHJCFSN6ENPFRFY3VVICZV2KZWXCIDNFXSE5BUIOLBFCB
GBXANKIZ2P4JMKOY5LXSDNFX2VK5I2VKYFJWUNAPQA4JFO3V4PFZBCZT
GDQAK5F3RXAHGNUZZGODDTUL4D2OFBQG26LOZF36URKXGDIQQEVBBA4L
GDLYHOUXV2IGDWK4P7C56JSPMOYU7ZZVQIK3HVQS5WLITWQIXVXHWOJC
GCZ2IR57HR7JSKNA5ILVGBWJSUFUHPJHW35RXDQ7HTDBZ2QHURULFP63
GBQ77KPTMSXCSM4CSWMRBXXORT2NL2ZEPEYGGP2YQQYZNL4GRGYUDVW3
GCW74EQE6JLW446BLSOFWHAUDTZFBTZLLLBAA7JTRSXLBBWGXR4V4YD5
GB752OFJ254RLVYQQ5EYTQIA7MFECZCR4X7RQCET4PLJODBXLOU7FRNH
```

## 8. User Feedback

**Feedback Collection:** [Google Sheets - User Feedback](https://docs.google.com/spreadsheets/d/1C4nx9vrrxJrWqZYkJXC9dMDBzJulSW2AuJ-5wOiwir8/edit?resourcekey=&gid=1457921225#gid=1457921225)

### Common Feedback:
- UX improvements on transaction status display
- Request for mobile optimization
- Agent unlock timing clarity

## 9. Improvements & Recent Fixes

### Recent Changes from User Feedback:

**1. Improvement by kait110204@gmail.com**
- **Issue**: Email-related functionality
- **Fix**: [Commit b374944795b50fa6db9e93118ee1f257b6e09947](https://github.com/tuananhh209/STLRemit/commit/b374944795b50fa6db9e93118ee1f257b6e09947)

**2. Improvement by wisoka1423@gmail.com**
- **Issue**: UX/Performance optimization
- **Fix**: [Commit 4d2e2928a5f6e4bfa4d9c4affaf4230ae682031b](https://github.com/tuananhh209/STLRemit/commit/4d2e2928a5f6e4bfa4d9c4affaf4230ae682031b)

### Planned Improvements:
- Mobile wallet optimization
- Enhanced agent profile verification
- Multi-currency support expansion
- Real-time transaction notifications

## 10. Installation & Running Locally

### Prerequisites:
- Node.js 18+ 
- npm or yarn
- PostgreSQL (or Neon account for HTTP queries)
- Stellar testnet funded account

### Setup:

```bash
git clone <repository-url>
# Clone repository
git clone https://github.com/tuananhh209/STLRemit.git
cd stlremit

# Install dependencies
npm install

# Environment variables
cp .env.example .env.local
# Fill in:
# - NEXT_PUBLIC_STELLAR_NETWORK=testnet
# - DATABASE_URL=<your-neon-url>
# - STELLAR_CONTRACT_ADDRESS=<your-contract-id>

# Run development server
npm run dev

# Open browser
open http://localhost:3000
```

### Build for Production:
```bash
npm run build
npm run start
```

### Run Tests:
```bash
npm run test        # Unit tests
npm run test:integration  # Integration tests
npm run test:smoke  # Smoke tests
```

## 11. Tech Stack

### Frontend:
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Stellar Wallet Kit** - Wallet integration
- **Framer Motion** - Animations

### Backend:
- **Next.js API Routes** - Serverless backend
- **Neon PostgreSQL** - Database with HTTP queries
- **Drizzle ORM** - Type-safe database queries

### Blockchain:
- **Stellar Network** (Testnet)
- **Soroban** - Smart contracts (Rust/WASM)
- **Stellar SDK** - Blockchain interactions
- **Horizon RPC** - Network communication

### Testing:
- **Jest** - Unit testing
- **Testcontainers** - Integration testing
- **Playwright** - E2E testing

### DevOps:
- **Docker** - Containerization
- **Railway** - Cloud deployment
- **Drizzle Kit** - Database migrations

## Project Structure

```
stlremit/
├── app/                      # Next.js app directory
│   ├── api/                 # API routes
│   ├── agent/              # Agent dashboard
│   ├── send/               # Send remittance flow
│   ├── receiver/           # Receiver confirmation
│   └── settings/           # User settings
├── components/             # Reusable React components
├── contracts/              # Soroban smart contracts (Rust)
├── lib/                    # Utilities & services
│   ├── stellar.ts         # Stellar service
│   ├── db.ts              # Database service
│   ├── schema.ts          # Drizzle schema
│   └── types.ts           # TypeScript types
├── public/                # Static assets
├── tests/                 # Test suites
│   ├── integration/       # Integration tests
│   ├── smoke/             # Smoke tests
│   └── unit/              # Unit tests
├── drizzle/               # Database migrations
└── package.json           # Dependencies & scripts
```

## Contributing

1. Create a feature branch from `main`
2. Make changes following code style
3. Write/update tests
4. Ensure build passes: `npm run build`
5. Submit pull request

## Support

- For issues or questions:
- Check the [GitHub Issues](https://github.com/tuananhh209/STLRemit/issues)
- Review [Feedback Sheet](https://docs.google.com/spreadsheets/d/1C4nx9vrrxJrWqZYkJXC9dMDBzJulSW2AuJ-5wOiwir8/edit)
- Contact: [Email Support]

## License

This project is open source and available under the MIT License.
