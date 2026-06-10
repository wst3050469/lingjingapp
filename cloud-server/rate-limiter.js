const rateLimitStores = new Map();

export function createRateLimiter(options = {}) {
  const {
    windowMs = 15 * 60 * 1000,
    maxAttempts = 5,
    keyGenerator = (req) => req.ip || req.connection?.remoteAddress || 'unknown',
    message = 'Too many attempts, please try again later',
  } = options;

  const storeKey = `${windowMs}-${maxAttempts}-${Math.random().toString(36).slice(2, 8)}`;
  rateLimitStores.set(storeKey, new Map());

  const cleanupInterval = setInterval(() => {
    const store = rateLimitStores.get(storeKey);
    if (!store) return;
    const now = Date.now();
    for (const [key, timestamps] of store) {
      const filtered = timestamps.filter(t => now - t < windowMs);
      if (filtered.length === 0) {
        store.delete(key);
      } else {
        store.set(key, filtered);
      }
    }
  }, 60 * 1000);
  cleanupInterval.unref();

  return function rateLimitMiddleware(req, res, next) {
    const store = rateLimitStores.get(storeKey);
    if (!store) return next();

    const key = keyGenerator(req);
    const now = Date.now();

    let timestamps = store.get(key) || [];
    timestamps = timestamps.filter(t => now - t < windowMs);

    if (timestamps.length >= maxAttempts) {
      return res.status(429).json({
        error: 'too_many_attempts',
        message,
        retryAfter: Math.ceil((timestamps[0] + windowMs - now) / 1000),
      });
    }

    timestamps.push(now);
    store.set(key, timestamps);
    next();
  };
}