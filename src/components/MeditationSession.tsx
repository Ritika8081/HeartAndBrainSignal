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

    // Calculate progress percentage for visual feedback
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
                            <div className="text-center">
                                <h3 className={`text-sm font-semibold ${textPrimary} mb-1`}>Begin Session</h3>
                                <p className={`text-xs ${textSecondary}`}>Start your meditation journey</p>
                            </div>

                            <div className="flex-1 flex flex-col justify-center space-y-1">
                                <label className={`text-xs font-medium ${textSecondary}`}>Duration (minutes)</label>

                                <div className="flex flex-row items-center space-x-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="60"
                                        value={duration}
                                        onChange={(e) =>
                                            setDuration(Math.min(60, Math.max(1, parseInt(e.target.value) || 5)))
                                        }
                                        className={`flex-grow px-3 py-2 rounded-lg border text-center font-medium ${inputBg} transition-all duration-200 outline-none text-sm`}
                                    />

                                    <button
                                        onClick={startMeditation}
                                        className={`bg-[#D9777B] px-4 py-2 text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm whitespace-nowrap`}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1.5a2.5 2.5 0 110 5H9m0 0V6.5a2.5 2.5 0 011.5-2.5H12"
                                            />
                                        </svg>
                                        Begin
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        // Session Results UI
                        <div className="h-full flex flex-col animate-in fade-in duration-500 overflow-hidden">
                            <div className="text-center flex flex-row">
                                <h4 className={`text-sm font-semibold ${textPrimary}`}>Session Complete : meditation insights</h4>
                                <div className="flex justify-center mx-5 pb-2">
                                    {(() => {
                                        const stateLabel = sessionResults.mostFrequent === "alpha"
                                            ? "🧘 Relaxation"
                                            : sessionResults.mostFrequent === "theta"
                                                ? "🛌 Deep Meditation"
                                                : sessionResults.mostFrequent === "beta"
                                                    ? "🎯 Focus"
                                                    : sessionResults.mostFrequent === "delta"
                                                        ? "💤 Sleep"
                                                        : "⚪ Neutral";

                                        const colorMap: Record<string, string> = {
                                            alpha: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-200",
                                            theta: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-200",
                                            beta: "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-200",
                                            delta: "bg-gray-100 text-gray-700 dark:bg-gray-800/20 dark:text-gray-300",
                                        };

                                        const bandColor = colorMap[sessionResults.mostFrequent] || "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";

                                        return (
                                            <div className={`text-xs font-semibold px-3 py-1 rounded-full ${bandColor}`}>
                                                {stateLabel}
                                            </div>
                                        );
                                    })()}
                                </div>

                            </div>

                            <div className="flex-1 min-h-0 overflow-y-auto ">
                                {renderSessionResults?.({
                                    dominantBands: sessionResults.dominantBands,
                                    mostFrequent: sessionResults.mostFrequent,
                                    convert: sessionResults.convert,
                                    avgSymmetry: sessionResults.avgSymmetry,
                                    duration: sessionResults.formattedDuration
                                })}

                                <div className=" rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-700 text-xs font-medium text-yellow-800 dark:text-yellow-100">
                                    {(() => {
                                        const alphaTicks = sessionResults.dominantBands.alpha ?? 0;
                                        const thetaTicks = sessionResults.dominantBands.theta ?? 0;
                                        const betaTicks = sessionResults.dominantBands.beta ?? 0;
                                        const deltaTicks = sessionResults.dominantBands.delta ?? 0;
                                        const totalTicks = alphaTicks + thetaTicks + betaTicks + deltaTicks;

                                        const alphaPct = ((alphaTicks / totalTicks) * 100).toFixed(1);
                                        const thetaPct = ((thetaTicks / totalTicks) * 100).toFixed(1);
                                        const betaPct = ((betaTicks / totalTicks) * 100).toFixed(1);

                                        const dominantText = sessionResults.mostFrequent === "alpha"
                                            ? "a calm, relaxed state"
                                            : sessionResults.mostFrequent === "theta"
                                                ? "a deeply meditative state"
                                                : sessionResults.mostFrequent === "beta"
                                                    ? "an alert or slightly stressed state"
                                                    : "a sleepy, resting state";

                                        const symmetry = Math.abs(Number(sessionResults.avgSymmetry)) < 0.05
                                            ? "balanced"
                                            : Number(sessionResults.avgSymmetry) > 0
                                                ? `left hemisphere was slightly dominant (α=${alphaPct}%)`
                                                : `right hemisphere was slightly dominant (β=${betaPct}%)`;

                                        const feedback = Number(betaPct) > 25
                                            ? "Try reducing beta activity next time for deeper calm."
                                            : "You're doing great—keep practicing regularly!";

                                        return `You stayed in ${dominantText} for ${sessionResults.formattedDuration}, with strong alpha-theta presence (α=${alphaPct}%, θ=${thetaPct}%). Your ${symmetry}. ${feedback}`;
                                    })()}
                                </div>
                            </div>

                            <button
                                onClick={() => setSessionResults(null)}
                                className={`w-full  px-4 bg-[#548687] text-white font-medium rounded-lg transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-sm flex-shrink-0`}
                            >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                New Session
                            </button>
                        </div>
                    )
                ) : (
                    // Active Meditation UI
                    <div className="h-full flex flex-col justify-center items-center text-center animate-in fade-in duration-300">
                        <div className="relative w-20 h-20 mb-2">
                            <div className={`w-full h-full rounded-full border-2 ${darkMode ? 'border-blue-400/30' : 'border-blue-500/30'} relative overflow-hidden`}>
                                <div
                                    className={`absolute inset-1 rounded-full ${darkMode ? 'bg-blue-400/20' : 'bg-blue-500/20'} animate-pulse`}
                                    style={{ animation: 'breathe 4s ease-in-out infinite' }}
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className={`text-xs font-light ${accent}`}>
                                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                                    </div>
                                </div>
                            </div>

                            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                                <circle
                                    cx="40"
                                    cy="40"
                                    r="38"
                                    stroke={darkMode ? "#374151" : "#e5e7eb"}
                                    strokeWidth="1"
                                    fill="none"
                                />
                                <circle
                                    cx="40"
                                    cy="40"
                                    r="38"
                                    stroke={darkMode ? "#60a5fa" : "#3b82f6"}
                                    strokeWidth="1"
                                    fill="none"
                                    strokeDasharray={`${2 * Math.PI * 38}`}
                                    strokeDashoffset={`${2 * Math.PI * 38 * (1 - progressPercentage / 100)}`}
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