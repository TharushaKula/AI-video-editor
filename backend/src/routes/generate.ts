import express from 'express';
import { Request, Response } from 'express';
import { getJobData, setJobData } from './analyze';
import { createVideo } from '../services/videoService';
import { getIO } from '../services/socketService';

const router = express.Router();

/**
 * POST /api/generate/:jobId
 * Phase 2: Generate final video with user-confirmed visuals
 * Only proceeds if all segments are confirmed
 */
router.post('/generate/:jobId', async (req: Request, res: Response): Promise<void> => {
    const io = getIO();
    const jobId = req.params.jobId as string;

    try {
        const jobData = getJobData(jobId);
        if (!jobData) {
            res.status(404).json({ message: 'Job not found' });
            return;
        }

        // Check if all segments are confirmed
        const unconfirmed = jobData.segments.filter((s: any) => !s.confirmed);
        if (unconfirmed.length > 0) {
            res.status(400).json({
                message: 'Not all segments are confirmed',
                unconfirmedCount: unconfirmed.length,
                unconfirmedSegments: unconfirmed.map((s: any) => s.segment_id)
            });
            return;
        }

        // Start generation - respond immediately
        res.status(200).json({
            success: true,
            message: 'Video generation started',
            jobId
        });

        // Emit progress event
        io.to(jobId).emit('progress', {
            step: 'assembly',
            progress: 5,
            message: 'Starting video assembly with your approved visuals...'
        });

        // Build segments array for video creation
        const segmentsForVideo = jobData.segments.map((segment: any) => ({
            imagePath: segment.media_path,
            mediaType: segment.user_media_type || segment.media_type,
            duration: segment.duration,
            id: segment.segment_id
        }));

        io.to(jobId).emit('progress', {
            step: 'assembly',
            progress: 30,
            message: 'Assembling video segments...'
        });

        // Create the final video
        const videoPath = await createVideo(
            jobData.filePath,
            segmentsForVideo,
            jobId,
            jobData.aspectRatio,
            jobData.subtitlePath,
            jobData.captionStyle
        );

        // Update job data with video path
        jobData.videoPath = videoPath;
        jobData.status = 'complete';
        setJobData(jobId, jobData);

        // Emit completion
        io.to(jobId).emit('progress', {
            step: 'complete',
            progress: 100,
            message: 'Video ready!',
            videoUrl: `/api/download/${jobId}/final_video.mp4`
        });

    } catch (error) {
        console.error(`Generation failed for job ${jobId}:`, error);
        io.to(jobId).emit('error', { message: (error as Error).message });
    }
});

/**
 * POST /api/confirm-all/:jobId
 * Confirm all segments at once (bulk confirmation)
 */
router.post('/confirm-all/:jobId', async (req: Request, res: Response): Promise<void> => {
    try {
        const jobId = req.params.jobId as string;
        const jobData = getJobData(jobId);

        if (!jobData) {
            res.status(404).json({ message: 'Job not found' });
            return;
        }

        // Confirm all segments
        jobData.segments.forEach((segment: any) => {
            segment.confirmed = true;
        });

        setJobData(jobId, jobData);

        res.status(200).json({
            success: true,
            message: 'All segments confirmed',
            confirmedCount: jobData.segments.length
        });

    } catch (error) {
        console.error('Failed to confirm all segments:', error);
        res.status(500).json({ message: 'Failed to confirm all', error: (error as Error).message });
    }
});

export default router;
