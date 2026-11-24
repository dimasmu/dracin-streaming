import { createHmac, timingSafeEqual } from 'node:crypto';
import type { VideoLang } from '@tiraiplay/shared';

export interface StreamTokenPayload {
  actorKey: string;
  episodeId: string;
  videoLang: VideoLang;
  streamUrl: string;
  subtitleUrl: string | null;
  exp: number;
}

const DEFAULT_TTL_SECONDS = 15 * 60;

function toBase64Url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

function fromBase64Url(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

function signPart(encodedPayload: string, secret: string): string {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function createStreamToken(
  data: Omit<StreamTokenPayload, 'exp'>,
  secret: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
  nowMs: number = Date.now(),
): { token: string; expiresAt: string } {
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload: StreamTokenPayload = { ...data, exp };
  const encoded = toBase64Url(JSON.stringify(payload));
  const sig = signPart(encoded, secret);
  return {
    token: `${encoded}.${sig}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function verifyStreamToken(
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): StreamTokenPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = signPart(encoded, secret);
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as StreamTokenPayload;
    if (!parsed.exp || parsed.exp < Math.floor(nowMs / 1000)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Rewrites relative segment/variant URIs inside an .m3u8 playlist to absolute
 * URLs resolved against the upstream manifest URL, preserving HLS tags.
 */
export function rewriteHlsManifest(manifestText: string, upstreamUrl: string): string {
  const base = new URL(upstreamUrl);
  return manifestText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, rawUri: string) => {
          try {
            return `URI="${new URL(rawUri, base).toString()}"`;
          } catch {
            return `URI="${rawUri}"`;
          }
        });
      }
      try {
        return new URL(trimmed, base).toString();
      } catch {
        return line;
      }
    })
    .join('\n');
}
