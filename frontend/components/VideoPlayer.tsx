'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw, Sparkles } from 'lucide-react';

interface VideoPlayerProps {
    videoUrl: string;
    onReset: () => void;
}

export default function VideoPlayer({ videoUrl, onReset }: VideoPlayerProps) {
    const fullUrl = `http://localhost:3001${videoUrl}`;

    return (
        <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="p-8 bg-card/60 backdrop-blur-sm rounded-2xl border-2 shadow-xl">
                <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                        <Sparkles className="w-8 h-8" />
                    </div>
                    <h3 className="text-2xl md:text-3xl font-bold tracking-tight">Your video is ready</h3>
                    <p className="text-muted-foreground max-w-md">
                        Download your generated video and share it anywhere. We keep it ready for you to save locally.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                        <Button
                            size="lg"
                            onClick={() => window.open(fullUrl, '_blank')}
                            className="gap-2 px-8"
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
                </div>
            </Card>
        </div>
    );
}
