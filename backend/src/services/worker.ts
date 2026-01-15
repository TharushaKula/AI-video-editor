import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { transcribeAudio } from './audioService';
import { analyzeTranscription } from './intelligenceService';
import { generateMedia } from './mediaService';
import { createVideo } from './videoService';
import { getIO } from './socketService';
import ffmpeg from 'fluent-ffmpeg';
import util from 'util';
import fs from 'fs';
import path from 'path';
import { generateSRT } from '../utils/subtitleUtils';
import { videoQueue } from './queueService';

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

export const initWorker = async () => {
    try {
        const counts = await videoQueue.getJobCounts('wait', 'active', 'delayed');
        const totalPending = counts.wait + counts.active + counts.delayed;
        if (totalPending > 0) {
            console.log(`\n[Worker] ⚠️  Found ${totalPending} pending/active jobs in the queue from a previous session.`);
            console.log(`[Worker] ▶️  Resuming processing automatically...`);
        } else {
            console.log(`[Worker] Queue is empty. Waiting for new jobs...`);
        }
    } catch (err) {
        console.warn('[Worker] Failed to check queue status:', err);
    }

    const worker = new Worker('video-generation', async job => {
        const io = getIO();
        const jobId = job.id;
        // Extract all parameters
        const { filePath, aspectRatio, captionStyle, imageSource, mediaType } = job.data;

        console.log(`Processing job ${jobId} (Aspect: ${aspectRatio}, Media: ${mediaType || 'image'})`);

        try {
            // 1. Transcription
            io.to(jobId!).emit('progress', { step: 'transcription', progress: 10, message: 'Transcribing audio...' });

            const transcription = await transcribeAudio(filePath);
            const text = transcription.text || transcription;

            // Subtitles
            let subtitlePath: string | undefined;
            if (transcription.chunks && captionStyle !== 'none') {
                try {
                    const srtContent = generateSRT(transcription.chunks);
                    const uploadDir = path.join(__dirname, '../../uploads', jobId!);
                    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
                    subtitlePath = path.join(uploadDir, 'subtitles.srt');
                    fs.writeFileSync(subtitlePath, srtContent);
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

            const segmentsWithMedia = [];
            let currentProgress = 55;
            const progressStep = 30 / Math.max(segmentCount, 1);

            for (const segment of analysis) {
                const source = imageSource || 'ai';
                const type = mediaType || 'image';

                // Call generateMedia
                const mediaResult = await generateMedia(
                    segment.image_prompt,
                    jobId!,
                    segment.segment_id,
                    segment.visual_topic,
                    aspectRatio,
                    source,
                    segment.contains_people,
                    type
                );

                segmentsWithMedia.push({
                    imagePath: mediaResult.path,
                    mediaType: mediaResult.type,
                    duration: defaultDuration,
                    id: segment.segment_id
                });

                currentProgress += progressStep;
                io.to(jobId!).emit('progress', { step: 'media', progress: Math.min(85, currentProgress), message: `Generated segment ${segment.segment_id}/${segmentCount}` });
            }

            // 4. Video Assembly
            io.to(jobId!).emit('progress', { step: 'assembly', progress: 90, message: 'Assembling video...' });

            // Pass segmentsWithMedia
            const videoPath = await createVideo(filePath, segmentsWithMedia, jobId!, aspectRatio, subtitlePath, captionStyle);

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
