'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { extractVariables } from '@/lib/jsonl-compiler';
import { cn } from '@/lib/utils';
import { Sparkles, Settings2 } from 'lucide-react';

interface PromptEditorProps {
    systemPrompt: string;
    userPromptTemplate: string;
    temperature: number;
    maxOutputTokens: number;
    onSystemPromptChange: (value: string) => void;
    onUserPromptChange: (value: string) => void;
    onTemperatureChange: (value: number) => void;
    onMaxOutputTokensChange: (value: number) => void;
}

export function PromptEditor({
    systemPrompt,
    userPromptTemplate,
    temperature,
    maxOutputTokens,
    onSystemPromptChange,
    onUserPromptChange,
    onTemperatureChange,
    onMaxOutputTokensChange,
}: PromptEditorProps) {
    const [variables, setVariables] = useState<string[]>([]);
    const [showConfig, setShowConfig] = useState(false);
    const highlightRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setVariables(extractVariables(userPromptTemplate));
    }, [userPromptTemplate]);

    const handleScroll = useCallback(() => {
        if (highlightRef.current && textareaRef.current) {
            highlightRef.current.scrollTop = textareaRef.current.scrollTop;
            highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
        }
    }, []);

    // Render highlighted template (variables shown in color)
    const renderHighlighted = (text: string) => {
        const parts = text.split(/(\{\{\w+\}\})/g);
        return parts.map((part, i) => {
            if (/^\{\{\w+\}\}$/.test(part)) {
                return (
                    <span key={i} className="text-blue-400 font-semibold bg-blue-500/10 rounded px-0.5">
                        {part}
                    </span>
                );
            }
            // Preserve whitespace rendering
            return <span key={i}>{part}</span>;
        });
    };

    return (
        <div className="space-y-4">
            {/* System Prompt */}
            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                    System Prompt <span className="text-muted-foreground/50">(optional)</span>
                </Label>
                <Textarea
                    placeholder="You are a helpful assistant that..."
                    value={systemPrompt}
                    onChange={(e) => onSystemPromptChange(e.target.value)}
                    className="min-h-[60px] resize-none text-sm font-mono bg-muted/30"
                    rows={2}
                />
            </div>

            {/* User Prompt Template */}
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Prompt Template
                    </Label>
                    {variables.length > 0 && (
                        <div className="flex items-center gap-1.5">
                            <Sparkles className="h-3 w-3 text-blue-400" />
                            <span className="text-[10px] text-blue-400 font-medium">
                                {variables.length} variable{variables.length !== 1 ? 's' : ''}: {variables.map(v => `{{${v}}}`).join(', ')}
                            </span>
                        </div>
                    )}
                </div>
                <div className="relative">
                    {/* Syntax highlight overlay */}
                    <div
                        ref={highlightRef}
                        className="absolute inset-0 p-3 text-sm font-mono whitespace-pre-wrap break-words overflow-hidden pointer-events-none"
                        aria-hidden="true"
                    >
                        {renderHighlighted(userPromptTemplate)}
                    </div>
                    {/* Actual textarea */}
                    <Textarea
                        ref={textareaRef}
                        placeholder="Summarize the following text about {{topic}}: {{text}}"
                        value={userPromptTemplate}
                        onChange={(e) => onUserPromptChange(e.target.value)}
                        onScroll={handleScroll}
                        className={cn(
                            'min-h-[120px] resize-y text-sm font-mono bg-transparent',
                            'text-transparent caret-foreground selection:bg-blue-500/30'
                        )}
                        rows={5}
                    />
                </div>
            </div>

            {/* Variable Pills */}
            {variables.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {variables.map((v) => (
                        <span
                            key={v}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        >
                            {`{{${v}}}`}
                        </span>
                    ))}
                </div>
            )}

            {/* Model Config Toggle */}
            <button
                onClick={() => setShowConfig(!showConfig)}
                className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
                <Settings2 className="h-3.5 w-3.5" />
                Model Configuration
                <span className="text-[10px]">{showConfig ? '▲' : '▼'}</span>
            </button>

            {showConfig && (
                <div className="grid grid-cols-2 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs">Temperature</Label>
                            <span className="text-xs font-mono text-muted-foreground">{temperature}</span>
                        </div>
                        <Slider
                            value={[temperature]}
                            onValueChange={([v]) => onTemperatureChange(v)}
                            min={0}
                            max={2}
                            step={0.1}
                            className="w-full"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs">Max Output Tokens</Label>
                        <Input
                            type="number"
                            value={maxOutputTokens}
                            onChange={(e) => onMaxOutputTokensChange(parseInt(e.target.value) || 1024)}
                            min={1}
                            max={8192}
                            className="text-sm font-mono"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
