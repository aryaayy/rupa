import { RupaError } from "@rupa/sdk";

/** Bounded single-process limits. Do not trust caller-provided forwarding headers. */
export class RateLimiter {
  private readonly entries = new Map<string, { count: number; until: number }>();
  constructor(private readonly now: () => number = Date.now, private readonly capacity = 5000) {}
  take(key: string, limit: number, windowMs: number) {
    const now = this.now();
    for (const [entry, value] of this.entries) if (value.until <= now) this.entries.delete(entry);
    let value = this.entries.get(key);
    if (!value) {
      if (this.entries.size >= this.capacity) throw new RupaError("RATE_LIMITED", "Service capacity reached. Try later.");
      value = { count: 0, until: now + windowMs }; this.entries.set(key, value);
    }
    if (value.count >= limit) throw new RupaError("RATE_LIMITED", "Request limit reached. Try later.");
    value.count++;
  }
}

export function serialQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(action: () => Promise<T>): Promise<T> => {
    const next = tail.then(action);
    tail = next.catch(() => undefined);
    return next;
  };
}
