'use client';

import { useState } from 'react';
import { useApiKey } from '@/lib/api-key-context';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Key, Loader2, CheckCircle2, XCircle, Trash2 } from 'lucide-react';

export function ApiKeyDialog() {
    const { apiKey, isValid, isValidating, setApiKey, removeApiKey } = useApiKey();
    const [open, setOpen] = useState(false);
    const [inputKey, setInputKey] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!inputKey.trim()) {
            setError('Please enter an API key');
            return;
        }

        const success = await setApiKey(inputKey.trim());
        if (success) {
            setInputKey('');
            setOpen(false);
        } else {
            setError('Invalid API key. Please check and try again.');
        }
    };

    const handleRemove = () => {
        removeApiKey();
        setInputKey('');
        setError('');
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Key className="h-3.5 w-3.5" />
                    {apiKey && isValid ? (
                        <>
                            <span className="hidden sm:inline">API Key</span>
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] px-1.5">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Connected
                            </Badge>
                        </>
                    ) : (
                        <>
                            <span className="hidden sm:inline">Set API Key</span>
                            <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] px-1.5">
                                Required
                            </Badge>
                        </>
                    )}
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Key className="h-5 w-5" />
                        Gemini API Key
                    </DialogTitle>
                    <DialogDescription>
                        Your API key is stored locally in your browser and never sent to our servers.
                        Get a free key at{' '}
                        <a
                            href="https://aistudio.google.com/apikey"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline underline-offset-2"
                        >
                            aistudio.google.com
                        </a>
                    </DialogDescription>
                </DialogHeader>

                {apiKey && isValid ? (
                    <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            <div className="flex-1">
                                <p className="text-sm font-medium">API Key Connected</p>
                                <p className="text-xs text-muted-foreground font-mono">
                                    {apiKey.slice(0, 8)}...{apiKey.slice(-4)}
                                </p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={handleRemove} className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="api-key">API Key</Label>
                            <Input
                                id="api-key"
                                type="password"
                                placeholder="AIza..."
                                value={inputKey}
                                onChange={(e) => {
                                    setInputKey(e.target.value);
                                    setError('');
                                }}
                                disabled={isValidating}
                            />
                            {error && (
                                <div className="flex items-center gap-2 text-sm text-destructive">
                                    <XCircle className="h-4 w-4" />
                                    {error}
                                </div>
                            )}
                        </div>
                        <Button type="submit" className="w-full" disabled={isValidating}>
                            {isValidating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Validating...
                                </>
                            ) : (
                                'Connect API Key'
                            )}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
