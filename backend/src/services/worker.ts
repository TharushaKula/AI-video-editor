import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { transcribeAudio } from './audioService';
import { analyzeTranscription } from './intelligenceService';
import { generateImage } from './mediaService';
import { createVideo } from './videoService';
import { getIO } from './socketService';
import ffmpeg from 'fluent-ffmpeg';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { generateSRT } from '../utils/subtitleUtils';

const connection = new IORedis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', { maxRetriesPerRequest: null });

// Helper to get duration
const getDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration || 0);
        });
    });
};

export const initWorker = () => {
    const worker = new Worker('video-generation', async job => {
        const io = getIO();
        const jobId = job.id;
        // Extract aspect ratio and caption style
        const { filePath, aspectRatio, captionStyle } = job.data;

        console.log(`Processing job ${jobId} (Aspect: ${aspectRatio}, Style: ${captionStyle})`);

        try {
            // 1. Transcription
            io.to(jobId!).emit('progress', { step: 'transcription', progress: 10, message: 'Transcribing audio...' });

            const transcription = await transcribeAudio(filePath);
            const text = transcription.text || transcription;

            // Generate Subtitles if chunks exist
            let subtitlePath: string | undefined;
            if (transcription.chunks && captionStyle !== 'none') {
                try {
                    const srtContent = generateSRT(transcription.chunks);
                    const uploadDir = path.join(__dirname, '../../uploads', jobId!);
                    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

                    subtitlePath = path.join(uploadDir, 'subtitles.srt');
                    fs.writeFileSync(subtitlePath, srtContent);
                    console.log(`Generated subtitles at ${subtitlePath}`);
                } catch (srtError) {
                    console.error('Failed to generate subtitles:', srtError);
                }
            }

            io.to(jobId!).emit('progress', { step: 'transcription', progress: 30, message: 'Transcription complete' });

            // 2. Intelligence
            io.to(jobId!).emit('progress', { step: 'analysis', progress: 35, message: 'Analyzing content...' });
            const analysis = await analyzeTranscription(text);

            io.to(jobId!).emit('progress', { step: 'analysis', progress: 50, message: 'Analysis complete' });

            // 3. Media & Timing
            io.to(jobId!).emit('progress', { step: 'media', progress: 55, message: 'Generating visuals...' });

            const totalDuration = await getDuration(filePath);
            const segmentCount = analysis.length;
            const defaultDuration = totalDuration / segmentCount;

            const segmentsWithImages = [];
            let currentProgress = 55;
            const progressStep = 30 / Math.max(segmentCount, 1);

            for (const segment of analysis) {
                // Pass visual_topic and aspectRatio
                const imagePath = await generateImage(segment.image_prompt, jobId!, segment.segment_id, segment.visual_topic, aspectRatio);

                segmentsWithImages.push({
                    imagePath,
                    duration: defaultDuration, // Simple equal split for now to ensure we cover the whole audio
                    id: segment.segment_id
                });

                currentProgress += progressStep;
                io.to(jobId!).emit('progress', { step: 'media', progress: Math.min(85, currentProgress), message: `Generated image ${segment.segment_id}/${segmentCount}` });
            }

            // 4. Video Assembly
            io.to(jobId!).emit('progress', { step: 'assembly', progress: 90, message: 'Assembling video with captions...' });

            // Pass subtitles and style
            const videoPath = await createVideo(filePath, segmentsWithImages, jobId!, aspectRatio, subtitlePath, captionStyle);

            // 5. Done
            io.to(jobId!).emit('progress', {
                step: 'complete',
                progress: 100,
                message: 'Video ready!',
                videoUrl: `/api/download/${jobId}/final_video.mp4`
            });

            return { videoPath };

        } catch (error) {
            console.error(`Job ${jobId} failed:`, error);
            io.to(jobId!).emit('error', { message: (error as Error).message });
            throw error;
        }
    }, { connection });

    console.log('Worker initialized');
};
