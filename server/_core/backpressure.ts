/**
 * Backpressure / Concurrency Limiter Middleware
 *
 * Protects heavy endpoints from overload by capping the number of
 * in-flight requests.  When the limit is reached new requests get
 * a 503 so clients can retry after a short delay.
 *
 * Usage:
 *   import { concurrencyLimiter } from './_core/backpressure';
 *   app.use('/api/heavy', concurrencyLimiter(20));
 */

import type { Request, Response, NextFunction } from 'express';

export function concurrencyLimiter(maxConcurrent: number) {
  let active = 0;

  return (req: Request, res: Response, next: NextFunction) => {
    if (active >= maxConcurrent) {
      res.status(503).json({ error: 'Server busy, try again shortly' });
      return;
    }

    active++;

    const decrement = () => {
      active--;
    };

    // Decrement when the response finishes (success or error)
    res.on('finish', decrement);
    res.on('close', decrement);

    // Guard against double-decrement: once one fires, remove the other
    let decremented = false;
    const safeDecrement = () => {
      if (!decremented) {
        decremented = true;
        active--;
      }
    };

    // Replace the simple decrement with the safe version
    res.removeListener('finish', decrement);
    res.removeListener('close', decrement);
    res.on('finish', safeDecrement);
    res.on('close', safeDecrement);

    next();
  };
}
