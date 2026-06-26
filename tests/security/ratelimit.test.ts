import { describe, it, expect, beforeEach } from 'vitest';
import { checkRate, _resetRateLimit } from '@/lib/security/ratelimit';

describe('checkRate', () => {
  beforeEach(() => _resetRateLimit());

  it('permite hasta max y bloquea el siguiente', async () => {
    const ip = '1.2.3.4';
    for (let i = 0; i < 5; i++) expect(await checkRate(ip, 'contact', 5, 60_000)).toBe(true);
    expect(await checkRate(ip, 'contact', 5, 60_000)).toBe(false); // 6º bloqueado
  });

  it('aísla por IP', async () => {
    expect(await checkRate('a', 'contact', 1, 60_000)).toBe(true);
    expect(await checkRate('a', 'contact', 1, 60_000)).toBe(false);
    expect(await checkRate('b', 'contact', 1, 60_000)).toBe(true); // otra IP, contador propio
  });

  it('aísla por key', async () => {
    expect(await checkRate('a', 'contact', 1, 60_000)).toBe(true);
    expect(await checkRate('a', 'newsletter', 1, 60_000)).toBe(true); // distinta key
  });
});
