import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canonicalizeJson } from "@/lib/canonical-json";
import { WriteConflictError } from "@/lib/services/errors";

export type WriteSource = "mcp" | "rest";

export type WriteReceipt = {
  status: "created" | "replayed";
  clientEventId: string;
  operation: string;
  entityType: string;
  entityId: string;
  source: WriteSource;
  recordedAt: string;
};

type TransactionClient = Prisma.TransactionClient;

export function canonicalPayloadHash(payload: unknown) {
  const canonical = JSON.stringify(canonicalizeJson(payload));
  return createHash("sha256").update(canonical).digest("hex");
}

function assertCompatible(
  event: {
    clientEventId: string;
    operation: string;
    entityType: string;
    payloadHash: string;
  },
  expected: {
    clientEventId: string;
    operation: string;
    entityType: string;
    payloadHash: string;
  }
) {
  if (
    event.clientEventId !== expected.clientEventId ||
    event.operation !== expected.operation ||
    event.entityType !== expected.entityType ||
    event.payloadHash !== expected.payloadHash
  ) {
    throw new WriteConflictError(expected.clientEventId);
  }
}

type IdempotentWrite<T> = {
  clientEventId: string;
  operation: string;
  entityType: string;
  payload: unknown;
  source: WriteSource;
  write: (tx: TransactionClient) => Promise<{ entityId: string; value: T }>;
  read: (tx: TransactionClient, entityId: string) => Promise<T>;
};

// The caller owns the transaction so multiple writes and their receipts can commit together.
export async function runIdempotentWriteInTransaction<T>(
  tx: TransactionClient,
  { clientEventId, operation, entityType, payload, source, write, read }: IdempotentWrite<T>
): Promise<{ value: T; receipt: WriteReceipt }> {
  const payloadHash = canonicalPayloadHash(payload);
  const expected = { clientEventId, operation, entityType, payloadHash };
  const existing = await tx.writeEvent.findUnique({ where: { clientEventId } });
  if (existing) {
    assertCompatible(existing, expected);
    return {
      value: await read(tx, existing.entityId),
      receipt: {
        status: "replayed", clientEventId, operation, entityType,
        entityId: existing.entityId,
        source: existing.source as WriteSource,
        recordedAt: existing.createdAt.toISOString()
      }
    };
  }
  const { entityId, value } = await write(tx);
  const event = await tx.writeEvent.create({
    data: { ...expected, entityId, source }
  });
  return {
    value,
    receipt: {
      status: "created", clientEventId, operation, entityType, entityId, source,
      recordedAt: event.createdAt.toISOString()
    }
  };
}

export async function runIdempotentWrite<T>(input: IdempotentWrite<T>) {
  try {
    return await prisma.$transaction((tx) => runIdempotentWriteInTransaction(tx, input));
  } catch (error) {
    // A concurrent request may have committed this event while our transaction rolled back.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const event = await prisma.writeEvent.findUnique({
        where: { clientEventId: input.clientEventId }
      });
      if (event) {
        return prisma.$transaction((tx) => runIdempotentWriteInTransaction(tx, input));
      }
    }
    throw error;
  }
}
