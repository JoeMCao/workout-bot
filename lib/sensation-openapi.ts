import { z } from "zod";
import { recordSensationCheckInSchema, updateSensationCheckInSchema } from "@/lib/sensation-validation";

const checkInProperties = {
  id: { type: "string" }, description: { type: "string" },
  observedAt: { type: "string", format: "date-time" }, timezone: { type: "string" },
  createdAt: { type: "string", format: "date-time" }, updatedAt: { type: "string", format: "date-time" }
};
const checkInResponse = {
  type: "object", properties: {
    checkIn: { $ref: "#/components/schemas/SensationCheckIn" },
    receipt: { type: "object", additionalProperties: true }
  }, required: ["checkIn"]
};
const checkInContent = { "application/json": { schema: checkInResponse } };
const idParameter = { name: "id", in: "path", required: true, schema: { type: "string" } };

export const sensationSchemas = {
  SensationCheckIn: { type: "object", properties: checkInProperties, required: Object.keys(checkInProperties) },
  RecordSensationCheckInRequest: z.toJSONSchema(recordSensationCheckInSchema, { target: "openapi-3.0" }),
  UpdateSensationCheckInRequest: {
    ...z.toJSONSchema(updateSensationCheckInSchema, { target: "openapi-3.0" }), minProperties: 1
  },
  SensationHistory: {
    type: "object", properties: {
      startDate: { type: "string", format: "date" }, endDate: { type: "string", format: "date" },
      timezone: { type: "string" },
      checkIns: { type: "array", items: { $ref: "#/components/schemas/SensationCheckIn" } },
      ironNeckSessions: { type: "array", items: { type: "object", properties: {
        id: { type: "string" }, startedAt: { type: "string", format: "date-time" },
        timezone: { type: "string" }, notes: { type: "string", nullable: true },
        durationMinutes: { type: "number", nullable: true },
        relatedWorkoutSessionId: { type: "string", nullable: true }
      } } },
      truncated: { type: "object", properties: {
        checkIns: { type: "boolean" }, ironNeckSessions: { type: "boolean" }
      }, required: ["checkIns", "ironNeckSessions"] }
    }, required: ["startDate", "endDate", "timezone", "checkIns", "ironNeckSessions", "truncated"]
  }
};

export const sensationPaths = {
  "/api/sensation-check-ins": {
    post: {
      operationId: "recordSensationCheckIn", summary: "Save a finger sensation observation",
      description: "Save a clear personal report verbatim, including neck/forearm context when mentioned. No score required. Omit observedAt for now; use an offset for backdating. Supply a stable clientEventId; retry unchanged IDs and payloads. Never log hypothetical reports.",
      "x-openai-isConsequential": false,
      requestBody: { required: true, content: { "application/json": {
        schema: { $ref: "#/components/schemas/RecordSensationCheckInRequest" }
      } } },
      responses: {
        "201": { description: "Saved observation and receipt", content: checkInContent },
        "200": { description: "Replayed observation and receipt", content: checkInContent },
        "400": { description: "Invalid observation" }, "401": { description: "Unauthorized" },
        "409": { description: "Event ID conflicts with an earlier write or a deleted check-in" }
      }
    }
  },
  "/api/sensation-check-ins/{id}": {
    patch: {
      operationId: "updateSensationCheckIn", summary: "Correct a saved sensation observation",
      description: "Change only provided fields. Preserve the observation time unless correcting it explicitly. Retrieve history to identify the record; clarify ambiguous targets.",
      parameters: [idParameter],
      requestBody: { required: true, content: { "application/json": {
        schema: { $ref: "#/components/schemas/UpdateSensationCheckInRequest" }
      } } },
      responses: { "200": { description: "Corrected observation", content: checkInContent },
        "400": { description: "Invalid correction" }, "401": { description: "Unauthorized" },
        "404": { description: "Observation not found" } }
    },
    delete: {
      operationId: "deleteSensationCheckIn", summary: "Delete a sensation observation",
      description: "Delete only at the user's explicit request. Repeating a deletion is safe; create retries cannot resurrect deleted entries.",
      "x-openai-isConsequential": true,
      parameters: [idParameter],
      responses: { "200": { description: "Deleted or already absent", content: { "application/json": {
        schema: { type: "object", properties: { ok: { type: "boolean" }, checkInId: { type: "string" } } }
      } } }, "401": { description: "Unauthorized" } }
    }
  },
  "/api/sensation-history": {
    get: {
      operationId: "getSensationHistory", summary: "Read finger sensations alongside Iron Neck sessions",
      description: "Defaults to 28 Los Angeles calendar days including today. Supply both inclusive startDate/endDate to change the range. Lists are newest first. Respect truncation flags; request a narrower range or higher limit if needed. Missing check-ins mean unknown; do not infer causes.",
      parameters: [
        { name: "startDate", in: "query", required: false, schema: { type: "string", format: "date" } },
        { name: "endDate", in: "query", required: false, schema: { type: "string", format: "date" } },
        { name: "limit", in: "query", required: false, description: "Maximum entries in each list.",
          schema: { type: "integer", minimum: 1, maximum: 500, default: 200 } }
      ],
      responses: { "200": { description: "Persisted observations and completed routines", content: { "application/json": {
        schema: { $ref: "#/components/schemas/SensationHistory" }
      } } }, "400": { description: "Invalid date range or limit" }, "401": { description: "Unauthorized" } }
    }
  }
};
