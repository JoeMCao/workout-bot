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

export async function runIdempotentWrite<T>({
  clientEventId,
  operation,
  entityType,
  payload,
  source,
  write,
  read
}: {
  clientEventId: string;
  operation: string;
  entityType: string;
  payload: unknown;
  source: WriteSource;
  write: (tx: TransactionClient) => Promise<{ entityId: string; value: T }>;
  read: (tx: TransactionClient, entityId: string) => Promise<T>;
}): Promise<{ value: T; receipt: WriteReceipt }> {
  const payloadHash = canonicalPayloadHash(payload);
  const expected = {
    clientEventId,
    operation,
    entityType,
    payloadHash
  };

  const existing = await prisma.writeEvent.findUnique({
    where: { clientEventId }
  });
  if (existing) {
    assertCompatible(existing, expected);
    const value = await read(prisma, existing.entityId);
    return {
      value,
      receipt: {
        status: "replayed",
        clientEventId,
        operation,
        entityType,
        entityId: existing.entityId,
        source: existing.source as WriteSource,
        recordedAt: existing.createdAt.toISOString()
      }
    };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const raced = await tx.writeEvent.findUnique({
        where: { clientEventId }
      });
      if (raced) {
        assertCompatible(raced, expected);
        const value = await read(tx, raced.entityId);
        return {
          value,
          receipt: {
            status: "replayed" as const,
            clientEventId,
            operation,
            entityType,
            entityId: raced.entityId,
            source: raced.source as WriteSource,
            recordedAt: raced.createdAt.toISOString()
          }
        };
      }

      const { entityId, value } = await write(tx);
      const event = await tx.writeEvent.create({
        data: {
          clientEventId,
          operation,
          entityType,
          entityId,
          payloadHash,
          source
        }
      });

      return {
        value,
        receipt: {
          status: "created" as const,
          clientEventId,
          operation,
          entityType,
          entityId,
          source,
          recordedAt: event.createdAt.toISOString()
        }
      };
    });

    return created;
  } catch (error) {
    // A concurrent retry can lose the unique-key race after its transaction
    // has already committed. Re-read outside the failed transaction and
    // return the same receipt when the payload is compatible.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.writeEvent.findUnique({
        where: { clientEventId }
      });
      if (raced) {
        assertCompatible(raced, expected);
        const value = await read(prisma, raced.entityId);
        return {
          value,
          receipt: {
            status: "replayed",
            clientEventId,
            operation,
            entityType,
            entityId: raced.entityId,
            source: raced.source as WriteSource,
            recordedAt: raced.createdAt.toISOString()
          }
        };
      }
    }
    throw error;
  }
}
