import express from 'express';
import upload from '../config/multer';
import { Request, Response } from 'express';
import { videoQueue } from '../services/queueService';

const router = express.Router();

router.post('/upload', upload.single('audio'), async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            res.status(400).json({ message: 'No file uploaded' });
            return;
        }

        // Add job to queue
        const aspectRatio = req.body.aspectRatio || '16:9';
        const captionStyle = req.body.captionStyle || 'none';
        const job = await videoQueue.add('process-video', {
            filePath: req.file.path,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            aspectRatio,
            captionStyle
        });

        res.status(200).json({
            message: 'File uploaded successfully',
            file: req.file,
            jobId: job.id
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error during upload' });
    }
});

export default router;
