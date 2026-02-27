"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const rate_limited_queue_1 = require("../../src/lib/rate-limited-queue");
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
(0, node_test_1.default)('enforces interval cap', async () => {
    const queue = new rate_limited_queue_1.RateLimitedQueue({
        concurrency: 1,
        intervalCap: 2,
        intervalMs: 120,
    });
    const startTimes = [];
    const tasks = Array.from({ length: 4 }).map(() => queue.add(async () => {
        startTimes.push(Date.now());
        await sleep(5);
    }));
    await Promise.all(tasks);
    await queue.onIdle();
    strict_1.default.equal(startTimes.length, 4);
    const gapBeforeThird = startTimes[2] - startTimes[0];
    strict_1.default.ok(gapBeforeThird >= 95, `expected third task to be delayed by interval cap, got ${gapBeforeThird}ms`);
});
(0, node_test_1.default)('enforces concurrency limit', async () => {
    const queue = new rate_limited_queue_1.RateLimitedQueue({
        concurrency: 2,
        intervalCap: 10,
        intervalMs: 100,
    });
    let active = 0;
    let maxActive = 0;
    const tasks = Array.from({ length: 6 }).map(() => queue.add(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await sleep(20);
        active -= 1;
    }));
    await Promise.all(tasks);
    strict_1.default.ok(maxActive <= 2, `expected max active <= 2, got ${maxActive}`);
});
