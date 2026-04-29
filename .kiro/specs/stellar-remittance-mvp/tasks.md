# Kế hoạch Implementation: Stellar Remittance MVP

## Tổng quan

Triển khai ứng dụng chuyển tiền xuyên biên giới VND → PHP sử dụng Next.js App Router, Soroban smart contract (Rust) trên Stellar testnet, PostgreSQL (Neon) với Drizzle ORM. Thứ tự implementation: project setup → smart contract → service layers → API routes → frontend UI → tests.

## Tasks

- [-] 1. Project Setup và Cấu hình
  - [ ] 1.1 Khởi tạo Next.js project với App Router và cài đặt dependencies
    - Tạo Next.js 14+ project với TypeScript và TailwindCSS
    - Cài đặt dependencies: `@stellar/stellar-sdk`, `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `pg`
    - Cài đặt dev dependencies: `jest`, `@testing-library/react`, `@testing-library/jest-dom`, `fast-check`, `ts-jest`
    - Tạo file `jest.config.ts` với cấu hình cho TypeScript và path aliases
    - Tạo file `.env.local` với các biến: `DATABASE_URL`, `ESCROW_CONTRACT_ID`, `AGENT_SECRET_KEY`
    - _Requirements: 11.2_

  - [ ] 1.2 Tạo cấu hình và types cốt lõi
    - Tạo `/lib/config.ts` với `EXCHANGE_RATES` (VND_TO_USDC=0.000040, USDC_TO_PHP=58.0, TIMEOUT_SECONDS=300) và hàm `calculateAmounts(vndAmount)`
    - Tạo `/lib/stellar-config.ts` với `STELLAR_CONFIG` (RPC_URL, NETWORK_PASSPHRASE, ESCROW_CONTRACT_ID, AGENT_SECRET_KEY)
    - Tạo `/lib/errors.ts` với các custom error classes: `StellarTransactionError`, `InsufficientLiquidityError`, `InvalidStatusTransitionError`, `TransactionExpiredError`, `UnauthorizedError`, `DatabaseConnectionError`
    - Tạo `/lib/types.ts` với `RemittanceStatus`, `RemittanceRecord`, `AgentBalance` và tất cả request/response interfaces
    - _Requirements: 2.2, 10.2_

  - [ ] 1.3 Thiết lập Drizzle ORM và Database Schema
    - Tạo `/lib/schema.ts` với `remittanceStatusEnum`, `remittanceRequests` table, `agentState` table theo đúng schema trong design
    - Tạo `drizzle.config.ts` trỏ đến Neon connection string
    - Tạo `/lib/db-client.ts` khởi tạo Drizzle client với `@neondatabase/serverless`
    - Chạy `drizzle-kit generate` để tạo migration files
    - Chạy `drizzle-kit migrate` để apply schema lên Neon DB
    - _Requirements: 11.1, 11.2, 11.4_

- [ ] 2. Soroban Escrow Smart Contract (Rust)
  - [ ] 2.1 Khởi tạo Soroban contract project
    - Tạo thư mục `/contracts/escrow/` với `Cargo.toml` cấu hình cho Soroban SDK
    - Tạo `/contracts/escrow/src/lib.rs` với struct `EscrowContract`, `TxStatus` enum, `TxRecord` struct, `DataKey` enum theo design
    - Định nghĩa `ContractError` enum với các variants: `AlreadyInitialized`, `NotInitialized`, `Unauthorized`, `InsufficientFunds`, `TxNotFound`, `TxAlreadyProcessed`, `Expired`
    - _Requirements: 9.1_

  - [ ] 2.2 Implement các hàm contract cốt lõi
    - Implement `initialize(env, agent)`: lưu agent address vào storage, khởi tạo TotalCollateral = 0
    - Implement `fund(env, agent, amount)`: xác thực agent address, cộng amount vào TotalCollateral, trả về balance mới
    - Implement `reserve(env, tx_id, amount, agent)`: kiểm tra available balance ≥ amount, tạo TxRecord với status Funded và created_at từ ledger timestamp, deduct từ available pool
    - Implement `confirm(env, tx_id, caller)`: xác thực caller = agent, kiểm tra timeout (ledger_time - created_at ≤ 300s), chuyển status → Completed, cộng amount về TotalCollateral
    - Implement `refund(env, tx_id)`: kiểm tra timeout đã hết (ledger_time - created_at > 300s), chuyển status → Expired, cộng amount về TotalCollateral
    - Implement `get_balance(env)`, `get_reserved(env, tx_id)`, `get_tx_status(env, tx_id)`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [ ] 2.3 Compile và deploy contract lên Stellar testnet
    - Chạy `cargo build --target wasm32-unknown-unknown --release` để compile contract
    - Tạo script `/scripts/deploy-contract.sh` dùng Stellar CLI để deploy WASM lên testnet
    - Gọi `initialize` với Agent address sau khi deploy
    - Lưu `ESCROW_CONTRACT_ID` vào `.env.local`
    - _Requirements: 9.1_

- [ ] 3. Stellar Service Layer
  - [ ] 3.1 Implement StellarService với contract invocation
    - Tạo `/lib/stellar.ts` với class `StellarService` implement interface từ design
    - Implement `fundContract(usdcAmount)`: build và submit Soroban transaction gọi `fund`, trả về `{ txHash, newBalance }`
    - Implement `reserveCollateral(txId, usdcAmount)`: build transaction với memo = txId, gọi `reserve`, trả về `{ txHash }`
    - Implement `confirmPayout(txId)`: gọi `confirm(txId)`, trả về `{ txHash, releasedUsdc }`
    - Implement `refundCollateral(txId)`: gọi `refund(txId)`, trả về `{ txHash, refundedUsdc }`
    - Implement `getContractBalance()`: gọi `get_balance` và tính available = total - reserved
    - Sử dụng `STELLAR_CONFIG` cho RPC URL, network passphrase, và agent keypair
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.5, 5.1, 5.2, 6.1, 6.2_

- [ ] 4. Database Service Layer
  - [ ] 4.1 Implement DatabaseService với Drizzle ORM
    - Tạo `/lib/db.ts` với object `databaseService` implement interface từ design
    - Implement `createRemittance(data)`: insert vào `remittance_requests`, tính `expiresAt = createdAt + 300s`, trả về `RemittanceRecord`
    - Implement `getRemittance(txId)`: SELECT by primary key, trả về `RemittanceRecord | null`
    - Implement `listRemittances()`: SELECT tất cả records, order by `createdAt DESC`
    - Implement `updateStatus(txId, status)`: UPDATE status field
    - Implement `updateSenderProof(txId, proofRef)`: UPDATE `senderProofRef`
    - Implement `updateAgentProof(txId, proofRef)`: UPDATE `agentProofRef`
    - Implement `updateStellarTxHash(txId, txHash)`: UPDATE `stellarTxHash`
    - Implement `getExpiredFundedRemittances()`: SELECT WHERE status='funded' AND expires_at < NOW()
    - _Requirements: 2.4, 3.5, 4.1, 7.4, 11.1, 11.4_

- [ ] 5. Checkpoint — Kiểm tra service layers
  - Đảm bảo tất cả tests pass, hỏi user nếu có vấn đề với Stellar testnet connectivity hoặc DB connection.

- [ ] 6. API Routes
  - [ ] 6.1 Implement POST /api/remittance/create
    - Tạo `/app/api/remittance/create/route.ts`
    - Validate request body: `vndAmount` (positive number), `receiverName` (non-empty string), `receiverAccount` (non-empty string)
    - Gọi `getContractBalance()` để kiểm tra available USDC ≥ usdcEquivalent; nếu không đủ trả 422 với code `INSUFFICIENT_LIQUIDITY`
    - Generate unique `txId` (UUID v4 hoặc nanoid)
    - Gọi `reserveCollateral(txId, usdcEquivalent)` để lock USDC on-chain
    - Gọi `createRemittance(data)` để persist vào DB với `stellarTxHash` từ bước trên
    - Trả về `CreateRemittanceResponse` với status 201
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ] 6.2 Implement POST /api/remittance/[id]/mark-paid
    - Tạo `/app/api/remittance/[id]/mark-paid/route.ts`
    - Validate `proofImageBase64` và `proofImageMimeType` trong request body
    - Gọi `getRemittance(txId)` để lấy record; trả 404 nếu không tìm thấy
    - Kiểm tra status = `funded`; nếu không trả 409 với code `INVALID_STATUS`
    - Kiểm tra `expiresAt > now()`; nếu đã hết hạn trả 410 với code `EXPIRED`
    - Gọi `updateSenderProof(txId, proofRef)` và `updateStatus(txId, 'processing')`
    - Trả về `MarkPaidResponse`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ] 6.3 Implement POST /api/remittance/[id]/agent-proof
    - Tạo `/app/api/remittance/[id]/agent-proof/route.ts`
    - Validate request body
    - Gọi `getRemittance(txId)`; trả 404 nếu không tìm thấy
    - Kiểm tra status = `processing`; nếu không trả 409 với code `INVALID_STATUS`
    - Gọi `updateAgentProof(txId, proofRef)`
    - Trả về `AgentProofResponse`
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 6.4 Implement POST /api/remittance/[id]/confirm
    - Tạo `/app/api/remittance/[id]/confirm/route.ts`
    - Gọi `getRemittance(txId)`; trả 404 nếu không tìm thấy
    - Kiểm tra status = `processing`; nếu không trả 409
    - Gọi `confirmPayout(txId)` trên Stellar; xử lý `EXPIRED` error → 410, `UNAUTHORIZED` error → 403
    - Gọi `updateStatus(txId, 'completed')` và `updateStellarTxHash(txId, txHash)`
    - Trả về `ConfirmResponse` với `releasedUsdc`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [ ] 6.5 Implement GET /api/remittance và GET /api/remittance/[id]
    - Tạo `/app/api/remittance/route.ts` cho list endpoint: gọi `listRemittances()`, trả về `RemittanceListResponse`
    - Tạo `/app/api/remittance/[id]/route.ts` cho detail endpoint: gọi `getRemittance(txId)`, trả 404 nếu null
    - _Requirements: 7.4_

  - [ ] 6.6 Implement POST /api/agent/fund và GET /api/agent/balance
    - Tạo `/app/api/agent/fund/route.ts`: validate `usdcAmount`, gọi `fundContract(usdcAmount)`, cập nhật `agentState` trong DB, trả về `AgentFundResponse`
    - Tạo `/app/api/agent/balance/route.ts`: gọi `getContractBalance()`, trả về `AgentBalanceResponse`
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [ ] 6.7 Implement POST /api/cron/check-timeouts
    - Tạo `/app/api/cron/check-timeouts/route.ts`
    - Gọi `getExpiredFundedRemittances()` để lấy danh sách records với status='funded' và expires_at < NOW()
    - Với mỗi record: gọi `refundCollateral(txId)`, nếu thành công gọi `updateStatus(txId, 'expired')`
    - Xử lý lỗi idempotent: nếu contract trả lỗi (đã refund rồi), log và tiếp tục
    - Trả về số lượng records đã xử lý
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [ ] 7. Checkpoint — Kiểm tra API routes
  - Đảm bảo tất cả API routes hoạt động đúng, hỏi user nếu có vấn đề với Stellar transactions.

- [ ] 8. Frontend UI
  - [ ] 8.1 Implement SendMoneyForm (`/app/send/page.tsx`)
    - Tạo form với 3 input fields: VND amount (number), Receiver name (text), Receiver account (text)
    - Implement real-time calculation: khi user nhập VND amount, hiển thị USDC equivalent và PHP payout dùng `calculateAmounts()`
    - Implement form submission: POST `/api/remittance/create`, redirect đến `/app/tx/[txId]` khi thành công
    - Hiển thị inline error message khi nhận `INSUFFICIENT_LIQUIDITY` response (không navigate away)
    - Style với TailwindCSS
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ] 8.2 Implement TransactionStatusPage (`/app/tx/[txId]/page.tsx`)
    - Hiển thị status badge với màu: `funded` (yellow), `processing` (blue), `completed` (green), `expired` (gray)
    - Hiển thị: txId, VND amount, USDC equivalent, PHP payout, Receiver name, Receiver account
    - Implement Countdown_Timer: hiển thị thời gian còn lại (tính từ `expiresAt`) khi status = `funded`
    - Implement upload proof form (chỉ hiển thị khi status = `funded`): input file → convert to base64 → POST `/api/remittance/[id]/mark-paid`
    - Implement polling: `setInterval` mỗi 3 giây gọi GET `/api/remittance/[id]` và cập nhật UI
    - Dừng polling khi status = `completed` hoặc `expired`
    - _Requirements: 7.1, 7.2, 7.3, 3.1, 3.2_

  - [ ] 8.3 Implement AgentDashboard (`/app/agent/page.tsx`)
    - Hiển thị bảng tất cả Remittance_Requests với columns: txId, Receiver, VND amount, USDC, PHP, status badge, countdown timer
    - Hiển thị Collateral_Pool balance section: total collateral, reserved USDC, available USDC (từ GET `/api/agent/balance`)
    - Implement Deposit form: input USDC amount → POST `/api/agent/fund`
    - Với mỗi request có status `processing`: hiển thị nút "Upload Proof" (POST `/api/remittance/[id]/agent-proof`) và nút "Confirm Payout" (POST `/api/remittance/[id]/confirm`)
    - Hiển thị sender proof và agent proof side-by-side cho requests ở status `processing`
    - Implement polling mỗi 3 giây để refresh danh sách và balance
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 4.4, 5.6_

- [ ] 9. Checkpoint — Kiểm tra full UI flow
  - Đảm bảo toàn bộ luồng Sender → Agent hoạt động end-to-end, hỏi user nếu có vấn đề.

- [ ] 10. Property-Based Tests (fast-check)
  - [ ] 10.1 Viết property test cho exchange rate calculation
    - Tạo `/tests/unit/exchange-rate.test.ts`
    - **Property 1: Exchange Rate Calculation Correctness**
    - **Validates: Requirements 2.2, 10.2**
    - Test với `fc.float({ min: 1, max: 1_000_000_000, noNaN: true })`, verify `usdcEquivalent = vndAmount × VND_TO_USDC` và `phpPayout = usdcEquivalent × USDC_TO_PHP` với sai số < 1e-9
    - Chạy tối thiểu 100 iterations
    - _Requirements: 2.2, 10.2_

  - [ ] 10.2 Viết property test cho txId uniqueness
    - Tạo `/tests/unit/tx-id-uniqueness.test.ts`
    - **Property 2: txId Uniqueness**
    - **Validates: Requirements 2.1, 11.4**
    - Generate N txIds (N từ 2 đến 100), verify tất cả distinct bằng cách so sánh Set.size với array.length
    - _Requirements: 2.1, 11.4_

  - [ ] 10.3 Viết property test cho data persistence completeness
    - Tạo `/tests/unit/data-persistence.test.ts`
    - **Property 3: Remittance Data Persistence Completeness**
    - **Validates: Requirements 2.4, 7.1, 11.1**
    - Mock DB, tạo remittance với arbitrary valid inputs, đọc lại và verify tất cả fields khớp với input
    - _Requirements: 2.4, 7.1, 11.1_

  - [ ] 10.4 Viết property test cho insufficient liquidity rejection
    - Tạo `/tests/unit/liquidity-check.test.ts`
    - **Property 4: Insufficient Liquidity Rejection**
    - **Validates: Requirements 2.3**
    - Mock available balance = X, generate request với usdcEquivalent > X, verify request bị reject và DB không thay đổi
    - _Requirements: 2.3_

  - [ ] 10.5 Viết property tests cho state machine transitions
    - Tạo `/tests/unit/state-machine.test.ts`
    - **Property 5: State Transition funded → processing**
    - **Validates: Requirements 3.1**
    - **Property 6: State Transition processing → completed with Balance Restoration**
    - **Validates: Requirements 5.2, 9.3**
    - **Property 7: State Transition funded → expired with Balance Restoration**
    - **Validates: Requirements 6.2, 9.4**
    - **Property 8: Invalid Mark-Paid Rejection**
    - **Validates: Requirements 3.3, 3.4**
    - **Property 15: Non-processing Status Guard for Agent Upload**
    - **Validates: Requirements 4.3**
    - **Property 16: Refund Guard for Non-funded Status**
    - **Validates: Requirements 6.3**
    - Mock DB và Stellar service, test tất cả state transitions với arbitrary txIds và amounts
    - _Requirements: 3.1, 3.3, 3.4, 4.3, 5.2, 6.2, 6.3, 9.3, 9.4_

  - [ ] 10.6 Viết property tests cho proof image upload
    - Tạo `/tests/unit/proof-upload.test.ts`
    - **Property 9: Proof Image Acceptance Without Content Validation**
    - **Validates: Requirements 3.2, 4.2**
    - **Property 10: Proof Image Reference Persistence**
    - **Validates: Requirements 3.5, 4.1**
    - Generate arbitrary base64 strings và mime types, verify system chấp nhận và lưu reference đúng
    - _Requirements: 3.2, 3.5, 4.1, 4.2_

  - [ ] 10.7 Viết property tests cho authorization và expiry
    - Tạo `/tests/unit/authorization.test.ts`
    - **Property 11: Agent-Only Authorization for Confirm**
    - **Validates: Requirements 5.4, 9.6**
    - **Property 12: Expired Confirm Rejection**
    - **Validates: Requirements 5.3, 9.5**
    - Generate arbitrary non-agent addresses, verify contract reject với UNAUTHORIZED; generate expired timestamps, verify EXPIRED error
    - _Requirements: 5.3, 5.4, 9.5, 9.6_

  - [ ] 10.8 Viết property test cho timeout window consistency
    - Tạo `/tests/unit/timeout.test.ts`
    - **Property 13: Timeout Window Consistency**
    - **Validates: Requirements 6.4, 9.7**
    - Generate arbitrary creation timestamps, verify `expiresAt = createdAt + 300s` cho tất cả records
    - _Requirements: 6.4, 9.7_

  - [ ] 10.9 Viết property test cho collateral math
    - Tạo `/tests/unit/collateral-math.test.ts`
    - **Property 14: Reserve Deducts Collateral Pool**
    - **Validates: Requirements 9.2**
    - Mock contract state, gọi reserve với arbitrary amount, verify available balance giảm đúng amount và reserved amount cho txId = amount
    - _Requirements: 9.2_

  - [ ] 10.10 Viết property test cho API list completeness
    - Tạo `/tests/unit/api-list.test.ts`
    - **Property 17: API List Completeness**
    - **Validates: Requirements 7.4**
    - Tạo N records (N từ 1 đến 50) với mock DB, gọi list endpoint, verify response chứa đúng N records với correct field values
    - _Requirements: 7.4_

- [ ] 11. Integration Tests và Smoke Tests
  - [ ]* 11.1 Viết integration tests cho Stellar contract
    - Tạo `/tests/integration/stellar-contract.test.ts`
    - Test deposit collateral → verify contract state thay đổi đúng
    - Test reserve → verify available balance giảm
    - Test confirm → verify USDC released về pool
    - Test refund sau timeout → verify USDC restored
    - _Requirements: 1.1, 9.2, 9.3, 9.4_

  - [ ]* 11.2 Viết integration tests cho full remittance flow
    - Tạo `/tests/integration/full-flow.test.ts`
    - Test luồng đầy đủ: create → mark-paid → agent-proof → confirm
    - Test concurrent requests: verify không double-spend collateral
    - _Requirements: 2.1, 3.1, 4.1, 5.1, 5.2_

  - [ ]* 11.3 Viết integration tests cho timeout flow
    - Tạo `/tests/integration/timeout-flow.test.ts`
    - Test create → wait expiry → trigger cron → verify status = expired và USDC restored
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ]* 11.4 Viết smoke tests
    - Tạo `/tests/smoke/db-connection.test.ts`: verify DB connectivity và schema
    - Tạo `/tests/smoke/stellar-rpc.test.ts`: verify Stellar RPC connectivity và contract deployment
    - _Requirements: 11.2, 11.3_

- [ ] 12. Final Checkpoint — Đảm bảo tất cả tests pass
  - Chạy toàn bộ test suite (`jest --testPathPattern="tests/unit"`), đảm bảo tất cả 17 property tests pass với ít nhất 100 iterations mỗi test. Hỏi user nếu có vấn đề.

## Ghi chú

- Tasks đánh dấu `*` là optional và có thể bỏ qua để triển khai MVP nhanh hơn
- Mỗi task tham chiếu đến requirements cụ thể để đảm bảo traceability
- Property tests dùng `fast-check` với `numRuns: 100` tối thiểu
- Tất cả property tests chạy với mock dependencies (không gọi Stellar testnet thật)
- Integration tests yêu cầu Stellar testnet và Neon DB test instance
- Connection string DB: sử dụng biến môi trường `DATABASE_URL` (không hardcode)
