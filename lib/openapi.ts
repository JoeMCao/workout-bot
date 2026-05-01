export function buildOpenApiSpec(baseUrl: string) {
  return {
    openapi: "3.0.3",
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
                  $ref: "#/components/schemas/UpdateSessionRequest"
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
      "/api/openapi": {
        get: {
          operationId: "getOpenApiSpec",
          summary: "Fetch this OpenAPI schema",
          responses: {
            "200": {
              description: "OpenAPI JSON"
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
            }
          }
        },
        UpdateSessionRequest: {
          allOf: [
            {
              $ref: "#/components/schemas/CreateSessionRequest"
            },
            {
              type: "object",
              properties: {
                endedAt: {
                  type: "string",
                  format: "date-time",
                  nullable: true
                }
              }
            }
          ]
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
        }
      }
    }
  };
}
