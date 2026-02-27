import test from 'node:test';
import assert from 'node:assert/strict';
import { RateLimitedQueue } from '../../src/lib/rate-limited-queue';
import { classifyError } from '../../src/lib/error-utils';

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

test('re-queues on 429 and resumes after global pause', async () => {
    const queue = new RateLimitedQueue({
        concurrency: 1,
        intervalCap: 20,
        intervalMs: 1000,
    });

    const rows = [
        { id: 'r1', state: 'pending' as 'pending' | 'completed', attempts: 0 },
        { id: 'r2', state: 'pending' as 'pending' | 'completed', attempts: 0 },
    ];

    let pauseUntil = 0;
    let rateLimitedAt = 0;
    let retryStartedAt = 0;

    const runModelCall = async (rowId: string) => {
        if (rowId === 'r1') {
            const row = rows[0];
            row.attempts += 1;
            if (row.attempts === 1) {
                throw new Error('429 Too Many Requests');
            }
        }
        await sleep(2);
    };

    while (rows.some((r) => r.state === 'pending')) {
        const row = rows.find((r) => r.state === 'pending');
        if (!row) break;

        const waitMs = pauseUntil - Date.now();
        if (waitMs > 0) {
            await sleep(waitMs);
        }

        await queue.add(async () => {
            if (row.id === 'r1' && row.attempts > 0) {
                retryStartedAt = Date.now();
            }

            try {
                await runModelCall(row.id);
                row.state = 'completed';
            } catch (error: unknown) {
                const meta = classifyError(error);
                if (meta.rateLimited) {
                    rateLimitedAt = Date.now();
                    pauseUntil = Date.now() + 120;
                    return;
                }
                throw error;
            }
        });
    }

    await queue.onIdle();

    assert.equal(rows[0].attempts, 2);
    assert.equal(rows[0].state, 'completed');
    assert.equal(rows[1].state, 'completed');
    assert.ok(rateLimitedAt > 0, 'expected a 429 pause signal');
    assert.ok(retryStartedAt - rateLimitedAt >= 100, 'expected retry to wait for pause window');
});
