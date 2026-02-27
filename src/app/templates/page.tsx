'use client';

import { useRouter } from 'next/navigation';
import { starterTemplates, type StarterTemplate } from '@/lib/starter-templates';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookTemplate, ArrowRight } from 'lucide-react';

// We need a way to pass template data to the builder.
// Using sessionStorage as a simple cross-page state mechanism.
function useTemplateToBuilder() {
    const router = useRouter();

    return (template: StarterTemplate) => {
        sessionStorage.setItem(
            'gemini-bench-template',
            JSON.stringify({
                systemPrompt: template.systemPrompt,
                userPromptTemplate: template.userPromptTemplate,
                rows: template.sampleRows,
            })
        );
        router.push('/builder');
    };
}

export default function TemplatesPage() {
    const loadTemplate = useTemplateToBuilder();

    // Group by category
    const categories = Array.from(
        new Set(starterTemplates.map((t) => t.category))
    );

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
                    <BookTemplate className="h-5 w-5" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
                    <p className="text-sm text-muted-foreground">
                        Pre-built prompt test suites to get started in seconds
                    </p>
                </div>
            </div>

            {/* Template Cards by Category */}
            {categories.map((category) => (
                <div key={category} className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                            {category}
                        </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {starterTemplates
                            .filter((t) => t.category === category)
                            .map((template) => (
                                <Card
                                    key={template.id}
                                    className="bg-card/50 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-pointer group"
                                    onClick={() => loadTemplate(template)}
                                >
                                    <CardContent className="pt-6">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{template.icon}</span>
                                                <div>
                                                    <h3 className="font-semibold text-sm">{template.name}</h3>
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        {template.description}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
                                            <p className="text-xs font-mono text-muted-foreground line-clamp-2">
                                                {template.userPromptTemplate}
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between mt-4">
                                            <span className="text-[10px] text-muted-foreground">
                                                {template.sampleRows.length} sample rows
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="gap-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                Use Template
                                                <ArrowRight className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
