'use client';

import { ApiKeyDialog } from '@/components/api-key-dialog';
import { Beaker } from 'lucide-react';

export function Header() {
    return (
        <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-sm flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 sm:hidden">
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
                        <Beaker className="h-4 w-4" />
                    </div>
                    <span className="text-sm font-semibold">Gemini Bench</span>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <ApiKeyDialog />
            </div>
        </header>
    );
}
