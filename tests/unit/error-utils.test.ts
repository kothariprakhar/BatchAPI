import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyError } from '../../src/lib/error-utils';

test('classifies 429 as rate limit and retryable', () => {
    const meta = classifyError(new Error('Request failed with status 429'));
    assert.equal(meta.rateLimited, true);
    assert.equal(meta.retryable, true);
    assert.equal(meta.errorType, 'rate_limit');
});

test('classifies 503 as retryable server error', () => {
    const meta = classifyError({ message: '503 unavailable', status: 503 });
    assert.equal(meta.rateLimited, false);
    assert.equal(meta.retryable, true);
    assert.equal(meta.errorType, 'server_error');
    assert.equal(meta.statusCode, 503);
});

test('classifies 400 as non-retryable client error', () => {
    const meta = classifyError({ message: 'Bad request', status: 400 });
    assert.equal(meta.retryable, false);
    assert.equal(meta.errorType, 'client_error');
    assert.equal(meta.statusCode, 400);
});
