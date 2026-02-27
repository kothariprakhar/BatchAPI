"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const rate_limited_queue_1 = require("../../src/lib/rate-limited-queue");
const error_utils_1 = require("../../src/lib/error-utils");
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
(0, node_test_1.default)('re-queues on 429 and resumes after global pause', async () => {
    const queue = new rate_limited_queue_1.RateLimitedQueue({
        concurrency: 1,
        intervalCap: 20,
        intervalMs: 1000,
    });
    const rows = [
        { id: 'r1', state: 'pending', attempts: 0 },
        { id: 'r2', state: 'pending', attempts: 0 },
    ];
    let pauseUntil = 0;
    let rateLimitedAt = 0;
    let retryStartedAt = 0;
    const runModelCall = async (rowId) => {
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
        if (!row)
            break;
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
            }
            catch (error) {
                const meta = (0, error_utils_1.classifyError)(error);
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
    strict_1.default.equal(rows[0].attempts, 2);
    strict_1.default.equal(rows[0].state, 'completed');
    strict_1.default.equal(rows[1].state, 'completed');
    strict_1.default.ok(rateLimitedAt > 0, 'expected a 429 pause signal');
    strict_1.default.ok(retryStartedAt - rateLimitedAt >= 100, 'expected retry to wait for pause window');
});
