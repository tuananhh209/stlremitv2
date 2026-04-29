# Design Document — Stellar Remittance MVP

## Overview

Stellar Remittance MVP là ứng dụng web full-stack cho phép chuyển tiền xuyên biên giới từ Việt Nam (VND) sang Philippines (PHP) thông qua một Agent trung gian duy nhất. Hệ thống kết hợp:

- **Next.js App Router** làm frontend và backend (API routes)
- **Soroban smart contract** trên Stellar testnet để quản lý collateral/escrow một cách trustless
- **PostgreSQL (Neon)** để lưu trữ trạng thái giao dịch off-chain
- **Stellar SDK** (`@stellar/stellar-sdk`) để tương tác với blockchain

Luồng fiat (VND/PHP) hoàn toàn off-chain và được mô phỏng. Blockchain đóng vai trò bảo đảm thanh khoản: Agent phải deposit USDC vào Escrow_Contract trước khi có thể nhận lệnh chuyển tiền. Mỗi giao dịch được định danh bằng `txId` gắn vào Stellar transaction dưới dạng memo.

### Tóm tắt luồng chính

```
Sender tạo lệnh → Backend reserve USDC on-chain → Sender mark-paid (upload proof)
→ Agent upload proof PHP → Agent confirm on-chain → USDC released về Agent
```

Nếu Sender không mark-paid trong 300 giây → hệ thống tự động gọi `refund` → USDC trả về pool.

---

## Architecture

### Tổng quan kiến trúc

```mermaid
graph TB
    subgraph "Frontend (Next.js App Router)"
        SF[Send Money Form<br/>/app/send]
        SP[Transaction Status Page<br/>/app/tx/[txId]]
        AD[Agent Dashboard<br/>/app/agent]
    end

    subgraph "Backend (Next.js API Routes)"
        AR[POST /api/remittance/create]
        AM[POST /api/remittance/[id]/mark-paid]
        AU[POST /api/remittance/[id]/agent-proof]
        AC[POST /api/remittance/[id]/confirm]
        AG[GET /api/remittance]
        AGI[GET /api/remittance/[id]]
        AF[POST /api/agent/fund]
        AH[GET /api/agent/balance]
        AT[POST /api/cron/check-timeouts]
    end

    subgraph "Stellar Testnet"
        SC[Soroban Escrow Contract<br/>Rust/WASM]
        SN[Stellar Network<br/>RPC: soroban-testnet.stellar.org]
    end

    subgraph "Database (Neon PostgreSQL)"
        DB[(remittance_requests<br/>agent_state)]
    end

    SF --> AR
    SP --> AGI
    SP --> AM
    AD --> AG
    AD --> AU
    AD --> AC
    AD --> AF
    AD --> AH

    AR --> SC
    AM --> DB
    AU --> DB
    AC --> SC
    AF --> SC
    AT --> SC

    AR --> DB
    AC --> DB
    AF --> DB
    AT --> DB

    SC --> SN
```

### Quyết định kiến trúc

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| ORM | Drizzle ORM | Type-safe, nhẹ, tương thích tốt với Neon serverless |
| Stellar interaction | `@stellar/stellar-sdk` + `Client` API | Official SDK, hỗ trợ Soroban contract invocation |
| Timeout handling | Cron API route + DB polling | Đơn giản, không cần message queue cho MVP |
| Real-time updates | Polling (setInterval 3s) | Đủ cho MVP, không cần WebSocket |
| File storage | Base64 in DB hoặc URL string | MVP: lưu reference string, không cần S3 |
| Exchange rate | Hardcoded config | MVP: không cần oracle |
| Authentication | Mock (hardcoded Agent address) | Theo yêu cầu: không có auth |

---

## Components and Interfaces

### 2.1 Frontend Components

#### SendMoneyForm (`/app/send/page.tsx`)
- Input: VND amount, Receiver name, Receiver account
- Real-time hiển thị USDC equivalent và PHP payout
- Submit → POST `/api/remittance/create` → redirect đến `/app/tx/[txId]`
- Hiển thị lỗi insufficient liquidity inline

#### TransactionStatusPage (`/app/tx/[txId]/page.tsx`)
- Hiển thị: status badge, VND amount, USDC equivalent, PHP payout, Receiver details
- Countdown timer (nếu status = `funded`)
- Upload proof image (nếu status = `funded`)
- Polling GET `/api/remittance/[id]` mỗi 3 giây

#### AgentDashboard (`/app/agent/page.tsx`)
- Bảng tất cả Remittance_Requests
- Hiển thị Collateral_Pool balance và available USDC
- Action buttons cho từng request (upload proof, confirm)
- Deposit form

### 2.2 API Routes

```typescript
// POST /api/remittance/create
interface CreateRemittanceRequest {
  vndAmount: number;
  receiverName: string;
  receiverAccount: string;
}
interface CreateRemittanceResponse {
  txId: string;
  usdcEquivalent: number;
  phpPayout: number;
  status: "funded";
  expiresAt: string; // ISO timestamp
  stellarTxHash: string;
}

// POST /api/remittance/[id]/mark-paid
interface MarkPaidRequest {
  proofImageBase64: string; // base64 encoded image
  proofImageMimeType: string;
}
interface MarkPaidResponse {
  txId: string;
  status: "processing";
}

// POST /api/remittance/[id]/agent-proof
interface AgentProofRequest {
  proofImageBase64: string;
  proofImageMimeType: string;
}
interface AgentProofResponse {
  txId: string;
  agentProofRef: string;
}

// POST /api/remittance/[id]/confirm
interface ConfirmResponse {
  txId: string;
  status: "completed";
  stellarTxHash: string;
  releasedUsdc: number;
}

// GET /api/remittance
interface RemittanceListResponse {
  remittances: RemittanceRecord[];
}

// GET /api/remittance/[id]
type RemittanceDetailResponse = RemittanceRecord;

// POST /api/agent/fund
interface AgentFundRequest {
  usdcAmount: number;
}
interface AgentFundResponse {
  newBalance: number;
  stellarTxHash: string;
}

// GET /api/agent/balance
interface AgentBalanceResponse {
  totalCollateral: number;
  reservedUsdc: number;
  availableUsdc: number;
}
```

### 2.3 Soroban Escrow Contract Interface

Contract được viết bằng Rust, compile sang WASM, deploy lên Stellar testnet.

```rust
// Các hàm public của Escrow Contract

// Khởi tạo contract với agent address
pub fn initialize(env: Env, agent: Address) -> Result<(), ContractError>

// Agent deposit USDC vào pool
pub fn fund(env: Env, agent: Address, amount: i128) -> Result<i128, ContractError>

// Reserve USDC cho một remittance request
pub fn reserve(env: Env, tx_id: String, amount: i128, agent: Address) -> Result<(), ContractError>

// Confirm payout - release USDC về agent
pub fn confirm(env: Env, tx_id: String, caller: Address) -> Result<i128, ContractError>

// Refund - trả USDC về pool khi timeout
pub fn refund(env: Env, tx_id: String) -> Result<i128, ContractError>

// Query balance
pub fn get_balance(env: Env) -> i128

// Query reserved amount cho một txId
pub fn get_reserved(env: Env, tx_id: String) -> i128

// Query trạng thái của một txId
pub fn get_tx_status(env: Env, tx_id: String) -> TxStatus
```

### 2.4 Stellar Service Layer (`/lib/stellar.ts`)

```typescript
interface StellarService {
  // Gọi contract fund function
  fundContract(usdcAmount: number): Promise<{ txHash: string; newBalance: number }>;
  
  // Gọi contract reserve function với txId làm memo
  reserveCollateral(txId: string, usdcAmount: number): Promise<{ txHash: string }>;
  
  // Gọi contract confirm function
  confirmPayout(txId: string): Promise<{ txHash: string; releasedUsdc: number }>;
  
  // Gọi contract refund function
  refundCollateral(txId: string): Promise<{ txHash: string; refundedUsdc: number }>;
  
  // Query balance từ contract
  getContractBalance(): Promise<{ total: number; reserved: number; available: number }>;
}
```

### 2.5 Database Service Layer (`/lib/db.ts`)

```typescript
interface DatabaseService {
  createRemittance(data: CreateRemittanceData): Promise<RemittanceRecord>;
  getRemittance(txId: string): Promise<RemittanceRecord | null>;
  listRemittances(): Promise<RemittanceRecord[]>;
  updateStatus(txId: string, status: RemittanceStatus): Promise<void>;
  updateSenderProof(txId: string, proofRef: string): Promise<void>;
  updateAgentProof(txId: string, proofRef: string): Promise<void>;
  updateStellarTxHash(txId: string, txHash: string): Promise<void>;
  getExpiredFundedRemittances(): Promise<RemittanceRecord[]>;
}
```

---

## Data Models

### 3.1 Database Schema (Drizzle ORM)

```typescript
// /lib/schema.ts
import { pgTable, text, numeric, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const remittanceStatusEnum = pgEnum("remittance_status", [
  "funded",
  "processing",
  "completed",
  "expired",
]);

export const remittanceRequests = pgTable("remittance_requests", {
  txId: text("tx_id").primaryKey(),
  vndAmount: numeric("vnd_amount", { precision: 20, scale: 2 }).notNull(),
  usdcEquivalent: numeric("usdc_equivalent", { precision: 20, scale: 7 }).notNull(),
  phpPayout: numeric("php_payout", { precision: 20, scale: 2 }).notNull(),
  receiverName: text("receiver_name").notNull(),
  receiverAccount: text("receiver_account").notNull(),
  status: remittanceStatusEnum("status").notNull().default("funded"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  senderProofRef: text("sender_proof_ref"),
  agentProofRef: text("agent_proof_ref"),
  stellarTxHash: text("stellar_tx_hash"),
});

export const agentState = pgTable("agent_state", {
  id: text("id").primaryKey().default("singleton"),
  totalCollateral: numeric("total_collateral", { precision: 20, scale: 7 }).notNull().default("0"),
  reservedUsdc: numeric("reserved_usdc", { precision: 20, scale: 7 }).notNull().default("0"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
```

### 3.2 TypeScript Types

```typescript
export type RemittanceStatus = "funded" | "processing" | "completed" | "expired";

export interface RemittanceRecord {
  txId: string;
  vndAmount: number;
  usdcEquivalent: number;
  phpPayout: number;
  receiverName: string;
  receiverAccount: string;
  status: RemittanceStatus;
  createdAt: string;
  expiresAt: string;
  senderProofRef: string | null;
  agentProofRef: string | null;
  stellarTxHash: string | null;
}

export interface AgentBalance {
  totalCollateral: number;
  reservedUsdc: number;
  availableUsdc: number; // = totalCollateral - reservedUsdc
}
```

### 3.3 Soroban Contract Data Structures (Rust)

```rust
use soroban_sdk::{contracttype, String};

#[contracttype]
#[derive(Clone, PartialEq)]
pub enum TxStatus {
    Funded,
    Completed,
    Expired,
}

#[contracttype]
#[derive(Clone)]
pub struct TxRecord {
    pub amount: i128,
    pub created_at: u64,  // Unix timestamp (ledger time)
    pub status: TxStatus,
}

#[contracttype]
pub enum DataKey {
    Agent,
    TotalCollateral,
    TxRecord(String),  // keyed by txId
}
```

### 3.4 Exchange Rate Configuration

```typescript
// /lib/config.ts
export const EXCHANGE_RATES = {
  VND_TO_USDC: 0.000040,   // 1 VND = 0.000040 USDC (25,000 VND = 1 USDC)
  USDC_TO_PHP: 58.0,        // 1 USDC = 58 PHP
  TIMEOUT_SECONDS: 300,     // 5 phút
} as const;

export function calculateAmounts(vndAmount: number) {
  const usdcEquivalent = vndAmount * EXCHANGE_RATES.VND_TO_USDC;
  const phpPayout = usdcEquivalent * EXCHANGE_RATES.USDC_TO_PHP;
  return { usdcEquivalent, phpPayout };
}
```

### 3.5 Stellar Network Configuration

```typescript
// /lib/stellar-config.ts
export const STELLAR_CONFIG = {
  RPC_URL: "https://soroban-testnet.stellar.org",
  NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  ESCROW_CONTRACT_ID: process.env.ESCROW_CONTRACT_ID!,
  AGENT_SECRET_KEY: process.env.AGENT_SECRET_KEY!,
  TIMEOUT_SECONDS: 300,
} as const;
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Thư viện PBT được sử dụng: **fast-check** (TypeScript/JavaScript). Mỗi property test chạy tối thiểu 100 iterations.

### Property 1: Exchange Rate Calculation Correctness

*For any* positive VND amount, the calculated USDC equivalent SHALL equal `vndAmount × VND_TO_USDC_RATE` and the PHP payout SHALL equal `usdcEquivalent × USDC_TO_PHP_RATE`, with no rounding errors beyond floating-point precision.

**Validates: Requirements 2.2, 10.2**

---

### Property 2: txId Uniqueness

*For any* collection of N successfully created Remittance_Requests (N ≥ 2), all txIds SHALL be distinct — no two requests share the same txId.

**Validates: Requirements 2.1, 11.4**

---

### Property 3: Remittance Data Persistence Completeness

*For any* successfully created Remittance_Request with valid inputs (VND amount, receiver name, receiver account), reading the record back from the DB SHALL return all required fields: txId, vndAmount, usdcEquivalent, phpPayout, receiverName, receiverAccount, status (`funded`), createdAt, expiresAt — with values matching the creation inputs.

**Validates: Requirements 2.4, 7.1, 11.1**

---

### Property 4: Insufficient Liquidity Rejection

*For any* remittance creation request where the required USDC equivalent exceeds the current available (unreserved) Collateral_Pool balance, the system SHALL reject the request and leave the DB and Collateral_Pool unchanged.

**Validates: Requirements 2.3**

---

### Property 5: State Transition funded → processing

*For any* Remittance_Request in `funded` status that has not yet expired, submitting a mark-paid request SHALL transition the status to `processing` in the DB.

**Validates: Requirements 3.1**

---

### Property 6: State Transition processing → completed with Balance Restoration

*For any* Remittance_Request in `processing` status, when the Agent confirms the payout, the status SHALL transition to `completed` and the previously Reserved_USDC SHALL be restored to the available Collateral_Pool balance.

**Validates: Requirements 5.2, 9.3**

---

### Property 7: State Transition funded → expired with Balance Restoration

*For any* Remittance_Request in `funded` status whose Countdown_Timer has expired, calling refund SHALL transition the status to `expired` and restore the Reserved_USDC to the available Collateral_Pool balance.

**Validates: Requirements 6.2, 9.4**

---

### Property 8: Invalid Mark-Paid Rejection

*For any* Remittance_Request whose status is NOT `funded`, OR whose Countdown_Timer has expired, a mark-paid request SHALL be rejected with an appropriate error and the status SHALL remain unchanged.

**Validates: Requirements 3.3, 3.4**

---

### Property 9: Proof Image Acceptance Without Content Validation

*For any* binary content submitted as a Proof_Image (regardless of file type, size within limits, or content), the system SHALL accept the upload without rejecting based on content validation.

**Validates: Requirements 3.2, 4.2**

---

### Property 10: Proof Image Reference Persistence

*For any* successfully uploaded Proof_Image (sender or agent), the stored reference in the DB SHALL be non-null and retrievable via GET `/api/remittance/[id]`.

**Validates: Requirements 3.5, 4.1**

---

### Property 11: Agent-Only Authorization for Confirm

*For any* confirm request submitted by a caller whose Stellar address does NOT match the hardcoded Agent address, the Escrow_Contract SHALL reject the call with an `UNAUTHORIZED` error and the Remittance_Request status SHALL remain unchanged.

**Validates: Requirements 5.4, 9.6**

---

### Property 12: Expired Confirm Rejection

*For any* Remittance_Request whose Countdown_Timer has expired, a confirm request SHALL be rejected with an `EXPIRED` error and the status SHALL remain unchanged.

**Validates: Requirements 5.3, 9.5**

---

### Property 13: Timeout Window Consistency

*For any* created Remittance_Request, the stored `expiresAt` timestamp SHALL equal `createdAt + 300 seconds`, consistently across all requests regardless of creation time.

**Validates: Requirements 6.4, 9.7**

---

### Property 14: Reserve Deducts Collateral Pool

*For any* successful `reserve(txId, amount)` call on the Escrow_Contract, the available Collateral_Pool balance SHALL decrease by exactly `amount` and the reserved amount for that txId SHALL equal `amount`.

**Validates: Requirements 9.2**

---

### Property 15: Non-processing Status Guard for Agent Upload

*For any* Remittance_Request whose status is NOT `processing`, an agent proof upload request SHALL be rejected with an appropriate error and the agentProofRef SHALL remain unchanged.

**Validates: Requirements 4.3**

---

### Property 16: Refund Guard for Non-funded Status

*For any* Remittance_Request whose status is `processing` or `completed`, the system SHALL NOT call `refund(txId)` even if the Countdown_Timer has reached zero.

**Validates: Requirements 6.3**

---

### Property 17: API List Completeness

*For any* set of N created Remittance_Requests, the GET `/api/remittance` endpoint SHALL return a list containing all N records with correct field values.

**Validates: Requirements 7.4**

---

## Error Handling

### 5.1 Stellar Transaction Errors

```typescript
// /lib/errors.ts
export class StellarTransactionError extends Error {
  constructor(
    public readonly stellarErrorCode: string,
    public readonly txHash?: string,
    message?: string
  ) {
    super(message ?? `Stellar transaction failed: ${stellarErrorCode}`);
  }
}

export class InsufficientLiquidityError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number
  ) {
    super(`Insufficient liquidity: required ${required} USDC, available ${available} USDC`);
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly txId: string,
    public readonly currentStatus: string,
    public readonly attemptedAction: string
  ) {
    super(`Cannot ${attemptedAction} for txId ${txId} in status ${currentStatus}`);
  }
}

export class TransactionExpiredError extends Error {
  constructor(public readonly txId: string) {
    super(`Transaction ${txId} has expired`);
  }
}

export class UnauthorizedError extends Error {
  constructor(message = "Unauthorized: only the Agent can perform this action") {
    super(message);
  }
}

export class DatabaseConnectionError extends Error {
  constructor(cause?: unknown) {
    super("Database connection failed");
    this.cause = cause;
  }
}
```

### 5.2 API Error Response Format

```typescript
interface ApiErrorResponse {
  error: string;
  code: "INSUFFICIENT_LIQUIDITY" | "INVALID_STATUS" | "EXPIRED" | 
        "UNAUTHORIZED" | "NOT_FOUND" | "STELLAR_ERROR" | "DB_ERROR";
  details?: Record<string, unknown>;
}
```

### 5.3 Error Handling Strategy

| Lỗi | HTTP Status | Hành động |
|---|---|---|
| Insufficient liquidity | 422 | Trả lỗi, không thay đổi DB |
| Invalid status transition | 409 | Trả lỗi, không thay đổi DB |
| Transaction expired | 410 | Trả lỗi, không thay đổi DB |
| Unauthorized | 403 | Trả lỗi |
| Not found | 404 | Trả lỗi |
| Stellar tx failed | 502 | Trả lỗi với Stellar error code, không thay đổi DB |
| DB connection failed | 503 | Log lỗi, trả 503 |
| Validation error | 400 | Trả lỗi với field details |

### 5.4 Timeout Handler

Cron job chạy mỗi 30 giây (hoặc trigger từ client polling):

```typescript
// /app/api/cron/check-timeouts/route.ts
// 1. Query DB: SELECT * FROM remittance_requests WHERE status = 'funded' AND expires_at < NOW()
// 2. Với mỗi expired record:
//    a. Gọi Escrow_Contract.refund(txId)
//    b. Nếu thành công: UPDATE status = 'expired'
//    c. Nếu lỗi: log và tiếp tục (idempotent)
```

---

## Testing Strategy

### 6.1 Tổng quan

Hệ thống sử dụng hai lớp kiểm thử bổ sung cho nhau:

- **Unit tests + Property-based tests**: Kiểm tra logic nghiệp vụ thuần túy (tính toán, state machine, validation)
- **Integration tests**: Kiểm tra tương tác với Stellar testnet và Neon DB

### 6.2 Property-Based Testing

Thư viện: **fast-check** (`npm install --save-dev fast-check`)

Cấu hình: Mỗi property test chạy tối thiểu **100 iterations**.

Tag format: `// Feature: stellar-remittance-mvp, Property {N}: {property_text}`

Các property test tập trung vào logic thuần túy (không gọi Stellar testnet thật):

```typescript
// Ví dụ: Property 1 - Exchange rate calculation
import fc from "fast-check";
import { calculateAmounts, EXCHANGE_RATES } from "@/lib/config";

// Feature: stellar-remittance-mvp, Property 1: Exchange rate calculation correctness
test("exchange rate calculation is correct for any positive VND amount", () => {
  fc.assert(
    fc.property(
      fc.float({ min: 1, max: 1_000_000_000, noNaN: true }),
      (vndAmount) => {
        const { usdcEquivalent, phpPayout } = calculateAmounts(vndAmount);
        const expectedUsdc = vndAmount * EXCHANGE_RATES.VND_TO_USDC;
        const expectedPhp = expectedUsdc * EXCHANGE_RATES.USDC_TO_PHP;
        expect(Math.abs(usdcEquivalent - expectedUsdc)).toBeLessThan(1e-9);
        expect(Math.abs(phpPayout - expectedPhp)).toBeLessThan(1e-6);
      }
    ),
    { numRuns: 100 }
  );
});
```

### 6.3 Unit Tests

Framework: **Jest** + **@testing-library/react** cho component tests.

Tập trung vào:
- `calculateAmounts()` với các giá trị biên
- State machine transitions (mock DB)
- Error handling paths
- API route handlers (mock Stellar service và DB)

### 6.4 Integration Tests

Chạy với Stellar testnet thật và Neon DB test instance:

- Deposit collateral → verify contract state
- Full remittance flow: create → mark-paid → agent-proof → confirm
- Timeout flow: create → wait expiry → verify refund
- Concurrent requests: verify no double-spending of collateral

### 6.5 Smoke Tests

- DB connectivity on startup
- Stellar RPC connectivity
- Contract deployment verification
- Environment variable validation

### 6.6 Test File Structure

```
/tests
  /unit
    exchange-rate.test.ts       # Property 1
    tx-id-uniqueness.test.ts    # Property 2
    data-persistence.test.ts    # Property 3
    liquidity-check.test.ts     # Property 4
    state-machine.test.ts       # Properties 5, 6, 7, 8, 15, 16
    proof-upload.test.ts        # Properties 9, 10
    authorization.test.ts       # Properties 11, 12
    timeout.test.ts             # Property 13
    collateral-math.test.ts     # Property 14
    api-list.test.ts            # Property 17
  /integration
    stellar-contract.test.ts
    full-flow.test.ts
    timeout-flow.test.ts
  /smoke
    db-connection.test.ts
    stellar-rpc.test.ts
```
