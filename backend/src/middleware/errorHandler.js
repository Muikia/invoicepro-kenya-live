function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = err.status || err.statusCode || 500;
  const message =
    status >= 500
      ? 'Something went wrong. Please try again.'
      : err.message || 'Request failed';

  if (status >= 500) {
    console.error(err);
  }

  return res.status(status).json({
    error: message,
    code: err.code || undefined,
  });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Not found' });
}

module.exports = {
  errorHandler,
  notFound,
};
