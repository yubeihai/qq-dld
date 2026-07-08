class AppError extends Error {
  constructor(message, code = 'UNKNOWN_ERROR', details = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

const ERROR_CODES = {
  LOGIN_EXPIRED: 'LOGIN_EXPIRED',
  SYSTEM_BUSY: 'SYSTEM_BUSY',
  MODULE_NOT_FOUND: 'MODULE_NOT_FOUND',
  TASK_FAILED: 'TASK_FAILED',
  CONFIG_INVALID: 'CONFIG_INVALID',
  NETWORK_ERROR: 'NETWORK_ERROR',
  REQUEST_TIMEOUT: 'REQUEST_TIMEOUT',
  PARSE_ERROR: 'PARSE_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

class ErrorHandler {
  handle(error, context = {}) {
    const errorInfo = {
      message: '',
      code: '',
      details: {},
      stack: null,
    };

    if (error instanceof AppError) {
      errorInfo.message = error.message;
      errorInfo.code = error.code;
      errorInfo.details = error.details;
    } else if (error instanceof Error) {
      errorInfo.message = error.message;
      errorInfo.code = ERROR_CODES.UNKNOWN_ERROR;
      errorInfo.details = { ...context };
      errorInfo.stack = error.stack;
    } else {
      errorInfo.message = String(error);
      errorInfo.code = ERROR_CODES.UNKNOWN_ERROR;
    }

    console.error(`[错误][${errorInfo.code}] ${errorInfo.message}`, context);

    return {
      success: false,
      error: errorInfo.message,
      code: errorInfo.code,
      details: errorInfo.details,
    };
  }

  fail(error, message = null, code = null) {
    if (error instanceof AppError) {
      return { success: false, error: error.message, code: error.code, details: error.details };
    }
    return {
      success: false,
      error: message || (error instanceof Error ? error.message : String(error)),
      code: code || ERROR_CODES.UNKNOWN_ERROR,
    };
  }

  static loginExpired(message = '登录已过期，请重新扫码登录') {
    return new AppError(message, ERROR_CODES.LOGIN_EXPIRED);
  }

  static systemBusy(message = '系统繁忙，请稍后再试') {
    return new AppError(message, ERROR_CODES.SYSTEM_BUSY);
  }

  static moduleNotFound(id) {
    return new AppError(`模块 ${id} 不存在`, ERROR_CODES.MODULE_NOT_FOUND, { moduleId: id });
  }

  static networkError(message, details = {}) {
    return new AppError(message, ERROR_CODES.NETWORK_ERROR, details);
  }

  static requestTimeout(ms, details = {}) {
    return new AppError(`请求超时 (${ms}ms)`, ERROR_CODES.REQUEST_TIMEOUT, details);
  }

  static validationError(message, details = {}) {
    return new AppError(message, ERROR_CODES.VALIDATION_ERROR, details);
  }

  static taskFailed(message, details = {}) {
    return new AppError(message, ERROR_CODES.TASK_FAILED, details);
  }
}

module.exports = { AppError, ErrorHandler, ERROR_CODES };
