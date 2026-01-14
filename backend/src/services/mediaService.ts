import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Default to Automatic1111 local API
const SD_API_URL = process.env.SD_API_URL || 'http://127.0.0.1:7860/sdapi/v1/txt2img';

const downloadImage = async (url: string, dest: string): Promise<void> => {
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

export const generateImage = async (prompt: string, jobId: string, segmentId: number, visualTopic?: string, aspectRatio: string = '16:9'): Promise<string> => {
    const uploadDir = path.join(__dirname, '../../uploads', jobId);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const imagePath = path.join(uploadDir, `segment_${segmentId}.png`);

    // Determine dimensions based on aspect ratio
    const isVertical = aspectRatio === '9:16';
    // Local SD: 576x1024 for vertical (safe), 1024x576 for horizontal.
    const width = isVertical ? 576 : 1024;
    const height = isVertical ? 1024 : 576;

    // External APIs (Pollinations/Pexels) can handle higher res
    const pexelsOrientation = isVertical ? 'portrait' : 'landscape';
    const pollinationsWidth = isVertical ? 1080 : 1920;
    const pollinationsHeight = isVertical ? 1920 : 1080;

    // 1. Try Stable Diffusion (Local)
    try {
        console.log(`[Step: Image Gen] Trying Stable Diffusion (${width}x${height})...`);

        // Payload for Automatic1111
        const payload = {
            prompt: prompt + ", high quality, 4k, photorealistic",
            negative_prompt: "blur, low quality, distortion, ugly",
            steps: 20,
            width: width,
            height: height,
            cfg_scale: 7
        };

        const response = await axios.post(SD_API_URL, payload, { timeout: 10000 }); // 10s timeout

        if (response.data && response.data.images && response.data.images[0]) {
            const base64Image = response.data.images[0];
            const buffer = Buffer.from(base64Image, 'base64');
            fs.writeFileSync(imagePath, buffer);
            console.log(`[Step: Image Gen] Success (Stable Diffusion) for segment ${segmentId}`);
            return imagePath;
        } else {
            throw new Error('No image returned from SD API');
        }

    } catch (error) {
        console.warn(`[Step: Image Gen] SD failed. Trying Fallbacks...`);

        // 2. Try Pexels (Stock Images) - Requires API KEY
        if (process.env.PEXELS_API_KEY && visualTopic) {
            try {
                console.log(`[Step: Image Gen] Searching Pexels for: "${visualTopic}" (${pexelsOrientation})`);
                const pexelsRes = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(visualTopic)}&per_page=1&orientation=${pexelsOrientation}`, {
                    headers: { Authorization: process.env.PEXELS_API_KEY }
                });

                if (pexelsRes.data && pexelsRes.data.photos && pexelsRes.data.photos.length > 0) {
                    const photoUrl = pexelsRes.data.photos[0].src.original; // Use original for best quality
                    await downloadImage(photoUrl, imagePath);
                    console.log(`[Step: Image Gen] Success (Pexels Stock) for segment ${segmentId}`);
                    return imagePath;
                }
            } catch (pexelsErr) {
                console.warn(`[Step: Image Gen] Pexels failed:`, (pexelsErr as Error).message);
            }
        }

        // 3. Try Pollinations.ai (Free AI, High Quality)
        try {
            console.log(`[Step: Image Gen] Trying Pollinations (AI Fallback)...`);
            const seed = Math.floor(Math.random() * 1000);
            const finalPrompt = visualTopic ? `${visualTopic}, cinematic lighting, 4k` : `${prompt}, 4k`;
            const encodedPrompt = encodeURIComponent(finalPrompt);
            const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${pollinationsWidth}&height=${pollinationsHeight}&seed=${seed}&nologo=true`;

            await downloadImage(fallbackUrl, imagePath);
            console.log(`[Step: Image Gen] Success (Pollinations) for segment ${segmentId}`);
            return imagePath;

        } catch (fallbackError) {
            console.error(`[Step: Image Gen] All fallbacks failed:`, fallbackError);
            throw fallbackError;
        }
    }
};
