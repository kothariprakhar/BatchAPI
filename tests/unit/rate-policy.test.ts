import test from 'node:test';
import assert from 'node:assert/strict';
import { getEffectiveRpm, getRatePolicy } from '../../src/lib/rate-policy';

test('returns policy for known flash model', () => {
    const policy = getRatePolicy('gemini-2.5-flash');
    assert.equal(policy.standardRpm, 15);
    assert.equal(policy.safetyRpm, 10);
});

test('returns policy for known pro model', () => {
    const policy = getRatePolicy('gemini-2.5-pro');
    assert.equal(policy.standardRpm, 2);
    assert.equal(policy.safetyRpm, 1);
});

test('falls back to default for unknown models', () => {
    assert.equal(getEffectiveRpm('unknown-model', false), 15);
    assert.equal(getEffectiveRpm('unknown-model', true), 10);
});
