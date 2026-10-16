/**
 * Centralized Request Queue with Concurrency Throttling, Rate Limit Detection,
 * and Exponential Backoff Retries.
 */

export interface RequestQueueOptions {
  maxConcurrent?: number;
  retryAttempts?: number;
  baseDelayMs?: number;
  rateLimitCooldownMs?: number;
}

export class RequestQueue {
  private queue: Array<{
    task: () => Promise<any>;
    resolve: (val: any) => void;
    reject: (err: any) => void;
    retriesLeft: number;
    key?: string;
  }> = [];

  private activeCount = 0;
  private maxConcurrent: number;
  private retryAttempts: number;
  private baseDelayMs: number;
  private rateLimitCooldownMs: number;
  private isCoolingDown = false;

  constructor(options: RequestQueueOptions = {}) {
    this.maxConcurrent = options.maxConcurrent ?? 12;
    this.retryAttempts = options.retryAttempts ?? 3;
    this.baseDelayMs = options.baseDelayMs ?? 200;
    this.rateLimitCooldownMs = options.rateLimitCooldownMs ?? 1000;
  }

  public enqueue<T>(task: () => Promise<T>, key?: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
        retriesLeft: this.retryAttempts,
        key,
      });
      this.processNext();
    });
  }

  private async processNext() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0 || this.isCoolingDown) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeCount++;

    try {
      const result = await item.task();
      item.resolve(result);
    } catch (err: any) {
      if (this.isRateLimitError(err) && item.retriesLeft > 0) {
        item.retriesLeft--;
        const attempt = this.retryAttempts - item.retriesLeft;
        const delay = this.baseDelayMs * Math.pow(2, attempt) + Math.random() * 200;

        console.warn(`[RequestQueue] Rate limit encountered for ${item.key || 'request'}. Retrying in ${Math.round(delay)}ms...`);

        this.isCoolingDown = true;
        setTimeout(() => {
          this.isCoolingDown = false;
          this.queue.unshift(item);
          this.processNext();
        }, Math.max(delay, this.rateLimitCooldownMs));
      } else {
        item.reject(err);
      }
    } finally {
      this.activeCount--;
      this.processNext();
    }
  }

  private isRateLimitError(error: any): boolean {
    if (!error) return false;
    const msg = String(error.message || error.code || error).toLowerCase();
    return (
      msg.includes('rate exceeded') ||
      msg.includes('rate_exceeded') ||
      msg.includes('quota exceeded') ||
      msg.includes('resource_exhausted') ||
      msg.includes('resource-exhausted') ||
      msg.includes('too many requests') ||
      msg.includes('429')
    );
  }
}

export const requestQueue = new RequestQueue({
  maxConcurrent: 12,
  retryAttempts: 3,
  baseDelayMs: 200,
  rateLimitCooldownMs: 1000,
});
