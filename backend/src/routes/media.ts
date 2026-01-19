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
    
    // Get file stats
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    // Support range requests for video streaming (seeking, buffering)
    const range = req.headers.range;
    
    if (range && (ext === '.mp4' || ext === '.webm' || ext === '.mov')) {
        // Parse range header
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;
        const file = fs.createReadStream(filePath, { start, end });
        
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600'
        };
        
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        // Regular file serving (for images and non-range requests)
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Content-Length', fileSize);
        
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
    }
});

export default router;
