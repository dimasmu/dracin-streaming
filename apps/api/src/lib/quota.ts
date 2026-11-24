import {
  and,
  count,
  dailyEpisodeUnlocks,
  eq,
  gt,
  userSubscriptions,
  type Database,
} from '@tiraiplay/db';
import { getNextWibMidnightIso, getWibDateString, type QuotaInfo } from '@tiraiplay/shared';
import type { KeyValueStore } from './redis.js';

export type QuotaCheckResult =
  | { allowed: true; quota: QuotaInfo }
  | { allowed: false; reason: 'LOGIN_REQUIRED_FOR_QUOTA' | 'QUOTA_EXCEEDED'; quota: QuotaInfo };

export interface QuotaActor {
  userId: string | null;
  guestKey: string;
}

export interface QuotaSettings {
  freeDailyLimit: number;
  guestDailyLimit: number;
}

export interface QuotaBackend {
  hasActiveSubscription(userId: string, now: Date): Promise<boolean>;
  isUserEpisodeUnlocked(userId: string, episodeId: string, dateWib: string): Promise<boolean>;
  countUserUnlocksToday(userId: string, dateWib: string): Promise<number>;
  recordUserUnlock(userId: string, episodeId: string, dateWib: string): Promise<void>;
  getGuestUnlockedIds(guestKey: string, dateWib: string): Promise<string[]>;
  recordGuestUnlock(guestKey: string, episodeId: string, dateWib: string): Promise<void>;
}

export class DbQuotaBackend implements QuotaBackend {
  constructor(
    private readonly db: Database,
    private readonly kv: KeyValueStore,
  ) {}

  async hasActiveSubscription(userId: string, now: Date): Promise<boolean> {
    const rows = await this.db
      .select({ id: userSubscriptions.id })
      .from(userSubscriptions)
      .where(
        and(
          eq(userSubscriptions.userId, userId),
          eq(userSubscriptions.status, 'active'),
          gt(userSubscriptions.expiresAt, now),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async isUserEpisodeUnlocked(userId: string, episodeId: string, dateWib: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: dailyEpisodeUnlocks.id })
      .from(dailyEpisodeUnlocks)
      .where(
        and(
          eq(dailyEpisodeUnlocks.userId, userId),
          eq(dailyEpisodeUnlocks.episodeId, episodeId),
          eq(dailyEpisodeUnlocks.unlockDateWib, dateWib),
        ),
      )
      .limit(1);
    return rows.length > 0;
  }

  async countUserUnlocksToday(userId: string, dateWib: string): Promise<number> {
    const [row] = await this.db
      .select({ total: count() })
      .from(dailyEpisodeUnlocks)
      .where(
        and(
          eq(dailyEpisodeUnlocks.userId, userId),
          eq(dailyEpisodeUnlocks.unlockDateWib, dateWib),
        ),
      );
    return Number(row?.total ?? 0);
  }

  async recordUserUnlock(userId: string, episodeId: string, dateWib: string): Promise<void> {
    await this.db
      .insert(dailyEpisodeUnlocks)
      .values({ userId, episodeId, unlockDateWib: dateWib })
      .onConflictDoNothing();
  }

  async getGuestUnlockedIds(guestKey: string, dateWib: string): Promise<string[]> {
    return this.kv.smembers(`guest_quota:${dateWib}:${guestKey}`);
  }

  async recordGuestUnlock(guestKey: string, episodeId: string, dateWib: string): Promise<void> {
    // 26 hours TTL covers WIB day boundary cleanly
    await this.kv.sadd(`guest_quota:${dateWib}:${guestKey}`, episodeId, 26 * 3600);
  }
}

export async function getActorQuotaStatus(
  backend: QuotaBackend,
  actor: QuotaActor,
  settings: QuotaSettings,
  now: Date = new Date(),
): Promise<QuotaInfo> {
  const dateWib = getWibDateString(now);
  const resetAtWib = getNextWibMidnightIso(now);

  if (actor.userId) {
    const isVip = await backend.hasActiveSubscription(actor.userId, now);
    if (isVip) {
      return {
        tier: 'vip',
        unlimited: true,
        usedToday: 0,
        dailyLimit: null,
        remainingToday: null,
        resetAtWib,
      };
    }
    const usedToday = await backend.countUserUnlocksToday(actor.userId, dateWib);
    return {
      tier: 'free',
      unlimited: false,
      usedToday,
      dailyLimit: settings.freeDailyLimit,
      remainingToday: Math.max(0, settings.freeDailyLimit - usedToday),
      resetAtWib,
    };
  }

  const guestUnlocked = await backend.getGuestUnlockedIds(actor.guestKey, dateWib);
  return {
    tier: 'guest',
    unlimited: false,
    usedToday: guestUnlocked.length,
    dailyLimit: settings.guestDailyLimit,
    remainingToday: Math.max(0, settings.guestDailyLimit - guestUnlocked.length),
    resetAtWib,
  };
}

export async function checkAndConsumeEpisodeQuota(
  backend: QuotaBackend,
  actor: QuotaActor,
  episodeId: string,
  settings: QuotaSettings,
  now: Date = new Date(),
): Promise<QuotaCheckResult> {
  const dateWib = getWibDateString(now);
  const resetAtWib = getNextWibMidnightIso(now);

  // 1. Logged-in user: VIP unlimited or Free 10 ep/day
  if (actor.userId) {
    if (await backend.hasActiveSubscription(actor.userId, now)) {
      return {
        allowed: true,
        quota: {
          tier: 'vip',
          unlimited: true,
          usedToday: 0,
          dailyLimit: null,
          remainingToday: null,
          resetAtWib,
        },
      };
    }

    const alreadyUnlocked = await backend.isUserEpisodeUnlocked(actor.userId, episodeId, dateWib);
    const usedBefore = await backend.countUserUnlocksToday(actor.userId, dateWib);

    if (alreadyUnlocked) {
      return {
        allowed: true,
        quota: {
          tier: 'free',
          unlimited: false,
          usedToday: usedBefore,
          dailyLimit: settings.freeDailyLimit,
          remainingToday: Math.max(0, settings.freeDailyLimit - usedBefore),
          resetAtWib,
        },
      };
    }

    if (usedBefore >= settings.freeDailyLimit) {
      return {
        allowed: false,
        reason: 'QUOTA_EXCEEDED',
        quota: {
          tier: 'free',
          unlimited: false,
          usedToday: usedBefore,
          dailyLimit: settings.freeDailyLimit,
          remainingToday: 0,
          resetAtWib,
        },
      };
    }

    await backend.recordUserUnlock(actor.userId, episodeId, dateWib);
    const usedAfter = usedBefore + 1;
    return {
      allowed: true,
      quota: {
        tier: 'free',
        unlimited: false,
        usedToday: usedAfter,
        dailyLimit: settings.freeDailyLimit,
        remainingToday: Math.max(0, settings.freeDailyLimit - usedAfter),
        resetAtWib,
      },
    };
  }

  // 2. Guest: up to 3 unique episodes/day via signed cookie + IP
  const guestIds = await backend.getGuestUnlockedIds(actor.guestKey, dateWib);
  if (guestIds.includes(episodeId)) {
    return {
      allowed: true,
      quota: {
        tier: 'guest',
        unlimited: false,
        usedToday: guestIds.length,
        dailyLimit: settings.guestDailyLimit,
        remainingToday: Math.max(0, settings.guestDailyLimit - guestIds.length),
        resetAtWib,
      },
    };
  }

  if (guestIds.length >= settings.guestDailyLimit) {
    return {
      allowed: false,
      reason: 'LOGIN_REQUIRED_FOR_QUOTA',
      quota: {
        tier: 'guest',
        unlimited: false,
        usedToday: guestIds.length,
        dailyLimit: settings.guestDailyLimit,
        remainingToday: 0,
        resetAtWib,
      },
    };
  }

  await backend.recordGuestUnlock(actor.guestKey, episodeId, dateWib);
  const usedAfter = guestIds.length + 1;
  return {
    allowed: true,
    quota: {
      tier: 'guest',
      unlimited: false,
      usedToday: usedAfter,
      dailyLimit: settings.guestDailyLimit,
      remainingToday: Math.max(0, settings.guestDailyLimit - usedAfter),
      resetAtWib,
    },
  };
}
