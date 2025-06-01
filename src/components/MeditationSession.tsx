// components/MeditationSession.tsx
"use client";

import { useState, useRef, useEffect } from 'react';
import { useBleStream } from '../components/Bledata';

export const MeditationSession = ({
    onStartSession,
    connected,
    onEndSession,
    sessionData,
    darkMode,
    renderSessionResults
}: {
    onStartSession: () => void;
    onEndSession: () => void;
    sessionData: { timestamp: number; alpha: number; beta: number; theta: number; delta: number; symmetry: number }[];
    darkMode: boolean;
    connected: boolean;
    renderSessionResults?: (results: {
        dominantBands: Record<string, number>;
        mostFrequent: string;
        convert: (ticks: number) => string;
        avgSymmetry: string;
        duration: string;
        averages: {
            alpha: number;
            beta: number;
            theta: number;
            delta: number;
            symmetry: number;
        };
        focusScore: string;
        statePercentages: Record<string, string>;
        goodMeditationPct: string;
    }) => React.ReactNode;
}) => {
    const [isMeditating, setIsMeditating] = useState(false);
    const [duration, setDuration] = useState(5);
    const [timeLeft, setTimeLeft] = useState(0);
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
        statePercentages: Record<string, string>;
        goodMeditationPct: string;
        weightedEEGScore: number;
    } | null>(null);
    const sessionStartTime = useRef<number | null>(null);
    const selectedGoalRef = useRef<string>('meditation');

    const startMeditation = () => {
        setIsMeditating(true);
        setTimeLeft(duration * 60);
        sessionStartTime.current = Date.now();
        onStartSession();
    };

    const stopMeditation = () => {
        setIsMeditating(false);
        const frozenData = sessionData.filter(d => sessionStartTime.current && d.timestamp >= sessionStartTime.current);
        analyzeSession(frozenData);
        onEndSession();
    };

    const analyzeSession = (data: typeof sessionData) => {
        if (!data.length) return;

        const sessionDurationMs = data[data.length - 1].timestamp - data[0].timestamp;
        const sessionDuration = sessionDurationMs > 60000
            ? `${Math.round(sessionDurationMs / 60000)} min`
            : `${Math.round(sessionDurationMs / 1000)} sec`;

        const convert = (ticks: number) => ((ticks * 0.5) / 60).toFixed(2);

        const avgSymmetry = (
            data.reduce((sum, d) => sum + (d.symmetry ?? 0), 0) / data.length
        ).toFixed(3);

        const averages = {
            alpha: data.reduce((sum, d) => sum + d.alpha, 0) / data.length,
            beta: data.reduce((sum, d) => sum + d.beta, 0) / data.length,
            theta: data.reduce((sum, d) => sum + d.theta, 0) / data.length,
            delta: data.reduce((sum, d) => sum + d.delta, 0) / data.length,
            symmetry: data.reduce((sum, d) => sum + d.symmetry, 0) / data.length,
        };

        const totalPower = averages.alpha + averages.beta + averages.theta + averages.delta;

        const statePercentages = {
            Relaxed: ((averages.alpha / totalPower) * 100).toFixed(1),
            Focused: ((averages.beta / totalPower) * 100).toFixed(1),
            "Meditation": ((averages.theta / totalPower) * 100).toFixed(1),
            Drowsy: ((averages.delta / totalPower) * 100).toFixed(1),
        };

        const goodMeditationPct = (
            ((averages.alpha + averages.theta) / totalPower) * 100
        ).toFixed(1);

        const mostFrequent = Object.entries(averages)
            .filter(([key]) => key !== "symmetry")
            .sort((a, b) => b[1] - a[1])[0][0];

        let mentalState = '';
        let stateDescription = '';

        if (mostFrequent === 'alpha') {
            mentalState = 'Relaxed';
            stateDescription = 'Your mind was in a calm and relaxed state, ideal for meditation.';
        } else if (mostFrequent === 'beta') {
            mentalState = 'Focused';
            stateDescription = 'Your mind was highly alert or active. Try to slow down your breath to enter a calmer state.';
        } else if (mostFrequent === 'theta') {
            mentalState = 'Meditation';
            stateDescription = 'You entered a deeply meditative state—excellent work.';
        } else if (mostFrequent === 'delta') {
            mentalState = 'Drowsy';
            stateDescription = 'Your brain was in a very slow-wave state, indicating deep rest or sleepiness.';
        }

        const EEG_WEIGHTS: Record<string, Partial<Record<'alpha' | 'theta' | 'beta' | 'delta', number>>> = {
            meditation: { alpha: 0.4, theta: 0.6 },
            relaxation: { alpha: 0.7, theta: 0.3 },
            focus: { beta: 0.8, alpha: 0.2 },
            sleep: { delta: 1.0 },
        };

        const goal = selectedGoalRef.current;
        const goalWeights = EEG_WEIGHTS[goal] || {};
        const weightedEEGScore = Object.entries(goalWeights).reduce(
            (sum, [band, weight]) => sum + (weight ?? 0) * (averages[band as keyof typeof averages] || 0),
            0
        );

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
            dominantBands: {
                alpha: Math.round(averages.alpha * 1000),
                beta: Math.round(averages.beta * 1000),
                theta: Math.round(averages.theta * 1000),
                delta: Math.round(averages.delta * 1000),
            },
            mostFrequent,
            convert,
            avgSymmetry: avgSymmetry,
            formattedDuration: sessionDuration,
            statePercentages,
            goodMeditationPct,
            weightedEEGScore,
        });
    };

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

    const progressPercentage = isMeditating ? ((duration * 60 - timeLeft) / (duration * 60)) * 100 : 0;

    const textPrimary = darkMode ? "text-stone-100" : "text-stone-800";
    const textSecondary = darkMode ? "text-stone-400" : "text-stone-600";
    const accent = darkMode ? "text-blue-400" : "text-blue-600";

    return (
        <div className="h-full w-full min-h-0 overflow-hidden relative flex flex-col">
            {!isMeditating ? (
                !sessionResults ? (
                    // Start Session UI - Responsive container
                    <div className="flex-1 flex flex-col p-2 sm:p-3 md:p-4 space-y-3 sm:space-y-4 animate-in fade-in duration-300">
                        {/* Main Content - Uses remaining space */}
                        <div className="flex-1 flex flex-col justify-center space-y-4 sm:space-y-6 md:space-y-8 min-h-0">
                            {/* Duration Selection */}
                            <div className="space-y-2 px-1 sm:px-2">
                                <label className={`text-xs sm:text-sm md:text-base font-semibold ${textPrimary} block text-center`}>
                                    Choose Duration
                                </label>

                                {/* Duration Buttons - Responsive grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2 md:gap-3">
                                    {[3, 5, 10, 15].map((val) => (
                                        <button
                                            key={val}
                                            onClick={() => setDuration(val)}
                                            disabled={!connected}
                                            className={`
                                                relative overflow-hidden group
                                                px-1 py-2 sm:px-2 sm:py-3 md:py-4
                                                rounded-lg border font-bold transition-all duration-300
                                                text-xs sm:text-sm md:text-base
                                                
                                                ${duration === val
                                                    ? `bg-[#D9777B] text-white border-transparent`
                                                    : `bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-zinc-600`
                                                }
                                                ${!connected ? "opacity-40 cursor-not-allowed" : "hover:scale-105"}
                                            `}
                                        >
                                            <div className="relative flex flex-col items-center space-y-0.5 sm:space-y-1">
                                                <span className="text-xs sm:text-sm md:text-base font-bold">{val}</span>
                                                <span className="text-[10px] sm:text-xs opacity-80 font-medium">min</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Begin Button - Bottom section with proper spacing */}
                        <div className="flex justify-center pt-2 pb-1 sm:pb-2 px-2">
                            <button
                                disabled={!connected}
                                onClick={startMeditation}
                                className={`
                                    group relative overflow-hidden
                                    px-4 py-2 sm:px-6 sm:py-3 md:px-8 md:py-4
                                    text-white font-bold rounded-lg transition-all duration-300 
                                    text-sm sm:text-base md:text-lg
                                    flex items-center justify-center space-x-2
                                    shadow-lg focus:ring-4 w-full max-w-xs
                                    ${connected
                                        ? 'bg-gradient-to-r from-[#D9777B] via-[#E68A8F] to-[#F0A0A5] hover:scale-105 focus:ring-[#D9777B]/30'
                                        : 'bg-gradient-to-r from-[#D9777B]/40 to-[#E68A8F]/40 cursor-not-allowed opacity-50'
                                    }
                                `}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <span className="relative z-10 truncate">Begin Session</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    // Session Results UI - Responsive layout
                    <div className="flex-1 flex flex-col animate-in fade-in duration-500 p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3 md:space-y-4">
                        {/* Results Header */}
                        <div className="text-center space-y-2 sm:space-y-3 flex-shrink-0">
                            <h3 className={`text-base sm:text-lg md:text-xl font-bold ${textPrimary}`}>
                                Session Complete
                            </h3>
                            <div className="w-16 sm:w-24 md:w-32 h-0.5 sm:h-1 bg-gradient-to-r from-[#548687] to-[#6B9FA0] mx-auto rounded-full" />
                        </div>

                        {/* Results Content - Takes remaining space with scroll */}
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            {renderSessionResults && renderSessionResults({
                                dominantBands: sessionResults.dominantBands,
                                mostFrequent: sessionResults.mostFrequent,
                                convert: sessionResults.convert,
                                avgSymmetry: sessionResults.avgSymmetry,
                                duration: sessionResults.formattedDuration,
                                averages: sessionResults.averages,
                                focusScore: sessionResults.focusScore,
                                statePercentages: sessionResults.statePercentages,
                                goodMeditationPct: sessionResults.goodMeditationPct
                            })}
                        </div>

                        {/* New Session Button - Responsive sizing */}
                        <div className="pt-1 sm:pt-2 px-1 sm:px-2 pb-1 sm:pb-2 flex-shrink-0">
                            <button
                                onClick={() => setSessionResults(null)}
                                className={`
                                    group relative overflow-hidden
                                    w-full px-4 py-2 sm:px-6 sm:py-3
                                    bg-gradient-to-r from-[#548687] via-[#6B9FA0] to-[#7FADB0] 
                                    hover:scale-105
                                    text-white font-bold rounded-lg transition-all duration-300 
                                    flex items-center justify-center space-x-2 shadow-lg
                                    text-sm sm:text-base
                                `}
                            >
                                <svg className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                <span className="relative z-10 truncate">Start New Session</span>
                            </button>
                        </div>
                    </div>
                )
            ) : (
                // Active Meditation UI - Responsive circular timer
                <div className="flex-1 flex flex-col justify-center items-center text-center animate-in fade-in duration-300 p-2 sm:p-3 md:p-4 space-y-3 sm:space-y-4 md:space-y-5">
                    {/* Responsive Timer Circle */}

                    <div className="relative w-full h-full mx-auto">
                        {/* Breathing rings with responsive scaling */}


                        {/* Responsive Timer Display */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className={`text-center ${accent}`}>
                                <div className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold font-mono leading-tight">
                                    {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                </div>
                                <div className="text-xs sm:text-sm md:text-base opacity-70 mt-1">
                                    remaining
                                </div>
                            </div>
                        </div>
                        {/* Enhanced Progress Circle - Responsive stroke */}
                        <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                            <circle
                                cx="50"
                                cy="50"
                                r="48"
                                stroke={darkMode ? "#374151" : "#e5e7eb"}
                                strokeWidth="1"
                                fill="none"
                            />
                            <circle
                                cx="50"
                                cy="50"
                                r="46"
                                stroke={darkMode ? "#1f2937" : "#f3f4f6"}
                                strokeWidth="2"
                                fill="none"
                            />
                            <circle
                                cx="50"
                                cy="50"
                                r="46"
                                stroke="url(#progressGradient)"
                                strokeWidth="3"
                                fill="none"
                                strokeDasharray={Math.PI * 2 * 46}
                                strokeDashoffset={(Math.PI * 2 * 46 * (1 - progressPercentage / 100))}
                                className="transition-all duration-1000 ease-linear"
                                strokeLinecap="round"
                            />
                            <defs>
                                <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor={darkMode ? "#60a5fa" : "#3b82f6"} />
                                    <stop offset="100%" stopColor={darkMode ? "#34d399" : "#10b981"} />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>


                    {/* Responsive End Session Button */}
                    <button
                        onClick={stopMeditation}
                        className={`
                            group relative overflow-hidden
                            px-4 py-2 sm:px-5 sm:py-2.5 md:px-6 md:py-3
                            bg-gradient-to-r from-red-600 via-red-700 to-red-800 
                            hover:scale-105
                            text-white font-bold rounded-lg transition-all duration-300 
                            flex items-center justify-center space-x-2 shadow-lg 
                            text-sm sm:text-base
                            w-full max-w-xs
                        `}
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <svg className="w-4 h-4 sm:w-5 sm:h-5 relative z-10 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                        </svg>
                        <span className="relative z-10 truncate">End Session</span>
                    </button>
                </div>
            )}

            <style jsx>{`
                @keyframes breathe {
                    0%, 100% { 
                        transform: scale(1); 
                        opacity: 0.8; 
                    }
                    50% { 
                        transform: scale(1.05); 
                        opacity: 0.4; 
                    }
                }
            `}</style>
        </div>
    );
};