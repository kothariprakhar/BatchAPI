import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateAssertion, normalizeAssertionRule } from '../../src/lib/assertions';

test('normalizeAssertionRule accepts valid contains rule', () => {
    const normalized = normalizeAssertionRule({ type: 'contains', value: '  must include  ' });
    assert.deepEqual(normalized, { type: 'contains', value: 'must include' });
});

test('normalizeAssertionRule rejects invalid or empty rules', () => {
    assert.equal(normalizeAssertionRule(null), null);
    assert.equal(normalizeAssertionRule({ type: 'contains', value: '   ' }), null);
    assert.equal(
        normalizeAssertionRule({ type: 'something_else' as 'contains', value: 'x' }),
        null
    );
});

test('evaluateAssertion handles missing configuration', () => {
    const result = evaluateAssertion('output', null);
    assert.deepEqual(result, {
        configured: false,
        passed: null,
        reason: 'No assertion configured',
    });
});

test('evaluateAssertion passes/fails contains checks', () => {
    const pass = evaluateAssertion('hello world', { type: 'contains', value: 'world' });
    assert.equal(pass.configured, true);
    assert.equal(pass.passed, true);

    const fail = evaluateAssertion('hello world', { type: 'contains', value: 'planet' });
    assert.equal(fail.configured, true);
    assert.equal(fail.passed, false);
    assert.match(fail.reason, /Missing required text/);
});

test('evaluateAssertion passes/fails not_contains checks', () => {
    const pass = evaluateAssertion('safe output', { type: 'not_contains', value: 'forbidden' });
    assert.equal(pass.configured, true);
    assert.equal(pass.passed, true);

    const fail = evaluateAssertion('contains forbidden token', {
        type: 'not_contains',
        value: 'forbidden',
    });
    assert.equal(fail.configured, true);
    assert.equal(fail.passed, false);
    assert.match(fail.reason, /Forbidden text found/);
});

test('evaluateAssertion supports regex and invalid regex handling', () => {
    const pass = evaluateAssertion('Ticket: ABC-123', { type: 'regex', value: 'ABC-\\d+' });
    assert.equal(pass.configured, true);
    assert.equal(pass.passed, true);

    const fail = evaluateAssertion('Ticket: XYZ', { type: 'regex', value: 'ABC-\\d+' });
    assert.equal(fail.configured, true);
    assert.equal(fail.passed, false);
    assert.match(fail.reason, /Regex did not match/);

    const invalid = evaluateAssertion('anything', { type: 'regex', value: '[' });
    assert.equal(invalid.configured, true);
    assert.equal(invalid.passed, false);
    assert.match(invalid.reason, /Invalid regex/);
});
