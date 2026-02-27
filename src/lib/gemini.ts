import { GoogleGenerativeAI, GenerateContentResult } from '@google/generative-ai';

const API_KEY_STORAGE_KEY = 'gemini-bench-api-key';

export function getStoredApiKey(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setStoredApiKey(key: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function clearStoredApiKey(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        await model.generateContent('Say "ok"');
        return { valid: true };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        if (message.includes('API_KEY_INVALID') || message.includes('401')) {
            return { valid: false, error: 'Invalid API key. Please check and try again.' };
        }
        return { valid: false, error: `Validation failed: ${message}` };
    }
}

export interface GenerateOptions {
    apiKey: string;
    model?: string;
    systemPrompt?: string;
    userPrompt: string;
    temperature?: number;
    maxOutputTokens?: number;
}

export interface GenerateResult {
    output: string;
    tokenUsage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
    };
    latencyMs: number;
}

export async function generateContent(options: GenerateOptions): Promise<GenerateResult> {
    const {
        apiKey,
        model = 'gemini-1.5-flash',
        systemPrompt,
        userPrompt,
        temperature = 0.7,
        maxOutputTokens = 1024,
    } = options;

    const genAI = new GoogleGenerativeAI(apiKey);
    const genModel = genAI.getGenerativeModel({
        model,
        ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
        generationConfig: {
            temperature,
            maxOutputTokens,
        },
    });

    const startTime = Date.now();
    let result: GenerateContentResult;

    try {
        result = await genModel.generateContent(userPrompt);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(message);
    }

    const latencyMs = Date.now() - startTime;
    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata;

    return {
        output: text,
        tokenUsage: {
            promptTokens: usage?.promptTokenCount ?? 0,
            completionTokens: usage?.candidatesTokenCount ?? 0,
            totalTokens: usage?.totalTokenCount ?? 0,
        },
        latencyMs,
    };
}
