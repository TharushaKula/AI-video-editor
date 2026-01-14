import { Ollama } from "@langchain/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

const ollama = new Ollama({
    baseUrl: process.env.OLLAMA_HOST || "http://127.0.0.1:11434",
    model: "gpt-oss:20b-cloud",
    temperature: 0.7,
});

export const analyzeTranscription = async (transcriptionText: string) => {
    try {
        const template = `
        You are an expert video director. Analyze the following audio transcription and break it down into frequent, dynamic video segments.
        AIM FOR HIGH DENSITY: Generate a new segment roughly every 5-10 seconds of speech. The more segments, the better.
        For each segment, identify the:
        1. Visual Topic (what should be shown)
        2. Image Prompt (detailed prompt for Stable Diffusion)
        3. Sentiment (Happy, Sad, Intense, Calm, etc.)
        4. Estimated duration based on text length (assume avg speaking rate).

        Return the result as a raw valid JSON array of objects. Do not include markdown formatting or explanations. JSON only.
        
        Transcription: "{text}"
        
        Output format:
        [
            {{
                "segment_id": 1,
                "text_content": "part of text...",
                "visual_topic": "...",
                "image_prompt": "...",
                "sentiment": "..."
            }}
        ]
        `;

        const prompt = PromptTemplate.fromTemplate(template);
        const chain = prompt.pipe(ollama).pipe(new StringOutputParser());

        const result = await chain.invoke({ text: transcriptionText });

        // Sanitize result to ensure JSON
        // Robust JSON extraction
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        const jsonString = jsonMatch ? jsonMatch[0] : result.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
            return JSON.parse(jsonString);
        } catch (e) {
            console.error('Failed to parse JSON from LLM:', result);
            // Fallback: Return a single segment with the whole text if parsing fails
            return [{
                segment_id: 1,
                text_content: transcriptionText,
                visual_topic: "General visualization",
                image_prompt: "Cinematic shot relevant to the audio context, high quality, 4k",
                sentiment: "Neutral"
            }];
        }

    } catch (error) {
        console.error('Error analyzing transcription:', error);
        throw error;
    }
};
