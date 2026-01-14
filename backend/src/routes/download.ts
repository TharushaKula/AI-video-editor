import express from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();

router.get('/download/:jobId/:filename', (req, res) => {
    const { jobId, filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads', jobId, filename);

    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ message: 'File not found' });
    }
});

export default router;
