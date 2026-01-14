'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues and potential type conflicts with ReactPlayer
const ReactPlayer = dynamic(() => import('react-player'), { ssr: false }) as any;

interface VideoPlayerProps {
    videoUrl: string;
    onReset: () => void;
}

export default function VideoPlayer({ videoUrl, onReset }: VideoPlayerProps) {
    const fullUrl = `http://localhost:3001${videoUrl}`;

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <Card className="p-2 bg-card/50 backdrop-blur-sm overflow-hidden rounded-xl border-2">
                <div className="aspect-video bg-black rounded-lg overflow-hidden relative group">
                    <ReactPlayer
                        url={fullUrl}
                        controls
                        width="100%"
                        height="100%"
                    />
                </div>
            </Card>

            <div className="flex gap-4 justify-center">
                <Button
                    size="lg"
                    variant="outline"
                    onClick={onReset}
                    className="gap-2"
                >
                    <RefreshCw className="w-4 h-4" />
                    Create New Video
                </Button>
                <Button
                    size="lg"
                    onClick={() => window.open(fullUrl, '_blank')}
                    className="gap-2"
                >
                    <Download className="w-4 h-4" />
                    Download Video
                </Button>
            </div>
        </div>
    );
}
