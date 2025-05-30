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
        averages: {
            alpha: number;
            beta: number;
            theta: number;
            delta: number;
            symmetry: number;
        };
        focusScore: string;
        statePercentages: Record<string, string>;  // ✅ required
        goodMeditationPct: string;                 // ✅ required
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
        statePercentages: Record<string, string>; // ✅ Added
        goodMeditationPct: string;               // ✅ Added
        weightedEEGScore: number;                // ✅ Added
    } | null>(null);
    const sessionStartTime = useRef<number | null>(null);
    const selectedGoalRef = useRef<string>('meditation'); // Default goal set to 'meditation'

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

        // 🧠 Goal-specific scoring
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
            avgSymmetry,
            formattedDuration: sessionDuration,
            statePercentages,
            goodMeditationPct,
            weightedEEGScore, // ✅ optional: you can show this in UI
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

    const cardBg = darkMode
        ? "bg-gradient-to-br from-zinc-800/95 to-zinc-900/95 border-zinc-700/50 shadow-2xl"
        : "bg-gradient-to-br from-white/95 to-stone-50/95 border-stone-200/50 shadow-lg";
    const textPrimary = darkMode ? "text-stone-100" : "text-stone-800";
    const textSecondary = darkMode ? "text-stone-400" : "text-stone-600";
    const accent = darkMode ? "text-blue-400" : "text-blue-600";
    const inputBg = darkMode
        ? 'bg-zinc-700/50 border-zinc-600/50 text-stone-200 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20'
        : 'bg-white/80 border-stone-300/50 text-stone-800 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20';

    return (
        <div className={`h-full min-h-0 overflow-hidden relative`}>
            <div className="relative h-full flex flex-col px-1">
                {!isMeditating ? (
                    !sessionResults ? (
                        // Start Session UI
                        <div className="space-y-2 animate-in fade-in duration-300 h-full flex flex-col">
                           

                            <div className="flex-1 flex flex-col justify-center space-y-1">
                                <label className={`text-xs font-medium ${textSecondary}`}>Duration</label>

                                {/* Preset Buttons */}
                                <div className="flex flex-row flex-wrap gap-1">
                                    {[3, 5, 10, 15].map((val) => (
                                        <button
                                            key={val}
                                            onClick={() => setDuration(val)}
                                            className={`px-2 py-1 rounded-lg border font-medium text-sm transition-all duration-200 
                    ${duration === val
                                                    ? "bg-[#D9777B] text-white border-transparent"
                                                    : `bg-white dark:bg-zinc-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-zinc-600`
                                                }`}
                                        >
                                            {val} min
                                        </button>
                                    ))}
                                </div>

                                {/* Begin Button */}
                                <button
                                    onClick={startMeditation}
                                    className={`mt-2 bg-[#D9777B] px-4 py-2 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm whitespace-nowrap`}
                                >
                                    Begin
                                </button>
                            </div>

                        </div>
                    ) : (
                        // Session Results UI
                        <div className="h-full flex flex-col animate-in fade-in duration-500 overflow-hidden">
                            <div className="text-center flex flex-row">
                                <h4 className={`text-sm font-semibold ${textPrimary}`}>Session Complete : meditation insights</h4>

                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto">
                                {renderSessionResults && renderSessionResults({
                                    dominantBands: sessionResults.dominantBands,
                                    mostFrequent: sessionResults.mostFrequent,
                                    convert: sessionResults.convert,
                                    avgSymmetry: sessionResults.avgSymmetry,
                                    duration: sessionResults.formattedDuration,
                                    averages: sessionResults.averages,
                                    focusScore: sessionResults.focusScore,
                                    statePercentages: sessionResults.statePercentages,      // ✅ new
                                    goodMeditationPct: sessionResults.goodMeditationPct     // ✅ new
                                })}
                            </div>


                            <button
                                onClick={() => setSessionResults(null)}
                                className={`w-full px-4 bg-[#548687] text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm flex-shrink-0`}
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                New Session
                            </button>
                        </div>
                    )
                ) : (
                    <div className="h-full flex flex-col justify-center items-center text-center animate-in fade-in duration-300">
                        <div className="relative  max-w-[120px] aspect-square mb-2">
                            <div
                                className={`w-16 h-16 rounded-full border-2 ${darkMode ? 'border-blue-400/30' : 'border-blue-500/30'} relative overflow-hidden`}
                            >
                                <div
                                    className={`absolute inset-0 rounded-full ${darkMode ? 'bg-blue-400/20' : 'bg-blue-500/20'} animate-pulse`}
                                    style={{ animation: 'breathe 4s ease-in-out infinite' }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className={`text-[10px] font-light ${accent}`}>
                                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                    </div>
                                </div>
                            </div>

                            <svg className="absolute inset-0 w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
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
                                    r="48"
                                    stroke={darkMode ? "#60a5fa" : "#3b82f6"}
                                    strokeWidth="1"
                                    fill="none"
                                    strokeDasharray={Math.PI * 2 * 48}
                                    strokeDashoffset={(Math.PI * 2 * 48 * (1 - progressPercentage / 100))}
                                    className="transition-all duration-1000 ease-linear"
                                />
                            </svg>

                        </div>

                        <div className="space-y-1 mb-2">
                            <h3 className={`text-sm font-semibold ${textPrimary}`}>Meditating</h3>
                            <p className={`text-xs ${textSecondary}`}>Focus on your breath</p>
                        </div>

                        <button
                            onClick={stopMeditation}
                            className={`px-4 py-1.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 text-xs`}
                        >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10h6v4H9z" />
                            </svg>
                            End
                        </button>
                    </div>

                )}
            </div>

            <style jsx>{`
            @keyframes breathe {
                0%, 100% { transform: scale(1); opacity: 0.7; }
                50% { transform: scale(1.1); opacity: 0.3; }
            }
        `}</style>
        </div>

    );
};