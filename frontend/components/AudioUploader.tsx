'use client';

import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Upload, Mic, Loader2 } from 'lucide-react';
import axios from 'axios';
import Waveform from './Waveform';
import { Segment } from './SegmentReviewCard';

interface AnalysisResult {
    jobId: string;
    segments: Segment[];
    totalDuration: number;
}

interface AudioUploaderProps {
    onAnalyzeStart: () => void;
    onAnalysisComplete: (result: AnalysisResult) => void;
}

export default function AudioUploader({ onAnalyzeStart, onAnalysisComplete }: AudioUploaderProps) {
    const [file, setFile] = useState<File | null>(null);
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
    const [captionStyle, setCaptionStyle] = useState<'none' | 'classic' | 'modern' | 'neon'>('classic');
    const [imageSource, setImageSource] = useState<'ai' | 'stock' | 'mixed'>('mixed');
    const [mediaType, setMediaType] = useState<'image' | 'video' | 'both'>('image');
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Auto-switch image source if video is selected
    useEffect(() => {
        if (mediaType === 'video') {
            setImageSource('stock');
        }
    }, [mediaType]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile && droppedFile.type.startsWith('audio/')) {
            setFile(droppedFile);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleUpload = async () => {
        if (!file) return;

        setUploading(true);
        setUploadProgress(0);
        onAnalyzeStart();

        const formData = new FormData();
        formData.append('audio', file);
        formData.append('aspectRatio', aspectRatio);
        formData.append('captionStyle', captionStyle);
        formData.append('imageSource', imageSource);
        formData.append('mediaType', mediaType);

        try {
            // Use the new analyze endpoint
            const response = await axios.post('http://localhost:3001/api/analyze', formData, {
                onUploadProgress: (progressEvent) => {
                    const progress = progressEvent.total 
                        ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                        : 0;
                    setUploadProgress(Math.min(progress, 30)); // Cap at 30% for upload phase
                }
            });

            // Analysis complete - pass the result
            onAnalysisComplete({
                jobId: response.data.jobId,
                segments: response.data.segments,
                totalDuration: response.data.totalDuration
            });

        } catch (error) {
            console.error('Analysis failed:', error);
            alert('Analysis failed. Please try again.');
            setUploading(false);
        }
    };

    return (
        <Card 
            className={`
                p-12 border-2 flex flex-col items-center gap-6 w-full max-w-xl mx-auto 
                bg-gradient-to-br from-card/80 via-card to-violet-500/5 backdrop-blur-sm 
                transition-all duration-300 shadow-xl
                ${isDragging ? 'border-primary border-solid scale-[1.02] shadow-2xl shadow-primary/20' : 'border-dashed hover:border-primary/50'}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            {/* Upload Icon */}
            <div 
                className={`
                    p-6 rounded-2xl transition-all duration-500 cursor-pointer
                    ${file 
                        ? 'bg-emerald-500/20 scale-110' 
                        : isDragging 
                            ? 'bg-primary/20 scale-110 animate-bounce' 
                            : 'bg-gradient-to-br from-violet-500/10 to-purple-500/10 animate-pulse'
                    }
                `}
                onClick={() => fileInputRef.current?.click()}
            >
                {file ? (
                    <Mic className="w-12 h-12 text-emerald-500" />
                ) : (
                    <Upload className="w-12 h-12 text-violet-500" />
                )}
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold tracking-tight">
                    {file ? 'Ready to Analyze' : 'Upload Your Audio'}
                </h3>
                <p className="text-muted-foreground">
                    {file 
                        ? 'Configure your preferences below and start generating' 
                        : 'Drag & drop or click to select an MP3/WAV file'
                    }
                </p>
            </div>

            <div className="w-full max-w-sm space-y-5">
                {/* File Input */}
                <div 
                    className="relative cursor-pointer group"
                    onClick={() => fileInputRef.current?.click()}
                >
                    <Input 
                        ref={fileInputRef}
                        type="file" 
                        accept="audio/*" 
                        onChange={handleFileChange} 
                        className="cursor-pointer file:text-primary opacity-0 absolute inset-0 z-10"
                    />
                    <div className="flex items-center gap-3 p-3 border-2 border-dashed rounded-lg group-hover:border-primary/50 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <Upload className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {file ? file.name : 'Choose audio file'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'MP3, WAV, M4A'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Waveform Preview */}
                {file && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                        <Waveform file={file} />
                    </div>
                )}

                {/* Video Format */}
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Video Format</label>
                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            type="button"
                            variant={aspectRatio === '9:16' ? 'default' : 'outline'}
                            onClick={() => setAspectRatio('9:16')}
                            className={`h-20 flex flex-col gap-1 transition-all duration-300 ${
                                aspectRatio === '9:16' ? 'shadow-lg shadow-primary/25' : ''
                            }`}
                        >
                            <span className="text-2xl">📱</span>
                            <span className="text-sm font-semibold">Mobile</span>
                            <span className="text-[10px] opacity-70">9:16 Vertical</span>
                        </Button>
                        <Button
                            type="button"
                            variant={aspectRatio === '16:9' ? 'default' : 'outline'}
                            onClick={() => setAspectRatio('16:9')}
                            className={`h-20 flex flex-col gap-1 transition-all duration-300 ${
                                aspectRatio === '16:9' ? 'shadow-lg shadow-primary/25' : ''
                            }`}
                        >
                            <span className="text-2xl">💻</span>
                            <span className="text-sm font-semibold">Desktop</span>
                            <span className="text-[10px] opacity-70">16:9 Standard</span>
                        </Button>
                    </div>
                </div>

                {/* Caption Style */}
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Caption Style</label>
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { id: 'none', label: 'None', icon: '✕' },
                            { id: 'classic', label: 'Classic', icon: '📝' },
                            { id: 'modern', label: 'Modern', icon: '✨' },
                            { id: 'neon', label: 'Neon', icon: '💫' }
                        ].map((style) => (
                            <Button
                                key={style.id}
                                type="button"
                                variant={captionStyle === style.id ? 'default' : 'outline'}
                                onClick={() => setCaptionStyle(style.id as any)}
                                className="h-14 flex flex-col gap-0.5 p-1 text-xs"
                            >
                                <span>{style.icon}</span>
                                <span className="capitalize">{style.label}</span>
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Media Type */}
                <div className="space-y-2">
                    <label className="text-sm font-medium leading-none">Media Type</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'image', label: 'Images', icon: '🖼️', desc: 'Static visuals' },
                            { id: 'video', label: 'Videos', icon: '🎥', desc: 'Stock footage' },
                            { id: 'both', label: 'Mixed', icon: '🎞️', desc: 'Best of both' }
                        ].map((type) => (
                            <Button
                                key={type.id}
                                type="button"
                                variant={mediaType === type.id ? 'default' : 'outline'}
                                onClick={() => setMediaType(type.id as any)}
                                className={`h-20 flex flex-col gap-1 transition-all duration-300 ${
                                    mediaType === type.id ? 'shadow-lg shadow-primary/25' : ''
                                }`}
                            >
                                <span className="text-xl">{type.icon}</span>
                                <span className="text-xs font-semibold">{type.label}</span>
                                <span className="text-[10px] opacity-70">{type.desc}</span>
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Visual Source */}
                <div className={`space-y-2 transition-all duration-300 ${mediaType === 'video' ? 'opacity-40 pointer-events-none' : ''}`}>
                    <label className="text-sm font-medium leading-none flex items-center justify-between">
                        <span>Visual Source</span>
                        {mediaType === 'video' && (
                            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">Stock only for videos</span>
                        )}
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'ai', label: 'AI Generated', icon: '🤖', desc: 'Stable Diffusion' },
                            { id: 'stock', label: 'Stock', icon: '📷', desc: 'Real photos' },
                            { id: 'mixed', label: 'Smart Mix', icon: '🔀', desc: 'AI + Stock' }
                        ].map((source) => (
                            <Button
                                key={source.id}
                                type="button"
                                variant={imageSource === source.id ? 'default' : 'outline'}
                                onClick={() => setImageSource(source.id as any)}
                                disabled={mediaType === 'video'}
                                className={`h-20 flex flex-col gap-1 transition-all duration-300 ${
                                    imageSource === source.id && mediaType !== 'video' ? 'shadow-lg shadow-primary/25' : ''
                                }`}
                            >
                                <span className="text-xl">{source.icon}</span>
                                <span className="text-xs font-semibold">{source.label}</span>
                                <span className="text-[10px] opacity-70">{source.desc}</span>
                            </Button>
                        ))}
                    </div>
                </div>

                {/* Upload Progress */}
                {uploading && (
                    <div className="space-y-2 animate-in fade-in">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Analyzing content...</span>
                            <span className="font-mono text-primary">{uploadProgress}%</span>
                        </div>
                        <Progress value={uploadProgress} className="h-2" />
                    </div>
                )}

                {/* Submit Button */}
                <Button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className={`
                        w-full h-12 text-lg font-semibold transition-all duration-300
                        ${file && !uploading 
                            ? 'bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 shadow-lg shadow-violet-500/30' 
                            : ''
                        }
                    `}
                >
                    {uploading ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <Upload className="w-5 h-5 mr-2" />
                            Analyze & Generate Visuals
                        </>
                    )}
                </Button>

                {/* Info Text */}
                <p className="text-xs text-center text-muted-foreground">
                    You'll review and approve all visuals before the final video is generated
                </p>
            </div>
        </Card>
    );
}
