'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload } from 'lucide-react';
import axios from 'axios';
import Waveform from './Waveform';

interface AudioUploaderProps {
    onUploadComplete: (file: File, jobId: string) => void;
}

export default function AudioUploader({ onUploadComplete }: AudioUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
    const [captionStyle, setCaptionStyle] = useState<'none' | 'classic' | 'modern' | 'neon'>('classic');
    const [imageSource, setImageSource] = useState<'ai' | 'stock'>('ai');
    const [uploading, setUploading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('aspectRatio', aspectRatio);
        formData.append('captionStyle', captionStyle);
        formData.append('imageSource', imageSource);

        try {
            const response = await axios.post('http://localhost:3001/api/upload', formData);
            onUploadComplete(file, response.data.jobId);
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload failed');
        } finally {
            setUploading(false);
        }
    };

    return (
        <Card className="p-12 border-dashed border-2 flex flex-col items-center gap-6 w-full max-w-xl mx-auto bg-card/50 backdrop-blur-sm transition-all hover:bg-card/80">
            <div className={`p-6 bg-primary/10 rounded-full transition-all ${file ? 'scale-110' : 'animate-pulse'}`}>
                <Upload className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold tracking-tight">Upload Your Audio</h3>
                <p className="text-muted-foreground">Drag & drop or select an MP3/WAV file to generate your video</p>
            </div>

            <div className="w-full max-w-sm space-y-4">
                <Input type="file" accept="audio/*" onChange={handleFileChange} className="cursor-pointer file:text-primary" />

                {file && (
                    <div className="animate-in fade-in slide-in-from-top-4">
                        <Waveform file={file} />
                        <p className="text-xs text-center text-muted-foreground mt-2">{file.name}</p>
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Video Format</label>
                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            type="button"
                            variant={aspectRatio === '9:16' ? 'default' : 'outline'}
                            onClick={() => setAspectRatio('9:16')}
                            className="h-20 flex flex-col gap-1 border-2"
                        >
                            <span className="text-lg font-bold">📱 Mobile</span>
                            <span className="text-xs opacity-70">9:16 (Reels/TikTok)</span>
                        </Button>
                        <Button
                            type="button"
                            variant={aspectRatio === '16:9' ? 'default' : 'outline'}
                            onClick={() => setAspectRatio('16:9')}
                            className="h-20 flex flex-col gap-1 border-2"
                        >
                            <span className="text-lg font-bold">💻 Desktop</span>
                            <span className="text-xs opacity-70">16:9 (Standard)</span>
                        </Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Caption Style</label>
                    <div className="grid grid-cols-2 gap-2">
                        {['none', 'classic', 'modern', 'neon'].map((style) => (
                            <Button
                                key={style}
                                type="button"
                                variant={captionStyle === style ? 'default' : 'outline'}
                                onClick={() => setCaptionStyle(style as any)}
                                className="capitalize h-10"
                            >
                                {style}
                            </Button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Visual Source</label>
                    <div className="grid grid-cols-2 gap-4">
                        <Button
                            type="button"
                            variant={imageSource === 'ai' ? 'default' : 'outline'}
                            onClick={() => setImageSource('ai')}
                            className="h-20 flex flex-col gap-1 border-2"
                        >
                            <span className="text-lg font-bold">✨ AI Generated</span>
                            <span className="text-xs opacity-70">Stable Diffusion / Pollinations</span>
                        </Button>
                        <Button
                            type="button"
                            variant={imageSource === 'stock' ? 'default' : 'outline'}
                            onClick={() => setImageSource('stock')}
                            className="h-20 flex flex-col gap-1 border-2"
                        >
                            <span className="text-lg font-bold">📷 Stock Images</span>
                            <span className="text-xs opacity-70">Real Photos (Pexels)</span>
                        </Button>
                    </div>
                </div>

                <Button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="w-full h-11 text-lg font-medium"
                >
                    {uploading ? 'Uploading...' : 'Start Generation'}
                </Button>
            </div>
        </Card>
    );
}
