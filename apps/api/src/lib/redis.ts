import Redis from 'ioredis';

export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  sadd(key: string, member: string, ttlSeconds?: number): Promise<void>;
  smembers(key: string): Promise<string[]>;
  scard(key: string): Promise<number>;
  sismember(key: string, member: string): Promise<boolean>;
  incrWithTtl(key: string, ttlSeconds: number): Promise<number>;
}

export class MemoryKeyValueStore implements KeyValueStore {
  private readonly strings = new Map<string, { value: string; expiresAt?: number }>();
  private readonly sets = new Map<string, { items: Set<string>; expiresAt?: number }>();

  private isExpired(expiresAt?: number): boolean {
    return expiresAt !== undefined && Date.now() > expiresAt;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.strings.get(key);
    if (!entry) return null;
    if (this.isExpired(entry.expiresAt)) {
      this.strings.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.strings.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  private getOrCreateSet(key: string, ttlSeconds?: number): Set<string> {
    const existing = this.sets.get(key);
    if (existing && !this.isExpired(existing.expiresAt)) {
      return existing.items;
    }
    const items = new Set<string>();
    this.sets.set(key, {
      items,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
    return items;
  }

  async sadd(key: string, member: string, ttlSeconds?: number): Promise<void> {
    this.getOrCreateSet(key, ttlSeconds).add(member);
  }

  async smembers(key: string): Promise<string[]> {
    const existing = this.sets.get(key);
    if (!existing || this.isExpired(existing.expiresAt)) return [];
    return [...existing.items];
  }

  async scard(key: string): Promise<number> {
    const existing = this.sets.get(key);
    if (!existing || this.isExpired(existing.expiresAt)) return 0;
    return existing.items.size;
  }

  async sismember(key: string, member: string): Promise<boolean> {
    const existing = this.sets.get(key);
    if (!existing || this.isExpired(existing.expiresAt)) return false;
    return existing.items.has(member);
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const cur = Number((await this.get(key)) ?? '0') + 1;
    await this.set(key, String(cur), ttlSeconds);
    return cur;
  }
}

export class RedisKeyValueStore implements KeyValueStore {
  constructor(private readonly redis: Redis) {}

  async get(key: string): Promise<string | null> {
    return this.redis.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.redis.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.redis.set(key, value);
    }
  }

  async sadd(key: string, member: string, ttlSeconds?: number): Promise<void> {
    await this.redis.sadd(key, member);
    if (ttlSeconds) {
      const ttl = await this.redis.ttl(key);
      if (ttl < 0) await this.redis.expire(key, ttlSeconds);
    }
  }

  async smembers(key: string): Promise<string[]> {
    return this.redis.smembers(key);
  }

  async scard(key: string): Promise<number> {
    return this.redis.scard(key);
  }

  async sismember(key: string, member: string): Promise<boolean> {
    return (await this.redis.sismember(key, member)) === 1;
  }

  async incrWithTtl(key: string, ttlSeconds: number): Promise<number> {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, ttlSeconds);
    return count;
  }
}

export function createKeyValueStore(redisUrl?: string): KeyValueStore {
  if (!redisUrl) return new MemoryKeyValueStore();
  const client = new Redis(redisUrl, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
  });
  return new RedisKeyValueStore(client);
}
