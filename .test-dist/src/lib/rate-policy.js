"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRatePolicy = getRatePolicy;
exports.getEffectiveRpm = getEffectiveRpm;
const DEFAULT_POLICY = {
    standardRpm: 15,
    safetyRpm: 10,
};
const MODEL_RATE_POLICIES = {
    'gemini-2.5-flash': {
        standardRpm: 15,
        safetyRpm: 10,
    },
    'gemini-2.5-pro': {
        standardRpm: 2,
        safetyRpm: 1,
    },
};
function getRatePolicy(model) {
    return MODEL_RATE_POLICIES[model] ?? DEFAULT_POLICY;
}
function getEffectiveRpm(model, safetyMode) {
    const policy = getRatePolicy(model);
    return safetyMode ? policy.safetyRpm : policy.standardRpm;
}
