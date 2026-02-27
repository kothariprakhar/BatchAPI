"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const compare_1 = require("../../src/lib/compare");
(0, node_test_1.default)('compiles compare prompt with variables', () => {
    const compiled = (0, compare_1.buildCompiledPrompt)('Answer: {{question}}', { question: 'What is 2+2?' });
    strict_1.default.equal(compiled, 'Answer: What is 2+2?');
});
(0, node_test_1.default)('computes diff summary for different outputs', () => {
    const summary = (0, compare_1.computeDiffSummary)('hello world', 'hello there');
    strict_1.default.equal(summary.changed, true);
    strict_1.default.equal(summary.leftLength, 11);
    strict_1.default.equal(summary.rightLength, 11);
    strict_1.default.ok(summary.firstDifferenceAt >= 0);
});
(0, node_test_1.default)('flags major length and formatting shifts', () => {
    const flags = (0, compare_1.computeFlags)('- one\n- two', '{"answer":"a very long block"}'.repeat(30));
    strict_1.default.equal(flags.formattingShift, false);
    strict_1.default.equal(flags.majorLengthShift, true);
    strict_1.default.equal(flags.possibleHallucinationShift, true);
});
(0, node_test_1.default)('derives compare status from job statuses and case outcomes', () => {
    strict_1.default.equal((0, compare_1.deriveCompareSessionStatus)({
        jobStatuses: ['running', 'queued'],
        totalCases: 10,
        completedCases: 1,
        failedCases: 0,
        previousStatus: 'queued',
    }), 'running');
    strict_1.default.equal((0, compare_1.deriveCompareSessionStatus)({
        jobStatuses: ['completed', 'completed'],
        totalCases: 10,
        completedCases: 10,
        failedCases: 0,
        previousStatus: 'running',
    }), 'completed');
    strict_1.default.equal((0, compare_1.deriveCompareSessionStatus)({
        jobStatuses: ['completed', 'failed'],
        totalCases: 10,
        completedCases: 7,
        failedCases: 3,
        previousStatus: 'running',
    }), 'partial_failed');
});
