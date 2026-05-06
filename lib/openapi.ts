const severityEnum = ["none", "mild", "moderate", "severe"];
const levelEnum = ["low", "medium", "high"];

const signalProperties = {
  lowBackPain: {
    type: "boolean",
    nullable: true
  },
  lowBackPainSeverity: {
    type: "string",
    enum: severityEnum,
    nullable: true
  },
  elbowIrritation: {
    type: "string",
    enum: severityEnum,
    nullable: true
  },
  neckTightness: {
    type: "string",
    enum: severityEnum,
    nullable: true
  },
  shoulderIrritation: {
    type: "string",
    enum: severityEnum,
    nullable: true
  },
  fatigueLevel: {
    type: "string",
    enum: levelEnum,
    nullable: true
  },
  motivationLevel: {
    type: "string",
    enum: levelEnum,
    nullable: true
  },
  sorenessAreas: {
    type: "array",
    items: {
      type: "string"
    },
    nullable: true
  },
  readinessNotes: {
    type: "string",
    nullable: true
  },
  whoopRecoveryScore: {
    type: "integer",
    nullable: true
  },
  whoopSleepPerformance: {
    type: "number",
    nullable: true
  },
  whoopSleepEfficiency: {
    type: "number",
    nullable: true
  },
  whoopHrvRmssd: {
    type: "number",
    nullable: true
  },
  whoopRestingHeartRate: {
    type: "number",
    nullable: true
  },
  whoopStrainYesterday: {
    type: "number",
    nullable: true
  },
  whoopDataFetchedAt: {
    type: "string",
    format: "date-time",
    nullable: true
  },
  whoopRaw: {
    type: "object",
    additionalProperties: true,
    nullable: true
  }
};

const activityTypeEnum = [
  "zone2",
  "hiit",
  "stairmaster",
  "run",
  "walk",
  "hike",
  "surf",
  "swim",
  "bike",
  "mobility",
  "sauna",
  "cold_plunge",
  "strength",
  "other"
] as const;

const activityIntensityEnum = ["low", "moderate", "high"] as const;

const activitySourceEnum = [
  "manual",
  "whoop_screenshot",
  "whoop_api",
  "apple_health",
  "other"
] as const;

const workoutSessionTimeSourceEnum = ["api_default", "user_provided"] as const;

const activitySessionTimeSourceEnum = [
  "api_default",
  "user_provided",
  "whoop_screenshot",
  "whoop_api"
] as const;

const activitySessionCanonicalMetricProperties = {
  modality: {
    type: "string",
    nullable: true
  },
  sourceActivityType: {
    type: "string",
    nullable: true,
    description:
      "Original vendor activity label (e.g. WHOOP sport_name). Canonical category is `type` + `modality`."
  },
  rawPayloadJson: {
    type: "object",
    additionalProperties: true,
    nullable: true,
    description: "Optional embedded vendor payload (e.g. full WHOOP workout JSON)."
  },
  endedAt: {
    type: "string",
    format: "date-time",
    nullable: true
  },
  durationMinutes: {
    type: "number",
    nullable: true
  },
  intensity: {
    type: "string",
    enum: [...activityIntensityEnum],
    nullable: true
  },
  avgHeartRate: {
    type: "integer",
    nullable: true
  },
  maxHeartRate: {
    type: "integer",
    nullable: true
  },
  minHeartRate: {
    type: "integer",
    nullable: true
  },
  calories: {
    type: "integer",
    nullable: true
  },
  distanceMeters: {
    type: "number",
    nullable: true
  },
  elevationGainMeters: {
    type: "number",
    nullable: true,
    description: "Canonical total ascent in meters."
  },
  elevationLossMeters: {
    type: "number",
    nullable: true,
    description: "Explicit total descent/loss in meters. Never inferred from elevation gain."
  },
  paceSecondsPerKm: {
    type: "number",
    nullable: true,
    description: "Canonical average pace in seconds per kilometer."
  },
  strain: {
    type: "number",
    nullable: true
  },
  zone0Minutes: {
    type: "number",
    nullable: true
  },
  zone1Minutes: {
    type: "number",
    nullable: true
  },
  zone2Minutes: {
    type: "number",
    nullable: true
  },
  zone3Minutes: {
    type: "number",
    nullable: true
  },
  zone4Minutes: {
    type: "number",
    nullable: true
  },
  zone5Minutes: {
    type: "number",
    nullable: true
  },
  source: {
    type: "string",
    enum: [...activitySourceEnum],
    nullable: true
  },
  notes: {
    type: "string",
    nullable: true
  },
  relatedWorkoutSessionId: {
    type: "string",
    nullable: true
  },
  syncStatus: {
    type: "string",
    nullable: true,
    description:
      "e.g. needs_review when WHOOP strength could not be auto-linked to a WorkoutSession."
  }
};

const activitySessionRequestMetricProperties = {
  ...activitySessionCanonicalMetricProperties,
  elevationGainFeet: {
    type: "number",
    nullable: true,
    description:
      "Input-only total ascent in feet. Converted to elevationGainMeters before persistence."
  },
  paceSecondsPerMile: {
    type: "number",
    nullable: true,
    description:
      "Input-only average pace in seconds per mile. Converted to paceSecondsPerKm before persistence."
  },
  paceMinutesPerKm: {
    type: "number",
    nullable: true,
    description:
      "Input-only average pace in minutes per kilometer. Converted to paceSecondsPerKm before persistence."
  },
  paceMinutesPerMile: {
    type: "number",
    nullable: true,
    description:
      "Input-only average pace in minutes per mile. Converted to paceSecondsPerKm before persistence."
  }
};

const relatedWorkoutSessionSummary = {
  type: "object",
  nullable: true,
  properties: {
    id: { type: "string" },
    startedAt: { type: "string", format: "date-time" },
    timeSource: {
      type: "string",
      enum: [...workoutSessionTimeSourceEnum],
      nullable: true
    },
    timezone: { type: "string" },
    sessionType: { type: "string", nullable: true },
    goal: { type: "string", nullable: true }
  }
};

const createActivityRequestProperties = {
  type: {
    type: "string",
    enum: [...activityTypeEnum]
  },
  startedAt: {
    type: "string",
    format: "date-time",
    description:
      "Optional. ISO 8601 datetime with offset; normalized to a UTC instant. When omitted, the server sets `startedAt` to the current time (`timeSource=api_default`)."
  },
  ...activitySessionRequestMetricProperties
};

const activitySessionResponseProperties = {
  id: { type: "string" },
  type: {
    type: "string",
    enum: [...activityTypeEnum]
  },
  startedAt: {
    type: "string",
    format: "date-time",
    description: "UTC instant (serialized as ISO 8601 with Z or offset)."
  },
  timeSource: {
    type: "string",
    enum: [...activitySessionTimeSourceEnum],
    nullable: true,
    description: "Whether `startedAt` came from the client, WHOOP ingest, or API default."
  },
  timezone: {
    type: "string",
    description:
      "IANA timezone for interpreting user-local context; stored instants are always UTC."
  },
  ...activitySessionCanonicalMetricProperties,
  createdAt: {
    type: "string",
    format: "date-time"
  },
  updatedAt: {
    type: "string",
    format: "date-time"
  },
  relatedWorkoutSession: relatedWorkoutSessionSummary
};

export function buildOpenApiSpec(baseUrl: string) {
  return {
    openapi: "3.1.0",
    info: {
      title: "Workout Bot API",
      version: "0.1.0",
      description: "Minimal workout logging API for a Custom GPT gym assistant."
    },
    servers: [
      {
        url: baseUrl
      }
    ],
    security: [
      {
        bearerAuth: []
      }
    ],
    paths: {
      "/api/sessions": {
        post: {
          operationId: "createWorkoutSession",
          summary: "Create a workout session",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateSessionRequest"
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Created session",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      session: {
                        $ref: "#/components/schemas/WorkoutSession"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/sessions/{id}": {
        patch: {
          operationId: "updateWorkoutSession",
          summary: "Update a workout session",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: {
                type: "string"
              }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    endedAt: {
                      type: "string",
                      format: "date-time"
                    },
                    sessionType: {
                      type: "string"
                    },
                    goal: {
                      type: "string"
                    },
                    readinessScore: {
                      type: "integer"
                    },
                    energy: {
                      type: "integer"
                    },
                    soreness: {
                      type: "string"
                    },
                    sleepQuality: {
                      type: "string"
                    },
                    notes: {
                      type: "string"
                    },
                    ...signalProperties
                  },
                  additionalProperties: false
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Updated session",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      session: {
                        $ref: "#/components/schemas/WorkoutSession"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/sessions/{id}/signals": {
        get: {
          operationId: "getWorkoutSessionSignals",
          summary: "Fetch readiness and recovery signals for a session",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: {
                type: "string"
              }
            }
          ],
          responses: {
            "200": {
              description: "Session signals",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      signals: {
                        type: "object",
                        properties: {
                          id: {
                            type: "string"
                          },
                          ...signalProperties,
                          updatedAt: {
                            type: "string",
                            format: "date-time"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        post: {
          operationId: "updateWorkoutSessionSignals",
          summary: "Update readiness and recovery signals for a session",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: {
                type: "string"
              }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: signalProperties,
                  additionalProperties: false
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Updated session signals",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      signals: {
                        type: "object",
                        properties: {
                          id: {
                            type: "string"
                          },
                          ...signalProperties,
                          updatedAt: {
                            type: "string",
                            format: "date-time"
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/sets": {
        post: {
          operationId: "logExerciseSet",
          summary: "Log a completed exercise set",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateSetRequest"
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Created set",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      set: {
                        $ref: "#/components/schemas/ExerciseSet"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/time": {
        get: {
          operationId: "getCurrentServerTime",
          summary: "Get current server/database time",
          responses: {
            "200": {
              description: "Current time",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      dbNow: {
                        type: "string",
                        format: "date-time"
                      },
                      timezone: {
                        type: "string"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/sessions/recent": {
        get: {
          operationId: "getRecentWorkoutSessions",
          summary: "Fetch recent sessions with exercises and sets",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                default: 10,
                minimum: 1,
                maximum: 50
              }
            }
          ],
          responses: {
            "200": {
              description: "Recent sessions",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      message: {
                        type: "string",
                        nullable: true,
                        description:
                          "Present when the latest workout session exists but has no attached exercise/set details yet."
                      },
                      sessions: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/WorkoutSessionWithExercises"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/exercises/history": {
        get: {
          operationId: "getExerciseHistory",
          summary: "Fetch recent sets for a matching exercise name",
          parameters: [
            {
              name: "name",
              in: "query",
              required: true,
              schema: {
                type: "string"
              }
            },
            {
              name: "limit",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                default: 10,
                minimum: 1,
                maximum: 50
              }
            }
          ],
          responses: {
            "200": {
              description: "Exercise set history",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      query: {
                        type: "string"
                      },
                      sets: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/ExerciseHistorySet"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/activity-sessions": {
        post: {
          operationId: "createActivitySession",
          summary: "Create a cardio, endurance, sport, recovery, or mobility activity",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/CreateActivitySessionRequest"
                }
              }
            }
          },
          responses: {
            "201": {
              description: "Created activity session",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      activity: {
                        $ref: "#/components/schemas/ActivitySession"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/activity-sessions/recent": {
        get: {
          operationId: "getRecentActivitySessions",
          summary: "List recent activity sessions",
          parameters: [
            {
              name: "limit",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                default: 20,
                minimum: 1,
                maximum: 50
              }
            },
            {
              name: "type",
              in: "query",
              required: false,
              schema: {
                type: "string",
                enum: [...activityTypeEnum]
              }
            }
          ],
          responses: {
            "200": {
              description: "Recent activities",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      activities: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/ActivitySession"
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/activity-sessions/from-whoop": {
        post: {
          operationId: "createActivitySessionFromWhoop",
          summary: "Legacy/manual WHOOP activity ingest (fallback)",
          description:
            "Fallback-only: use when WHOOP OAuth sync is unavailable, sync failed, or you are manually correcting/importing historical activity from parsed screenshot text. Prefer getWhoopConnectionStatus + syncWhoopWorkouts + recent ActivitySession reads for normal logging.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/WhoopIngestionRequest"
                }
              }
            }
          },
          responses: {
            "201": {
              description:
                "Created activity (legacy/manual ingest; source typically whoop_screenshot)",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      activity: {
                        $ref: "#/components/schemas/ActivitySession"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/activity-sessions/{id}": {
        get: {
          operationId: "getActivitySession",
          summary: "Get one activity session by id",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": {
              description: "Activity session",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      activity: {
                        $ref: "#/components/schemas/ActivitySession"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        patch: {
          operationId: "updateActivitySession",
          summary: "Update an activity session",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/UpdateActivitySessionRequest"
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Updated activity",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      activity: {
                        $ref: "#/components/schemas/ActivitySession"
                      }
                    }
                  }
                }
              }
            }
          }
        },
        delete: {
          operationId: "deleteActivitySession",
          summary: "Delete an activity session",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" }
            }
          ],
          responses: {
            "200": {
              description: "Deleted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      ok: { type: "boolean" }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/whoop/status": {
        get: {
          operationId: "getWhoopConnectionStatus",
          summary: "WHOOP OAuth connection and last sync metadata (single-tenant)",
          responses: {
            "200": {
              description: "Connection status",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      whoop: {
                        $ref: "#/components/schemas/WhoopConnectionStatus"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/whoop/sync": {
        post: {
          operationId: "syncWhoopWorkouts",
          summary:
            "Pull workouts from WHOOP v2 API and upsert ActivitySession rows (requires prior browser OAuth connect)",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/WhoopSyncRequest"
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Sync result counts",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      result: {
                        $ref: "#/components/schemas/WhoopSyncResult"
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      "/api/whoop/health-context": {
        get: {
          operationId: "getWhoopHealthContext",
          summary:
            "Read persisted WHOOP sleep + recovery by America/Los_Angeles calendar day (coaching context; not workout rows)",
          parameters: [
            {
              name: "date",
              in: "query",
              required: false,
              schema: {
                type: "string",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
                description:
                  "Anchor date YYYY-MM-DD. Defaults to current date in America/Los_Angeles."
              }
            },
            {
              name: "days",
              in: "query",
              required: false,
              schema: {
                type: "integer",
                minimum: 1,
                maximum: 14,
                default: 1,
                description:
                  "Number of consecutive local days ending at `date` (inclusive backward window)."
              }
            }
          ],
          responses: {
            "200": {
              description: "Sleep and recovery rows per localDate (nulls when not synced / missing)",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/WhoopHealthContextResponse"
                  }
                }
              }
            }
          }
        }
      },
      "/api/whoop/health-context/sync": {
        post: {
          operationId: "syncWhoopHealthContext",
          summary:
            "Pull WHOOP sleep and recovery collections into Postgres (read:sleep + read:recovery scopes)",
          requestBody: {
            required: false,
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/WhoopHealthContextSyncRequest"
                }
              }
            }
          },
          responses: {
            "200": {
              description: "Sync counts and optional per-row errors",
              content: {
                "application/json": {
                  schema: {
                    $ref: "#/components/schemas/WhoopHealthContextSyncResponse"
                  }
                }
              }
            }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer"
        }
      },
      schemas: {
        CreateSessionRequest: {
          type: "object",
          properties: {
            startedAt: {
              type: "string",
              format: "date-time",
              description:
                "Optional. ISO 8601 with offset as a UTC instant. When omitted, the server uses the current time (`timeSource=api_default`)."
            },
            sessionType: {
              type: "string",
              example: "Push"
            },
            goal: {
              type: "string"
            },
            readinessScore: {
              type: "integer"
            },
            energy: {
              type: "integer"
            },
            soreness: {
              type: "string"
            },
            sleepQuality: {
              type: "string"
            },
            notes: {
              type: "string"
            },
            ...signalProperties
          }
        },
        CreateSetRequest: {
          type: "object",
          required: ["sessionId", "exerciseName"],
          properties: {
            sessionId: {
              type: "string"
            },
            exerciseName: {
              type: "string",
              example: "Lat Pulldown"
            },
            setNumber: {
              type: "integer"
            },
            weight: {
              type: "number"
            },
            reps: {
              type: "integer"
            },
            rpe: {
              type: "number"
            },
            rir: {
              type: "number"
            },
            painFlag: {
              type: "boolean",
              default: false
            },
            painNotes: {
              type: "string"
            },
            notes: {
              type: "string"
            },
            completedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        WorkoutSession: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            startedAt: {
              type: "string",
              format: "date-time",
              description: "UTC session start instant."
            },
            timeSource: {
              type: "string",
              enum: [...workoutSessionTimeSourceEnum],
              nullable: true,
              description: "How `startedAt` was set when the session was created."
            },
            timezone: {
              type: "string",
              description:
                "IANA timezone label for user context (default America/Los_Angeles); values are stored in UTC."
            },
            endedAt: {
              type: "string",
              format: "date-time",
              nullable: true
            },
            sessionType: {
              type: "string",
              nullable: true
            },
            goal: {
              type: "string",
              nullable: true
            },
            readinessScore: {
              type: "integer",
              nullable: true
            },
            energy: {
              type: "integer",
              nullable: true
            },
            soreness: {
              type: "string",
              nullable: true
            },
            sleepQuality: {
              type: "string",
              nullable: true
            },
            notes: {
              type: "string",
              nullable: true
            },
            ...signalProperties,
            createdAt: {
              type: "string",
              format: "date-time"
            },
            updatedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        ExerciseSet: {
          type: "object",
          properties: {
            id: {
              type: "string"
            },
            sessionId: {
              type: "string"
            },
            exerciseId: {
              type: "string"
            },
            exercise: {
              type: "object",
              properties: {
                id: {
                  type: "string"
                },
                name: {
                  type: "string"
                }
              }
            },
            setNumber: {
              type: "integer",
              nullable: true
            },
            weight: {
              type: "number",
              nullable: true
            },
            reps: {
              type: "integer",
              nullable: true
            },
            rpe: {
              type: "number",
              nullable: true
            },
            rir: {
              type: "number",
              nullable: true
            },
            painFlag: {
              type: "boolean"
            },
            painNotes: {
              type: "string",
              nullable: true
            },
            notes: {
              type: "string",
              nullable: true
            },
            completedAt: {
              type: "string",
              format: "date-time"
            }
          }
        },
        WorkoutSessionWithExercises: {
          allOf: [
            {
              $ref: "#/components/schemas/WorkoutSession"
            },
            {
              type: "object",
              properties: {
                exercises: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string"
                      },
                      name: {
                        type: "string"
                      },
                      sets: {
                        type: "array",
                        items: {
                          $ref: "#/components/schemas/ExerciseSet"
                        }
                      }
                    }
                  }
                }
              }
            }
          ]
        },
        ExerciseHistorySet: {
          allOf: [
            {
              $ref: "#/components/schemas/ExerciseSet"
            },
            {
              type: "object",
              properties: {
                exerciseName: {
                  type: "string"
                },
                session: {
                  type: "object",
                  properties: {
                    id: {
                      type: "string"
                    },
                    startedAt: {
                      type: "string",
                      format: "date-time"
                    },
                    sessionType: {
                      type: "string",
                      nullable: true
                    },
                    goal: {
                      type: "string",
                      nullable: true
                    }
                  }
                }
              }
            }
          ]
        },
        ActivitySession: {
          type: "object",
          properties: activitySessionResponseProperties
        },
        CreateActivitySessionRequest: {
          type: "object",
          required: ["type"],
          properties: createActivityRequestProperties,
          additionalProperties: false
        },
        WhoopIngestionRequest: {
          type: "object",
          description:
            "Legacy/manual fallback payload (e.g. GPT-parsed screenshot metrics). Not the preferred path—use WHOOP OAuth + sync for live data. Same fields as CreateActivitySessionRequest; defaults `source` to whoop_screenshot when omitted. `startedAt` is optional (server fills current UTC time when missing). When `startedAt` is present, `timeSource` is set to whoop_screenshot.",
          required: ["type"],
          properties: createActivityRequestProperties,
          additionalProperties: false
        },
        UpdateActivitySessionRequest: {
          type: "object",
          properties: createActivityRequestProperties,
          additionalProperties: false
        },
        WhoopConnectionStatus: {
          type: "object",
          properties: {
            connected: { type: "boolean" },
            lastSyncAt: {
              type: "string",
              format: "date-time",
              nullable: true
            },
            lastSyncError: { type: "string", nullable: true },
            expiresAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description: "Access token expiry when connected"
            },
            workoutCount: {
              type: "integer",
              minimum: 0,
              description:
                "Rows in WhoopWorkoutMapping (unique WHOOP workout ids ever synced). Deleting ActivitySession does not remove these."
            },
            whoopActivitySessionCount: {
              type: "integer",
              minimum: 0,
              description:
                "ActivitySession rows with source=whoop_api (actual imported activity records in DB)."
            },
            needsReviewActivityCount: {
              type: "integer",
              minimum: 0,
              description:
                "Activity sessions with syncStatus=needs_review (strength WHOOP without a unique WorkoutSession match)."
            },
            scope: {
              type: "string",
              nullable: true,
              description:
                "OAuth scope string last stored from WHOOP (token response); null when disconnected."
            },
            readWorkout: {
              type: "boolean",
              description:
                "True when `read:workout` appears in the stored scope string (required for workout sync)."
            },
            readSleep: {
              type: "boolean",
              description:
                "True when `read:sleep` appears in the stored scope (required for sleep health-context sync)."
            },
            readRecovery: {
              type: "boolean",
              description:
                "True when `read:recovery` appears in the stored scope (required for recovery health-context sync)."
            },
            lastHealthContextAt: {
              type: "string",
              format: "date-time",
              nullable: true,
              description:
                "Most recent `updatedAt` among `WhoopSleep` and `WhoopRecovery` rows, if any."
            },
            whoopDeveloperApiBase: {
              type: "string",
              description:
                "Runtime WHOOP data API base URL (official OpenAPI server); must be `https://api.prod.whoop.com/developer` for production workout collection calls."
            },
            whoopWorkoutCollectionUrl: {
              type: "string",
              description:
                "Path used for workout list requests before query params (`limit`, `start`, `end`, `nextToken`)."
            },
            vercelDeploymentId: {
              type: "string",
              nullable: true,
              description:
                "Vercel `VERCEL_DEPLOYMENT_ID` when running on Vercel; use to confirm which deployment served this response."
            },
            vercelGitCommitSha: {
              type: "string",
              nullable: true,
              description:
                "Vercel `VERCEL_GIT_COMMIT_SHA` when set; compare to your repo to confirm the live build."
            }
          },
          required: [
            "connected",
            "lastSyncAt",
            "lastSyncError",
            "expiresAt",
            "workoutCount",
            "whoopActivitySessionCount",
            "needsReviewActivityCount",
            "scope",
            "readWorkout",
            "readSleep",
            "readRecovery",
            "lastHealthContextAt",
            "whoopDeveloperApiBase",
            "whoopWorkoutCollectionUrl",
            "vercelDeploymentId",
            "vercelGitCommitSha"
          ]
        },
        WhoopSyncRequest: {
          type: "object",
          description:
            "Optional ISO 8601 window for WHOOP workout list. Defaults follow WHOOP client pagination limits.",
          properties: {
            start: { type: "string", format: "date-time" },
            end: { type: "string", format: "date-time" },
            maxPages: { type: "integer", minimum: 1, maximum: 20 }
          },
          additionalProperties: false
        },
        WhoopSyncResult: {
          type: "object",
          properties: {
            fetched: { type: "integer", minimum: 0 },
            inserted: { type: "integer", minimum: 0 },
            updated: { type: "integer", minimum: 0 },
            skipped: { type: "integer", minimum: 0 },
            needsReview: {
              type: "integer",
              minimum: 0,
              description:
                "Count of workouts in this sync batch written as strength ActivitySession with needs_review."
            }
          },
          required: ["fetched", "inserted", "updated", "skipped", "needsReview"]
        },
        WhoopHealthContextSyncRequest: {
          type: "object",
          description:
            "Optional ISO window for WHOOP sleep/recovery collection pagination (same semantics as workout sync).",
          properties: {
            start: { type: "string", format: "date-time" },
            end: { type: "string", format: "date-time" },
            maxPages: { type: "integer", minimum: 1, maximum: 20 }
          },
          additionalProperties: false
        },
        WhoopHealthContextSyncResult: {
          type: "object",
          properties: {
            sleepsFetched: { type: "integer", minimum: 0 },
            sleepsInserted: { type: "integer", minimum: 0 },
            sleepsUpdated: { type: "integer", minimum: 0 },
            recoveriesFetched: { type: "integer", minimum: 0 },
            recoveriesInserted: { type: "integer", minimum: 0 },
            recoveriesUpdated: { type: "integer", minimum: 0 },
            errors: {
              type: "array",
              items: { type: "string" },
              description: "Non-fatal row or partial-sync messages (e.g. missing scope for one resource)."
            }
          },
          required: [
            "sleepsFetched",
            "sleepsInserted",
            "sleepsUpdated",
            "recoveriesFetched",
            "recoveriesInserted",
            "recoveriesUpdated",
            "errors"
          ]
        },
        WhoopHealthContextSyncResponse: {
          type: "object",
          properties: {
            result: {
              $ref: "#/components/schemas/WhoopHealthContextSyncResult"
            },
            whoop: {
              $ref: "#/components/schemas/WhoopConnectionStatus"
            }
          },
          required: ["result", "whoop"]
        },
        WhoopHealthContextResponse: {
          type: "object",
          properties: {
            timezone: {
              type: "string",
              description: "IANA timezone used for localDate keys (default America/Los_Angeles)."
            },
            anchorDate: {
              type: "string",
              description: "YYYY-MM-DD end of the requested backward window."
            },
            days: { type: "integer", minimum: 1, maximum: 14 },
            context: {
              type: "array",
              items: {
                type: "object",
                required: ["localDate", "sleep", "recovery"],
                properties: {
                  localDate: { type: "string" },
                  sleep: {
                    type: "object",
                    nullable: true,
                    additionalProperties: true,
                    description: "WhoopSleep row or null if none for that local day."
                  },
                  recovery: {
                    type: "object",
                    nullable: true,
                    additionalProperties: true,
                    description: "WhoopRecovery row or null if none for that local day."
                  }
                }
              }
            }
          },
          required: ["timezone", "anchorDate", "days", "context"]
        }
      }
    }
  };
}
