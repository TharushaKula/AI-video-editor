'use client';

import { useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
    CheckCircle2, 
    Circle, 
    Loader2, 
    ArrowRight, 
    Eye,
    Sparkles,
    Film,
    ChevronLeft,
    ChevronRight,
    LayoutGrid,
    Rows3,
    AlertCircle,
    Rocket
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';
import SegmentReviewCard, { Segment } from './SegmentReviewCard';
import AlternativesModal from './AlternativesModal';

interface VisualReviewProps {
    jobId: string;
    segments: Segment[];
    totalDuration: number;
    onStartGeneration: () => void;
    onComplete: (videoUrl: string) => void;
}

type ViewMode = 'grid' | 'carousel';

export default function VisualReview({
    jobId,
    segments: initialSegments,
    totalDuration,
    onStartGeneration,
    onComplete
}: VisualReviewProps) {
    const [segments, setSegments] = useState<Segment[]>(initialSegments);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>('grid');
    const [expandedSegment, setExpandedSegment] = useState<number | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [generationMessage, setGenerationMessage] = useState('');
    const [socket, setSocket] = useState<Socket | null>(null);

    // Alternatives modal state
    const [showAlternatives, setShowAlternatives] = useState(false);
    const [alternativesSegmentId, setAlternativesSegmentId] = useState<number | null>(null);
    const [alternativesMediaType, setAlternativesMediaType] = useState<'image' | 'video'>('image');

    const confirmedCount = segments.filter(s => s.confirmed).length;
    const allConfirmed = confirmedCount === segments.length;
    const progressPercent = (confirmedCount / segments.length) * 100;

    // Socket connection for generation progress
    useEffect(() => {
        if (isGenerating) {
            const newSocket = io('http://localhost:3001');
            
            newSocket.on('connect', () => {
                newSocket.emit('join-job', jobId);
            });

            newSocket.on('progress', (data) => {
                setGenerationProgress(data.progress);
                setGenerationMessage(data.message);

                if (data.step === 'complete') {
                    setTimeout(() => {
                        onComplete(data.videoUrl);
                    }, 1000);
                }
            });

            newSocket.on('error', (err) => {
                setGenerationMessage(`Error: ${err.message}`);
                setIsGenerating(false);
            });

            setSocket(newSocket);

            return () => {
                newSocket.disconnect();
            };
        }
    }, [isGenerating, jobId, onComplete]);

    const handleConfirmSegment = async (segmentId: number) => {
        try {
            await axios.post(`http://localhost:3001/api/confirm-segment/${jobId}/${segmentId}`, {
                confirmed: true
            });

            setSegments(prev => prev.map(s => 
                s.segment_id === segmentId ? { ...s, confirmed: true } : s
            ));
        } catch (error) {
            console.error('Failed to confirm segment:', error);
        }
    };

    const handleToggleMediaType = async (segmentId: number, type: 'image' | 'video') => {
        // If switching type, need to regenerate media
        setAlternativesSegmentId(segmentId);
        setAlternativesMediaType(type);
        setShowAlternatives(true);
    };

    const handleRequestAlternatives = (segmentId: number, type: 'image' | 'video') => {
        setAlternativesSegmentId(segmentId);
        setAlternativesMediaType(type);
        setShowAlternatives(true);
    };

    const handleSelectAlternative = async (alternative: any) => {
        if (alternativesSegmentId === null) return;

        try {
            await axios.post(`http://localhost:3001/api/confirm-segment/${jobId}/${alternativesSegmentId}`, {
                media_url: alternative.media_url,
                media_type: alternative.media_type,
                media_path: alternative.media_path
            });

            setSegments(prev => prev.map(s => 
                s.segment_id === alternativesSegmentId 
                    ? { 
                        ...s, 
                        media_url: alternative.media_url, 
                        media_type: alternative.media_type,
                        media_path: alternative.media_path,
                        user_media_type: alternative.media_type 
                    } 
                    : s
            ));
        } catch (error) {
            console.error('Failed to update segment:', error);
        }
    };

    const handleConfirmAll = async () => {
        try {
            await axios.post(`http://localhost:3001/api/confirm-all/${jobId}`);
            setSegments(prev => prev.map(s => ({ ...s, confirmed: true })));
        } catch (error) {
            console.error('Failed to confirm all:', error);
        }
    };

    const handleStartGeneration = async () => {
        if (!allConfirmed) return;
        
        setIsGenerating(true);
        onStartGeneration();

        try {
            await axios.post(`http://localhost:3001/api/generate/${jobId}`);
        } catch (error) {
            console.error('Failed to start generation:', error);
            setIsGenerating(false);
        }
    };

    const currentSegment = segments[currentIndex];
    const currentAlternativeSegment = alternativesSegmentId !== null 
        ? segments.find(s => s.segment_id === alternativesSegmentId) 
        : null;

    // Generation in progress view
    if (isGenerating) {
        return (
            <Card className="p-8 w-full max-w-2xl mx-auto space-y-8 bg-gradient-to-br from-card via-card to-primary/5 border-2 shadow-xl">
                <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
                        <Film className="w-10 h-10 text-white animate-pulse" />
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight">Creating Your Video</h3>
                    <p className="text-muted-foreground">Using your approved visuals to craft the perfect video</p>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-sm font-medium">
                        <span className="text-muted-foreground">{generationMessage}</span>
                        <span className="text-primary font-mono">{Math.round(generationProgress)}%</span>
                    </div>
                    <div className="relative">
                        <Progress value={generationProgress} className="h-4" />
                        <div 
                            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer"
                            style={{ 
                                backgroundSize: '200% 100%',
                                animation: 'shimmer 2s infinite linear'
                            }}
                        />
                    </div>
                </div>

                {/* Mini segments preview */}
                <div className="flex justify-center gap-2 flex-wrap">
                    {segments.map((segment, i) => (
                        <div 
                            key={segment.segment_id}
                            className={cn(
                                "w-12 h-8 rounded-md overflow-hidden border-2 transition-all duration-300",
                                generationProgress > (i / segments.length) * 100
                                    ? "border-emerald-500 scale-105"
                                    : "border-border/30 opacity-50"
                            )}
                        >
                            <img 
                                src={`http://localhost:3001${segment.media_url}`}
                                alt=""
                                className="w-full h-full object-cover"
                            />
                        </div>
                    ))}
                </div>
            </Card>
        );
    }

    return (
        <div className="w-full max-w-7xl mx-auto space-y-6">
            {/* Header Stats Bar */}
            <Card className="p-6 bg-gradient-to-r from-card via-card to-primary/5 border-2">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                            <Eye className="w-7 h-7 text-white" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold tracking-tight">Review Your Visuals</h2>
                            <p className="text-muted-foreground">
                                Approve each section before generating your video
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                        {/* Progress Indicator */}
                        <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
                            <div className="relative">
                                <svg className="w-12 h-12 -rotate-90">
                                    <circle
                                        cx="24"
                                        cy="24"
                                        r="20"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        className="text-muted"
                                    />
                                    <circle
                                        cx="24"
                                        cy="24"
                                        r="20"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        strokeDasharray={`${progressPercent * 1.256} 125.6`}
                                        className="text-emerald-500 transition-all duration-500"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <span className="text-xs font-bold">{confirmedCount}/{segments.length}</span>
                                </div>
                            </div>
                            <div className="text-sm">
                                <p className="font-semibold">{confirmedCount} Approved</p>
                                <p className="text-muted-foreground">{segments.length - confirmedCount} remaining</p>
                            </div>
                        </div>

                        {/* View Mode Toggle */}
                        <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-lg">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={cn(
                                    "p-2 rounded-md transition-all",
                                    viewMode === 'grid'
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </button>
                            <button
                                onClick={() => setViewMode('carousel')}
                                className={cn(
                                    "p-2 rounded-md transition-all",
                                    viewMode === 'carousel'
                                        ? "bg-background shadow-sm text-foreground"
                                        : "text-muted-foreground hover:text-foreground"
                                )}
                            >
                                <Rows3 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Duration & Quick Actions */}
                <div className="flex items-center justify-between mt-6 pt-6 border-t border-border/50">
                    <div className="flex items-center gap-6 text-sm">
                        <div className="flex items-center gap-2">
                            <Film className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Duration:</span>
                            <span className="font-semibold font-mono">{totalDuration.toFixed(1)}s</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Sparkles className="w-4 h-4 text-muted-foreground" />
                            <span className="text-muted-foreground">Segments:</span>
                            <span className="font-semibold font-mono">{segments.length}</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {!allConfirmed && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleConfirmAll}
                                className="gap-2"
                            >
                                <CheckCircle2 className="w-4 h-4" />
                                Approve All
                            </Button>
                        )}
                        <Button
                            size="sm"
                            onClick={handleStartGeneration}
                            disabled={!allConfirmed}
                            className={cn(
                                "gap-2 transition-all duration-300",
                                allConfirmed
                                    ? "bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                                    : ""
                            )}
                        >
                            {allConfirmed ? (
                                <>
                                    <Rocket className="w-4 h-4" />
                                    Generate Video
                                </>
                            ) : (
                                <>
                                    <AlertCircle className="w-4 h-4" />
                                    Approve All Sections First
                                </>
                            )}
                        </Button>
                    </div>
                </div>
            </Card>

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {segments.map((segment, index) => (
                        <SegmentReviewCard
                            key={segment.segment_id}
                            segment={segment}
                            index={index}
                            totalSegments={segments.length}
                            onConfirm={handleConfirmSegment}
                            onRequestAlternatives={handleRequestAlternatives}
                            onToggleMediaType={handleToggleMediaType}
                            isExpanded={expandedSegment === segment.segment_id}
                            onToggleExpand={() => setExpandedSegment(
                                expandedSegment === segment.segment_id ? null : segment.segment_id
                            )}
                        />
                    ))}
                </div>
            )}

            {/* Carousel View */}
            {viewMode === 'carousel' && (
                <div className="space-y-6">
                    {/* Navigation */}
                    <div className="flex items-center justify-center gap-4">
                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                            disabled={currentIndex === 0}
                            className="w-12 h-12 rounded-full"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </Button>

                        <div className="flex items-center gap-2">
                            {segments.map((segment, i) => (
                                <button
                                    key={segment.segment_id}
                                    onClick={() => setCurrentIndex(i)}
                                    className={cn(
                                        "w-3 h-3 rounded-full transition-all duration-300",
                                        i === currentIndex
                                            ? "bg-primary w-8"
                                            : segment.confirmed
                                                ? "bg-emerald-500"
                                                : "bg-muted hover:bg-muted-foreground/30"
                                    )}
                                />
                            ))}
                        </div>

                        <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setCurrentIndex(Math.min(segments.length - 1, currentIndex + 1))}
                            disabled={currentIndex === segments.length - 1}
                            className="w-12 h-12 rounded-full"
                        >
                            <ChevronRight className="w-6 h-6" />
                        </Button>
                    </div>

                    {/* Single Card */}
                    <div className="max-w-2xl mx-auto">
                        <SegmentReviewCard
                            key={currentSegment.segment_id}
                            segment={currentSegment}
                            index={currentIndex}
                            totalSegments={segments.length}
                            onConfirm={handleConfirmSegment}
                            onRequestAlternatives={handleRequestAlternatives}
                            onToggleMediaType={handleToggleMediaType}
                            isExpanded={true}
                        />
                    </div>

                    {/* Mini Preview Strip */}
                    <div className="flex justify-center gap-2 overflow-x-auto py-4 px-8">
                        {segments.map((segment, i) => (
                            <button
                                key={segment.segment_id}
                                onClick={() => setCurrentIndex(i)}
                                className={cn(
                                    "relative flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden transition-all duration-300 border-2",
                                    i === currentIndex
                                        ? "border-primary ring-2 ring-primary/30 scale-110"
                                        : segment.confirmed
                                            ? "border-emerald-500/50 opacity-80"
                                            : "border-transparent opacity-50 hover:opacity-80"
                                )}
                            >
                                <img
                                    src={`http://localhost:3001${segment.media_url}`}
                                    alt=""
                                    className="w-full h-full object-cover"
                                />
                                {segment.confirmed && (
                                    <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                        <CheckCircle2 className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Alternatives Modal */}
            {currentAlternativeSegment && (
                <AlternativesModal
                    isOpen={showAlternatives}
                    onClose={() => setShowAlternatives(false)}
                    jobId={jobId}
                    segmentId={currentAlternativeSegment.segment_id}
                    currentMediaUrl={currentAlternativeSegment.media_url}
                    mediaType={alternativesMediaType}
                    visualTopic={currentAlternativeSegment.visual_topic}
                    onSelect={handleSelectAlternative}
                />
            )}

            {/* Custom CSS for animations */}
            <style jsx global>{`
                @keyframes fadeInUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes shimmer {
                    0% {
                        background-position: -200% 0;
                    }
                    100% {
                        background-position: 200% 0;
                    }
                }
            `}</style>
        </div>
    );
}
