'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    X,
    Check,
    Loader2,
    RefreshCw,
    Image as ImageIcon,
    Video,
    Wand2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import axios from 'axios';

interface Alternative {
    id: string;
    media_path: string;
    media_type: 'image' | 'video';
    media_url: string;
}

interface AlternativesModalProps {
    isOpen: boolean;
    onClose: () => void;
    jobId: string;
    segmentId: number;
    currentMediaUrl: string;
    mediaType: 'image' | 'video';
    visualTopic: string;
    onSelect: (alternative: Alternative) => void;
}

export default function AlternativesModal({
    isOpen,
    onClose,
    jobId,
    segmentId,
    currentMediaUrl,
    mediaType,
    visualTopic,
    onSelect
}: AlternativesModalProps) {
    const [alternatives, setAlternatives] = useState<Alternative[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [selectedType, setSelectedType] = useState<'image' | 'video'>(mediaType);
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (isOpen) {
            setPage(1); // Reset page on open
            fetchAlternatives(1);
        }
    }, [isOpen, selectedType]);

    const fetchAlternatives = async (pageNum: number) => {
        setLoading(true);
        try {
            const response = await axios.get(
                `http://localhost:3001/api/alternatives/${jobId}/${segmentId}?type=${selectedType}&page=${pageNum}`
            );
            setAlternatives(response.data.alternatives);
        } catch (error) {
            console.error('Failed to fetch alternatives:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchAlternatives(nextPage);
    };

    const handleSelect = (alt: Alternative) => {
        setSelectedId(alt.id);
    };

    const handleConfirmSelection = () => {
        const selected = alternatives.find(a => a.id === selectedId);
        if (selected) {
            onSelect(selected);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-4xl max-h-[90vh] mx-4 bg-gradient-to-br from-background via-background to-muted/30 rounded-2xl shadow-2xl border border-border/50 overflow-hidden animate-in zoom-in-95 fade-in duration-300">
                {/* Header */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/25">
                                <Wand2 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold">Find Alternatives</h2>
                                <p className="text-sm text-muted-foreground">{visualTopic}</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-muted rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Media Type Toggle */}
                    <div className="flex items-center gap-2 mt-4 p-1 bg-muted/50 rounded-lg w-fit">
                        <button
                            onClick={() => setSelectedType('image')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-300",
                                selectedType === 'image'
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <ImageIcon className="w-4 h-4" />
                            Images
                        </button>
                        <button
                            onClick={() => setSelectedType('video')}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-300",
                                selectedType === 'video'
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <Video className="w-4 h-4" />
                            Videos
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                    {/* Current Selection */}
                    <div className="mb-6">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 font-semibold">Current Selection</p>
                        <div className="relative aspect-video max-w-xs rounded-xl overflow-hidden border-2 border-primary/50 shadow-lg shadow-primary/10">
                            {mediaType === 'video' ? (
                                <video
                                    src={`http://localhost:3001${currentMediaUrl}`}
                                    className="w-full h-full object-cover"
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                />
                            ) : (
                                <img
                                    src={`http://localhost:3001${currentMediaUrl}`}
                                    alt="Current"
                                    className="w-full h-full object-cover"
                                />
                            )}
                            <div className="absolute top-2 left-2 bg-primary text-primary-foreground px-2 py-0.5 rounded text-xs font-semibold">
                                Current
                            </div>
                        </div>
                    </div>

                    {/* Alternatives Grid */}
                    <div className="mb-4 flex items-center justify-between">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                            {loading ? 'Generating alternatives...' : 'Choose an alternative'}
                        </p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleGenerateMore} // Use the specific handler
                            disabled={loading}
                            className="gap-2 text-xs"
                        >
                            <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
                            Generate More
                        </Button>
                    </div>

                    {loading ? (
                        <div className="grid grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className="aspect-video rounded-xl bg-gradient-to-r from-muted via-muted/70 to-muted animate-pulse"
                                    style={{ animationDelay: `${i * 100}ms` }}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            {alternatives.map((alt, index) => (
                                <button
                                    key={alt.id}
                                    onClick={() => handleSelect(alt)}
                                    className={cn(
                                        "group relative aspect-video rounded-xl overflow-hidden transition-all duration-300",
                                        "border-2 hover:shadow-xl",
                                        selectedId === alt.id
                                            ? "border-emerald-500 ring-2 ring-emerald-500/30 shadow-lg shadow-emerald-500/20"
                                            : "border-transparent hover:border-primary/30"
                                    )}
                                    style={{
                                        animationDelay: `${index * 100}ms`,
                                        animation: 'fadeInUp 0.4s ease-out forwards'
                                    }}
                                >
                                    {alt.media_type === 'video' ? (
                                        <video
                                            src={`http://localhost:3001${alt.media_url}`}
                                            className="w-full h-full object-cover"
                                            autoPlay
                                            loop
                                            muted
                                            playsInline
                                        />
                                    ) : (
                                        <img
                                            src={`http://localhost:3001${alt.media_url}`}
                                            alt={`Alternative ${index + 1}`}
                                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                        />
                                    )}

                                    {/* Selection Overlay */}
                                    <div className={cn(
                                        "absolute inset-0 transition-all duration-300 flex items-center justify-center",
                                        selectedId === alt.id
                                            ? "bg-emerald-500/20"
                                            : "bg-black/0 group-hover:bg-black/20"
                                    )}>
                                        {selectedId === alt.id && (
                                            <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg animate-in zoom-in duration-200">
                                                <Check className="w-6 h-6 text-white" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Alternative Number */}
                                    <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white px-2 py-0.5 rounded text-xs font-mono">
                                        Alt {index + 1}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border/50 px-6 py-4">
                    <div className="flex items-center justify-end gap-3">
                        <Button
                            variant="outline"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleConfirmSelection}
                            disabled={!selectedId || loading}
                            className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-lg shadow-emerald-500/25"
                        >
                            <Check className="w-4 h-4" />
                            Use Selected
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
