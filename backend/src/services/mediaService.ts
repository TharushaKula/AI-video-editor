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

export const generateImage = async (prompt: string, jobId: string, segmentId: number, visualTopic?: string, aspectRatio: string = '16:9', imageSource: string = 'ai'): Promise<string> => {
    const uploadDir = path.join(__dirname, '../../uploads', jobId);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const imagePath = path.join(uploadDir, `segment_${segmentId}.png`);

    // Determine dimensions based on aspect ratio
    const isVertical = aspectRatio === '9:16';
    const width = isVertical ? 576 : 1024;
    const height = isVertical ? 1024 : 576;
    const pexelsOrientation = isVertical ? 'portrait' : 'landscape';
    const pollinationsWidth = isVertical ? 1080 : 1920;
    const pollinationsHeight = isVertical ? 1920 : 1080;

    // Helper functions for each source
    const tryStableDiffusion = async () => {
        console.log(`[Step: Image Gen] Trying Stable Diffusion (${width}x${height})...`);
        const payload = {
            prompt: prompt + ", high quality, 4k, photorealistic",
            negative_prompt: "blur, low quality, distortion, ugly",
            steps: 20,
            width: width,
            height: height,
            cfg_scale: 7
        };
        const response = await axios.post(SD_API_URL, payload, { timeout: 10000 });
        if (response.data && response.data.images && response.data.images[0]) {
            const buffer = Buffer.from(response.data.images[0], 'base64');
            fs.writeFileSync(imagePath, buffer);
            console.log(`[Step: Image Gen] Success (Stable Diffusion) for segment ${segmentId}`);
            return imagePath;
        }
        throw new Error('No image returned from SD API');
    };

    const tryPexels = async () => {
        if (!process.env.PEXELS_API_KEY || !visualTopic) throw new Error('Pexels skipped (No Key or Topic)');
        console.log(`[Step: Image Gen] Searching Pexels for: "${visualTopic}" (${pexelsOrientation})`);
        const pexelsRes = await axios.get(`https://api.pexels.com/v1/search?query=${encodeURIComponent(visualTopic)}&per_page=1&orientation=${pexelsOrientation}`, {
            headers: { Authorization: process.env.PEXELS_API_KEY }
        });
        if (pexelsRes.data && pexelsRes.data.photos && pexelsRes.data.photos.length > 0) {
            const photoUrl = pexelsRes.data.photos[0].src.original;
            await downloadImage(photoUrl, imagePath);
            console.log(`[Step: Image Gen] Success (Pexels Stock) for segment ${segmentId}`);
            return imagePath;
        }
        throw new Error('No photos found on Pexels');
    };

    const tryPollinations = async () => {
        console.log(`[Step: Image Gen] Trying Pollinations (AI Fallback)...`);
        const seed = Math.floor(Math.random() * 1000);
        const finalPrompt = visualTopic ? `${visualTopic}, cinematic lighting, 4k` : `${prompt}, 4k`;
        const encodedPrompt = encodeURIComponent(finalPrompt);
        const fallbackUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${pollinationsWidth}&height=${pollinationsHeight}&seed=${seed}&nologo=true`;
        await downloadImage(fallbackUrl, imagePath);
        console.log(`[Step: Image Gen] Success (Pollinations) for segment ${segmentId}`);
        return imagePath;
    };

    // Execution Logic
    try {
        if (imageSource === 'stock') {
            // Priority: Pexels -> (Fallback: Stable Diffusion -> Pollinations)
            try { return await tryPexels(); } catch (e) {
                console.warn(`[Step: Image Gen] Stock failed: ${(e as Error).message}. Falling back to AI.`);
                try { return await tryStableDiffusion(); } catch (sdErr) { return await tryPollinations(); }
            }
        } else {
            // Priority: Stable Diffusion -> Pollinations -> (Fallback: Pexels)
            try { return await tryStableDiffusion(); } catch (sdErr) {
                console.warn(`[Step: Image Gen] SD failed. Falling back to Pollinations...`);
                try { return await tryPollinations(); } catch (pollErr) {
                    console.warn(`[Step: Image Gen] Pollinations failed. Last resort: Pexels.`);
                    return await tryPexels();
                }
            }
        }
    } catch (finalError) {
        console.error(`[Step: Image Gen] All sources failed for segment ${segmentId}:`, finalError);
        // Last ditch effort: Create a blank/error image or re-throw
        throw finalError;
    }
};
