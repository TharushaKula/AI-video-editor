import { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';

interface WaveformProps {
    file: File;
}

export default function Waveform({ file }: WaveformProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const wavesurferRef = useRef<WaveSurfer | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const wavesurfer = WaveSurfer.create({
            container: containerRef.current,
            waveColor: '#a855f7',
            progressColor: '#3b82f6',
            cursorColor: '#3b82f6',
            height: 80, // matched to UI
            barWidth: 3,
            barGap: 3,
            barRadius: 3,
            normalize: true,
        });

        const url = URL.createObjectURL(file);
        wavesurfer.load(url).catch((err) => {
            if (err.name === 'AbortError' || err.message?.includes('aborted')) {
                console.log('Waveform load aborted');
                return;
            }
            console.error('Waveform load error:', err);
        });
        wavesurferRef.current = wavesurfer;

        return () => {
            // Use a small timeout to ensure any pending fetch operations are cleared 
            // before destroying the instance, preventing AbortError race conditions.
            setTimeout(() => {
                if (wavesurfer) {
                    try {
                        wavesurfer.destroy();
                    } catch (e) {
                        // ignore cleanup errors
                        console.debug('Waveform cleanup error:', e);
                    }
                }
            }, 10);
            URL.revokeObjectURL(url);
        };
    }, [file]);

    return (
        <div className="w-full bg-slate-100 dark:bg-slate-900 rounded-lg p-4 shadow-inner">
            <div ref={containerRef} />
        </div>
    );
}
