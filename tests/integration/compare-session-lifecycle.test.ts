import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveCompareSessionStatus } from '../../src/lib/compare';

test('compare status lifecycle transitions', () => {
    const queued = deriveCompareSessionStatus({
        jobStatuses: ['queued', 'queued'],
        totalCases: 20,
        completedCases: 0,
        failedCases: 0,
        previousStatus: 'queued',
    });
    assert.equal(queued, 'queued');

    const running = deriveCompareSessionStatus({
        jobStatuses: ['running', 'queued'],
        totalCases: 20,
        completedCases: 2,
        failedCases: 0,
        previousStatus: queued,
    });
    assert.equal(running, 'running');

    const partialFailed = deriveCompareSessionStatus({
        jobStatuses: ['completed', 'failed'],
        totalCases: 20,
        completedCases: 15,
        failedCases: 5,
        previousStatus: running,
    });
    assert.equal(partialFailed, 'partial_failed');

    const cancelled = deriveCompareSessionStatus({
        jobStatuses: ['cancelled', 'completed'],
        totalCases: 20,
        completedCases: 15,
        failedCases: 5,
        previousStatus: running,
    });
    assert.equal(cancelled, 'cancelled');
});
