import test from 'node:test';
import assert from 'node:assert/strict';
import { RateLimitedQueue } from '../../src/lib/rate-limited-queue';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

test('enforces interval cap', async () => {
    const queue = new RateLimitedQueue({
        concurrency: 1,
        intervalCap: 2,
        intervalMs: 120,
    });

    const startTimes: number[] = [];

    const tasks = Array.from({ length: 4 }).map(() =>
        queue.add(async () => {
            startTimes.push(Date.now());
            await sleep(5);
        })
    );

    await Promise.all(tasks);
    await queue.onIdle();

    assert.equal(startTimes.length, 4);
    const gapBeforeThird = startTimes[2] - startTimes[0];
    assert.ok(
        gapBeforeThird >= 95,
        `expected third task to be delayed by interval cap, got ${gapBeforeThird}ms`
    );
});

test('enforces concurrency limit', async () => {
    const queue = new RateLimitedQueue({
        concurrency: 2,
        intervalCap: 10,
        intervalMs: 100,
    });

    let active = 0;
    let maxActive = 0;

    const tasks = Array.from({ length: 6 }).map(() =>
        queue.add(async () => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await sleep(20);
            active -= 1;
        })
    );

    await Promise.all(tasks);
    assert.ok(maxActive <= 2, `expected max active <= 2, got ${maxActive}`);
});
