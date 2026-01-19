import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    // Allowed MIME types
    const allowedMimeTypes = [
        'audio/mpeg',
        'audio/mp3',
        'audio/x-mpeg',
        'audio/x-mp3',
        'audio/mpeg3',
        'audio/wav',
        'audio/wave',
        'audio/x-wav',
        'audio/x-m4a',
        'audio/mp4',
        'audio/x-m4a',
        'audio/aac',
        'audio/ogg',
        'audio/webm',
        'audio/flac',
        'audio/x-flac'
    ];
    
    // Allowed file extensions (as fallback)
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.mp4', '.aac', '.ogg', '.webm', '.flac'];
    
    const fileExt = path.extname(file.originalname).toLowerCase();
    const isValidMimeType = allowedMimeTypes.includes(file.mimetype);
    const isValidExtension = allowedExtensions.includes(fileExt);
    
    if (isValidMimeType || isValidExtension) {
        cb(null, true);
    } else {
        cb(new Error(`Invalid file type. Only audio files are allowed. Received: ${file.mimetype}, extension: ${fileExt}`));
    }
};

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 1024 * 1024 * 50 // 50MB limit
    },
    fileFilter: fileFilter
});

export default upload;
