'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Circle, Loader2, Film, Sparkles } from 'lucide-react';

interface SEOMetadata {
    title: string;
    description: string;
    hashtags: string[];
}

interface ProcessStatusProps {
    jobId: string;
    onComplete: (videoUrl: string, seoMetadata?: SEOMetadata) => void;
}

const steps = [
    'assembly',
    'seo',
    'complete'
];

const stepLabels: Record<string, string> = {
    'assembly': 'Assembling Video',
    'seo': 'Generating SEO Metadata',
    'complete': 'Complete'
};

export default function ProcessStatus({ jobId, onComplete }: ProcessStatusProps) {
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('Starting video assembly...');
    const [currentStep, setCurrentStep] = useState('assembly');

    useEffect(() => {
        const socket = io('http://localhost:3001');

        socket.on('connect', () => {
            console.log('Connected to socket');
            socket.emit('join-job', jobId);
        });

        socket.on('progress', (data) => {
            console.log('Progress:', data);
            setProgress(data.progress);
            setMessage(data.message);
            setCurrentStep(data.step);

            if (data.step === 'complete') {
                // Wait a moment for pure UI satisfaction
                setTimeout(() => {
                    onComplete(data.videoUrl, data.seoMetadata);
                    socket.disconnect();
                }, 1000);
            }
        });

        socket.on('error', (err) => {
            setMessage(`Error: ${err.message}`);
        });

        return () => {
            socket.disconnect();
        };
    }, [jobId, onComplete]);

    return (
        <Card className="p-10 w-full max-w-xl mx-auto space-y-8 bg-gradient-to-br from-card via-card to-emerald-500/5 border-2 shadow-xl">
            {/* Animated Icon */}
            <div className="flex justify-center">
                <div className="relative">
                    <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                        <Film className="w-12 h-12 text-white" />
                    </div>
                    {/* Pulsing rings */}
                    <div className="absolute inset-0 rounded-3xl bg-emerald-500/20 animate-ping" />
                    <div className="absolute -inset-2 rounded-3xl border-2 border-emerald-500/30 animate-pulse" />
                </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold tracking-tight">Creating Your Video</h3>
                <p className="text-muted-foreground">
                    Using your approved visuals to craft the perfect video
                </p>
            </div>

            {/* Progress */}
            <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium">
                    <span className="text-muted-foreground">{message}</span>
                    <span className="font-mono text-emerald-600">{Math.round(progress)}%</span>
                </div>
                <div className="relative">
                    <Progress value={progress} className="h-4" />
                    {/* Shimmer effect */}
                    <div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded-full animate-shimmer"
                    />
                </div>
            </div>

            {/* Step indicators */}
            <div className="flex justify-center gap-6">
                {steps.map((step) => {
                    const stepIndex = steps.indexOf(step);
                    const currentIndex = steps.indexOf(currentStep);

                    let status = 'pending';
                    if (stepIndex < currentIndex) status = 'completed';
                    if (stepIndex === currentIndex && step !== 'complete') status = 'current';
                    if (step === 'complete' && currentStep === 'complete') status = 'completed';

                    return (
                        <div
                            key={step}
                            className={`
                                flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                                ${status === 'current' ? 'bg-emerald-500/10 border border-emerald-500/20' : ''}
                            `}
                        >
                            {status === 'completed' ? (
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                </div>
                            ) : status === 'current' ? (
                                <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                                </div>
                            ) : (
                                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                                    <Circle className="w-5 h-5 text-muted-foreground/30" />
                                </div>
                            )}
                            <span className={`
                                font-medium transition-colors
                                ${status === 'current' ? 'text-foreground' : 'text-muted-foreground'}
                            `}>
                                {stepLabels[step]}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Fun fact */}
            <div className="text-center p-4 bg-muted/30 rounded-xl flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <p className="text-xs text-muted-foreground">
                    Your approved visuals are being combined into a seamless video
                </p>
            </div>
        </Card>
    );
}
