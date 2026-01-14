'use client';

import { useState } from 'react';
import AudioUploader from '@/components/AudioUploader';
import ProcessStatus from '@/components/ProcessStatus';
import VideoPlayer from '@/components/VideoPlayer';

export default function Home() {
  const [step, setStep] = useState<'upload' | 'processing' | 'result'>('upload');
  const [jobId, setJobId] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string>('');

  const handleUploadComplete = (file: File, id: string) => {
    setJobId(id);
    setStep('processing');
  };

  const handleProcessingComplete = (url: string) => {
    setVideoUrl(url);
    setStep('result');
  };

  const handleReset = () => {
    setStep('upload');
    setJobId('');
    setVideoUrl('');
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 p-8 flex flex-col items-center">
      <header className="w-full max-w-5xl mx-auto mb-16 text-center space-y-4">
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent pb-2">
          AI Video Generator
        </h1>
        <p className="text-xl text-muted-foreground">
          Turn your audio into captivating videos in minutes using AI
        </p>
      </header>

      <div className="w-full max-w-5xl mx-auto relative min-h-[400px]">
        {step === 'upload' && (
          <div className="animate-in fade-in zoom-in duration-300">
            <AudioUploader onUploadComplete={handleUploadComplete} />
          </div>
        )}

        {step === 'processing' && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <ProcessStatus jobId={jobId} onComplete={handleProcessingComplete} />
          </div>
        )}

        {step === 'result' && (
          <VideoPlayer videoUrl={videoUrl} onReset={handleReset} />
        )}
      </div>
    </main>
  );
}
