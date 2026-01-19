'use client';

import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Brain, Mic, Sparkles, Loader2 } from 'lucide-react';

interface AnalyzeProgressProps {
    progress?: number;
    message?: string;
}

export default function AnalyzeProgress({ 
    progress = 0, 
    message = 'Processing your audio...' 
}: AnalyzeProgressProps) {
    // Simulate progress stages
    const stages = [
        { icon: Mic, label: 'Transcribing Audio', range: [0, 30] },
        { icon: Brain, label: 'Analyzing Content', range: [30, 60] },
        { icon: Sparkles, label: 'Generating Visuals', range: [60, 100] }
    ];

    const getCurrentStage = () => {
        for (let i = stages.length - 1; i >= 0; i--) {
            if (progress >= stages[i].range[0]) return i;
        }
        return 0;
    };

    const currentStage = getCurrentStage();

    return (
        <Card className="p-8 w-full max-w-6xl mx-auto bg-gradient-to-br from-card via-card to-violet-500/5 border-2 shadow-xl">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column - Icon & Title */}
                <div className="lg:col-span-1 flex flex-col items-center justify-center space-y-4">
                    <div className="relative">
                        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-violet-500/30">
                            <Brain className="w-10 h-10 text-white" />
                        </div>
                        {/* Pulsing rings */}
                        <div className="absolute inset-0 rounded-2xl bg-violet-500/20 animate-ping" />
                        <div className="absolute -inset-2 rounded-2xl border-2 border-violet-500/30 animate-pulse" />
                    </div>
                    <div className="text-center space-y-1">
                        <h3 className="text-xl font-bold tracking-tight">Analyzing Content</h3>
                        <p className="text-xs text-muted-foreground">
                            AI is processing your audio
                        </p>
                    </div>
                </div>

                {/* Right Column - Progress & Stages */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Progress Bar */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground font-medium">{message}</span>
                            <span className="font-mono font-bold text-lg text-primary">{Math.round(progress)}%</span>
                        </div>
                        <div className="relative">
                            <Progress value={progress} className="h-3" />
                            {/* Shimmer effect */}
                            <div 
                                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent rounded-full"
                                style={{ 
                                    backgroundSize: '200% 100%',
                                    animation: 'shimmer 2s infinite linear'
                                }}
                            />
                        </div>
                    </div>

                    {/* Stage Indicators - Horizontal Layout */}
                    <div className="grid grid-cols-3 gap-3">
                        {stages.map((stage, index) => {
                            const StageIcon = stage.icon;
                            const isActive = index === currentStage;
                            const isCompleted = index < currentStage;

                            return (
                                <div 
                                    key={stage.label}
                                    className={`
                                        flex flex-col items-center gap-3 p-4 rounded-xl transition-all duration-500 text-center
                                        ${isActive ? 'bg-primary/10 border-2 border-primary/30 shadow-lg shadow-primary/10' : ''}
                                        ${isCompleted ? 'opacity-70 bg-emerald-500/5' : ''}
                                        ${!isActive && !isCompleted ? 'bg-muted/30' : ''}
                                    `}
                                >
                                    <div className={`
                                        w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
                                        ${isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : ''}
                                        ${isCompleted ? 'bg-emerald-500/20 text-emerald-600' : ''}
                                        ${!isActive && !isCompleted ? 'bg-muted text-muted-foreground' : ''}
                                    `}>
                                        {isActive ? (
                                            <Loader2 className="w-6 h-6 animate-spin" />
                                        ) : isCompleted ? (
                                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                            </svg>
                                        ) : (
                                            <StageIcon className="w-6 h-6" />
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <p className={`text-xs font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {stage.label}
                                        </p>
                                        {isActive && (
                                            <p className="text-[10px] text-muted-foreground animate-pulse">
                                                Processing...
                                            </p>
                                        )}
                                        {isCompleted && (
                                            <p className="text-[10px] text-emerald-600 font-medium">
                                                Complete
                                            </p>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Fun fact while waiting */}
                    <div className="text-center p-3 bg-muted/30 rounded-xl border border-border/50">
                        <p className="text-xs text-muted-foreground">
                            💡 You'll be able to review and customize every visual before generating your video
                        </p>
                    </div>
                </div>
            </div>

            {/* Custom animation */}
            <style jsx global>{`
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
            `}</style>
        </Card>
    );
}
