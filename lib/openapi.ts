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

const activitySessionMetricProperties = {
  modality: {
    type: "string",
    nullable: true
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
  }
};

const relatedWorkoutSessionSummary = {
  type: "object",
  nullable: true,
  properties: {
    id: { type: "string" },
    startedAt: { type: "string", format: "date-time" },
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
    format: "date-time"
  },
  ...activitySessionMetricProperties
};

const activitySessionResponseProperties = {
  id: { type: "string" },
  type: {
    type: "string",
    enum: [...activityTypeEnum]
  },
  startedAt: {
    type: "string",
    format: "date-time"
  },
  ...activitySessionMetricProperties,
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
          summary: "Ingest activity metrics parsed from a WHOOP screenshot",
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
              description: "Created activity from WHOOP data",
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
              format: "date-time"
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
              format: "date-time"
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
          required: ["type", "startedAt"],
          properties: createActivityRequestProperties,
          additionalProperties: false
        },
        WhoopIngestionRequest: {
          type: "object",
          description:
            "WHOOP screenshot parse payload. Same fields as CreateActivitySessionRequest; the ingestion endpoint defaults `source` to whoop_screenshot when omitted.",
          required: ["type", "startedAt"],
          properties: createActivityRequestProperties,
          additionalProperties: false
        },
        UpdateActivitySessionRequest: {
          type: "object",
          properties: createActivityRequestProperties,
          additionalProperties: false
        }
      }
    }
  };
}
