import express from 'express';
import { videoQueue } from '../services/queueService';

const router = express.Router();

router.get('/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const job = await videoQueue.getJob(jobId);

        if (!job) {
            res.status(404).json({ message: 'Job not found' });
            return;
        }

        const state = await job.getState();
        const progress = job.progress;
        const result = job.returnvalue;
        const reason = job.failedReason;

        res.json({
            id: job.id,
            state,
            progress,
            result,
            error: reason
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;
