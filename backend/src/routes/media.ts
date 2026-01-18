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

    // Use process.cwd() to ensure we're looking in the project root's 'uploads' folder
    // This avoids issues with src/ vs dist/ directory structures
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filePath = path.join(uploadsDir, jobId, filename);

    console.log(`[Media Serve] Request: ${jobId}/${filename}`);
    console.log(`[Media Serve] CWD: ${process.cwd()}`);
    console.log(`[Media Serve] Target Path: ${filePath}`);

    if (!fs.existsSync(filePath)) {
        console.error(`[Media Serve] File missing at ${filePath}`);
        // List directory contents to debug
        const jobDir = path.join(uploadsDir, jobId);
        if (fs.existsSync(jobDir)) {
            console.log(`[Media Serve] Contents of ${jobDir}:`, fs.readdirSync(jobDir));
        } else {
            console.log(`[Media Serve] Job directory missing: ${jobDir}`);
        }

        res.status(404).json({ message: 'File not found' });
        return;
    }

    console.log(`[Media Serve] Success: Found file`);

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
