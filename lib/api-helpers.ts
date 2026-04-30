import { NextResponse } from "next/server";
import type { ApiErrorResponse } from "./types";
import {
  InsufficientLiquidityError,
  InvalidStatusTransitionError,
  TransactionExpiredError,
  UnauthorizedError,
  NotFoundError,
  StellarTransactionError,
  DatabaseConnectionError,
} from "./errors";

export function errorResponse(
  error: unknown
): NextResponse<ApiErrorResponse> {
  if (error instanceof InsufficientLiquidityError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "INSUFFICIENT_LIQUIDITY",
        details: { required: error.required, available: error.available },
      },
      { status: 422 }
    );
  }
  if (error instanceof InvalidStatusTransitionError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "INVALID_STATUS",
        details: {
          txId: error.txId,
          currentStatus: error.currentStatus,
          attemptedAction: error.attemptedAction,
        },
      },
      { status: 409 }
    );
  }
  if (error instanceof TransactionExpiredError) {
    return NextResponse.json(
      { error: error.message, code: "EXPIRED", details: { txId: error.txId } },
      { status: 410 }
    );
  }
  if (error instanceof UnauthorizedError) {
    return NextResponse.json(
      { error: error.message, code: "UNAUTHORIZED" },
      { status: 403 }
    );
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json(
      { error: error.message, code: "NOT_FOUND", details: { txId: error.txId } },
      { status: 404 }
    );
  }
  if (error instanceof StellarTransactionError) {
    return NextResponse.json(
      {
        error: error.message,
        code: "STELLAR_ERROR",
        details: {
          stellarErrorCode: error.stellarErrorCode,
          txHash: error.txHash,
        },
      },
      { status: 502 }
    );
  }
  if (error instanceof DatabaseConnectionError) {
    return NextResponse.json(
      { error: "Database connection failed", code: "DB_ERROR" },
      { status: 503 }
    );
  }

  // Generic error
  const message =
    error instanceof Error ? error.message : "Internal server error";
  console.error("[errorResponse] Unhandled error:", error);
  return NextResponse.json(
    { error: message, code: "STELLAR_ERROR" },
    { status: 500 }
  );
}
