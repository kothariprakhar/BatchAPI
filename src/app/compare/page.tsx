'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useApiKey } from '@/lib/api-key-context';
import { supabase, getDeviceId } from '@/lib/supabase';
import { extractVariables, type VariableRow } from '@/lib/jsonl-compiler';
import { VariableTable } from '@/components/variable-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { GitCompare, Loader2 } from 'lucide-react';

type CompareType = 'prompt_vs_prompt' | 'model_vs_model';

export default function ComparePage() {
    const router = useRouter();
    const { apiKey } = useApiKey();

    const [name, setName] = useState('');
    const [compareType, setCompareType] = useState<CompareType>('prompt_vs_prompt');

    const [leftSystemPrompt, setLeftSystemPrompt] = useState('');
    const [leftUserPrompt, setLeftUserPrompt] = useState('Summarize in 2 bullet points: {{text}}');
    const [leftModel, setLeftModel] = useState('gemini-2.5-flash');
    const [leftTemperature, setLeftTemperature] = useState(0.7);
    const [leftMaxTokens, setLeftMaxTokens] = useState(1024);

    const [rightSystemPrompt, setRightSystemPrompt] = useState('');
    const [rightUserPrompt, setRightUserPrompt] = useState('Summarize in 2 bullet points with concise wording: {{text}}');
    const [rightModel, setRightModel] = useState('gemini-2.5-pro');
    const [rightTemperature, setRightTemperature] = useState(0.7);
    const [rightMaxTokens, setRightMaxTokens] = useState(1024);

    const [rows, setRows] = useState<VariableRow[]>([
        {
            id: crypto.randomUUID(),
            values: { text: '' },
        },
    ]);

    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState('');

    const variables = useMemo(() => {
        const union = new Set<string>([
            ...extractVariables(leftUserPrompt),
            ...extractVariables(rightUserPrompt),
        ]);
        return Array.from(union);
    }, [leftUserPrompt, rightUserPrompt]);

    const isValid =
        variables.length > 0 &&
        rows.length > 0 &&
        leftUserPrompt.trim().length > 0 &&
        rightUserPrompt.trim().length > 0;

    const ensureProject = async (): Promise<string> => {
        const deviceId = getDeviceId();

        let { data: project } = await supabase
            .from('projects')
            .select('id')
            .eq('device_id', deviceId)
            .limit(1)
            .single();

        if (!project) {
            const { data: newProject } = await supabase
                .from('projects')
                .insert({ device_id: deviceId, name: 'Default Project' })
                .select('id')
                .single();
            project = newProject;
        }

        if (!project?.id) {
            throw new Error('Failed to create project');
        }

        return project.id;
    };

    const handleCreateCompare = async () => {
        if (!isValid) return;
        setIsCreating(true);
        setError('');

        try {
            const projectId = await ensureProject();
            const response = await fetch('/api/compare', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    name,
                    compareType,
                    apiKey,
                    rows,
                    left: {
                        systemPrompt: leftSystemPrompt,
                        userPromptTemplate: leftUserPrompt,
                        model: leftModel,
                        temperature: leftTemperature,
                        maxOutputTokens: leftMaxTokens,
                    },
                    right: {
                        systemPrompt: rightSystemPrompt,
                        userPromptTemplate: rightUserPrompt,
                        model: rightModel,
                        temperature: rightTemperature,
                        maxOutputTokens: rightMaxTokens,
                    },
                }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => ({}));
                throw new Error(payload.error ?? 'Failed to create compare session');
            }

            const payload = await response.json();
            router.push(`/compare/${payload.compareId}`);
        } catch (createError) {
            setError(createError instanceof Error ? createError.message : 'Failed to create compare');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
                        <GitCompare className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Compare Mode</h1>
                        <p className="text-sm text-muted-foreground">
                            Run side-by-side regression tests for prompt versions or model variants
                        </p>
                    </div>
                </div>
                <Button onClick={handleCreateCompare} disabled={!isValid || isCreating} className="gap-2">
                    {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompare className="h-4 w-4" />}
                    Start Compare Run
                </Button>
            </div>

            {error && <div className="text-sm text-destructive">{error}</div>}

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Session Settings</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder={`Compare ${new Date().toLocaleDateString()}`}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>Compare Type</Label>
                        <Select value={compareType} onValueChange={(value) => setCompareType(value as CompareType)}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="prompt_vs_prompt">Prompt V1 vs Prompt V2</SelectItem>
                                <SelectItem value="model_vs_model">Model vs Model</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Left Side (Baseline)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>System Prompt</Label>
                            <Textarea value={leftSystemPrompt} onChange={(event) => setLeftSystemPrompt(event.target.value)} rows={2} />
                        </div>
                        <div className="space-y-2">
                            <Label>User Prompt Template</Label>
                            <Textarea value={leftUserPrompt} onChange={(event) => setLeftUserPrompt(event.target.value)} rows={5} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                                <Label>Model</Label>
                                <Select value={leftModel} onValueChange={setLeftModel}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                                        <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Temp</Label>
                                <Input type="number" value={leftTemperature} onChange={(event) => setLeftTemperature(parseFloat(event.target.value) || 0)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Tokens</Label>
                                <Input type="number" value={leftMaxTokens} onChange={(event) => setLeftMaxTokens(parseInt(event.target.value, 10) || 1024)} />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Right Side (Candidate)</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>System Prompt</Label>
                            <Textarea value={rightSystemPrompt} onChange={(event) => setRightSystemPrompt(event.target.value)} rows={2} />
                        </div>
                        <div className="space-y-2">
                            <Label>User Prompt Template</Label>
                            <Textarea value={rightUserPrompt} onChange={(event) => setRightUserPrompt(event.target.value)} rows={5} />
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-2">
                                <Label>Model</Label>
                                <Select value={rightModel} onValueChange={setRightModel}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="gemini-2.5-flash">Gemini 2.5 Flash</SelectItem>
                                        <SelectItem value="gemini-2.5-pro">Gemini 2.5 Pro</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Temp</Label>
                                <Input type="number" value={rightTemperature} onChange={(event) => setRightTemperature(parseFloat(event.target.value) || 0)} />
                            </div>
                            <div className="space-y-2">
                                <Label>Max Tokens</Label>
                                <Input type="number" value={rightMaxTokens} onChange={(event) => setRightMaxTokens(parseInt(event.target.value, 10) || 1024)} />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Shared Test Cases</CardTitle>
                </CardHeader>
                <CardContent>
                    <VariableTable variables={variables} rows={rows} onRowsChange={setRows} />
                </CardContent>
            </Card>
        </div>
    );
}
