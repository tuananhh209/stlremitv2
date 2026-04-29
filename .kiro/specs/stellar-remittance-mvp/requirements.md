# Requirements Document

## Introduction

Hệ thống **Stellar Remittance MVP** là một ứng dụng web full-stack cho phép chuyển tiền xuyên biên giới từ Việt Nam (VND) sang Philippines (PHP) thông qua một Agent trung gian duy nhất. Hệ thống sử dụng Stellar blockchain (testnet) và Soroban smart contract để tạo sự tin tưởng thông qua cơ chế escrow/collateral, đảm bảo Agent luôn có đủ thanh khoản trước khi nhận lệnh chuyển tiền. Toàn bộ luồng fiat (VND/PHP) là off-chain và được mô phỏng; blockchain chỉ đóng vai trò bảo đảm và theo dõi trạng thái.

---

## Glossary

- **System**: Ứng dụng web Stellar Remittance MVP (Next.js full-stack).
- **Sender**: Người dùng tại Việt Nam muốn gửi tiền VND ra nước ngoài.
- **Receiver**: Người nhận tại Philippines, nhận tiền PHP.
- **Agent**: Thực thể trung gian duy nhất (hardcoded), chịu trách nhiệm nhận VND off-chain, chuyển đổi sang PHP và thanh toán cho Receiver.
- **Remittance_Request**: Một lệnh chuyển tiền được tạo bởi Sender, có trạng thái vòng đời từ `funded` → `processing` → `completed` hoặc `expired`.
- **txId**: Mã định danh duy nhất cho mỗi Remittance_Request, được sinh bởi backend và gắn vào Stellar transaction dưới dạng memo.
- **Escrow_Contract**: Soroban smart contract trên Stellar testnet, quản lý collateral USDC của Agent.
- **Collateral_Pool**: Tổng lượng USDC mà Agent đã deposit vào Escrow_Contract.
- **Reserved_USDC**: Lượng USDC bị khóa trong Escrow_Contract tương ứng với một Remittance_Request đang hoạt động.
- **USDC**: Tài sản kỹ thuật số được mô phỏng trên Stellar testnet, dùng làm đơn vị collateral.
- **Proof_Image**: Ảnh chứng minh do Sender hoặc Agent upload, được chấp nhận mà không cần xác thực nội dung.
- **Countdown_Timer**: Bộ đếm ngược 5 phút (300 giây) bắt đầu từ thời điểm Remittance_Request được tạo.
- **Timeout**: Trạng thái khi Countdown_Timer hết hạn mà Sender chưa mark-paid.
- **Agent_Dashboard**: Giao diện web dành riêng cho Agent để quản lý tất cả Remittance_Request.
- **DB**: Cơ sở dữ liệu PostgreSQL trên Neon, lưu trữ trạng thái Remittance_Request.
- **API**: Tập hợp các Next.js API routes xử lý logic nghiệp vụ.

---

## Requirements

### Requirement 1: Agent Fund Contract (Deposit Collateral)

**User Story:** As an Agent, I want to deposit USDC into the Escrow_Contract, so that the Collateral_Pool has sufficient liquidity to back future Remittance_Requests.

#### Acceptance Criteria

1. WHEN the Agent submits a deposit request with a valid USDC amount, THE System SHALL call the Escrow_Contract `fund` function on Stellar testnet and record the updated Collateral_Pool balance in the DB.
2. WHEN the Escrow_Contract `fund` transaction is confirmed on Stellar testnet, THE System SHALL update the Agent's available liquidity in the DB within 10 seconds.
3. IF the Stellar testnet transaction fails, THEN THE System SHALL return an error response with the Stellar error code and leave the DB unchanged.
4. THE Agent_Dashboard SHALL display the current Collateral_Pool balance and available (unreserved) USDC balance in real time.

---

### Requirement 2: Create Remittance Request

**User Story:** As a Sender, I want to create a remittance request specifying the VND amount and Receiver details, so that the System initiates a cross-border transfer backed by Agent collateral.

#### Acceptance Criteria

1. WHEN the Sender submits a valid remittance creation request (VND amount, Receiver name, Receiver account), THE System SHALL generate a unique txId, reserve the equivalent USDC amount from the Collateral_Pool in the Escrow_Contract, set the Remittance_Request status to `funded`, and start the Countdown_Timer.
2. THE System SHALL calculate the USDC equivalent from the VND amount using a fixed exchange rate defined in system configuration, and display the USDC equivalent and PHP payout amount to the Sender.
3. IF the available (unreserved) USDC in the Collateral_Pool is less than the required USDC equivalent, THEN THE System SHALL reject the request with an error message indicating insufficient liquidity and leave the DB unchanged.
4. WHEN the Remittance_Request is created successfully, THE System SHALL persist the txId, VND amount, USDC equivalent, PHP payout, Receiver details, status (`funded`), and creation timestamp to the DB.
5. WHEN the Remittance_Request is created successfully, THE System SHALL attach the txId as a memo to the Stellar testnet transaction that calls the Escrow_Contract `reserve` function.
6. THE System SHALL display the Countdown_Timer to the Sender on the transaction status page, counting down from 300 seconds.

---

### Requirement 3: Sender Mark Payment (Upload VND Proof)

**User Story:** As a Sender, I want to upload proof of my VND payment, so that the Agent knows to proceed with the PHP payout.

#### Acceptance Criteria

1. WHEN the Sender submits a mark-paid request with a txId and a Proof_Image for a Remittance_Request in `funded` status, THE System SHALL update the Remittance_Request status to `processing` in the DB.
2. WHEN the Sender submits a mark-paid request, THE System SHALL accept any Proof_Image file without validating its content.
3. IF the Remittance_Request status is not `funded` at the time of the mark-paid request, THEN THE System SHALL reject the request with an error message indicating the invalid status transition.
4. IF the Countdown_Timer has expired before the mark-paid request is received, THEN THE System SHALL reject the mark-paid request and return an error indicating the transaction has expired.
5. THE System SHALL store the Proof_Image reference in the DB alongside the Remittance_Request record.

---

### Requirement 4: Agent Payout and Proof Upload

**User Story:** As an Agent, I want to upload proof of PHP payout to the Receiver, so that there is a record of the off-chain payment before confirming on-chain.

#### Acceptance Criteria

1. WHEN the Agent uploads a Proof_Image for a Remittance_Request in `processing` status, THE System SHALL store the Proof_Image reference in the DB alongside the Remittance_Request record.
2. THE System SHALL accept any Proof_Image file without validating its content.
3. IF the Remittance_Request status is not `processing` at the time of the Agent proof upload, THEN THE System SHALL reject the upload with an error message indicating the invalid status.
4. THE Agent_Dashboard SHALL display the Sender's Proof_Image and the Agent's Proof_Image side by side for each Remittance_Request in `processing` status.

---

### Requirement 5: Agent Confirm Payout (On-Chain Release)

**User Story:** As an Agent, I want to confirm the PHP payout on-chain, so that the Escrow_Contract releases the Reserved_USDC back to the Agent's account.

#### Acceptance Criteria

1. WHEN the Agent submits a confirm request for a Remittance_Request in `processing` status, THE System SHALL call the Escrow_Contract `confirm(txId)` function on Stellar testnet.
2. WHEN the Escrow_Contract `confirm(txId)` call succeeds, THE System SHALL update the Remittance_Request status to `completed` in the DB and release the Reserved_USDC back to the Agent's Collateral_Pool balance.
3. IF the Escrow_Contract determines the Countdown_Timer has expired for the given txId, THEN THE System SHALL reject the confirm call and return an error indicating the transaction has expired.
4. IF the caller of the confirm request is not the Agent, THEN THE Escrow_Contract SHALL reject the call and THE System SHALL return an authorization error.
5. IF the txId provided in the confirm request does not exist in the Escrow_Contract, THEN THE Escrow_Contract SHALL reject the call and THE System SHALL return a not-found error.
6. WHEN the Remittance_Request status is updated to `completed`, THE Agent_Dashboard SHALL reflect the updated status and the restored available USDC balance.

---

### Requirement 6: Timeout and Automatic Refund

**User Story:** As an Agent, I want the system to automatically handle expired transactions, so that Reserved_USDC is returned when a Sender fails to pay within the time window.

#### Acceptance Criteria

1. WHEN the Countdown_Timer for a Remittance_Request in `funded` status reaches zero, THE System SHALL call the Escrow_Contract `refund(txId)` function on Stellar testnet.
2. WHEN the Escrow_Contract `refund(txId)` call succeeds, THE System SHALL update the Remittance_Request status to `expired` in the DB and restore the Reserved_USDC to the available Collateral_Pool balance.
3. IF the Remittance_Request status is `processing` or `completed` at the time the Countdown_Timer reaches zero, THEN THE System SHALL NOT call `refund(txId)` for that Remittance_Request.
4. THE System SHALL enforce the 5-minute (300-second) timeout window consistently for all Remittance_Requests.

---

### Requirement 7: Transaction Status and History

**User Story:** As a Sender, I want to view the real-time status of my remittance transaction, so that I know when to pay and when the transfer is complete.

#### Acceptance Criteria

1. WHEN the Sender accesses the transaction status page for a given txId, THE System SHALL display the current status, VND amount, USDC equivalent, PHP payout, Receiver details, and Countdown_Timer (if applicable).
2. THE System SHALL display status badges with the following color coding: `funded` (yellow), `processing` (blue), `completed` (green), `expired` (gray).
3. WHEN the Remittance_Request status changes, THE System SHALL reflect the updated status on the transaction status page within 5 seconds without requiring a full page reload.
4. THE System SHALL provide a GET /api/remittance endpoint that returns a list of all Remittance_Requests, and a GET /api/remittance/[id] endpoint that returns the details of a single Remittance_Request.

---

### Requirement 8: Agent Dashboard

**User Story:** As an Agent, I want a dashboard showing all remittance transactions, so that I can monitor and act on pending payouts efficiently.

#### Acceptance Criteria

1. THE Agent_Dashboard SHALL display all Remittance_Requests with their txId, Sender information, VND amount, USDC equivalent, PHP payout, current status, and remaining Countdown_Timer.
2. THE Agent_Dashboard SHALL provide action buttons for each Remittance_Request in `processing` status: upload Proof_Image and confirm payout.
3. WHEN the Agent_Dashboard is loaded, THE System SHALL fetch the latest Remittance_Request list from GET /api/remittance and display it.
4. THE Agent_Dashboard SHALL display the current Collateral_Pool balance and available (unreserved) USDC balance.

---

### Requirement 9: Soroban Escrow Contract State Machine

**User Story:** As a system architect, I want the Soroban smart contract to enforce the transaction state machine on-chain, so that collateral management is trustless and tamper-proof.

#### Acceptance Criteria

1. THE Escrow_Contract SHALL maintain the following state transitions for each txId: `created` → `funded` → `processing` → `completed`, and `funded` → `expired`.
2. WHEN the Escrow_Contract `reserve(txId, amount)` function is called, THE Escrow_Contract SHALL transition the txId state to `funded` and deduct the specified amount from the available Collateral_Pool.
3. WHEN the Escrow_Contract `confirm(txId)` function is called and the txId state is `funded` or `processing` and the Countdown_Timer has not expired, THE Escrow_Contract SHALL transition the txId state to `completed` and return the Reserved_USDC to the Agent's balance.
4. WHEN the Escrow_Contract `refund(txId)` function is called and the Countdown_Timer for the txId has expired, THE Escrow_Contract SHALL transition the txId state to `expired` and return the Reserved_USDC to the available Collateral_Pool.
5. IF the Escrow_Contract `confirm(txId)` function is called after the Countdown_Timer has expired, THEN THE Escrow_Contract SHALL reject the call with an `EXPIRED` error code.
6. IF the Escrow_Contract `confirm(txId)` function is called by any address other than the Agent's Stellar address, THEN THE Escrow_Contract SHALL reject the call with an `UNAUTHORIZED` error code.
7. THE Escrow_Contract SHALL store the creation timestamp for each txId to enforce the 300-second timeout window.

---

### Requirement 10: Sender UI — Send Money Form

**User Story:** As a Sender, I want a simple form to initiate a remittance, so that I can quickly start the transfer process.

#### Acceptance Criteria

1. THE System SHALL provide a Send Money form with input fields for: VND amount, Receiver name, and Receiver account number.
2. WHEN the Sender enters a VND amount, THE System SHALL display the calculated USDC equivalent and PHP payout amount in real time using the configured exchange rate.
3. WHEN the Sender submits the Send Money form, THE System SHALL call POST /api/remittance/create and redirect the Sender to the transaction status page for the created txId.
4. IF the POST /api/remittance/create call returns an insufficient liquidity error, THEN THE System SHALL display an error message on the Send Money form without navigating away.

---

### Requirement 11: Data Persistence

**User Story:** As a system operator, I want all transaction data persisted in PostgreSQL, so that the system state survives restarts and can be audited.

#### Acceptance Criteria

1. THE DB SHALL store each Remittance_Request with the following fields: txId (primary key), VND amount, USDC equivalent, PHP payout, Receiver name, Receiver account, status, creation timestamp, expiry timestamp, sender Proof_Image reference, Agent Proof_Image reference, and Stellar transaction hash.
2. WHEN the System starts, THE System SHALL connect to the DB using the configured PostgreSQL connection string and verify connectivity.
3. IF the DB connection fails at startup, THEN THE System SHALL log the error and return a 503 error for all API requests until connectivity is restored.
4. THE DB SHALL enforce uniqueness on txId to prevent duplicate Remittance_Requests.
