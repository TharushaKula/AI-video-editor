'use client';

import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Sparkles, Play, Pause, Volume2, VolumeX, Maximize, Copy, Hash, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface VideoPlayerProps {
    videoUrl: string;
    onReset: () => void;
    seoMetadata?: {
        title: string;
        description: string;
        hashtags: string[];
    };
}

export default function VideoPlayer({ videoUrl, onReset, seoMetadata }: VideoPlayerProps) {
    // Extract jobId and filename from videoUrl (format: /api/download/jobId/filename)
    const urlParts = videoUrl.split('/');
    const jobId = urlParts[urlParts.length - 2];
    const filename = urlParts[urlParts.length - 1];

    // Use media route for streaming instead of download route
    const videoSrc = `http://localhost:3001/api/media/${jobId}/${filename}`;
    const downloadUrl = `http://localhost:3001${videoUrl}`;

    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);

    const handlePlayPause = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
        }
    };

    const handleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            setCurrentTime(videoRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (videoRef.current) {
            setDuration(videoRef.current.duration);
        }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = parseFloat(e.target.value);
        if (videoRef.current) {
            videoRef.current.currentTime = newTime;
            setCurrentTime(newTime);
        }
    };

    const handleFullscreen = () => {
        if (videoRef.current) {
            if (videoRef.current.requestFullscreen) {
                videoRef.current.requestFullscreen();
            }
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="p-8 bg-card/60 backdrop-blur-sm rounded-2xl border-2 shadow-xl">
                {/* Header */}
                <div className="flex flex-col items-center text-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-500/20 to-violet-500/20 text-primary flex items-center justify-center">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight">Your video is ready!</h3>
                    <p className="text-muted-foreground max-w-md">
                        Watch your generated video below or download it to share anywhere.
                    </p>
                </div>

                {/* Video Player */}
                <div
                    className="relative w-full bg-black rounded-xl overflow-hidden shadow-2xl group"
                    onMouseEnter={() => setShowControls(true)}
                    onMouseLeave={() => setShowControls(false)}
                >
                    <video
                        ref={videoRef}
                        src={videoSrc}
                        className="w-full aspect-video object-contain"
                        onTimeUpdate={handleTimeUpdate}
                        onLoadedMetadata={handleLoadedMetadata}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onEnded={() => setIsPlaying(false)}
                        playsInline
                    />

                    {/* Custom Controls Overlay */}
                    <div className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}>
                        {/* Play/Pause Button - Center */}
                        <button
                            onClick={handlePlayPause}
                            className="absolute inset-0 flex items-center justify-center group/play"
                        >
                            <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 hover:bg-white/30 transition-all duration-300 group-hover/play:scale-110">
                                {isPlaying ? (
                                    <Pause className="w-10 h-10 text-white" />
                                ) : (
                                    <Play className="w-10 h-10 text-white ml-1" />
                                )}
                            </div>
                        </button>

                        {/* Bottom Controls Bar */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
                            {/* Progress Bar */}
                            <div className="space-y-1">
                                <input
                                    type="range"
                                    min="0"
                                    max={duration || 0}
                                    value={currentTime}
                                    onChange={handleSeek}
                                    className="w-full h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                                    style={{
                                        background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) ${(currentTime / duration) * 100}%, rgba(255,255,255,0.2) 100%)`
                                    }}
                                />
                                <div className="flex justify-between text-xs text-white/80">
                                    <span>{formatTime(currentTime)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            {/* Control Buttons */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handlePlayPause}
                                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    >
                                        {isPlaying ? (
                                            <Pause className="w-5 h-5 text-white" />
                                        ) : (
                                            <Play className="w-5 h-5 text-white" />
                                        )}
                                    </button>
                                    <button
                                        onClick={handleMute}
                                        className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                    >
                                        {isMuted ? (
                                            <VolumeX className="w-5 h-5 text-white" />
                                        ) : (
                                            <Volume2 className="w-5 h-5 text-white" />
                                        )}
                                    </button>
                                    <span className="text-sm text-white/80 font-mono">
                                        {formatTime(currentTime)} / {formatTime(duration)}
                                    </span>
                                </div>
                                <button
                                    onClick={handleFullscreen}
                                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
                                >
                                    <Maximize className="w-5 h-5 text-white" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                    <Button
                        size="lg"
                        onClick={() => window.open(downloadUrl, '_blank')}
                        className="gap-2 px-8 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                    >
                        <Download className="w-4 h-4" />
                        Download Video
                    </Button>
                    <Button
                        size="lg"
                        variant="outline"
                        onClick={onReset}
                        className="gap-2 px-8"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Create New Video
                    </Button>
                </div>
            </Card>

            {/* SEO Metadata Card */}
            {seoMetadata && (
                <Card className="p-8 bg-card/60 backdrop-blur-sm rounded-2xl border-2 shadow-xl space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-violet-500/10 text-violet-500">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <h3 className="text-xl font-bold">AI-Generated Video Metadata</h3>
                    </div>

                    <div className="grid gap-6">
                        {/* Title Section */}
                        <div className="space-y-2 group">
                            <label className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> YouTube Title
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                        navigator.clipboard.writeText(seoMetadata.title);
                                        toast.success('Title copied!');
                                    }}
                                >
                                    <Copy className="w-3 h-3 mr-1" /> Copy
                                </Button>
                            </label>
                            <div className="p-4 rounded-xl bg-muted/50 border border-border/50 font-semibold text-lg">
                                {seoMetadata.title}
                            </div>
                        </div>

                        {/* Description Section */}
                        <div className="space-y-2 group">
                            <label className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                                <span className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" /> Description
                                </span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => {
                                        navigator.clipboard.writeText(seoMetadata.description);
                                        toast.success('Description copied!');
                                    }}
                                >
                                    <Copy className="w-3 h-3 mr-1" /> Copy
                                </Button>
                            </label>
                            <div className="p-4 rounded-xl bg-muted/50 border border-border/50 text-muted-foreground leading-relaxed">
                                {seoMetadata.description}
                            </div>
                        </div>

                        {/* Hashtags Section */}
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                <Hash className="w-4 h-4" /> Recommended Hashtags
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {seoMetadata.hashtags?.map((tag, i) => (
                                    <span
                                        key={i}
                                        className="px-3 py-1.5 rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400 text-sm font-medium border border-violet-500/20 hover:bg-violet-500/20 transition-colors cursor-pointer"
                                        onClick={() => {
                                            navigator.clipboard.writeText(tag);
                                            toast.success(`Copied ${tag}`);
                                        }}
                                    >
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </Card>
            )}

            {/* Custom Slider Styles */}
            <style jsx global>{`
                .slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #8b5cf6;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
                .slider::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #8b5cf6;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                }
            `}</style>
        </div>
    );
}
