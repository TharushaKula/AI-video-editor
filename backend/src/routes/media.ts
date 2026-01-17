import express from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();

/**
 * GET /api/media/:jobId/:filename
 * Serve media files (images/videos) for preview
 */
router.get('/media/:jobId/:filename', (req, res) => {
    const { jobId, filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads', jobId, filename);

    if (!fs.existsSync(filePath)) {
        res.status(404).json({ message: 'File not found' });
        return;
    }

    // Determine content type
    const ext = path.extname(filename).toLowerCase();
    const contentTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
});

export default router;
