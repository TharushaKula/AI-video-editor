import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';

interface VideoSegment {
    imagePath: string; // Used for both Image and Video paths
    mediaType?: 'image' | 'video'; // discriminator
    duration: number;
    id: number;
}

export const createVideo = (audioPath: string, segments: VideoSegment[], jobId: string, aspectRatio: string = '16:9', subtitlePath?: string, captionStyle?: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadDir = path.join(__dirname, '../../uploads', jobId);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const outputPath = path.join(uploadDir, 'final_video.mp4');

        // Determine dimensions
        const isVertical = aspectRatio === '9:16';
        const width = isVertical ? 576 : 1024;
        const height = isVertical ? 1024 : 576;

        // Create complex filter manually for better control
        const filterComplex: string[] = [];
        const inputMap: string[] = [];

        // Scale dimensions based on aspect ratio
        const scaleW = width;
        const scaleH = height;

        segments.forEach((segment, index) => {
            // Distinguish between Image and Video
            if (segment.mediaType === 'video') {
                // For video: Scale -> Crop -> Trim -> SetPTS
                // We need to force it to fill the screen (cover)
                const scaleFilter = `scale=${scaleW}:${scaleH}:force_original_aspect_ratio=increase`;
                const cropFilter = `crop=${scaleW}:${scaleH}`;
                // Trim to exact segment duration
                const trimFilter = `trim=duration=${segment.duration}`;
                const ptsFilter = `setpts=PTS-STARTPTS`;

                filterComplex.push(`[${index}:v]${scaleFilter},${cropFilter},${trimFilter},${ptsFilter}[v${index}]`);
            } else {
                // For image: Scale -> ZoomPan
                // We apply .loop(duration) on input, giving infinite stream. We assume ~25fps for ZoomPan duration.

                // Scale image first to avoid zoompan errors on large images
                // But ZoomPan creates new frames, so we can do it directly on input if we set size.

                // ZoomPan Effect
                const fps = 25;
                const d = Math.ceil(segment.duration * fps) + fps; // Duration in frames. Add buffer to prevent blink.
                const s = `${scaleW}x${scaleH}`;
                // Simple center zoom with explicit fps + trim + pts reset for concat
                const zoompan = `zoompan=z='min(zoom+0.0015,1.5)':d=${d}:s=${s}:fps=${fps}`;
                const trimFilter = `trim=duration=${segment.duration}`;
                const ptsFilter = `setpts=PTS-STARTPTS`;

                filterComplex.push(`[${index}:v]${zoompan},${trimFilter},${ptsFilter}[v${index}]`);
            }
            inputMap.push(`[v${index}]`);
        });

        const concatFilter = `${inputMap.join('')}concat=n=${segments.length}:v=1:a=0[vconcat]`;
        filterComplex.push(concatFilter);

        // Build FFmpeg command
        let chain = ffmpeg();

        // Add inputs
        segments.forEach(segment => {
            if (segment.mediaType === 'video') {
                chain = chain.input(segment.imagePath); // It's an mp4 path
            } else {
                // Keep input alive; duration is controlled by zoompan/concat and output -t.
                chain = chain.input(segment.imagePath).inputOptions(['-loop 1']);
            }
        });

        // Add audio track (last input)
        chain = chain.input(audioPath);

        // Apply Filter Complex
        const complexStr = filterComplex.join(';');
        chain = chain.complexFilter(complexStr, ['vconcat']);

        const totalDuration = segments.reduce((acc, s) => acc + s.duration, 0) + 1;

        // Output Options
        let outputOptions = [
            '-map', '[vconcat]', // Map video from filter
            '-map', `${segments.length}:a`, // Map audio from file (it is the Nth input, 0-indexed)
            '-pix_fmt', 'yuv420p',
            // '-shortest' // CAUTION: With complex filters and exact trims, shortest can sometimes cut prematurely if audio is slightly shorter.
            // We'll rely on our segment math.
            '-t', `${totalDuration}` // Hard limit slightly above duration
        ];

        // Caption Styles (FFmpeg force_style uses BGR hex format: &HAABBGGRR)
        const fontSize = isVertical ? 18 : 24;
        const styles: Record<string, string> = {
            'classic': `Fontname=Arial,FontSize=${fontSize},PrimaryColour=&H00FFFFFF,Outline=1,Shadow=1,MarginV=30`,
            'modern': `Fontname=Arial,FontSize=${fontSize},PrimaryColour=&H0000FFFF,BorderStyle=3,Outline=0,Shadow=0,MarginV=50,BackColour=&H00000000,Alignment=2`,
            'neon': `Fontname=Arial,FontSize=${fontSize},PrimaryColour=&H00FF00FF,Outline=2,Shadow=0,MarginV=30,Bold=1`
        };
        const selectedStyle = styles[captionStyle || 'classic'] || styles['classic'];

        if (subtitlePath && fs.existsSync(subtitlePath)) {
            // Use complex filter for subtitles
            // path must be escaped for ffmpeg
            const escapedPath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:'); // Simple escape
            // Since we already have a complex filter chain ending in [vconcat], we need to chain subtitles onto it.
            // But complexFilter() only takes one string.
            // We need to append the subtitles filter to the existing graph.

            // New strategy: Append ",subtitles=..." to the concat filter string
            // But subtitles filter usually takes a filename.
            // [vconcat]subtitles='path'[vfinal]

            outputOptions = [
                '-map', '[vfinal]',
                '-map', `${segments.length}:a`,
                '-pix_fmt', 'yuv420p',
                '-t', `${totalDuration}`
            ];

            // Extend the complex filter
            // Replace the last [vconcat] with intermediate label or chain it
            // Current list: ..., concat=...[vconcat]
            // We add: ;[vconcat]subtitles=...[vfinal]

            // Re-construct complex string
            chain = chain.complexFilter([
                ...filterComplex,
                `[vconcat]subtitles='${escapedPath}':force_style='${selectedStyle}'[vfinal]`
            ]);

        } else {
            // No subtitles
            // Map [vconcat] directly
        }

        chain = chain.outputOptions(outputOptions);

        // Add x264 encoding params. Removed -shortest to prevent premature cuts; we rely on -t.
        chain = chain.outputOptions(['-c:v', 'libx264', '-preset', 'fast', '-crf', '23']);

        chain.on('start', (commandLine) => {
            console.log('Spawned Ffmpeg with command: ' + commandLine);
        });

        chain.on('error', (err) => {
            console.error('An error occurred: ' + err.message);
            reject(err);
        });

        chain.on('end', () => {
            console.log('Video created successfully');
            resolve(outputPath);
        });

        chain.save(outputPath);
    });
};
