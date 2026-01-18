import express from 'express';
import upload from '../config/multer';
import { Request, Response } from 'express';
import { transcribeAudio } from '../services/audioService';
import { analyzeTranscription } from '../services/intelligenceService';
import { generateMedia } from '../services/mediaService';
import { generateSRT } from '../utils/subtitleUtils';
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

const router = express.Router();

// Helper to get audio duration
const getDuration = (filePath: string): Promise<number> => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(metadata.format.duration || 0);
        });
    });
};

// Store job data temporarily (in production, use Redis or DB)
const jobStore: Map<string, any> = new Map();

export const getJobData = (jobId: string) => jobStore.get(jobId);
export const setJobData = (jobId: string, data: any) => jobStore.set(jobId, data);
export const updateJobSegment = (jobId: string, segmentId: number, updates: any) => {
    const job = jobStore.get(jobId);
    if (job && job.segments) {
        const segment = job.segments.find((s: any) => s.segment_id === segmentId);
        if (segment) {
            Object.assign(segment, updates);
        }
    }
};

/**
 * POST /api/analyze
 * Phase 1: Upload audio, transcribe, analyze, and generate initial visual suggestions
 * Returns segments with suggested visuals for user review
 */
router.post('/analyze', upload.single('audio'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }

        const filePath = req.file.path;
        const aspectRatio = req.body.aspectRatio || '16:9';
        const captionStyle = req.body.captionStyle || 'none';
        const imageSource = req.body.imageSource || 'mixed';
        const mediaType = req.body.mediaType || 'image';

        // Generate unique job ID
        const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Create upload directory for this job
        const uploadDir = path.join(process.cwd(), 'uploads', jobId);
        console.log(`[Analyze] Creating upload directory at: ${uploadDir}`);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Copy uploaded file to job directory (use copy instead of move for safety)
        const sanitizedFilename = req.file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const newFilePath = path.join(uploadDir, sanitizedFilename);
        fs.copyFileSync(filePath, newFilePath);

        // Clean up original uploaded file
        try {
            fs.unlinkSync(filePath);
        } catch (e) {
            console.warn('Could not delete original uploaded file:', e);
        }

        // Step 1: Transcription
        console.log(`[Job ${jobId}] Starting transcription...`);
        const transcription = await transcribeAudio(newFilePath);
        const text = transcription.text || transcription;

        // Generate subtitles if needed
        let subtitlePath: string | undefined;
        if (transcription.chunks && captionStyle !== 'none') {
            try {
                const srtContent = generateSRT(transcription.chunks);
                subtitlePath = path.join(uploadDir, 'subtitles.srt');
                fs.writeFileSync(subtitlePath, srtContent);
            } catch (srtError) {
                console.error('Failed to generate subtitles:', srtError);
            }
        }

        // Step 2: Analysis
        console.log(`[Job ${jobId}] Analyzing content...`);
        const analysis = await analyzeTranscription(text);

        // Step 3: Get audio duration and calculate segment durations
        const totalDuration = await getDuration(newFilePath);
        const segmentCount = analysis.length;
        const defaultDuration = totalDuration / segmentCount;

        // Step 4: Generate initial visual suggestions for each segment
        console.log(`[Job ${jobId}] Generating visual suggestions...`);
        const segmentsWithVisuals = [];

        for (const segment of analysis) {
            const source = imageSource;
            const type = mediaType;

            // Generate the initial visual
            const mediaResult = await generateMedia(
                segment.image_prompt,
                jobId,
                segment.segment_id,
                segment.visual_topic,
                aspectRatio,
                source,
                segment.contains_people,
                type
            );

            segmentsWithVisuals.push({
                segment_id: segment.segment_id,
                text_content: segment.text_content,
                visual_topic: segment.visual_topic,
                image_prompt: segment.image_prompt,
                sentiment: segment.sentiment,
                contains_people: segment.contains_people,
                duration: defaultDuration,
                // Visual data
                media_path: mediaResult.path,
                media_type: mediaResult.type, // 'image' or 'video'
                media_url: `/api/media/${jobId}/${path.basename(mediaResult.path)}`,
                // User can change these
                confirmed: false,
                user_media_type: mediaResult.type // What the user wants to use
            });
        }

        // Store job data for later use
        setJobData(jobId, {
            jobId,
            filePath: newFilePath,
            aspectRatio,
            captionStyle,
            imageSource,
            mediaType,
            subtitlePath,
            totalDuration,
            transcription: text,
            segments: segmentsWithVisuals
        });

        console.log(`[Job ${jobId}] Analysis complete. ${segmentsWithVisuals.length} segments ready for review.`);

        res.status(200).json({
            success: true,
            jobId,
            totalDuration,
            segmentCount: segmentsWithVisuals.length,
            segments: segmentsWithVisuals
        });

    } catch (error) {
        console.error('Analysis failed:', error);
        res.status(500).json({ message: 'Analysis failed', error: (error as Error).message });
    }
});

/**
 * GET /api/alternatives/:jobId/:segmentId
 * Fetch alternative visuals for a specific segment
 */
router.get('/alternatives/:jobId/:segmentId', async (req: Request, res: Response): Promise<void> => {
    try {
        const jobId = req.params.jobId as string;
        const segmentId = req.params.segmentId as string;
        const { type } = req.query; // 'image' or 'video'

        const jobData = getJobData(jobId);
        if (!jobData) {
            res.status(404).json({ message: 'Job not found' });
            return;
        }

        const segment = jobData.segments.find((s: any) => s.segment_id === parseInt(segmentId));
        if (!segment) {
            res.status(404).json({ message: 'Segment not found' });
            return;
        }

        // Generate 4 alternative visuals
        const alternatives = [];
        const mediaTypeToUse = (type as string) || segment.user_media_type || 'image';

        for (let i = 0; i < 4; i++) {
            const altId = `${segmentId}_alt_${i + 1}`;

            const mediaResult = await generateMedia(
                segment.image_prompt,
                jobId,
                altId as any,
                segment.visual_topic,
                jobData.aspectRatio,
                jobData.imageSource,
                segment.contains_people,
                mediaTypeToUse as any,
                i // Pass loop index as variationIndex
            );

            alternatives.push({
                id: altId,
                media_path: mediaResult.path,
                media_type: mediaResult.type,
                media_url: `/api/media/${jobId}/${path.basename(mediaResult.path)}`
            });
        }

        res.status(200).json({
            success: true,
            segmentId: parseInt(segmentId),
            alternatives
        });

    } catch (error) {
        console.error('Failed to fetch alternatives:', error);
        res.status(500).json({ message: 'Failed to fetch alternatives', error: (error as Error).message });
    }
});

/**
 * POST /api/confirm-segment/:jobId/:segmentId
 * Confirm or update a segment's visual choice
 */
router.post('/confirm-segment/:jobId/:segmentId', async (req: Request, res: Response): Promise<void> => {
    try {
        const jobId = req.params.jobId as string;
        const segmentId = req.params.segmentId as string;
        const { media_url, media_type, media_path, confirmed } = req.body;

        const jobData = getJobData(jobId);
        if (!jobData) {
            res.status(404).json({ message: 'Job not found' });
            return;
        }

        const segmentIndex = jobData.segments.findIndex((s: any) => s.segment_id === parseInt(segmentId));
        if (segmentIndex === -1) {
            res.status(404).json({ message: 'Segment not found' });
            return;
        }

        // Update the segment
        if (media_url) jobData.segments[segmentIndex].media_url = media_url;
        if (media_type) jobData.segments[segmentIndex].user_media_type = media_type;
        if (media_path) jobData.segments[segmentIndex].media_path = media_path;
        if (typeof confirmed === 'boolean') jobData.segments[segmentIndex].confirmed = confirmed;

        setJobData(jobId, jobData);

        res.status(200).json({
            success: true,
            segment: jobData.segments[segmentIndex]
        });

    } catch (error) {
        console.error('Failed to confirm segment:', error);
        res.status(500).json({ message: 'Failed to confirm segment', error: (error as Error).message });
    }
});

/**
 * GET /api/job/:jobId
 * Get current job status and segments
 */
router.get('/job/:jobId', async (req: Request, res: Response): Promise<void> => {
    try {
        const jobId = req.params.jobId as string;
        const jobData = getJobData(jobId);

        if (!jobData) {
            res.status(404).json({ message: 'Job not found' });
            return;
        }

        const allConfirmed = jobData.segments.every((s: any) => s.confirmed);

        res.status(200).json({
            success: true,
            jobId,
            allConfirmed,
            totalSegments: jobData.segments.length,
            confirmedCount: jobData.segments.filter((s: any) => s.confirmed).length,
            segments: jobData.segments
        });

    } catch (error) {
        console.error('Failed to get job:', error);
        res.status(500).json({ message: 'Failed to get job', error: (error as Error).message });
    }
});

export default router;
