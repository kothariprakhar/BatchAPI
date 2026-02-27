import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCompiledPrompt,
    computeDiffSummary,
    computeFlags,
    deriveCompareSessionStatus,
} from '../../src/lib/compare';

test('compiles compare prompt with variables', () => {
    const compiled = buildCompiledPrompt('Answer: {{question}}', { question: 'What is 2+2?' });
    assert.equal(compiled, 'Answer: What is 2+2?');
});

test('computes diff summary for different outputs', () => {
    const summary = computeDiffSummary('hello world', 'hello there');
    assert.equal(summary.changed, true);
    assert.equal(summary.leftLength, 11);
    assert.equal(summary.rightLength, 11);
    assert.ok(summary.firstDifferenceAt >= 0);
});

test('flags major length and formatting shifts', () => {
    const flags = computeFlags('- one\n- two', '{"answer":"a very long block"}'.repeat(30));
    assert.equal(flags.formattingShift, false);
    assert.equal(flags.majorLengthShift, true);
    assert.equal(flags.possibleHallucinationShift, true);
});

test('derives compare status from job statuses and case outcomes', () => {
    assert.equal(
        deriveCompareSessionStatus({
            jobStatuses: ['running', 'queued'],
            totalCases: 10,
            completedCases: 1,
            failedCases: 0,
            previousStatus: 'queued',
        }),
        'running'
    );

    assert.equal(
        deriveCompareSessionStatus({
            jobStatuses: ['completed', 'completed'],
            totalCases: 10,
            completedCases: 10,
            failedCases: 0,
            previousStatus: 'running',
        }),
        'completed'
    );

    assert.equal(
        deriveCompareSessionStatus({
            jobStatuses: ['completed', 'failed'],
            totalCases: 10,
            completedCases: 7,
            failedCases: 3,
            previousStatus: 'running',
        }),
        'partial_failed'
    );
});
