import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

interface VideoSegment {
    imagePath: string;
    duration: number; // in seconds
    id: number;
}

export const createVideo = async (audioPath: string, segments: VideoSegment[], jobId: string, aspectRatio: string = '16:9', subtitlePath?: string, captionStyle: string = 'classic'): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        const outputDir = path.join(__dirname, '../../uploads', jobId);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const finalOutputPath = path.join(outputDir, 'final_video.mp4');
        const mkVPath = path.join(outputDir, 'temp_video.mkv'); // Intermediate for subtitle burning
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

        // Font Size scaling based on resolution
        const fontSize = isVertical ? 18 : 24;

        // Caption Styles (FFmpeg force_style uses BGR hex format: &HAABBGGRR)
        const styles: Record<string, string> = {
            'classic': `Fontname=Arial,FontSize=${fontSize},PrimaryColour=&H00FFFFFF,Outline=1,Shadow=1,MarginV=30`, // White text, Black outline
            // Yellow text (BGR: 00FFFF) with Opaque Black Box (Alpha: 00)
            'modern': `Fontname=Arial,FontSize=${fontSize},PrimaryColour=&H0000FFFF,BorderStyle=3,Outline=0,Shadow=0,MarginV=50,BackColour=&H00000000,Alignment=2`,
            // Neon Pink (BGR: FF00FF) with thicker outline for glow
            'neon': `Fontname=Arial,FontSize=${fontSize},PrimaryColour=&H00FF00FF,Outline=2,Shadow=0,MarginV=30,Bold=1`
        };
        const selectedStyle = styles[captionStyle] || styles['classic'];

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

            // 3. Merge with Audio AND Burn Subtitles
            await new Promise<void>((res, rej) => {
                let chain = ffmpeg()
                    .input(visualPath)
                    .input(audioPath);

                const outputOptions = ['-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0'];

                // If subtitles exist, we must re-encode video to burn them
                // Note: 'subtitles' filter usually requires re-encoding.
                if (subtitlePath && fs.existsSync(subtitlePath)) {
                    // Use complex filter for subtitles
                    // path must be escaped for ffmpeg
                    const escapedPath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
                    chain = chain.videoFilters(`subtitles='${escapedPath}':force_style='${selectedStyle}'`);
                    // Cannot use copy for video if filtering
                    chain = chain.outputOptions(['-c:v', 'libx264', '-preset', 'fast', '-crf', '23', ...outputOptions]);
                } else {
                    // No subtitles, fast copy
                    chain = chain.outputOptions(['-c:v', 'copy', ...outputOptions]);
                }

                chain
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
