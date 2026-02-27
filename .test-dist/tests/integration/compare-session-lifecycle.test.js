"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const compare_1 = require("../../src/lib/compare");
(0, node_test_1.default)('compare status lifecycle transitions', () => {
    const queued = (0, compare_1.deriveCompareSessionStatus)({
        jobStatuses: ['queued', 'queued'],
        totalCases: 20,
        completedCases: 0,
        failedCases: 0,
        previousStatus: 'queued',
    });
    strict_1.default.equal(queued, 'queued');
    const running = (0, compare_1.deriveCompareSessionStatus)({
        jobStatuses: ['running', 'queued'],
        totalCases: 20,
        completedCases: 2,
        failedCases: 0,
        previousStatus: queued,
    });
    strict_1.default.equal(running, 'running');
    const partialFailed = (0, compare_1.deriveCompareSessionStatus)({
        jobStatuses: ['completed', 'failed'],
        totalCases: 20,
        completedCases: 15,
        failedCases: 5,
        previousStatus: running,
    });
    strict_1.default.equal(partialFailed, 'partial_failed');
    const cancelled = (0, compare_1.deriveCompareSessionStatus)({
        jobStatuses: ['cancelled', 'completed'],
        totalCases: 20,
        completedCases: 15,
        failedCases: 5,
        previousStatus: running,
    });
    strict_1.default.equal(cancelled, 'cancelled');
});
