"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const error_utils_1 = require("../../src/lib/error-utils");
(0, node_test_1.default)('classifies 429 as rate limit and retryable', () => {
    const meta = (0, error_utils_1.classifyError)(new Error('Request failed with status 429'));
    strict_1.default.equal(meta.rateLimited, true);
    strict_1.default.equal(meta.retryable, true);
    strict_1.default.equal(meta.errorType, 'rate_limit');
});
(0, node_test_1.default)('classifies 503 as retryable server error', () => {
    const meta = (0, error_utils_1.classifyError)({ message: '503 unavailable', status: 503 });
    strict_1.default.equal(meta.rateLimited, false);
    strict_1.default.equal(meta.retryable, true);
    strict_1.default.equal(meta.errorType, 'server_error');
    strict_1.default.equal(meta.statusCode, 503);
});
(0, node_test_1.default)('classifies 400 as non-retryable client error', () => {
    const meta = (0, error_utils_1.classifyError)({ message: 'Bad request', status: 400 });
    strict_1.default.equal(meta.retryable, false);
    strict_1.default.equal(meta.errorType, 'client_error');
    strict_1.default.equal(meta.statusCode, 400);
});
