// Custom error classes for Stellar Remittance MVP

export class StellarTransactionError extends Error {
  constructor(
    public readonly stellarErrorCode: string,
    public readonly txHash?: string,
    message?: string
  ) {
    super(message ?? `Stellar transaction failed: ${stellarErrorCode}`);
    this.name = "StellarTransactionError";
  }
}

export class InsufficientLiquidityError extends Error {
  constructor(
    public readonly required: number,
    public readonly available: number
  ) {
    super(
      `Insufficient liquidity: required ${required} USDC, available ${available} USDC`
    );
    this.name = "InsufficientLiquidityError";
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(
    public readonly txId: string,
    public readonly currentStatus: string,
    public readonly attemptedAction: string
  ) {
    super(
      `Cannot ${attemptedAction} for txId ${txId} in status ${currentStatus}`
    );
    this.name = "InvalidStatusTransitionError";
  }
}

export class TransactionExpiredError extends Error {
  constructor(public readonly txId: string) {
    super(`Transaction ${txId} has expired`);
    this.name = "TransactionExpiredError";
  }
}

export class UnauthorizedError extends Error {
  constructor(
    message = "Unauthorized: only the Agent can perform this action"
  ) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class DatabaseConnectionError extends Error {
  constructor(cause?: unknown) {
    super("Database connection failed");
    this.name = "DatabaseConnectionError";
    this.cause = cause;
  }
}

export class NotFoundError extends Error {
  constructor(public readonly txId: string) {
    super(`Transaction ${txId} not found`);
    this.name = "NotFoundError";
  }
}
