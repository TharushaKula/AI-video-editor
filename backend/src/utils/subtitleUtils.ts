
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
    const WORDS_PER_CAPTION = 3;

    for (let i = 0; i < chunks.length; i += WORDS_PER_CAPTION) {
        const batch = chunks.slice(i, i + WORDS_PER_CAPTION);
        if (batch.length === 0) continue;

        // Combine text
        const text = batch.map(c => c.text.trim()).join(' ');

        // Start time of first word
        const startTime = batch[0].timestamp[0];

        // End time of last word
        const lastChunk = batch[batch.length - 1];
        const endTime = lastChunk.timestamp[1] || (lastChunk.timestamp[0] + 0.5);

        const start = formatTime(startTime);
        const end = formatTime(endTime);

        srtContent += `${counter}\n${start} --> ${end}\n${text}\n\n`;
        counter++;
    }

    return srtContent.trim();
};
