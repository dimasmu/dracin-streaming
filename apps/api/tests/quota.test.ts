import { describe, expect, it } from 'vitest';
import { getNextWibMidnightIso, getWibDateString } from '@tiraiplay/shared';
import {
  checkAndConsumeEpisodeQuota,
  getActorQuotaStatus,
  type QuotaBackend,
} from '../src/lib/quota.js';

class MemoryQuotaBackend implements QuotaBackend {
  readonly vips = new Set<string>();
  readonly userUnlocks = new Map<string, Set<string>>();
  readonly guestUnlocks = new Map<string, Set<string>>();

  async hasActiveSubscription(userId: string): Promise<boolean> {
    return this.vips.has(userId);
  }

  async isUserEpisodeUnlocked(
    userId: string,
    episodeId: string,
    dateWib: string,
  ): Promise<boolean> {
    return this.userUnlocks.get(`${userId}:${dateWib}`)?.has(episodeId) ?? false;
  }

  async countUserUnlocksToday(userId: string, dateWib: string): Promise<number> {
    return this.userUnlocks.get(`${userId}:${dateWib}`)?.size ?? 0;
  }

  async recordUserUnlock(userId: string, episodeId: string, dateWib: string): Promise<void> {
    const key = `${userId}:${dateWib}`;
    const set = this.userUnlocks.get(key) ?? new Set<string>();
    set.add(episodeId);
    this.userUnlocks.set(key, set);
  }

  async getGuestUnlockedIds(guestKey: string, dateWib: string): Promise<string[]> {
    return [...(this.guestUnlocks.get(`${guestKey}:${dateWib}`) ?? [])];
  }

  async recordGuestUnlock(guestKey: string, episodeId: string, dateWib: string): Promise<void> {
    const key = `${guestKey}:${dateWib}`;
    const set = this.guestUnlocks.get(key) ?? new Set<string>();
    set.add(episodeId);
    this.guestUnlocks.set(key, set);
  }
}

describe('Daily Quota Engine (10 ep/day Free, 3 ep Guest, VIP Unlimited)', () => {
  const settings = { freeDailyLimit: 10, guestDailyLimit: 3 };

  it('computes Asia/Jakarta (WIB) date boundaries accurately', () => {
    // 2026-11-23T17:30:00Z = 2026-11-24 00:30 WIB
    const afterMidnightWib = new Date('2026-11-23T17:30:00.000Z');
    expect(getWibDateString(afterMidnightWib)).toBe('2026-11-24');
    expect(getNextWibMidnightIso(afterMidnightWib)).toBe('2026-11-25T00:00:00+07:00');
  });

  it('allows guest up to 3 unique episodes then requires login', async () => {
    const backend = new MemoryQuotaBackend();
    const actor = { userId: null, guestKey: 'guest-1' };
    const now = new Date('2026-11-23T10:00:00+07:00');

    for (let i = 1; i <= 3; i++) {
      const res = await checkAndConsumeEpisodeQuota(backend, actor, `ep-${i}`, settings, now);
      expect(res.allowed).toBe(true);
      expect(res.quota.usedToday).toBe(i);
    }

    // Re-watching ep-2 does NOT consume quota
    const rewatch = await checkAndConsumeEpisodeQuota(backend, actor, 'ep-2', settings, now);
    expect(rewatch.allowed).toBe(true);
    expect(rewatch.quota.usedToday).toBe(3);

    // 4th unique episode triggers LOGIN_REQUIRED_FOR_QUOTA
    const blocked = await checkAndConsumeEpisodeQuota(backend, actor, 'ep-4', settings, now);
    expect(blocked.allowed).toBe(false);
    if (!blocked.allowed) {
      expect(blocked.reason).toBe('LOGIN_REQUIRED_FOR_QUOTA');
    }
  });

  it('allows free user 10 unique episodes per WIB day and resets next day', async () => {
    const backend = new MemoryQuotaBackend();
    const actor = { userId: 'user-free', guestKey: 'g' };
    const day1 = new Date('2026-11-23T23:50:00+07:00');

    for (let i = 1; i <= 10; i++) {
      const res = await checkAndConsumeEpisodeQuota(backend, actor, `ep-${i}`, settings, day1);
      expect(res.allowed).toBe(true);
      expect(res.quota.remainingToday).toBe(10 - i);
    }

    // Re-watch allowed without consuming
    const rewatch = await checkAndConsumeEpisodeQuota(backend, actor, 'ep-5', settings, day1);
    expect(rewatch.allowed).toBe(true);
    expect(rewatch.quota.usedToday).toBe(10);

    // 11th episode same day blocked
    const eleventh = await checkAndConsumeEpisodeQuota(backend, actor, 'ep-11', settings, day1);
    expect(eleventh.allowed).toBe(false);
    if (!eleventh.allowed) {
      expect(eleventh.reason).toBe('QUOTA_EXCEEDED');
    }

    // Next day 00:05 WIB resets quota to 0
    const day2 = new Date('2026-11-24T00:05:00+07:00');
    const status = await getActorQuotaStatus(backend, actor, settings, day2);
    expect(status.usedToday).toBe(0);
    expect(status.remainingToday).toBe(10);

    const unlockedDay2 = await checkAndConsumeEpisodeQuota(backend, actor, 'ep-11', settings, day2);
    expect(unlockedDay2.allowed).toBe(true);
    expect(unlockedDay2.quota.usedToday).toBe(1);
  });

  it('grants unlimited episodes to VIP monthly subscribers', async () => {
    const backend = new MemoryQuotaBackend();
    backend.vips.add('user-vip');
    const actor = { userId: 'user-vip', guestKey: 'g' };

    for (let i = 1; i <= 25; i++) {
      const res = await checkAndConsumeEpisodeQuota(backend, actor, `ep-${i}`, settings);
      expect(res.allowed).toBe(true);
      expect(res.quota.tier).toBe('vip');
      expect(res.quota.unlimited).toBe(true);
    }
  });
});
