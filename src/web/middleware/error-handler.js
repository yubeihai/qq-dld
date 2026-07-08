function errorHandler(err, req, res, next) {
  console.error(`[API错误] ${req.method} ${req.url}:`, err.message);

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  res.status(statusCode).json({
    success: false,
    error: err.message || '服务器内部错误',
    code,
  });
}

function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    error: '接口不存在',
    code: 'NOT_FOUND',
  });
}

function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { errorHandler, notFoundHandler, asyncHandler };
