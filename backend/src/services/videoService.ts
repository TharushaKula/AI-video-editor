import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import os from 'os';

interface VideoSegment {
    imagePath: string; // Used for both Image and Video paths
    mediaType?: 'image' | 'video'; // discriminator
    duration: number;
    start_time?: number; // Precise start time in audio (seconds)
    end_time?: number; // Precise end time in audio (seconds)
    id: number;
}

export const createVideo = (audioPath: string, segments: VideoSegment[], jobId: string, aspectRatio: string = '16:9', subtitlePath?: string, captionStyle?: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadDir = path.join(process.cwd(), 'uploads', jobId);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const outputPath = path.join(uploadDir, 'final_video.mp4');
        // FFmpeg can fail with "Invalid argument" when the path contains spaces; write to temp (no spaces) then move
        const safeDir = path.join(os.tmpdir(), 'video-editor', jobId.replace(/[^a-zA-Z0-9_-]/g, '_'));
        const outputPathSafe = path.join(safeDir, 'final_video.mp4');
        const useSafePath = outputPath.includes(' ');
        if (useSafePath && !fs.existsSync(safeDir)) {
            fs.mkdirSync(safeDir, { recursive: true });
        }

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

        // Process video segments
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

        // Process audio segments - extract precise audio portions matching video segments
        const audioInputIndex = segments.length; // Audio is the last input
        const audioSegments: string[] = [];
        
        segments.forEach((segment, index) => {
            // Use precise timestamps if available, otherwise use sequential timing
            const audioStart = segment.start_time !== undefined ? segment.start_time : 
                segments.slice(0, index).reduce((sum, s) => sum + s.duration, 0);
            const audioDuration = segment.duration;
            
            // Extract audio segment: atrim=start=START:duration=DURATION,asetpts=PTS-STARTPTS
            // This ensures perfect alignment with video segment timing
            const audioLabel = `a${index}`;
            filterComplex.push(`[${audioInputIndex}:a]atrim=start=${audioStart}:duration=${audioDuration},asetpts=PTS-STARTPTS[${audioLabel}]`);
            audioSegments.push(`[${audioLabel}]`);
        });

        // Concatenate video segments
        const concatFilter = `${inputMap.join('')}concat=n=${segments.length}:v=1:a=0[vconcat]`;
        filterComplex.push(concatFilter);
        
        // Concatenate audio segments
        const audioConcatFilter = `${audioSegments.join('')}concat=n=${segments.length}:v=0:a=1[aconcat]`;
        filterComplex.push(audioConcatFilter);

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

        // Caption Styles (FFmpeg force_style uses BGR hex format: &HAABBGGRR)
        const fontSize = isVertical ? 18 : 24;
        const styles: Record<string, string> = {
            'classic': `Fontname=Arial,FontSize=${fontSize},PrimaryColour=&H00FFFFFF,Outline=1,Shadow=1,MarginV=30`,
            'modern': `Fontname=Arial,FontSize=${fontSize},PrimaryColour=&H0000FFFF,BorderStyle=3,Outline=0,Shadow=0,MarginV=50,BackColour=&H00000000,Alignment=2`,
            'neon': `Fontname=Arial,FontSize=${fontSize},PrimaryColour=&H00FF00FF,Outline=2,Shadow=0,MarginV=30,Bold=1`
        };
        const selectedStyle = styles[captionStyle || 'classic'] || styles['classic'];

        // Build complete filter complex (with or without subtitles)
        let finalFilterComplex = [...filterComplex];
        let videoOutputLabel = 'vconcat';
        let outputLabels = ['vconcat', 'aconcat'];

        if (subtitlePath && fs.existsSync(subtitlePath)) {
            // Add subtitles filter
            const escapedPath = subtitlePath.replace(/\\/g, '/').replace(/:/g, '\\:');
            finalFilterComplex.push(`[vconcat]subtitles='${escapedPath}':force_style='${selectedStyle}'[vfinal]`);
            videoOutputLabel = 'vfinal';
            outputLabels = ['vfinal', 'aconcat'];
        }

        // Apply Filter Complex - specify both video and audio outputs (only once)
        const complexStr = finalFilterComplex.join(';');
        chain = chain.complexFilter(complexStr, outputLabels);

        const totalDuration = segments.reduce((acc, s) => acc + s.duration, 0) + 1;

        // Output options (do not add -map here; complexFilter(..., outputLabels) already adds -map [vfinal] and -map [aconcat])
        const outputOptions = [
            '-pix_fmt', 'yuv420p',
            '-t', `${totalDuration}` // Hard limit slightly above duration
        ];

        chain = chain.outputOptions(outputOptions);
        
        // Add audio codec
        chain = chain.outputOptions(['-c:a', 'aac', '-b:a', '128k']);

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
            if (useSafePath) {
                try {
                    fs.renameSync(outputPathSafe, outputPath);
                } catch (e) {
                    try {
                        fs.copyFileSync(outputPathSafe, outputPath);
                        fs.unlinkSync(outputPathSafe);
                    } catch (e2) {
                        reject(e2);
                        return;
                    }
                }
            }
            console.log('Video created successfully');
            resolve(outputPath);
        });

        const savePath = useSafePath ? outputPathSafe : outputPath;
        chain.save(savePath);
    });
};
