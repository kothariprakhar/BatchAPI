"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const rate_policy_1 = require("../../src/lib/rate-policy");
(0, node_test_1.default)('returns policy for known flash model', () => {
    const policy = (0, rate_policy_1.getRatePolicy)('gemini-2.5-flash');
    strict_1.default.equal(policy.standardRpm, 15);
    strict_1.default.equal(policy.safetyRpm, 10);
});
(0, node_test_1.default)('returns policy for known pro model', () => {
    const policy = (0, rate_policy_1.getRatePolicy)('gemini-2.5-pro');
    strict_1.default.equal(policy.standardRpm, 2);
    strict_1.default.equal(policy.safetyRpm, 1);
});
(0, node_test_1.default)('falls back to default for unknown models', () => {
    strict_1.default.equal((0, rate_policy_1.getEffectiveRpm)('unknown-model', false), 15);
    strict_1.default.equal((0, rate_policy_1.getEffectiveRpm)('unknown-model', true), 10);
});
