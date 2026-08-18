export class ServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export class NotFoundError extends ServiceError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND");
  }
}

export class ConflictError extends ServiceError {
  constructor(message: string, code = "CONFLICT") {
    super(message, 409, code);
  }
}

export class WriteConflictError extends Error {
  readonly code = "WRITE_EVENT_CONFLICT";
  readonly httpStatus = 409;

  constructor(clientEventId: string) {
    super(
      `clientEventId '${clientEventId}' was already used with different write data.`
    );
    this.name = "WriteConflictError";
  }
}
