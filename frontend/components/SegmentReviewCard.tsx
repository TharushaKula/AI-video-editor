'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Check,
    RefreshCw,
    Image as ImageIcon,
    Video,
    ChevronDown,
    Sparkles,
    Play,
    Pause
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Segment {
    segment_id: number;
    text_content: string;
    visual_topic: string;
    image_prompt: string;
    sentiment: string;
    contains_people: boolean;
    duration: number;
    start_time?: number; // Precise start time in seconds
    end_time?: number; // Precise end time in seconds
    media_path: string;
    media_type: 'image' | 'video';
    media_url: string;
    confirmed: boolean;
    user_media_type: 'image' | 'video';
}

interface SegmentReviewCardProps {
    segment: Segment;
    index: number;
    totalSegments: number;
    onConfirm: (segmentId: number) => void;
    onRequestAlternatives: (segmentId: number, type: 'image' | 'video') => void;
    onToggleMediaType: (segmentId: number, type: 'image' | 'video') => void;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
}

export default function SegmentReviewCard({
    segment,
    index,
    totalSegments,
    onConfirm,
    onRequestAlternatives,
    onToggleMediaType,
    isExpanded = false,
    onToggleExpand
}: SegmentReviewCardProps) {
    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [imageError, setImageError] = useState(false);

    const mediaUrl = `http://localhost:3001${segment.media_url}`;
    const isVideo = segment.media_type === 'video';

    const handleVideoToggle = () => {
        const video = document.getElementById(`video-${segment.segment_id}`) as HTMLVideoElement;
        if (video) {
            if (isVideoPlaying) {
                video.pause();
            } else {
                video.play();
            }
            setIsVideoPlaying(!isVideoPlaying);
        }
    };

    // Sentiment colors
    const sentimentColors: Record<string, string> = {
        'Happy': 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
        'Sad': 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
        'Intense': 'from-red-500/20 to-rose-500/20 border-red-500/30',
        'Calm': 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
        'Neutral': 'from-slate-500/20 to-gray-500/20 border-slate-500/30'
    };

    const sentimentColor = sentimentColors[segment.sentiment] || sentimentColors['Neutral'];

    return (
        <Card
            className={cn(
                "group relative overflow-hidden transition-all duration-500 ease-out",
                "border-2 hover:shadow-2xl hover:shadow-primary/5",
                segment.confirmed
                    ? "border-emerald-500/50 bg-gradient-to-br from-emerald-500/5 to-transparent"
                    : "border-border/50 hover:border-primary/30",
                isExpanded ? "ring-2 ring-primary/20" : ""
            )}
            style={{
                animationDelay: `${index * 100}ms`,
                animation: 'fadeInUp 0.5s ease-out forwards'
            }}
        >
            {/* Confirmation Badge */}
            {segment.confirmed && (
                <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 bg-emerald-500 text-white px-2.5 py-1 rounded-full text-xs font-semibold shadow-lg">
                    <Check className="w-3 h-3" />
                    Approved
                </div>
            )}

            {/* Segment Number Badge */}
            <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-xs font-mono">
                {String(index + 1).padStart(2, '0')} / {String(totalSegments).padStart(2, '0')}
            </div>

            {/* Media Preview Section */}
            <div className="relative aspect-video bg-gradient-to-br from-slate-900 to-slate-800 overflow-hidden">
                {/* Loading Skeleton */}
                {!imageLoaded && !isVideo && !imageError && (
                    <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 animate-pulse" />
                )}

                {/* Error Fallback */}
                {imageError && !isVideo && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-800 text-slate-500">
                        <ImageIcon className="w-10 h-10 mb-2 opacity-50" />
                        <span className="text-xs font-medium">Image not found</span>
                    </div>
                )}

                {isVideo ? (
                    <div className="relative w-full h-full">
                        <video
                            id={`video-${segment.segment_id}`}
                            src={mediaUrl}
                            className="w-full h-full object-cover"
                            loop
                            muted
                            playsInline
                            onPlay={() => setIsVideoPlaying(true)}
                            onPause={() => setIsVideoPlaying(false)}
                        />
                        {/* Video Play Overlay */}
                        <button
                            onClick={handleVideoToggle}
                            className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                        >
                            <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 hover:bg-white/30 transition-colors">
                                {isVideoPlaying ? (
                                    <Pause className="w-8 h-8 text-white" />
                                ) : (
                                    <Play className="w-8 h-8 text-white ml-1" />
                                )}
                            </div>
                        </button>
                    </div>
                ) : (
                    <img
                        src={mediaUrl}
                        alt={segment.visual_topic}
                        className={cn(
                            "w-full h-full object-cover transition-all duration-700",
                            (imageLoaded && !imageError) ? "opacity-100 scale-100" : "opacity-0 scale-105"
                        )}
                        onLoad={() => setImageLoaded(true)}
                        onError={() => {
                            console.error(`[SegmentCard] Failed to load image: ${mediaUrl}`);
                            setImageError(true);
                            setImageLoaded(true);
                        }}
                    />
                )}

                {/* Ken Burns Effect Hint */}
                {!isVideo && imageLoaded && (
                    <div className="absolute bottom-2 right-2 bg-black/50 backdrop-blur-sm text-white/80 px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        Ken Burns
                    </div>
                )}

                {/* Duration Badge */}
                <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded text-xs font-mono">
                    {segment.duration.toFixed(1)}s
                </div>
            </div>

            {/* Content Section */}
            <div className="p-5 space-y-4">
                {/* Sentiment & Topic Row */}
                <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn(
                        "px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r border",
                        sentimentColor
                    )}>
                        {segment.sentiment}
                    </span>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                        {segment.visual_topic}
                    </span>
                </div>

                {/* Text Content */}
                <button
                    onClick={onToggleExpand}
                    className="w-full text-left group/text"
                >
                    <p className={cn(
                        "text-sm leading-relaxed transition-all duration-300",
                        isExpanded ? "" : "line-clamp-2"
                    )}>
                        "{segment.text_content}"
                    </p>
                    {!isExpanded && segment.text_content.length > 100 && (
                        <div className="flex items-center gap-1 text-xs text-primary mt-1 group-hover/text:underline">
                            <span>Read more</span>
                            <ChevronDown className="w-3 h-3" />
                        </div>
                    )}
                </button>

                {/* Media Type Toggle */}
                <div className="flex items-center gap-2 p-1 bg-muted/30 rounded-lg">
                    <button
                        onClick={() => onToggleMediaType(segment.segment_id, 'image')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all duration-300",
                            segment.user_media_type === 'image'
                                ? "bg-background shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <ImageIcon className="w-4 h-4" />
                        Image
                    </button>
                    <button
                        onClick={() => onToggleMediaType(segment.segment_id, 'video')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2 rounded-md text-sm font-medium transition-all duration-300",
                            segment.user_media_type === 'video'
                                ? "bg-background shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Video className="w-4 h-4" />
                        Video
                    </button>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRequestAlternatives(segment.segment_id, segment.user_media_type)}
                        className="flex-1 gap-2 border-dashed hover:border-solid hover:border-primary/50"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Find Alternatives
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => onConfirm(segment.segment_id)}
                        disabled={segment.confirmed}
                        className={cn(
                            "flex-1 gap-2 transition-all duration-300",
                            segment.confirmed
                                ? "bg-emerald-500/20 text-emerald-600 border border-emerald-500/30"
                                : "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                        )}
                    >
                        <Check className="w-4 h-4" />
                        {segment.confirmed ? 'Approved' : 'Approve'}
                    </Button>
                </div>
            </div>

            {/* Animated Border Glow on Hover */}
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/10 via-transparent to-primary/10" />
            </div>
        </Card>
    );
}
