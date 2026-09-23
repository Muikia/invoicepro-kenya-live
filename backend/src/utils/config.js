function publicAppUrl() {
  const url =
    process.env.FRONTEND_URL ||
    process.env.RENDER_EXTERNAL_URL ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173');
  return String(url || '').replace(/\/$/, '');
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

module.exports = {
  publicAppUrl,
  isProduction,
};
