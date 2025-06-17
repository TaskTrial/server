/**
 * Standardized error codes for API responses
 */
export const ErrorCodes = {
  // Authentication errors (1xxx)
  UNAUTHORIZED: 1001,
  INVALID_TOKEN: 1002,
  EXPIRED_TOKEN: 1003,
  INSUFFICIENT_PERMISSIONS: 1004,

  // Resource errors (2xxx)
  RESOURCE_NOT_FOUND: 2001,
  RESOURCE_ALREADY_EXISTS: 2002,
  RESOURCE_CONFLICT: 2003,
  INVALID_RESOURCE_STATE: 2004,

  // Validation errors (3xxx)
  VALIDATION_ERROR: 3001,
  INVALID_PARAMETERS: 3002,
  MISSING_REQUIRED_FIELD: 3003,
  INVALID_FORMAT: 3004,

  // Chat specific errors (4xxx)
  CHAT_ROOM_NOT_FOUND: 4001,
  NOT_CHAT_PARTICIPANT: 4002,
  MESSAGE_NOT_FOUND: 4003,
  ATTACHMENT_ERROR: 4004,
  INVALID_MESSAGE_TYPE: 4005,

  // Video specific errors (5xxx)
  VIDEO_SESSION_NOT_FOUND: 5001,
  INVALID_SESSION_STATE: 5002,
  RECORDING_ERROR: 5003,
  PARTICIPANT_ERROR: 5004,
  WAITING_ROOM_ERROR: 5005,

  // Server errors (9xxx)
  INTERNAL_SERVER_ERROR: 9001,
  DATABASE_ERROR: 9002,
  EXTERNAL_SERVICE_ERROR: 9003,
  RATE_LIMIT_EXCEEDED: 9004,
};

/**
 * Error response formatter
 * @param {number} status - HTTP status code
 * @param {string} message - Error message
 * @param {number} code - Error code from ErrorCodes enum
 * @param {Object} [details=null] - Additional error details
 * @returns {Object} Formatted error response
 */
export const formatErrorResponse = (status, message, code, details = null) => {
  const response = {
    error: {
      status,
      code,
      message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return response;
};

/**
 * API error handler class with predefined error responses
 */
export class ApiError {
  /**
   * Not found error
   * @param {string} resource - The resource type that was not found
   * @param {string|number} id - The identifier that was used in the lookup
   * @returns {Object} Formatted error response
   */
  static notFound(resource, id) {
    return formatErrorResponse(
      404,
      `${resource} not found${id ? ` with ID ${id}` : ''}`,
      ErrorCodes.RESOURCE_NOT_FOUND,
      { resource, id },
    );
  }

  /**
   * Unauthorized error
   * @param {string} [message='Unauthorized access'] - Custom error message
   * @returns {Object} Formatted error response
   */
  static unauthorized(message = 'Unauthorized access') {
    return formatErrorResponse(401, message, ErrorCodes.UNAUTHORIZED);
  }

  /**
   * Forbidden error
   * @param {string} [message='Insufficient permissions'] - Custom error message
   * @returns {Object} Formatted error response
   */
  static forbidden(message = 'Insufficient permissions') {
    return formatErrorResponse(
      403,
      message,
      ErrorCodes.INSUFFICIENT_PERMISSIONS,
    );
  }

  /**
   * Validation error
   * @param {Array|Object} errors - Validation errors
   * @returns {Object} Formatted error response
   */
  static validationError(errors) {
    return formatErrorResponse(
      400,
      'Validation failed',
      ErrorCodes.VALIDATION_ERROR,
      { errors },
    );
  }

  /**
   * Conflict error
   * @param {string} message - Description of the conflict
   * @returns {Object} Formatted error response
   */
  static conflict(message) {
    return formatErrorResponse(409, message, ErrorCodes.RESOURCE_CONFLICT);
  }

  /**
   * Rate limit exceeded error
   * @param {string} [message='Too many requests'] - Custom error message
   * @returns {Object} Formatted error response
   */
  static rateLimitExceeded(message = 'Too many requests') {
    return formatErrorResponse(429, message, ErrorCodes.RATE_LIMIT_EXCEEDED);
  }

  /**
   * Server error
   * @param {string} [message='Internal server error'] - Custom error message
   * @param {Error} [error] - Original error object
   * @returns {Object} Formatted error response
   */
  static serverError(message = 'Internal server error', error = null) {
    const response = formatErrorResponse(
      500,
      message,
      ErrorCodes.INTERNAL_SERVER_ERROR,
    );

    // In development, include the error stack
    /* eslint no-undef: off */
    if (process.env.NODE_ENV === 'development' && error) {
      response.error.stack = error.stack;
    }

    return response;
  }

  /**
   * Chat participant error
   * @param {string} chatRoomId - Chat room ID
   * @returns {Object} Formatted error response
   */
  static notChatParticipant(chatRoomId) {
    return formatErrorResponse(
      403,
      'You are not a participant in this chat room',
      ErrorCodes.NOT_CHAT_PARTICIPANT,
      { chatRoomId },
    );
  }

  /**
   * Video session error
   * @param {string} sessionId - Video session ID
   * @returns {Object} Formatted error response
   */
  static videoSessionNotFound(sessionId) {
    return formatErrorResponse(
      404,
      'Video session not found',
      ErrorCodes.VIDEO_SESSION_NOT_FOUND,
      { sessionId },
    );
  }
}
