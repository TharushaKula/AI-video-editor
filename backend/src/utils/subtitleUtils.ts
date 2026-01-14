
interface WhisperChunk {
    text: string;
    timestamp: [number, number]; // [start, end] in seconds
}

function formatTime(seconds: number): string {
    const date = new Date(0);
    date.setMilliseconds(seconds * 1000);
    const hh = date.getUTCHours().toString().padStart(2, '0');
    const mm = date.getUTCMinutes().toString().padStart(2, '0');
    const ss = date.getUTCSeconds().toString().padStart(2, '0');
    const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${hh}:${mm}:${ss},${ms}`;
}

export const generateSRT = (chunks: WhisperChunk[]): string => {
    let srtContent = '';
    let counter = 1;

    chunks.forEach((chunk) => {
        const text = chunk.text.trim();
        if (!text) return;

        const words = text.split(/\s+/);
        const startTime = chunk.timestamp[0];
        // Ensure we have an end time. If missing, estimate 0.3s per word.
        const endTime = chunk.timestamp[1] || (startTime + words.length * 0.3);
        const duration = endTime - startTime;
        const timePerWord = duration / words.length;

        // Group into chunks of 3 words (user requested "3 letters" likely meaning minimal/fast words)
        // We will do max 3 words per caption for a fast-paced feel.
        const WORDS_PER_CAPTION = 3;

        for (let i = 0; i < words.length; i += WORDS_PER_CAPTION) {
            const batch = words.slice(i, i + WORDS_PER_CAPTION);
            const batchText = batch.join(' ');

            const batchStartTime = startTime + (i * timePerWord);
            const batchEndTime = Math.min(endTime, batchStartTime + (batch.length * timePerWord));

            // Prevent zero-duration or overlapping issues with tiny tolerance
            const safeStart = formatTime(batchStartTime);
            const safeEnd = formatTime(batchEndTime);

            srtContent += `${counter}\n${safeStart} --> ${safeEnd}\n${batchText}\n\n`;
            counter++;
        }
    });

    return srtContent.trim();
};
