import { describe, expect, it } from 'vitest';
import {
  createStreamToken,
  rewriteHlsManifest,
  verifyStreamToken,
} from '../src/lib/stream-token.js';

describe('Stream Token & HLS Manifest Rewriter', () => {
  const secret = 'test-secret-key-at-least-16-chars';

  it('signs and verifies stream token within TTL', () => {
    const now = 1_700_000_000_000;
    const { token } = createStreamToken(
      {
        actorKey: 'user-1',
        episodeId: 'ep-uuid',
        videoLang: 'id',
        streamUrl: 'https://cdn.example.com/v1/master.m3u8',
        subtitleUrl: 'https://cdn.example.com/v1/id.vtt',
      },
      secret,
      900,
      now,
    );

    const verified = verifyStreamToken(token, secret, now + 60_000);
    expect(verified?.actorKey).toBe('user-1');
    expect(verified?.streamUrl).toBe('https://cdn.example.com/v1/master.m3u8');

    // Expired
    expect(verifyStreamToken(token, secret, now + 905_000)).toBeNull();

    // Tampered
    expect(verifyStreamToken(`${token}x`, secret, now + 1_000)).toBeNull();
  });

  it('rewrites relative HLS segments & key URIs to absolute upstream CDN URLs', () => {
    const manifest = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-KEY:METHOD=AES-128,URI="enc.key"',
      '#EXTINF:4.0,',
      'seg-001.ts',
      '#EXTINF:4.0,',
      '../shared/seg-002.ts',
    ].join('\n');

    const rewritten = rewriteHlsManifest(
      manifest,
      'https://cdn.tiraiplay.example/dramas/d1/ep1/index.m3u8',
    );

    expect(rewritten).toContain('URI="https://cdn.tiraiplay.example/dramas/d1/ep1/enc.key"');
    expect(rewritten).toContain('https://cdn.tiraiplay.example/dramas/d1/ep1/seg-001.ts');
    expect(rewritten).toContain('https://cdn.tiraiplay.example/dramas/d1/shared/seg-002.ts');
  });
});
