import { type VariableRow } from '@/lib/jsonl-compiler';

export interface StarterTemplate {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string; // emoji
    systemPrompt: string;
    userPromptTemplate: string;
    sampleRows: VariableRow[];
}

export const starterTemplates: StarterTemplate[] = [
    {
        id: 'summarization',
        name: 'Text Summarization',
        description: 'Test how well the model summarizes different types of content',
        category: 'NLP',
        icon: '📝',
        systemPrompt: 'You are a concise summarizer. Provide clear, factual summaries.',
        userPromptTemplate: 'Summarize the following {{content_type}} in 2-3 sentences:\n\n{{text}}',
        sampleRows: [
            {
                id: '1',
                values: {
                    content_type: 'news article',
                    text: 'Scientists at CERN have announced the discovery of a new subatomic particle that could reshape our understanding of quantum physics. The particle, tentatively named the "zephyr boson," was detected during high-energy collisions in the Large Hadron Collider. Researchers say it may help explain dark matter.',
                },
            },
            {
                id: '2',
                values: {
                    content_type: 'email',
                    text: 'Hi team, just wanted to follow up on our Q3 planning meeting. We agreed to prioritize the mobile app redesign, push the API migration to Q4, and hire two more frontend engineers. Budget was approved for $150K. Let me know if you have questions.',
                },
            },
            {
                id: '3',
                values: {
                    content_type: 'technical document',
                    text: 'RESTful APIs use HTTP methods (GET, POST, PUT, DELETE) to perform CRUD operations on resources. Authentication is typically handled via OAuth 2.0 or API keys. Rate limiting prevents abuse, while pagination handles large result sets. Versioning ensures backward compatibility.',
                },
            },
        ],
    },
    {
        id: 'translation',
        name: 'Translation Quality',
        description: 'Evaluate translation accuracy across different languages',
        category: 'NLP',
        icon: '🌍',
        systemPrompt: 'You are a professional translator. Provide accurate, natural-sounding translations.',
        userPromptTemplate: 'Translate the following text to {{target_language}}:\n\n{{text}}',
        sampleRows: [
            {
                id: '1',
                values: {
                    target_language: 'Spanish',
                    text: 'The quick brown fox jumps over the lazy dog. This sentence contains every letter of the English alphabet.',
                },
            },
            {
                id: '2',
                values: {
                    target_language: 'Japanese',
                    text: 'Welcome to our platform. We help developers build better AI applications through automated testing and evaluation.',
                },
            },
            {
                id: '3',
                values: {
                    target_language: 'French',
                    text: 'The meeting has been rescheduled to next Thursday at 3 PM. Please confirm your attendance by end of day.',
                },
            },
        ],
    },
    {
        id: 'sentiment',
        name: 'Sentiment Analysis',
        description: 'Test sentiment classification across diverse review types',
        category: 'Classification',
        icon: '😊',
        systemPrompt:
            'You are a sentiment analysis expert. Classify the sentiment as POSITIVE, NEGATIVE, or NEUTRAL. Provide a confidence score (0-100%) and a brief explanation.',
        userPromptTemplate: 'Analyze the sentiment of this {{review_type}}:\n\n"{{review_text}}"',
        sampleRows: [
            {
                id: '1',
                values: {
                    review_type: 'product review',
                    review_text: 'This laptop is absolutely amazing! The battery lasts all day and the screen is gorgeous. Best purchase I have made this year.',
                },
            },
            {
                id: '2',
                values: {
                    review_type: 'restaurant review',
                    review_text: 'The food was okay but nothing special. Service was slow and the prices were higher than expected for the quality.',
                },
            },
            {
                id: '3',
                values: {
                    review_type: 'app review',
                    review_text: 'Terrible app. Crashes every 5 minutes, lost all my data twice. The developers clearly do not test their updates before releasing them.',
                },
            },
            {
                id: '4',
                values: {
                    review_type: 'hotel review',
                    review_text: 'Clean rooms and friendly staff. The location is convenient but the breakfast selection could be better. Would stay again.',
                },
            },
        ],
    },
    {
        id: 'code-gen',
        name: 'Code Generation',
        description: 'Benchmark code generation quality across languages and tasks',
        category: 'Code',
        icon: '💻',
        systemPrompt:
            'You are an expert programmer. Write clean, well-documented code with proper error handling.',
        userPromptTemplate:
            'Write a {{language}} function that {{specification}}.\n\nInclude:\n- Type annotations\n- Error handling\n- A brief docstring',
        sampleRows: [
            {
                id: '1',
                values: {
                    language: 'Python',
                    specification: 'validates an email address using regex and returns True/False',
                },
            },
            {
                id: '2',
                values: {
                    language: 'TypeScript',
                    specification: 'debounces a callback function with a configurable delay',
                },
            },
            {
                id: '3',
                values: {
                    language: 'Go',
                    specification: 'reads a CSV file and returns a slice of maps with column headers as keys',
                },
            },
        ],
    },
    {
        id: 'qa-extraction',
        name: 'Q&A Extraction',
        description: 'Test context-based question answering accuracy',
        category: 'RAG',
        icon: '🔍',
        systemPrompt:
            'Answer questions based ONLY on the provided context. If the answer is not in the context, say "Not found in context."',
        userPromptTemplate:
            'Context:\n{{context}}\n\nQuestion: {{question}}\n\nAnswer based only on the context above:',
        sampleRows: [
            {
                id: '1',
                values: {
                    context:
                        'Gemini Bench is an open-source tool for batch prompt testing. It was created in 2025 and supports Gemini 1.5 Flash. The tool uses client-side batching with a token bucket rate limiter set to 15 RPM.',
                    question: 'What rate limit does Gemini Bench use?',
                },
            },
            {
                id: '2',
                values: {
                    context:
                        'Gemini Bench is an open-source tool for batch prompt testing. It was created in 2025 and supports Gemini 1.5 Flash. The tool uses client-side batching with a token bucket rate limiter set to 15 RPM.',
                    question: 'Who created Gemini Bench?',
                },
            },
            {
                id: '3',
                values: {
                    context:
                        'The Apollo 11 mission landed on the Moon on July 20, 1969. Neil Armstrong was the first person to walk on the lunar surface, followed by Buzz Aldrin. Michael Collins remained in lunar orbit.',
                    question: 'Who stayed in lunar orbit during Apollo 11?',
                },
            },
        ],
    },
];
