'use client';

import { useState } from 'react';
import AudioUploader from '@/components/AudioUploader';
import ProcessStatus from '@/components/ProcessStatus';
import VideoPlayer from '@/components/VideoPlayer';
import VisualReview from '@/components/VisualReview';
import AnalyzeProgress from '@/components/AnalyzeProgress';
import { Segment } from '@/components/SegmentReviewCard';

type AppStep = 'upload' | 'analyzing' | 'review' | 'generating' | 'result';

interface AnalysisResult {
    jobId: string;
    segments: Segment[];
    totalDuration: number;
}

export default function Home() {
    const [step, setStep] = useState<AppStep>('upload');
    const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
    const [videoUrl, setVideoUrl] = useState<string>('');
    const [seoMetadata, setSeoMetadata] = useState<any>(null);

    const handleAnalyzeStart = () => {
        setStep('analyzing');
    };

    const handleAnalysisComplete = (result: AnalysisResult) => {
        setAnalysisResult(result);
        setStep('review');
    };

    const handleStartGeneration = () => {
        setStep('generating');
    };

    const handleGenerationComplete = (url: string, seo: any) => {
        setVideoUrl(url);
        setSeoMetadata(seo);
        setStep('result');
    };

    const handleReset = () => {
        setStep('upload');
        setAnalysisResult(null);
        setStep('upload');
        setAnalysisResult(null);
        setVideoUrl('');
        setSeoMetadata(null);
    };

    return (
        <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 overflow-hidden">
            {/* Animated Background */}
            <div className="fixed inset-0 -z-10">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-emerald-500/5" />
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="p-8 flex flex-col items-center">
                {/* Header */}
                <header className="w-full max-w-7xl mx-auto mb-12 text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-sm font-medium text-primary mb-4">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                        </span>
                        AI-Powered Video Generation
                    </div>
                    <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
                        <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-emerald-600 bg-clip-text text-transparent">
                            AI Video Generator
                        </span>
                    </h1>
                    <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                        Turn your audio into captivating videos with AI-generated visuals.
                        Review and customize every frame before generating.
                    </p>

                    {/* Step Indicator */}
                    {step !== 'upload' && (
                        <div className="flex items-center justify-center gap-2 mt-8 animate-in fade-in slide-in-from-top-4 duration-500">
                            {(['upload', 'analyzing', 'review', 'generating', 'result'] as AppStep[]).map((s, i) => {
                                const stepLabels: Record<AppStep, string> = {
                                    upload: 'Upload',
                                    analyzing: 'Analyze',
                                    review: 'Review',
                                    generating: 'Generate',
                                    result: 'Complete'
                                };
                                const currentIndex = ['upload', 'analyzing', 'review', 'generating', 'result'].indexOf(step);
                                const stepIndex = i;
                                const isActive = stepIndex === currentIndex;
                                const isCompleted = stepIndex < currentIndex;

                                return (
                                    <div key={s} className="flex items-center">
                                        <div className={`
                                            flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300
                                            ${isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : ''}
                                            ${isCompleted ? 'bg-emerald-500/20 text-emerald-600' : ''}
                                            ${!isActive && !isCompleted ? 'bg-muted/50 text-muted-foreground' : ''}
                                        `}>
                                            {isCompleted && (
                                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                            <span>{stepLabels[s]}</span>
                                        </div>
                                        {i < 4 && (
                                            <div className={`w-8 h-0.5 mx-1 transition-colors duration-300 ${stepIndex < currentIndex ? 'bg-emerald-500' : 'bg-muted'
                                                }`} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </header>

                {/* Content */}
                <div className="w-full max-w-7xl mx-auto relative min-h-[400px]">
                    {step === 'upload' && (
                        <div className="animate-in fade-in zoom-in duration-300">
                            <AudioUploader
                                onAnalyzeStart={handleAnalyzeStart}
                                onAnalysisComplete={handleAnalysisComplete}
                            />
                        </div>
                    )}

                    {step === 'analyzing' && (
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                            <AnalyzeProgress />
                        </div>
                    )}

                    {step === 'review' && analysisResult && (
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                            <VisualReview
                                jobId={analysisResult.jobId}
                                segments={analysisResult.segments}
                                totalDuration={analysisResult.totalDuration}
                                onStartGeneration={handleStartGeneration}
                                onComplete={handleGenerationComplete}
                            />
                        </div>
                    )}

                    {step === 'generating' && analysisResult && (
                        <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
                            <ProcessStatus
                                jobId={analysisResult.jobId}
                                onComplete={handleGenerationComplete}
                            />
                        </div>
                    )}

                    {step === 'result' && (
                        <div className="animate-in fade-in zoom-in duration-500">
                            <VideoPlayer
                                videoUrl={videoUrl}
                                onReset={handleReset}
                                seoMetadata={seoMetadata}
                            />
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
