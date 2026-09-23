const TIER_RANK = { free: 0, basic: 1, pro: 2 };

const FEATURE_MIN_TIER = {
  vat: 'basic',
  inventory: 'basic',
  receipts_share: 'basic',
  top_products: 'basic',
};

function normalizeTier(tier) {
  const value = String(tier || 'free').toLowerCase();
  return TIER_RANK[value] !== undefined ? value : 'free';
}

function hasFeature(user, feature) {
  const required = FEATURE_MIN_TIER[feature] || 'pro';
  return TIER_RANK[normalizeTier(user?.subscription_tier)] >= TIER_RANK[required];
}

function upgradeError(message) {
  const error = new Error(message || 'Upgrade to Basic (KSh 500/month) to unlock this feature');
  error.status = 403;
  error.code = 'UPGRADE_REQUIRED';
  return error;
}

module.exports = {
  TIER_RANK,
  normalizeTier,
  hasFeature,
  upgradeError,
};
