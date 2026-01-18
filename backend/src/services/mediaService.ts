import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Default to Automatic1111 local API
const SD_API_URL = process.env.SD_API_URL || 'http://127.0.0.1:7860/sdapi/v1/txt2img';

const downloadFile = async (url: string, dest: string): Promise<void> => {
    const writer = fs.createWriteStream(dest);
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
    });
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};

export const generateMedia = async (
    prompt: string,
    jobId: string,
    segmentId: number,
    visualTopic?: string,
    aspectRatio: string = '16:9',
    imageSource: string = 'ai',
    containsPeople: boolean = false,
    mediaType: 'image' | 'video' | 'both' = 'image',
    variationIndex: number = 0 // New parameter for distinct results
): Promise<{ path: string, type: 'image' | 'video' }> => {

    const uploadDir = path.join(process.cwd(), 'uploads', jobId);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    // Determine dimensions
    const isVertical = aspectRatio === '9:16';
    const width = isVertical ? 576 : 1024;
    const height = isVertical ? 1024 : 576;
    const pexelsOrientation = isVertical ? 'portrait' : 'landscape';
    const pollinationsWidth = isVertical ? 1080 : 1920;
    const pollinationsHeight = isVertical ? 1920 : 1080;

    // Helper: Try Pexels Video
    const tryPexelsVideo = async (): Promise<{ path: string, type: 'video' }> => {
        if (!process.env.PEXELS_API_KEY || !visualTopic) throw new Error('Pexels Video skipped (No Key or Topic)');

        const videoPath = path.join(uploadDir, `segment_${segmentId}.mp4`);
        // Add page parameter to get diverse results
        const page = variationIndex + 1;
        console.log(`[Step: Media Gen] Searching Pexels Video for: "${visualTopic}" (Page ${page})`);

        const pexelsRes = await axios.get(`https://api.pexels.com/videos/search?query=${encodeURIComponent(visualTopic)}&per_page=1&page=${page}&orientation=${pexelsOrientation}&size=medium`, {
            headers: { Authorization: process.env.PEXELS_API_KEY }
        });

        if (pexelsRes.data && pexelsRes.data.videos && pexelsRes.data.videos.length > 0) {
            const videoFiles = pexelsRes.data.videos[0].video_files;
            const videoUrl = videoFiles[0].link;

            await downloadFile(videoUrl, videoPath);
            console.log(`[Step: Media Gen] Success (Pexels Video) for segment ${segmentId}`);
            return { path: videoPath, type: 'video' };
        }
        throw new Error('No videos found on Pexels');
    };

    // Helper: Existing Image Logic (Wrapped)
    const generateStaticImage = async (): Promise<{ path: string, type: 'image' }> => {
        const imagePath = path.join(uploadDir, `segment_${segmentId}.png`);

        const tryStableDiffusion = async () => {
            console.log(`[Step: Media Gen] Trying Stable Diffusion (${width}x${height})...`);
            // Vary seed based on variationIndex
            const seed = Math.floor(Math.random() * 1000000) + (variationIndex * 12345);

            const payload = {
                prompt: prompt + ", high quality, 4k, photorealistic",
                negative_prompt: "blur, low quality, distortion, ugly",
                steps: 20,
                width: width,
                height: height,
                cfg_scale: 7,
                seed: seed
            };
            const response = await axios.post(SD_API_URL, payload, { timeout: 10000 });
            if (response.data?.images?.[0]) {
                const buffer = Buffer.from(response.data.images[0], 'base64');
                fs.writeFileSync(imagePath, buffer);
                return imagePath;
            }
            throw new Error('No image from SD');
        };

        const tryPexelsImage = async () => {
            if (!process.env.PEXELS_API_KEY || !visualTopic) throw new Error('Pexels skipped');
            const page = variationIndex + 1;
            console.log(`[Step: Media Gen] Searching Pexels Image (Page ${page})...`);

            const pexelsRes = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(visualTopic)}&per_page=1&page=${page}&orientation=${pexelsOrientation}`, {
                headers: { Authorization: process.env.PEXELS_API_KEY }
            });
            if (pexelsRes.data?.photos?.[0]) {
                await downloadFile(pexelsRes.data.photos[0].src.original, imagePath);
                return imagePath;
            }
            throw new Error('No photos on Pexels');
        };

        const tryPollinations = async () => {
            console.log(`[Step: Media Gen] Trying Pollinations...`);
            // Ensure unique seed for each variation
            const seed = Math.floor(Math.random() * 1000) + (variationIndex * 99);
            const finalPrompt = visualTopic ? `${visualTopic}, cinematic lighting, 4k` : `${prompt}, 4k`;
            const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${pollinationsWidth}&height=${pollinationsHeight}&seed=${seed}&nologo=true`;
            await downloadFile(fallbackUrl, imagePath);
            return imagePath;
        };

        // Reuse existing Stock/AI/Mixed logic for Images
        let useStock = imageSource === 'stock';
        if (imageSource === 'mixed') {
            useStock = containsPeople;
        }

        try {
            if (useStock) {
                try { return { path: await tryPexelsImage(), type: 'image' }; }
                catch (e) { return { path: await tryStableDiffusion(), type: 'image' }; }
            } else {
                try { return { path: await tryStableDiffusion(), type: 'image' }; }
                catch (e) { return { path: await tryPollinations(), type: 'image' }; }
            }
        } catch (err) {
            // Ultimate fallback
            return { path: await tryPollinations(), type: 'image' };
        }
    };

    // Main Selection Logic
    try {
        if (mediaType === 'video') {
            try {
                return await tryPexelsVideo();
            } catch (err) {
                console.warn(`[Step: Media Gen] Video failed. Fallback to Image.`);
                return await generateStaticImage();
            }
        } else if (mediaType === 'both') {
            // 50% chance of video
            if (Math.random() > 0.5) {
                try { return await tryPexelsVideo(); }
                catch (err) { return await generateStaticImage(); }
            } else {
                return await generateStaticImage();
            }
        } else {
            // 'image' only
            return await generateStaticImage();
        }

    } catch (finalError) {
        console.error('All media generation failed:', finalError);
        throw finalError;
    }
};
