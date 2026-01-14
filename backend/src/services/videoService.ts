import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

interface VideoSegment {
    imagePath: string;
    duration: number; // in seconds
    id: number;
}

export const createVideo = async (audioPath: string, segments: VideoSegment[], jobId: string, aspectRatio: string = '16:9'): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        const outputDir = path.join(__dirname, '../../uploads', jobId);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const finalOutputPath = path.join(outputDir, 'final_video.mp4');
        const tempListPath = path.join(outputDir, 'files.txt');

        // Configure filters based on aspect ratio
        const isVertical = aspectRatio === '9:16';

        // Output resolution
        const outW = isVertical ? 1080 : 1920;
        const outH = isVertical ? 1920 : 1080;
        const outSize = `${outW}x${outH}`;

        // Super-sampling resolution (2x output) to prevent aliasing during zoom
        const superW = outW * 2;
        const superH = outH * 2;
        const superSize = `${superW}:${superH}`;

        let fileListContent = '';

        try {
            const clipPaths: string[] = [];

            for (const segment of segments) {
                const clipPath = path.join(outputDir, `clip_${segment.id}.mp4`);
                await new Promise<void>((res, rej) => {
                    ffmpeg()
                        .input(segment.imagePath)
                        .loop(segment.duration)
                        .inputOptions(['-t', segment.duration.toString()])
                        .videoFilters([
                            // 1. Supersample Scale: Scale up to 2x resolution to ensure plenty of pixels
                            // force_original_aspect_ratio=increase ensures it fills the box
                            `scale=${superSize}:force_original_aspect_ratio=increase,crop=${superSize},setsar=1`,

                            // 2. Smooth Zoompan
                            // Zoom from 1.0 to 1.5 linearly. Output at final resolution.
                            `zoompan=z='1+(0.5*on/(${segment.duration * 30}))':d=${segment.duration * 30}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${outSize}:fps=30`
                        ])
                        .output(clipPath)
                        .videoCodec('libx264')
                        .format('mp4')
                        .on('end', () => res())
                        .on('error', (err) => rej(err))
                        .run();
                });
                clipPaths.push(clipPath);
                fileListContent += `file '${clipPath}'\n`;
            }

            fs.writeFileSync(tempListPath, fileListContent);

            // 2. Concatenate clips
            const visualPath = path.join(outputDir, 'visuals.mp4');
            await new Promise<void>((res, rej) => {
                ffmpeg()
                    .input(tempListPath)
                    .inputOptions(['-f', 'concat', '-safe', '0'])
                    .output(visualPath)
                    .on('end', () => res())
                    .on('error', (err) => rej(err))
                    .run();
            });

            // 3. Merge with Audio
            await new Promise<void>((res, rej) => {
                ffmpeg()
                    .input(visualPath)
                    .input(audioPath)
                    .outputOptions(['-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0'])
                    .output(finalOutputPath)
                    .on('end', () => res())
                    .on('error', (err) => rej(err))
                    .run();
            });

            resolve(finalOutputPath);

        } catch (error) {
            console.error('Error assembling video:', error);
            reject(error);
        }
    });
};
