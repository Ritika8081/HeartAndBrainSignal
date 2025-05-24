// components/MeditationSession.tsx
"use client";
import { useState, useRef, useEffect } from 'react';

export const MeditationSession = ({ 
    onStartSession, 
    onEndSession,
    sessionData,
    darkMode,
    renderSessionResults
}: {
    onStartSession: () => void;
    onEndSession: () => void;
    sessionData: { timestamp: number; alpha: number; beta: number; theta: number; delta: number; symmetry: number }[];
    darkMode: boolean;
    renderSessionResults?: (results: {
        dominantBands: Record<string, number>;
        mostFrequent: string;
        convert: (ticks: number) => string;
        avgSymmetry: string;
        duration: string;
    }) => React.ReactNode;
}) => {
    
    const [isMeditating, setIsMeditating] = useState(false);
    const [duration, setDuration] = useState(5); // minutes
    const [timeLeft, setTimeLeft] = useState(0); // seconds
    const [sessionResults, setSessionResults] = useState<{
        duration: number;
        averages: {
            alpha: number;
            beta: number;
            theta: number;
            delta: number;
            symmetry: number;
        };
        mentalState: string;
        stateDescription: string;
        focusScore: string;
        symmetry: string;
        data: typeof sessionData;
        dominantBands: Record<string, number>;
        mostFrequent: string;
        convert: (ticks: number) => string;
        avgSymmetry: string;
        formattedDuration: string;
    } | null>(null);
    const sessionStartTime = useRef<number | null>(null);

    // Start meditation session
    const startMeditation = () => {
        setIsMeditating(true);
        setTimeLeft(duration * 60);
        sessionStartTime.current = Date.now();
        onStartSession();
    };

    // Stop meditation session
    const stopMeditation = () => {
        setIsMeditating(false);
        analyzeSession();
        onEndSession();
    };

    // Analyze collected data
    const analyzeSession = () => {
        const data = sessionData.filter(d => 
            sessionStartTime.current && d.timestamp >= sessionStartTime.current
        );
        
        if (!data.length) return;

        const sessionDurationMs = data[data.length - 1].timestamp - data[0].timestamp;
        const sessionDuration = sessionDurationMs > 60000
            ? `${Math.round(sessionDurationMs / 60000)} min`
            : `${Math.round(sessionDurationMs / 1000)} sec`;

        const dominantBands: Record<string, number> = {
            alpha: 0,
            beta: 0,
            theta: 0,
            delta: 0,
        };

        for (const d of data) {
            const maxBand = Object.entries(d).filter(([key]) => key !== "timestamp" && key !== "symmetry")
                .reduce((a, b) => (a[1] > b[1] ? a : b))[0];
            dominantBands[maxBand]++;
        }

        const convert = (ticks: number) => ((ticks * 0.5) / 60).toFixed(2); // assuming FFT every 500ms
        const avgSymmetry = (
            data.reduce((sum, d) => sum + (d.symmetry ?? 0), 0) / data.length
        ).toFixed(3);

        const mostFrequent = Object.entries(dominantBands).sort((a, b) => b[1] - a[1])[0][0];

        // Calculate averages
        const averages = {
            alpha: data.reduce((sum, d) => sum + d.alpha, 0) / data.length,
            beta: data.reduce((sum, d) => sum + d.beta, 0) / data.length,
            theta: data.reduce((sum, d) => sum + d.theta, 0) / data.length,
            delta: data.reduce((sum, d) => sum + d.delta, 0) / data.length,
            symmetry: data.reduce((sum, d) => sum + d.symmetry, 0) / data.length,
        };

        // Determine mental state
        const maxBand = Object.entries(averages)
            .filter(([key]) => key !== 'symmetry')
            .reduce((a, b) => a[1] > b[1] ? a : b)[0];

        let mentalState = '';
        let stateDescription = '';
        
        if (maxBand === 'alpha') {
            mentalState = 'Relaxed';
            stateDescription = 'Your mind was in a calm and relaxed state, ideal for meditation.';
        } else if (maxBand === 'beta') {
            mentalState = 'Active';
            stateDescription = 'Your mind was quite active. Try focusing more on your breath next time.';
        } else if (maxBand === 'theta') {
            mentalState = 'Deep Meditation';
            stateDescription = 'You reached a deep meditative state, great job!';
        } else if (maxBand === 'delta') {
            mentalState = 'Drowsy/Sleepy';
            stateDescription = 'You were very relaxed, almost sleepy. Perfect for bedtime meditation.';
        }

        // Calculate focus score (alpha/theta to beta ratio)
        const focusScore = ((averages.alpha + averages.theta) / (averages.beta + 0.001)).toFixed(2);

        setSessionResults({
            duration: sessionDurationMs / 1000,
            averages,
            mentalState,
            stateDescription,
            focusScore,
            symmetry: averages.symmetry > 0 ? 'Left hemisphere dominant' : 
                     averages.symmetry < 0 ? 'Right hemisphere dominant' : 'Balanced',
            data,
            dominantBands,
            mostFrequent,
            convert,
            avgSymmetry,
            formattedDuration: sessionDuration
        });
    };

    // Countdown timer effect
    useEffect(() => {
        if (!isMeditating || timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    stopMeditation();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [isMeditating, timeLeft]);

    const cardBg = darkMode ? "bg-zinc-800/90 border-zinc-700" : "bg-white/95 border-stone-200";
    const textPrimary = darkMode ? "text-stone-300" : "text-stone-800";
    const textSecondary = darkMode ? "text-stone-400" : "text-stone-500";

    return (
        <div className={`rounded-xl shadow-md p-1 border ${cardBg} transition-colors duration-300 h-full min-h-0 overflow-hidden`}>
            {!isMeditating ? (
                !sessionResults ? (
                    <div className="space-y-2">
                        <h3 className={`text-sm font-small ${textPrimary}`}>Start Meditation Session</h3>
                        <div className="flex flex-col ">
                            <label className={`text-xs ${textSecondary}`}>Duration (minutes)</label>
                            <input
                                type="number"
                                min="1"
                                max="60"
                                value={duration}
                                onChange={(e) => setDuration(Math.min(60, Math.max(1, parseInt(e.target.value) || 5)))}

                                className={`p-1 rounded border ${darkMode ? 'bg-zinc-700 border-zinc-600' : 'bg-white border-stone-300'}`}
                            />
                        </div>
                        <button
                            onClick={startMeditation}
                            className="w-full  px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                        >
                            Begin Session
                        </button>
                    </div>
                ) : (
                    <div className="">
                        <h3 className={`text-xs ${textPrimary}`}>Session Results</h3>
                        
                        <div className="gap-2 ">
                            {renderSessionResults?.({
                                dominantBands: sessionResults.dominantBands,
                                mostFrequent: sessionResults.mostFrequent,
                                convert: sessionResults.convert,
                                avgSymmetry: sessionResults.avgSymmetry,
                                duration: sessionResults.formattedDuration
                            })}
                        </div>
                        
                        <button
                            onClick={() => setSessionResults(null)}
                            className="w-full  px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors "
                        >
                            Start New Session
                        </button>
                    </div>
                )
            ) : (
                <div className="space-y-2 text-center">
                    <h3 className={`text-sm font-small ${textPrimary}`}>Meditation in Progress</h3>
                    <div className={`text-sm  ${textPrimary}`}>
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                    <p className={textSecondary}>Focus on your breath...</p>
                    <button
                        onClick={stopMeditation}
                        className="w-full  px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                    >
                        End Session Early
                    </button>
                </div>
            )}
        </div>
    );
};