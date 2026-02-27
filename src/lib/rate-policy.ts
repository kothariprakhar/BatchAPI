export interface RatePolicy {
    standardRpm: number;
    safetyRpm: number;
}

const DEFAULT_POLICY: RatePolicy = {
    standardRpm: 15,
    safetyRpm: 10,
};

const MODEL_RATE_POLICIES: Record<string, RatePolicy> = {
    'gemini-1.5-flash': {
        standardRpm: 15,
        safetyRpm: 10,
    },
    'gemini-1.5-pro': {
        standardRpm: 2,
        safetyRpm: 1,
    },
};

export function getRatePolicy(model: string): RatePolicy {
    return MODEL_RATE_POLICIES[model] ?? DEFAULT_POLICY;
}

export function getEffectiveRpm(model: string, safetyMode: boolean): number {
    const policy = getRatePolicy(model);
    return safetyMode ? policy.safetyRpm : policy.standardRpm;
}
