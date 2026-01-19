import { Ollama } from "@langchain/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const ollama = new Ollama({
    baseUrl: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
    model: "gpt-oss:20b-cloud",
    temperature: 0.7,
});

interface WordChunk {
    text: string;
    timestamp: [number, number]; // [start, end] in seconds
}

interface IntelligentSegment {
    segment_id: number;
    text_content: string;
    start_time: number;
    end_time: number;
    duration: number;
    visual_topic: string;
    image_prompt: string;
    sentiment: string;
    contains_people: boolean;
}

/**
 * Intelligently segments audio transcription using word-level timestamps
 * Creates segments based on natural speech flow, pauses, and sentence boundaries
 */
export const createIntelligentSegments = async (
    transcriptionOutput: any,
    fullText: string
): Promise<IntelligentSegment[]> => {
    try {
        // Extract word chunks from Whisper output
        // Whisper with return_timestamps: 'word' can return different structures:
        // 1. { chunks: [{ text, timestamp: [start, end] }] }
        // 2. { text, chunks: [...] }
        // 3. Direct array of chunks
        let chunks: WordChunk[] = [];
        
        if (transcriptionOutput.chunks && Array.isArray(transcriptionOutput.chunks)) {
            chunks = transcriptionOutput.chunks;
        } else if (Array.isArray(transcriptionOutput)) {
            chunks = transcriptionOutput;
        } else if (transcriptionOutput.text && transcriptionOutput.chunks) {
            chunks = transcriptionOutput.chunks;
        }
        
        // Validate chunks structure
        if (!chunks || chunks.length === 0 || !chunks[0].timestamp) {
            console.log('[Segmentation] No valid word-level timestamps found, using LLM-based segmentation');
            // Fallback: use LLM-based segmentation without timestamps
            return await analyzeTranscriptionWithLLM(fullText);
        }

        console.log(`[Segmentation] Processing ${chunks.length} word chunks with timestamps`);

        // Step 1: Use LLM to identify semantic segment boundaries
        const semanticSegments = await identifySemanticSegments(fullText, chunks);

        // Step 2: Map semantic segments to precise timestamps
        const segmentsWithTimestamps = mapSegmentsToTimestamps(semanticSegments, chunks);

        // Step 3: Enhance each segment with visual analysis
        const enhancedSegments = await enhanceSegmentsWithVisuals(segmentsWithTimestamps);

        return enhancedSegments;

    } catch (error) {
        console.error('Intelligent segmentation failed:', error);
        // Fallback to LLM-based segmentation
        return await analyzeTranscriptionWithLLM(fullText);
    }
};

/**
 * Uses LLM to identify natural segment boundaries in the text
 * Returns segment text with approximate word ranges
 */
async function identifySemanticSegments(
    fullText: string,
    chunks: WordChunk[]
): Promise<Array<{ text: string; wordStart: number; wordEnd: number }>> {
    const template = `
You are an expert video editor. Analyze the following transcription and break it into natural, meaningful segments based on:
1. Sentence boundaries (periods, commas, natural pauses)
2. Semantic meaning (complete thoughts, phrases)
3. Speech flow (natural breaks in speech)
4. Optimal segment length: 2-5 seconds of speech (roughly 5-15 words)

IMPORTANT: Break at natural points where the visual should change. Each segment should be a complete thought or phrase.

Transcription: "{text}"

Return ONLY a JSON array of objects with this exact format (no markdown, no explanations):
[
    {{
        "text": "exact text from transcription",
        "word_count": number of words in this segment
    }}
]

Example for "Vitamin D helps your body absorb calcium, keeping your bones strong and reducing the risk of fractures.":
[
    {{"text": "Vitamin D helps your body absorb calcium", "word_count": 6}},
    {{"text": "keeping your bones strong", "word_count": 4}},
    {{"text": "reducing the risk of fractures", "word_count": 5}}
]
`;

    const prompt = PromptTemplate.fromTemplate(template);
    const chain = prompt.pipe(ollama).pipe(new StringOutputParser());

    try {
        const result = await chain.invoke({ text: fullText });
        
        // Extract JSON
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        const jsonString = jsonMatch ? jsonMatch[0] : result.replace(/```json/g, '').replace(/```/g, '').trim();
        
        const segments = JSON.parse(jsonString);
        
        // Map to word indices
        const words = fullText.split(/\s+/);
        let currentWordIndex = 0;
        const mappedSegments = [];

        for (const segment of segments) {
            const segmentWords = segment.text.split(/\s+/);
            const wordStart = currentWordIndex;
            const wordEnd = Math.min(currentWordIndex + segmentWords.length - 1, words.length - 1);
            
            mappedSegments.push({
                text: segment.text,
                wordStart,
                wordEnd
            });
            
            currentWordIndex = wordEnd + 1;
        }

        return mappedSegments;

    } catch (error) {
        console.error('Failed to identify semantic segments:', error);
        // Fallback: simple sentence-based segmentation
        return createFallbackSegments(fullText, chunks);
    }
}

/**
 * Maps semantic segments to precise timestamps from word chunks
 */
function mapSegmentsToTimestamps(
    semanticSegments: Array<{ text: string; wordStart: number; wordEnd: number }>,
    chunks: WordChunk[]
): Array<{ text: string; start_time: number; end_time: number; duration: number }> {
    const segmentsWithTimestamps = [];

    for (const segment of semanticSegments) {
        // Find corresponding word chunks
        const startChunk = chunks[segment.wordStart];
        const endChunk = chunks[Math.min(segment.wordEnd, chunks.length - 1)];

        if (startChunk && endChunk) {
            const start_time = startChunk.timestamp[0];
            const end_time = endChunk.timestamp[1] || endChunk.timestamp[0] + 0.5;
            const duration = end_time - start_time;

            segmentsWithTimestamps.push({
                text: segment.text,
                start_time: Math.max(0, start_time),
                end_time: Math.max(start_time, end_time),
                duration: Math.max(0.5, duration) // Minimum 0.5 seconds
            });
        }
    }

    return segmentsWithTimestamps;
}

/**
 * Enhances segments with visual analysis using LLM
 */
async function enhanceSegmentsWithVisuals(
    segments: Array<{ text: string; start_time: number; end_time: number; duration: number }>
): Promise<IntelligentSegment[]> {
    const template = `
You are an expert video director. For each segment of audio, provide:
1. Visual Topic: What should be visually shown (brief description)
2. Image Prompt: Detailed prompt for AI image generation (Stable Diffusion style)
3. Sentiment: Emotional tone (Happy, Sad, Intense, Calm, Neutral, etc.)
4. Contains People: true if the visual should show humans/faces, false otherwise

Segments:
{segments}

Return ONLY a JSON array matching this format (no markdown):
[
    {{
        "visual_topic": "...",
        "image_prompt": "...",
        "sentiment": "...",
        "contains_people": true/false
    }}
]
`;

    // Process segments in batches to avoid token limits
    const batchSize = 10;
    const allSegments: IntelligentSegment[] = [];

    for (let i = 0; i < segments.length; i += batchSize) {
        const batch = segments.slice(i, i + batchSize);
        const segmentsText = batch.map((s, idx) => 
            `${i + idx + 1}. "${s.text}" (${s.duration.toFixed(1)}s)`
        ).join('\n');

        const prompt = PromptTemplate.fromTemplate(template);
        const chain = prompt.pipe(ollama).pipe(new StringOutputParser());

        try {
            const result = await chain.invoke({ segments: segmentsText });
            const jsonMatch = result.match(/\[[\s\S]*\]/);
            const jsonString = jsonMatch ? jsonMatch[0] : result.replace(/```json/g, '').replace(/```/g, '').trim();
            const visualData = JSON.parse(jsonString);

            // Combine timestamp data with visual data
            for (let j = 0; j < batch.length && j < visualData.length; j++) {
                allSegments.push({
                    segment_id: i + j + 1,
                    text_content: batch[j].text,
                    start_time: batch[j].start_time,
                    end_time: batch[j].end_time,
                    duration: batch[j].duration,
                    visual_topic: visualData[j].visual_topic || 'General visualization',
                    image_prompt: visualData[j].image_prompt || 'High quality cinematic shot',
                    sentiment: visualData[j].sentiment || 'Neutral',
                    contains_people: visualData[j].contains_people || false
                });
            }
        } catch (error) {
            console.error(`Failed to enhance batch ${i}-${i + batchSize}:`, error);
            // Fallback: add segments without visual enhancement
            for (let j = 0; j < batch.length; j++) {
                allSegments.push({
                    segment_id: i + j + 1,
                    text_content: batch[j].text,
                    start_time: batch[j].start_time,
                    end_time: batch[j].end_time,
                    duration: batch[j].duration,
                    visual_topic: 'General visualization',
                    image_prompt: 'High quality cinematic shot relevant to the audio',
                    sentiment: 'Neutral',
                    contains_people: false
                });
            }
        }
    }

    return allSegments;
}

/**
 * Fallback: Create simple sentence-based segments
 */
function createFallbackSegments(
    fullText: string,
    chunks: WordChunk[]
): Array<{ text: string; wordStart: number; wordEnd: number }> {
    const sentences = fullText.split(/[.!?]+/).filter(s => s.trim().length > 0);
    const words = fullText.split(/\s+/);
    const segments = [];
    let currentWordIndex = 0;

    for (const sentence of sentences) {
        const sentenceWords = sentence.trim().split(/\s+/);
        const wordStart = currentWordIndex;
        const wordEnd = Math.min(currentWordIndex + sentenceWords.length - 1, words.length - 1);

        if (wordEnd >= wordStart) {
            segments.push({
                text: sentence.trim(),
                wordStart,
                wordEnd
            });
            currentWordIndex = wordEnd + 1;
        }
    }

    return segments;
}

/**
 * Fallback: LLM-based segmentation without timestamps
 */
async function analyzeTranscriptionWithLLM(fullText: string): Promise<IntelligentSegment[]> {
    const template = `
You are an expert video director. Analyze the transcription and break it into segments.
For each segment, provide:
1. Text content
2. Visual topic
3. Image prompt
4. Sentiment
5. Contains people

Transcription: "{text}"

Return JSON array:
[
    {{
        "segment_id": 1,
        "text_content": "...",
        "visual_topic": "...",
        "image_prompt": "...",
        "sentiment": "...",
        "contains_people": true/false,
        "duration": estimated_seconds
    }}
]
`;

    const prompt = PromptTemplate.fromTemplate(template);
    const chain = prompt.pipe(ollama).pipe(new StringOutputParser());

    try {
        const result = await chain.invoke({ text: fullText });
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        const jsonString = jsonMatch ? jsonMatch[0] : result.replace(/```json/g, '').replace(/```/g, '').trim();
        const segments = JSON.parse(jsonString);

        // Add timestamp placeholders
        let currentTime = 0;
        return segments.map((seg: any) => {
            const duration = seg.duration || 3; // Default 3 seconds
            const segment = {
                segment_id: seg.segment_id,
                text_content: seg.text_content,
                start_time: currentTime,
                end_time: currentTime + duration,
                duration: duration,
                visual_topic: seg.visual_topic,
                image_prompt: seg.image_prompt,
                sentiment: seg.sentiment,
                contains_people: seg.contains_people || false
            };
            currentTime += duration;
            return segment;
        });
    } catch (error) {
        console.error('LLM segmentation failed:', error);
        // Ultimate fallback: single segment
        return [{
            segment_id: 1,
            text_content: fullText,
            start_time: 0,
            end_time: 10,
            duration: 10,
            visual_topic: 'General visualization',
            image_prompt: 'High quality cinematic shot',
            sentiment: 'Neutral',
            contains_people: false
        }];
    }
}
