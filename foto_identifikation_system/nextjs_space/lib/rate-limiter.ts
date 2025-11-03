// Rate Limiter - Verhindert API-Blocks

export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async checkLimit(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(ts => now - ts < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const waitTime = this.windowMs - (now - this.timestamps[0]);
      console.log(`[RateLimit] Warte ${Math.ceil(waitTime / 1000)}s`);
      await new Promise(r => setTimeout(r, waitTime));
      return this.checkLimit();
    }

    this.timestamps.push(now);
  }

  getStatus() {
    const now = Date.now();
    const recent = this.timestamps.filter(ts => now - ts < this.windowMs).length;
    return { requests: recent, max: this.maxRequests, remaining: this.maxRequests - recent };
  }
}

export const visionRateLimiter = new RateLimiter(10, 60000);