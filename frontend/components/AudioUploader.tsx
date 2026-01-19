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
                p-8 border-2 w-full max-w-6xl mx-auto 
                bg-gradient-to-br from-card/80 via-card to-violet-500/5 backdrop-blur-sm 
                transition-all duration-300 shadow-xl
                ${isDragging ? 'border-primary border-solid scale-[1.01] shadow-2xl shadow-primary/20' : 'border-dashed hover:border-primary/50'}
            `}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
        >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Upload Area */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Title */}
                    <div className="space-y-2">
                        <h3 className="text-2xl font-bold tracking-tight">
                            {file ? 'Ready to Analyze' : 'Upload Your Audio'}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {file 
                                ? 'Configure settings and start generating' 
                                : 'Drag & drop or click to select an audio file'
                            }
                        </p>
                    </div>

                    {/* Upload Icon & File Input */}
                    <div 
                        className={`
                            relative p-8 rounded-2xl transition-all duration-500 cursor-pointer border-2 border-dashed
                            ${file 
                                ? 'bg-emerald-500/10 border-emerald-500/30 scale-[1.02]' 
                                : isDragging 
                                    ? 'bg-primary/10 border-primary scale-[1.02] animate-pulse' 
                                    : 'bg-gradient-to-br from-violet-500/5 to-purple-500/5 border-violet-500/20 hover:border-primary/50'
                            }
                        `}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="flex flex-col items-center justify-center gap-4">
                            {file ? (
                                <>
                                    <div className="p-4 rounded-xl bg-emerald-500/20">
                                        <Mic className="w-10 h-10 text-emerald-500" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-semibold text-sm">{file.name}</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {(file.size / 1024 / 1024).toFixed(2)} MB
                                        </p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="p-4 rounded-xl bg-violet-500/10">
                                        <Upload className="w-10 h-10 text-violet-500" />
                                    </div>
                                    <div className="text-center">
                                        <p className="font-medium text-sm">Click or drag to upload</p>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            MP3, WAV, M4A, AAC
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                        <Input 
                            ref={fileInputRef}
                            type="file" 
                            accept="audio/*" 
                            onChange={handleFileChange} 
                            className="cursor-pointer file:text-primary opacity-0 absolute inset-0 z-10"
                        />
                    </div>

                    {/* Waveform Preview */}
                    {file && (
                        <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                            <Waveform file={file} />
                        </div>
                    )}

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
                            w-full h-12 text-base font-semibold transition-all duration-300
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
                </div>

                {/* Right Column - Settings */}
                <div className="lg:col-span-2 space-y-6">
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

                    {/* Settings Grid */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Video Format */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold leading-none flex items-center gap-2">
                                <span className="text-lg">📐</span>
                                Video Format
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={aspectRatio === '9:16' ? 'default' : 'outline'}
                                    onClick={() => setAspectRatio('9:16')}
                                    className={`h-16 flex flex-col gap-1 transition-all duration-300 ${
                                        aspectRatio === '9:16' ? 'shadow-lg shadow-primary/25' : ''
                                    }`}
                                >
                                    <span className="text-xl">📱</span>
                                    <span className="text-xs font-semibold">Mobile</span>
                                    <span className="text-[9px] opacity-70">9:16</span>
                                </Button>
                                <Button
                                    type="button"
                                    variant={aspectRatio === '16:9' ? 'default' : 'outline'}
                                    onClick={() => setAspectRatio('16:9')}
                                    className={`h-16 flex flex-col gap-1 transition-all duration-300 ${
                                        aspectRatio === '16:9' ? 'shadow-lg shadow-primary/25' : ''
                                    }`}
                                >
                                    <span className="text-xl">💻</span>
                                    <span className="text-xs font-semibold">Desktop</span>
                                    <span className="text-[9px] opacity-70">16:9</span>
                                </Button>
                            </div>
                        </div>

                        {/* Caption Style */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold leading-none flex items-center gap-2">
                                <span className="text-lg">✍️</span>
                                Caption Style
                            </label>
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
                                        className="h-16 flex flex-col gap-1 p-1 text-xs"
                                    >
                                        <span className="text-base">{style.icon}</span>
                                        <span className="text-[10px] capitalize">{style.label}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Media Type */}
                        <div className="space-y-3">
                            <label className="text-sm font-semibold leading-none flex items-center gap-2">
                                <span className="text-lg">🎬</span>
                                Media Type
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'image', label: 'Images', icon: '🖼️', desc: 'Static' },
                                    { id: 'video', label: 'Videos', icon: '🎥', desc: 'Stock' },
                                    { id: 'both', label: 'Mixed', icon: '🎞️', desc: 'Both' }
                                ].map((type) => (
                                    <Button
                                        key={type.id}
                                        type="button"
                                        variant={mediaType === type.id ? 'default' : 'outline'}
                                        onClick={() => setMediaType(type.id as any)}
                                        className={`h-16 flex flex-col gap-1 transition-all duration-300 ${
                                            mediaType === type.id ? 'shadow-lg shadow-primary/25' : ''
                                        }`}
                                    >
                                        <span className="text-lg">{type.icon}</span>
                                        <span className="text-[10px] font-semibold">{type.label}</span>
                                        <span className="text-[9px] opacity-70">{type.desc}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>

                        {/* Visual Source */}
                        <div className={`space-y-3 transition-all duration-300 ${mediaType === 'video' ? 'opacity-40 pointer-events-none' : ''}`}>
                            <label className="text-sm font-semibold leading-none flex items-center gap-2">
                                <span className="text-lg">🎨</span>
                                Visual Source
                                {mediaType === 'video' && (
                                    <span className="ml-auto text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Stock only</span>
                                )}
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: 'ai', label: 'AI', icon: '🤖', desc: 'AI Gen' },
                                    { id: 'stock', label: 'Stock', icon: '📷', desc: 'Photos' },
                                    { id: 'mixed', label: 'Mix', icon: '🔀', desc: 'Both' }
                                ].map((source) => (
                                    <Button
                                        key={source.id}
                                        type="button"
                                        variant={imageSource === source.id ? 'default' : 'outline'}
                                        onClick={() => setImageSource(source.id as any)}
                                        disabled={mediaType === 'video'}
                                        className={`h-16 flex flex-col gap-1 transition-all duration-300 ${
                                            imageSource === source.id && mediaType !== 'video' ? 'shadow-lg shadow-primary/25' : ''
                                        }`}
                                    >
                                        <span className="text-lg">{source.icon}</span>
                                        <span className="text-[10px] font-semibold">{source.label}</span>
                                        <span className="text-[9px] opacity-70">{source.desc}</span>
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Info Text */}
                    <div className="pt-4 border-t border-border/50">
                        <p className="text-xs text-center text-muted-foreground">
                            💡 You'll review and approve all visuals before the final video is generated
                        </p>
                    </div>
                </div>
            </div>
        </Card>
    );
}
