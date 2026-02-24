export class ApiError extends Error {
  status: number;
  type: string;
  param?: string;
  code?: string;

  constructor(status: number, message: string, type: string, param?: string, code?: string) {
    super(message);
    this.status = status;
    this.type = type;
    this.param = param;
    this.code = code;
    this.name = 'ApiError';
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        type: this.type,
        param: this.param,
        code: this.code,
      },
    };
  }
}

export class BadRequestError extends ApiError {
  constructor(message: string, param?: string) {
    super(400, message, 'invalid_request_error', param);
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message: string = 'Invalid API key') {
    super(401, message, 'invalid_request_error', undefined, 'invalid_api_key');
  }
}

export class NotFoundError extends ApiError {
  constructor(message: string = 'Model not found') {
    super(404, message, 'invalid_request_error', undefined, 'model_not_found');
  }
}

export class TimeoutError extends ApiError {
  constructor(message: string = 'Request timeout') {
    super(408, message, 'timeout', undefined, 'timeout');
  }
}

export class RequestTooLargeError extends ApiError {
  constructor(message: string = 'Prompt too long') {
    super(413, message, 'invalid_request_error', undefined, 'context_length_exceeded');
  }
}

export class UnprocessableError extends ApiError {
  constructor(message: string, param?: string) {
    super(422, message, 'invalid_request_error', param);
  }
}

export class RateLimitError extends ApiError {
  constructor(message: string = 'Rate limit exceeded') {
    super(429, message, 'rate_limit_error', undefined, 'rate_limit_exceeded');
  }
}

export class InternalServerError extends ApiError {
  constructor(message: string = 'Internal server error') {
    super(500, message, 'internal_error', undefined, 'internal_error');
  }
}

export class ServiceUnavailableError extends ApiError {
  constructor(message: string = 'Model not loaded') {
    super(503, message, 'service_unavailable', undefined, 'model_not_loaded');
  }
}

export function handleError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof Error) {
    const message = error.message;

    if (message.includes('API key') || message.includes('unauthorized')) {
      return new UnauthorizedError(message);
    }
    if (message.includes('not found') || message.includes('does not exist')) {
      return new NotFoundError(message);
    }
    if (message.includes('timeout')) {
      return new TimeoutError(message);
    }
    if (message.includes('too long') || message.includes('context length')) {
      return new RequestTooLargeError(message);
    }
    if (message.includes('rate limit')) {
      return new RateLimitError(message);
    }
    if (message.includes('not loaded') || message.includes('not ready')) {
      return new ServiceUnavailableError(message);
    }

    return new InternalServerError(message);
  }

  return new InternalServerError('Unknown error');
}
