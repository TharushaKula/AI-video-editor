import { pipeline, env } from '@xenova/transformers';
import path from 'path';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { WaveFile } from 'wavefile';

// Suppress ONNX info/warning logs
env.backends.onnx.logLevel = 'fatal';

let transcriber: any = null;

const convertToWav = (inputPath: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const outputPath = inputPath.replace(path.extname(inputPath), '.wav');
        ffmpeg(inputPath)
            .toFormat('wav')
            .audioFrequency(16000)
            .audioChannels(1)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => reject(err))
            .save(outputPath);
    });
};

export const transcribeAudio = async (filePath: string): Promise<any> => {
    try {
        if (!transcriber) {
            console.log('Loading Whisper model (Xenova/whisper-base)...');
            transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
        }

        console.log(`Converting ${filePath} to WAV for processing...`);
        const wavPath = await convertToWav(filePath);

        console.log(`Reading audio data from ${wavPath}...`);
        const buffer = fs.readFileSync(wavPath);
        const wav = new WaveFile(buffer);

        // Convert to 32-bit float
        wav.toBitDepth('32f');

        let audioData: any = wav.getSamples();
        if (Array.isArray(audioData)) {
            // If multiple channels, take the first one (should be 1 because of ffmpeg conversion)
            audioData = audioData[0];
        }

        console.log(`Starting transcription...`);

        // Pass the Float32Array directly
        // return_timestamps: 'word' gives us word-level precision for perfect sync
        const output = await transcriber(audioData, {
            chunk_length_s: 30,
            stride_length_s: 5,
            return_timestamps: 'word'
        });

        // Cleanup temporary wav file
        if (fs.existsSync(wavPath)) {
            fs.unlinkSync(wavPath);
        }

        console.log('Transcription complete.');
        return output;

    } catch (error) {
        console.error('Transcription failed:', error);
        throw error;
    }
};
