import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// These modules contain no JSX or native imports. A data URL loads them as
// ESM without changing the Expo application's module/package conventions.
const load = async (name) => {
  const source = await readFile(new URL(`../src/lib/${name}.js`, import.meta.url), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
};

test('Nepal slots have the same hours regardless of the host time zone', async () => {
  const { nepalDate, nepalParts, formatRange } = await load('nepalTime');
  const start = nepalDate(2026, 10, 6, 10);
  const end = nepalDate(2026, 10, 6, 12);
  assert.equal(start.toISOString(), '2026-11-06T04:15:00.000Z');
  assert.equal(nepalParts(start).hour, 10);
  assert.equal(formatRange(start, end), '10 am–12 pm');
});

test('requests timeout, respect caller cancellation and recover on the next request', async () => {
  const { fetchWithTimeout } = await load('request');
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = (_input, { signal }) => new Promise((_resolve, reject) => {
      if (signal.aborted) return reject(new Error('aborted'));
      signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    });
    await assert.rejects(fetchWithTimeout('https://example.invalid', {}, 10), /aborted/);
    const controller = new AbortController();
    const pending = fetchWithTimeout('https://example.invalid', { signal: controller.signal }, 1000);
    controller.abort();
    await assert.rejects(pending, /aborted/);
    globalThis.fetch = async () => ({ ok: true });
    assert.equal((await fetchWithTimeout('https://example.invalid')).ok, true);
  } finally {
    globalThis.fetch = realFetch;
  }
});
