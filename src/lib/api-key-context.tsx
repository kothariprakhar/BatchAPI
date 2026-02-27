'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getStoredApiKey, setStoredApiKey, clearStoredApiKey, validateApiKey } from '@/lib/gemini';

interface ApiKeyContextType {
    apiKey: string | null;
    isValid: boolean;
    isValidating: boolean;
    setApiKey: (key: string) => Promise<boolean>;
    removeApiKey: () => void;
}

const ApiKeyContext = createContext<ApiKeyContextType>({
    apiKey: null,
    isValid: false,
    isValidating: false,
    setApiKey: async () => false,
    removeApiKey: () => { },
});

export function useApiKey() {
    return useContext(ApiKeyContext);
}

export function ApiKeyProvider({ children }: { children: React.ReactNode }) {
    const [apiKey, setApiKeyState] = useState<string | null>(null);
    const [isValid, setIsValid] = useState(false);
    const [isValidating, setIsValidating] = useState(false);

    useEffect(() => {
        const stored = getStoredApiKey();
        if (stored) {
            setApiKeyState(stored);
            setIsValid(true); // assume valid if stored
        }
    }, []);

    const handleSetApiKey = useCallback(async (key: string): Promise<boolean> => {
        setIsValidating(true);
        try {
            const result = await validateApiKey(key);
            if (result.valid) {
                setStoredApiKey(key);
                setApiKeyState(key);
                setIsValid(true);
                return true;
            }
            return false;
        } finally {
            setIsValidating(false);
        }
    }, []);

    const removeApiKey = useCallback(() => {
        clearStoredApiKey();
        setApiKeyState(null);
        setIsValid(false);
    }, []);

    return (
        <ApiKeyContext.Provider value={{ apiKey, isValid, isValidating, setApiKey: handleSetApiKey, removeApiKey }}>
            {children}
        </ApiKeyContext.Provider>
    );
}
