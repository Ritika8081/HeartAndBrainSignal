// app/SignalVisualizer.tsx
"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import {
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
} from 'recharts';
import { Activity, Brain, Heart, Box, Moon, Sun } from 'lucide-react';
import { useBleStream } from '../components/Bledata';
import WebglPlotCanvas from '../components/WebglPlotCanvas';
import Contributors from './Contributors';
import { WebglPlotCanvasHandle } from "../components/WebglPlotCanvas";

const CHANNEL_COLORS: Record<string, string> = {
    ch0: "#C29963", // EEG channel 0
    ch1: "#63A2C2", // EEG channel 1
    ch2: "#E4967E", // ECG channel 1
};

export default function SignalVisualizer() {
    const [darkMode, setDarkMode] = useState(false);
    const canvaseeg1Ref = useRef<WebglPlotCanvasHandle>(null);
    const canvaseeg2Ref = useRef<WebglPlotCanvasHandle>(null);
    const canvasecgRef = useRef<WebglPlotCanvasHandle>(null);
    const buf0Ref = useRef<number[]>([]);
    const buf1Ref = useRef<number[]>([]);
    const radarDataCh0Ref = useRef<{ subject: string; value: number }[]>([]);
    const radarDataCh1Ref = useRef<{ subject: string; value: number }[]>([]);
    const workerRef = useRef<Worker | null>(null);
    const dataProcessorWorkerRef = useRef<Worker | null>(null);
    // Animation state
    const [isBeating, setIsBeating] = useState(false);
    // 1) Create refs for each display element
    const currentRef = useRef<HTMLDivElement>(null);
    const highRef = useRef<HTMLDivElement>(null);
    const lowRef = useRef<HTMLDivElement>(null);
    const avgRef = useRef<HTMLDivElement>(null);
    let previousCounter: number | null = null; // Variable to store the previous counter value for loss detection
    const bpmWorkerRef = useRef<Worker | null>(null);
    const previousCounterRef = useRef<number | null>(null); // Replace previousCounter with a useRef

    // Create beating heart animation effect
    useEffect(() => {
        const interval = setInterval(() => {
            setIsBeating(true);
            setTimeout(() => setIsBeating(false), 200);
        }, 1000);

        return () => clearInterval(interval);
    }, []);

    const datastream = useCallback((data: number[]) => {
        // Only send raw data to worker (no direct canvas updates)
        dataProcessorWorkerRef.current?.postMessage({
            command: "process",
            rawData: {
                counter: data[0],
                raw0: data[1], // EEG 1
                raw1: data[2], // EEG 2
                raw2: data[3], // ECG
            },
        });

    }, []);

    const { connected, connect, disconnect } = useBleStream(datastream);

    const channelColors: Record<string, string> = {
        ch0: "#C29963",
        ch1: "#548687",
        ch2: "#9A7197",
    };

    // inside your component, before the return:
    const bandData = [
        { subject: "Delta", value: 0 },
        { subject: "Theta", value: 0 },
        { subject: "Alpha", value: 0 },
        { subject: "Beta", value: 0 },
        { subject: "Gamma", value: 0 },
    ];
    // 2. Let the worker's onmessage handle ALL visualization updates
    useEffect(() => {
        const worker = new Worker(
            new URL("../webworker/dataProcessor.worker.ts", import.meta.url),
            { type: "module" }
        );
        worker.onmessage = (e) => {
            if (e.data.type === "processedData") {
                const { counter, eeg0, eeg1, ecg } = e.data.data;
                canvaseeg1Ref.current?.updateData([counter, eeg0, 1]);
                canvaseeg2Ref.current?.updateData([counter, eeg1, 2]);
                canvasecgRef.current?.updateData([counter, ecg, 3]);
                onNewSample(eeg0, eeg1); // For radar charts
            }
        };
        dataProcessorWorkerRef.current = worker;
        return () => worker.terminate();
    }, []);

    useEffect(() => {
        const w = new Worker(
            new URL("../webworker/bandPower.worker.ts", import.meta.url),
            { type: "module" }
        );
        w.onmessage = (
            e: MessageEvent<{
                smooth0: Record<string, number>;
                smooth1: Record<string, number>;
            }>
        ) => {
            const { smooth0, smooth1 } = e.data;

            radarDataCh0Ref.current = Object.entries(smooth0).map(
                ([subject, value]) => ({ subject: capitalize(subject), value })
            );

            function capitalize(str: string): string {
                return str.charAt(0).toUpperCase() + str.slice(1);
            }
            radarDataCh1Ref.current = Object.entries(smooth1).map(
                ([subject, value]) => ({ subject: capitalize(subject), value })
            );
            // setTick(t => t + 1);
        };
        workerRef.current = w;
        return () => {
            w.terminate();
        };
    }, []);

    const onNewSample = useCallback((eeg0: number, eeg1: number) => {
        buf0Ref.current.push(eeg0);
        buf1Ref.current.push(eeg1);
        if (buf0Ref.current.length > 256) buf0Ref.current.shift();
        if (buf1Ref.current.length > 256) buf1Ref.current.shift();

        if (buf0Ref.current.length === 256) {
            workerRef.current?.postMessage({
                eeg0: buf0Ref.current,
                eeg1: buf1Ref.current,
                sampleRate: 500,
                fftSize: 256,
            });
        }
    }, []);

    // onNewECG: buffer ECG and every 500 samples (1 s) send to BPM worker ---
    const ecgBufRef = useRef<number[]>([]);

    const onNewECG = useCallback((ecg: number) => {
        ecgBufRef.current.push(ecg);
        // keep last 5 s @500 Hz = 2500 samples
        if (ecgBufRef.current.length > 2500) {
            ecgBufRef.current.shift();
        }
        // every full second → 500 new samples
        if (ecgBufRef.current.length % 500 === 0) {
            bpmWorkerRef.current?.postMessage({
                ecgBuffer: [...ecgBufRef.current],
                sampleRate: 500,
            });
        }
    }, []);

    // BPM worker: smooth & display BPM, high/low/avg, (optionally) peaks ---
    useEffect(() => {
        const worker = new Worker(
            new URL("../webworker/bpm.worker.ts", import.meta.url),
            { type: "module" }
        );

        const bpmWindow: number[] = [];
        const windowSize = 5;
        let displayedBPM: number | null = null;
        const maxChange = 2;

        worker.onmessage = (
            e: MessageEvent<{
                bpm: number | null;
                high: number | null;
                low: number | null;
                avg: number | null;
                peaks: number[];
            }>
        ) => {
            const { bpm, high, low, avg } = e.data;

            // — smooth current BPM —
            if (bpm !== null) {
                bpmWindow.push(bpm);
                if (bpmWindow.length > windowSize) bpmWindow.shift();
                const avgBPM = bpmWindow.reduce((a, b) => a + b, 0) / bpmWindow.length;
                if (displayedBPM === null) displayedBPM = avgBPM;
                else {
                    const diff = avgBPM - displayedBPM;
                    displayedBPM += Math.sign(diff) * Math.min(Math.abs(diff), maxChange);
                }
                currentRef.current!.textContent = `${Math.round(displayedBPM)}`;
            } else {
                bpmWindow.length = 0;
                displayedBPM = null;
                currentRef.current!.textContent = "--";
            }

            // — display high/low/avg —
            highRef.current!.textContent = high !== null ? `${high}` : "--";
            lowRef.current!.textContent = low !== null ? `${low}` : "--";
            avgRef.current!.textContent = avg !== null ? `${avg}` : "--";
        };

        bpmWorkerRef.current = worker;
        return () => {
            worker.terminate();
        };
    }, []);

    // 5) Hook into your existing dataProcessor worker
    useEffect(() => {
        const dp = dataProcessorWorkerRef.current!;
        const handler = (e: MessageEvent) => {
            if (e.data.type === "processedData") {
                const { eeg0, eeg1, ecg } = e.data.data;
                onNewSample(eeg0, eeg1);
                onNewECG(ecg);
            }
        };
        dp.addEventListener("message", handler);
        return () => {
            dp.removeEventListener("message", handler);
        };
    }, [onNewSample, onNewECG]);

    const bgGradient = darkMode
        ? "bg-gradient-to-b from-zinc-900 to-neutral-900"
        : "bg-gradient-to-b from-neutral-50 to-stone-100";
    const cardBg = darkMode
        ? "bg-zinc-800/90 border-zinc-700/50"
        : "bg-white/95 border-stone-200";
    const statCardBg = darkMode ? "bg-zinc-700/50" : "bg-stone-100/80"; // Added statCardBg variable
    const primaryAccent = darkMode ? "text-amber-300" : "text-amber-600";
    const secondaryAccent = darkMode ? "text-rose-300" : "text-rose-500";
    const textPrimary = darkMode ? "text-stone-300" : "text-stone-800";
    const textSecondary = darkMode ? "text-stone-400" : "text-stone-500";
    const gridLines = darkMode ? "#3f3f46" : "#e5e7eb";
    const axisColor = darkMode ? "#71717a" : "#78716c";
    const iconBoxBg = darkMode ? "bg-amber-900/20" : "bg-amber-50";
    const heartIconBoxBg = darkMode ? "bg-rose-900/20" : "bg-rose-50";
    const labelText = darkMode ? "text-zinc-400" : "text-stone-500"; // Added for labels

    return (
        <div className={`flex flex-col h-screen ${bgGradient} transition-colors duration-300`}>
            <header className={`${darkMode
                ? 'bg-zinc-900/90 backdrop-blur-sm border-b border-amber-900/20'
                : 'bg-white/90 backdrop-blur-sm border-b border-amber-100'} shadow-lg p-2 transition-colors duration-300`}>
                <div className="container mx-auto flex justify-between items-center">
                    <div className="flex items-center space-x-3">
                        <Activity className={primaryAccent} />
                        <h1 className="text-xl font-light tracking-tight">
                            <span className={`font-bold ${textPrimary}`}>Meditation</span>
                            <span className={`${primaryAccent} font-medium ml-1`}>Medusa</span>
                        </h1>
                    </div>
                    <div className="flex items-center space-x-4">

                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className={`p-1 rounded-full transition-all duration-300 ${darkMode ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200' : 'bg-stone-200 hover:bg-stone-300 text-stone-700'} shadow-sm`}
                        >
                            {darkMode ? <Sun className="h-5 w-5" strokeWidth={2} /> : <Moon className="h-4 w-4" strokeWidth={2} />}
                        </button>

                        <Contributors darkMode={darkMode} />
                    </div>
                </div>
            </header>

            <main className="flex-1 container mx-auto px-2 py-2">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 h-full">
                    {/* First Column (20%) - Device Info */}
                    <div className="md:col-span-1 flex flex-col h-full gap-3">

                        <div
                            className={`
        flex-1
        rounded-xl shadow-md p-3 border ${cardBg}
        flex flex-col items-center transition-colors duration-300
      `}
                        >

                            {/* Main icon/content area */}
                            <div className="flex-1 flex flex-col items-center w-full">
                                {/* 1) Centered icon wrapper */}
                                <div className="flex-1 flex items-center justify-center">
                                    <div
                                        className={`
        p-3 rounded-full mb-2 ${iconBoxBg}
        transition-colors duration-300
      `}
                                    >
                                        <Box className={primaryAccent} strokeWidth={1.5} />
                                    </div>
                                </div>

                                {/* 2) Buttons always at bottom */}
                                <div className="w-full flex justify-center mb-4">
                                    <button
                                        onClick={connect}
                                        disabled={connected}
                                        className={`
        px-3 py-1 rounded-full transition-all duration-300 text-white
        ${connected ? "bg-[#548687]" : "bg-[#7C9885]"}
      `}
                                    >
                                        {connected ? "Connected" : "Connect"}
                                    </button>
                                    <button
                                        onClick={disconnect}
                                        disabled={!connected}
                                        className={`
        ml-2 px-3 py-1 rounded-full transition-all duration-300 text-white
        ${connected
                                                ? "bg-[#D9777B] hover:bg-[#C7696D]"
                                                : "bg-gray-400 cursor-not-allowed"}
      `}
                                    >
                                        {connected ? "Disconnect" : "Disconnected"}
                                    </button>
                                </div>
                            </div>

                        </div>
                        <div
                            className={`flex-1 rounded-xl shadow-md p-3 border ${cardBg} flex flex-col transition-colors duration-300`}
                        >
                            {/* Device status */}
                            <h3 className={`text-base font-semibold mb-2 ${textPrimary}`}>Device Status</h3>
                            <div className={`flex items-center mb-2 ${textSecondary}`}>
                                <div className="w-2 h-2 rounded-full bg-amber-400 mr-2"></div>
                                <span className="text-sm">Connected</span>
                            </div>
                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs ${textSecondary}`}>Address</span>
                                    <span className={`font-medium text-xs ${textPrimary}`}>000</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs ${textSecondary}`}>SPS</span>
                                    <span className={`font-medium text-xs ${textPrimary}`}>500</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className={`text-xs ${textSecondary}`}>Sample Lost</span>
                                    <span className={`font-medium text-xs ${textPrimary}`}>27</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Second Column (40%) - EEG */}
                    <div className="md:col-span-2 flex flex-col gap-2">
                        {/* EEG Row 1: Brain Image */}
                        <div
                            className={`rounded-xl shadow-md p-3 border ${cardBg} flex flex-col items-center justify-center transition-colors duration-300`}
                        >
                            <div
                                className={`p-3 rounded-full mb-1 ${iconBoxBg} transition-colors duration-300`}
                            >
                                <Brain className={primaryAccent} strokeWidth={1.5} />
                            </div>
                            <h2 className={`text-lg font-semibold mb-0 ${textPrimary}`}>
                                Brain Activity
                            </h2>
                            <p className={`text-xs ${textSecondary}`}>
                                Electroencephalogram (EEG)
                            </p>
                        </div>

                        {/* EEG Row 2: Spider Plot */}
                        <div
                            className={`flex flex-col rounded-xl shadow-md p-1 px-3 border ${cardBg} transition-colors duration-300 h-[40%]`}
                        >
                            {/* Charts container */}
                            <div className="flex flex-row flex-1">
                                {/* Left chart: Channel 0 */}
                                <div className="flex-1 pr-2 flex flex-col">
                                    <div className="flex-1 h-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart
                                                data={
                                                    radarDataCh0Ref.current.length
                                                        ? radarDataCh0Ref.current
                                                        : bandData
                                                }
                                                cx="50%"
                                                cy="50%"
                                                outerRadius="70%"
                                            >
                                                <PolarGrid strokeDasharray="3 3" stroke={gridLines} />
                                                <PolarAngleAxis
                                                    dataKey="subject"
                                                    tick={{ fill: axisColor, fontSize: 12 }}
                                                />
                                                <PolarRadiusAxis
                                                    domain={[0, "auto"]}
                                                    tick={false}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <Radar
                                                    name="Ch0"
                                                    dataKey="value"
                                                    stroke={channelColors.ch0}
                                                    fill={channelColors.ch0}
                                                    fillOpacity={0.6}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {/* Heading below Channel 0 chart */}
                                    <div className="text-center mt-2 text-sm" style={{ color: axisColor }}>
                                        Synaptic Swing (L)
                                    </div>
                                </div>

                                {/* Right chart: Channel 1 */}
                                <div className="flex-1 pl-2 flex flex-col">
                                    <div className="flex-1 h-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart
                                                data={
                                                    radarDataCh1Ref.current.length
                                                        ? radarDataCh1Ref.current  // fixed to use Ch1 data ref
                                                        : bandData
                                                }
                                                cx="50%"
                                                cy="50%"
                                                outerRadius="70%"
                                            >
                                                <PolarGrid strokeDasharray="3 3" stroke={gridLines} />
                                                <PolarAngleAxis
                                                    dataKey="subject"
                                                    tick={{ fill: axisColor, fontSize: 12 }}
                                                />
                                                <PolarRadiusAxis
                                                    domain={[0, "auto"]}
                                                    tick={false}
                                                    axisLine={false}
                                                    tickLine={false}
                                                />
                                                <Radar
                                                    name="Ch1"
                                                    dataKey="value"
                                                    stroke={channelColors.ch1}
                                                    fill={channelColors.ch1}
                                                    fillOpacity={0.6}
                                                />
                                            </RadarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {/* Heading below Channel 1 chart */}
                                    <div className="text-center mt-2 text-sm " style={{ color: axisColor }}>
                                        Synaptic Swing (R)
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* EEG Row 3: EEG Chart */}
                        <div className="md:col-span-2 flex flex-col gap-2 ">
                            {/* Chart container */}
                            <div className={`h-30 max-h-[300px] rounded-xl overflow-hidden p-2 transition-colors duration-300  ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>

                                <WebglPlotCanvas
                                    ref={canvaseeg1Ref}
                                    channels={[0]} // EEG Channel 0
                                    colors={{ 0: CHANNEL_COLORS.ch0 }}

                                />
                            </div>
                            <div className={`h-30 max-h-[300px] rounded-xl overflow-hidden p-2 transition-colors duration-300  ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>

                                <WebglPlotCanvas
                                    ref={canvaseeg2Ref}
                                    channels={[1]} // EEG Channel 1
                                    colors={{ 1: CHANNEL_COLORS.ch1 }}

                                />
                            </div>
                        </div>
                    </div>

                    {/* Third Column (40%) - ECG */}
                    <div className="md:col-span-2 flex flex-col gap-2">
                        {/* ECG Row 1: Heart Image */}
                        <div className={`rounded-xl shadow-md p-1  pt-2 border ${cardBg} flex flex-col items-center transition-colors duration-300 w-full h-[19%]`}>
                            <div className={`p-2 rounded-full ${heartIconBoxBg} transition-all duration-300 ${isBeating ? 'scale-110' : 'scale-100'} mb-1`}>
                                <Heart
                                    className={`${secondaryAccent} ${isBeating ? 'scale-110' : 'scale-100'} transition-all duration-200`}
                                    strokeWidth={1.5}
                                    size={32}
                                    fill={isBeating ? "currentColor" : "none"}
                                />
                            </div>

                            <div className="text-center pt-2">
                                <h2 className={`text-lg font-semibold  ${textPrimary}`}>Heart Activity</h2>
                                <p className={`text-xs ${textSecondary}`}>Electrocardiogram (ECG)</p>
                            </div>

                            <div className="mt-3 w-full flex justify-center">
                                <div className="flex space-x-1">
                                    {[1, 2, 3, 4, 5].map((dot, index) => (
                                        <div
                                            key={index}
                                            className={`h-1 w-6 rounded-full ${secondaryAccent} opacity-${80 - index * 15}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ECG Row 2: BPM Info */}
                        <div
                            className={`md:col-span-2 ${cardBg} rounded-xl shadow-lg px-4 border transition-colors duration-300 h-[40%] flex flex-col`}
                        >
                            {/* BPM Header */}
                            <div className="flex items-center justify-between p-4">
                                <div className="flex items-baseline pt-6">
                                    <span
                                        ref={currentRef}
                                        className={`text-6xl font-bold ${primaryAccent}`}
                                    >
                                        --
                                    </span>
                                    <span className={`ml-2 text-xl ${labelText}`}>BPM</span>
                                </div>
                                <div
                                    className={`flex gap-3 items-center ${textSecondary} text-sm`}
                                >
                                    <Activity size={16} />
                                    <span>Monitoring active</span>
                                </div>
                            </div>

                            {/* Stats at bottom */}
                            <div className="mt-auto grid grid-cols-3 gap-3 pb-4">
                                {/* Low BPM */}
                                <div
                                    className={`${statCardBg} rounded-lg p-2 transition-colors duration-300 flex flex-col items-center`}
                                >
                                    <div className={`text-sm ${labelText} mb-1`}>Lowest</div>
                                    <div className="flex items-baseline">
                                        <span
                                            ref={lowRef}
                                            className={`text-2xl font-semibold ${textPrimary}`}
                                        >
                                            --
                                        </span>
                                        <span className={`ml-1 text-sm ${textSecondary}`}>BPM</span>
                                    </div>
                                </div>

                                {/* Average BPM */}
                                <div
                                    className={`${statCardBg} rounded-lg p-2  transition-colors duration-300 flex flex-col items-center`}
                                >
                                    <div className={`text-sm ${labelText} mb-1`}>Average</div>
                                    <div className="flex items-baseline">
                                        <span
                                            ref={avgRef}
                                            className={`text-2xl font-semibold ${secondaryAccent}`}
                                        >
                                            --
                                        </span>
                                        <span className={`ml-1 text-sm ${textSecondary}`}>BPM</span>
                                    </div>
                                </div>

                                {/* High BPM */}
                                <div
                                    className={`${statCardBg} rounded-lg p-2  transition-colors duration-300 flex flex-col items-center`}
                                >
                                    <div className={`text-sm ${labelText} mb-1`}>Highest</div>
                                    <div className="flex items-baseline">
                                        <span
                                            ref={highRef}
                                            className={`text-2xl font-semibold ${primaryAccent}`}
                                        >
                                            --
                                        </span>
                                        <span className={`ml-1 text-sm ${textSecondary}`}>BPM</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ECG Section */}
                        <div className="md:col-span-2 flex flex-col gap-3">
                            <div className={`h-62 max-h-[300px] rounded-xl overflow-hidden p-2 transition-colors duration-300  ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>

                                <WebglPlotCanvas
                                    ref={canvasecgRef}
                                    channels={[2]} // ECG Channel 2
                                    colors={{ 2: CHANNEL_COLORS.ch2 }}

                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer
                className={`py-2 px-4 ${darkMode
                    ? "bg-zinc-900/90 border-t border-amber-900/20"
                    : "bg-white/90 backdrop-blur-sm border-t border-amber-100"
                    } shadow-inner transition-colors duration-300`}
            >
                <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-xs">
                    <div className={textSecondary + " mb-1 md:mb-0"}>
                        <span className="font-medium">Meditation Medusa</span> ©{" "}
                        {new Date().getFullYear()}
                    </div>
                </div>
            </footer>
        </div>
    );
}
