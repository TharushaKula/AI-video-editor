'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface ProcessStatusProps {
    jobId: string;
    onComplete: (videoUrl: string) => void;
}

const steps = [
    'transcription',
    'analysis',
    'media',
    'assembly',
    'complete'
];

export default function ProcessStatus({ jobId, onComplete }: ProcessStatusProps) {
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState('Initializing...');
    const [currentStep, setCurrentStep] = useState('transcription');

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
                    onComplete(data.videoUrl);
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
        <Card className="p-8 w-full max-w-xl mx-auto space-y-8 bg-card/50 backdrop-blur-sm">
            <h3 className="text-2xl font-bold text-center tracking-tight">Generating Your Video</h3>

            <div className="space-y-3">
                <div className="flex justify-between text-sm font-medium text-muted-foreground">
                    <span>{message}</span>
                    <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="h-3 w-full" />
            </div>

            <div className="grid gap-4 pl-4">
                {steps.map((step) => {
                    const stepIndex = steps.indexOf(step);
                    const currentIndex = steps.indexOf(currentStep);

                    // Logic for status icons
                    let status = 'pending';
                    if (stepIndex < currentIndex) status = 'completed';
                    if (stepIndex === currentIndex && step !== 'complete') status = 'current';
                    if (step === 'complete' && currentStep === 'complete') status = 'completed';

                    return (
                        <div key={step} className="flex items-center gap-4">
                            {status === 'completed' ? (
                                <CheckCircle2 className="w-6 h-6 text-green-500" />
                            ) : status === 'current' ? (
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            ) : (
                                <Circle className="w-6 h-6 text-muted-foreground/30" />
                            )}
                            <span className={`capitalize text-lg ${status === 'current' ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                                {step === 'media' ? 'Visual Generation' : step}
                            </span>
                        </div>
                    );
                })}
            </div>
        </Card>
    );
}
