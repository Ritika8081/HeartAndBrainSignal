// app/SignalVisualizer.tsx
"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useMotionValue } from "framer-motion";
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
import HRVPlotCanvas, { HRVPlotCanvasHandle } from '@/components/Hrvwebglplot'
import BrainSplitVisualizer from '@/components/BrainSplit';
import { StateIndicator, State } from "@/components/StateIndicator";
import { predictState } from "@/lib/stateClassifier";
import { useRouter } from 'next/navigation';

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
    const [userState, setUserState] = useState<State>("relaxed");
    // 1) Create refs for each display element
    const currentRef = useRef<HTMLDivElement>(null);
    const highRef = useRef<HTMLDivElement>(null);
    const lowRef = useRef<HTMLDivElement>(null);
    const avgRef = useRef<HTMLDivElement>(null);
    let previousCounter: number | null = null; // Variable to store the previous counter value for loss detection
    const bpmWorkerRef = useRef<Worker | null>(null);
    const previousCounterRef = useRef<number | null>(null); // Replace previousCounter with a useRef
    // new HRV refs
    const hrvRef = useRef<HTMLSpanElement>(null);
    const hrvHighRef = useRef<HTMLSpanElement>(null);
    const hrvLowRef = useRef<HTMLSpanElement>(null);
    const hrvAvgRef = useRef<HTMLSpanElement>(null);
    const [hrvData, setHrvData] = useState<{ time: number; hrv: number }[]>([]);
    const hrvplotRef = useRef<HRVPlotCanvasHandle>(null);
    const router = useRouter();
    const leftMV = useMotionValue(0);
    const rightMV = useMotionValue(0);
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

            leftMV.set(smooth0.beta);
            rightMV.set(smooth1.beta);

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
                hrv: number | null;
                hrvHigh: number | null;
                hrvLow: number | null;
                hrvAvg: number | null;
                sdnn: number;      // true SDNN from worker
                rmssd: number;     // latest RMSSD from worker
                pnn50: number;     // pNN50 from worker
            }>
        ) => {
            const { bpm, high, low, avg, hrv, hrvHigh, hrvLow, hrvAvg, sdnn, rmssd, pnn50 } = e.data;

            console.log(
                `BPM: current=${bpm}, low=${low}, high=${high}, avg=${avg}; ` +
                `HRV (ms): latest=${hrv}, low=${hrvLow}, high=${hrvHigh}, avg=${hrvAvg}`
            );

            if (hrv !== null && !isNaN(hrv)) {
                hrvplotRef.current?.updateHRV(hrv);
            }

            // Update BPM values
            if (bpm !== null) {
                bpmWindow.push(bpm);
                if (bpmWindow.length > windowSize) bpmWindow.shift();
                const avgBPM = bpmWindow.reduce((a, b) => a + b, 0) / bpmWindow.length;
                if (displayedBPM === null) displayedBPM = avgBPM;
                else {
                    const diff = avgBPM - displayedBPM;
                    displayedBPM += Math.sign(diff) * Math.min(Math.abs(diff), maxChange);
                }
                if (currentRef.current) currentRef.current.textContent = `${Math.round(displayedBPM)}`;
            } else {
                bpmWindow.length = 0;
                displayedBPM = null;
                if (currentRef.current) currentRef.current.textContent = "--";
            }

            if (highRef.current) highRef.current.textContent = high !== null ? `${high}` : "--";
            if (lowRef.current) lowRef.current.textContent = low !== null ? `${low}` : "--";
            if (avgRef.current) avgRef.current.textContent = avg !== null ? `${avg}` : "--";

            // Update HRV values
            if (hrvRef.current) hrvRef.current.textContent = hrv !== null ? `${hrv}` : "--";
            if (hrvHighRef.current) hrvHighRef.current.textContent = hrvHigh !== null ? `${hrvHigh}` : "--";
            if (hrvLowRef.current) hrvLowRef.current.textContent = hrvLow !== null ? `${hrvLow}` : "--";
            if (hrvAvgRef.current) hrvAvgRef.current.textContent = hrvAvg !== null ? `${hrvAvg}` : "--";


            const state = predictState({ sdnn, rmssd, pnn50 });
            setUserState(state);
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
        <div className={`flex flex-col h-screen w-full overflow-hidden ${bgGradient} transition-colors duration-300`}>
            {/* Header - Fixed height */}
            <header className={`${darkMode
                ? 'bg-zinc-900/90 backdrop-blur-sm border-b border-amber-900/20'
                : 'bg-white/90 backdrop-blur-sm border-b border-amber-100'} shadow-lg p-2 transition-colors duration-300 z-10`}>
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

            {/* Main content - Flexible height */}
            <main className="flex-1 container mx-auto px-2 py-2 overflow-hidden flex flex-col">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 h-full min-h-0 overflow-hidden">
                    {/* First Column (20%) - Device Info */}
                    <div className="md:col-span-1 flex flex-col gap-3 h-full min-h-0 overflow-hidden">
                        {/* First card - device connection */}
                        <div className={`rounded-xl shadow-md p-3 border ${cardBg} flex flex-col items-center transition-colors duration-300 h-1/2 min-h-0 overflow-hidden`}>
                            {/* Main icon/content area */}
                            <div className="flex-1 flex flex-col items-center justify-center w-full">
                                {/* Centered icon wrapper */}
                                <div className={`p-3 rounded-full mb-2 ${iconBoxBg} transition-colors duration-300`}>
                                    <Box className={primaryAccent} strokeWidth={1.5} />
                                </div>
                            </div>

                            {/* Buttons always at bottom */}
                            <div className="w-full flex justify-center mb-2 mt-auto">
                                <button
                                    onClick={connect}
                                    disabled={connected}
                                    className={`px-3 py-1 rounded-full transition-all duration-300 text-white
                                    ${connected ? "bg-[#548687]" : "bg-[#7C9885]"}`}
                                >
                                    {connected ? "Connected" : "Connect"}
                                </button>
                                <button
                                    onClick={disconnect}
                                    disabled={!connected}
                                    className={`ml-2 px-3 py-1 rounded-full transition-all duration-300 text-white
                                    ${connected ? "bg-[#D9777B] hover:bg-[#C7696D]" : "bg-gray-400 cursor-not-allowed"}`}
                                >
                                    {connected ? "Disconnect" : "Disconnected"}
                                </button>
                            </div>
                        </div>

                        {/* Second card - device status */}
                        <div className={`rounded-xl shadow-md p-3 border ${cardBg} flex flex-col transition-colors duration-300 h-1/2 min-h-0 overflow-hidden`}>
                            {/* Device status */}
                            <h3 className={`text-base font-semibold mb-2 ${textPrimary}`}>Device Status</h3>
                            <div className={`flex items-center mb-2 ${textSecondary}`}>
                                <div className="w-2 h-2 rounded-full bg-amber-400 mr-2"></div>
                                <span className="text-sm">Connected</span>
                            </div>
                            <div className="space-y-2 flex-1 overflow-auto">
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
                    <div className="md:col-span-2 flex flex-col gap-3 h-full min-h-0 overflow-hidden">
                        {/* EEG Row 1: Brain Image - Fixed height */}
                        <div className={`rounded-xl shadow-md py-2 px-3 border ${cardBg} flex items-center justify-center transition-colors duration-300 flex-none`} style={{ height: "80px" }}>
                            <div className="flex items-center">
                                <div className={`p-2 rounded-full  duration-300 mr-3 px-8`}>
                                    <BrainSplitVisualizer leftMotion={leftMV} rightMotion={rightMV} size={45} />
                                </div>
                                <div>
                                    <h2 className={`text-lg font-semibold ${textPrimary}`}>
                                        Brain Activity
                                    </h2>
                                    <p className={`text-xs ${textSecondary}`}>
                                        Electroencephalogram (EEG)
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* EEG Row 2: Spider Plot - 40% height */}
                        <div className={`rounded-xl shadow-md p-3 border ${cardBg} transition-colors duration-300 h-2/5 min-h-0 overflow-hidden`}>
                            {/* Charts container */}
                            <div className="flex flex-row h-full">
                                {/* Left chart: Channel 0 */}
                                <div className="flex-1 pr-2 flex flex-col h-full">
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
                                <div className="flex-1 pl-2 flex flex-col h-full">
                                    <div className="flex-1 h-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart
                                                data={
                                                    radarDataCh1Ref.current.length
                                                        ? radarDataCh1Ref.current
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
                                    <div className="text-center mt-2 text-sm" style={{ color: axisColor }}>
                                        Synaptic Swing (R)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* EEG Row 3: EEG Charts - Remaining height */}
                        <div className="flex flex-col gap-3 h-flex-1 flex-1 min-h-0 overflow-hidden">
                            {/* Chart 1 */}
                            <div className={`h-1/2 min-h-0 rounded-xl overflow-hidden p-2 transition-colors duration-300 ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>
                                <WebglPlotCanvas
                                    ref={canvaseeg1Ref}
                                    channels={[0]} // EEG Channel 0
                                    colors={{ 0: CHANNEL_COLORS.ch0 }}
                                />
                            </div>
                            {/* Chart 2 */}
                            <div className={`h-1/2 min-h-0 rounded-xl overflow-hidden p-2 transition-colors duration-300 ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>
                                <WebglPlotCanvas
                                    ref={canvaseeg2Ref}
                                    channels={[1]} // EEG Channel 1
                                    colors={{ 1: CHANNEL_COLORS.ch1 }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Third Column (40%) - ECG */}
                    <div className="md:col-span-2 flex flex-col gap-3 h-full min-h-0 overflow-hidden">
                        {/* ECG Row 1: Heart Image - Fixed height */}
                        <div className={`rounded-xl shadow-md py-2 px-3 border ${cardBg} flex items-center justify-center transition-colors duration-300 flex-none`} style={{ height: "80px" }}>
                            <div className="flex items-center">
                                <div className={`p-2 rounded-full ${heartIconBoxBg} transition-all duration-300 ${isBeating ? 'scale-110' : 'scale-100'} mr-3`}>
                                    <Heart
                                        className={`${secondaryAccent} ${isBeating ? 'scale-110' : 'scale-100'} transition-all duration-200`}
                                        strokeWidth={1.5}
                                        size={32}
                                        fill={isBeating ? "currentColor" : "none"}
                                    />
                                </div>
                                <div>
                                    <h2 className={`text-lg font-semibold ${textPrimary}`}>Heart Activity</h2>
                                    <p className={`text-xs ${textSecondary}`}>Electrocardiogram (ECG)</p>

                                </div>
                            </div>

                        </div>

                        {/* ECG Row 2: BPM + HRV Info - 40% height */}
                        <div
                            className={`
    ${cardBg}
    rounded-xl shadow-md border
    transition-colors duration-300
    h-2/5 min-h-0 overflow-hidden
    flex flex-col
  `}
                        >
                            {/* ── Top Section: Heart Rate Stats ── */}
                            <div className="grid grid-cols-5 gap-2 p-3">
                                {/* Current BPM - takes 2 columns */}
                                <div className="col-span-2 flex flex-col justify-center">

                                    <div className="flex items-baseline mt-1">
                                        <span ref={currentRef} className={`text-4xl font-bold ${secondaryAccent}`}>
                                            --
                                        </span>
                                        <span className={`ml-2 text-lg ${labelText}`}>BPM</span>
                                    </div>
                                </div>

                                {/* Stats cards - takes 3 columns */}
                                <div className="col-span-3 grid grid-cols-3 gap-2">
                                    {/* Low stat */}
                                    <div className={` rounded-lg flex flex-col items-center justify-center transition-colors duration-300`}>
                                        <span className={`text-xs ${labelText}`}>LOW</span>
                                        <div className="flex items-baseline">
                                            <span ref={lowRef} className={`text-lg font-semibold ${textPrimary}`}>--</span>
                                            <span className={`ml-1 text-xs ${labelText}`}>BPM</span>
                                        </div>
                                    </div>

                                    {/* Avg stat */}
                                    <div className={` rounded-lg  flex flex-col items-center justify-center transition-colors duration-300 `}>
                                        <span className={`text-xs ${labelText}`}>AVG</span>
                                        <div className="flex items-baseline">
                                            <span ref={avgRef} className={`text-lg font-semibold ${primaryAccent}`}>--</span>
                                            <span className={`ml-1 text-xs ${labelText}`}>BPM</span>
                                        </div>
                                    </div>

                                    {/* High stat */}
                                    <div className={` rounded-lg flex flex-col items-center justify-center transition-colors duration-300`}>
                                        <span className={`text-xs ${labelText}`}>HIGH</span>
                                        <div className="flex items-baseline">
                                            <span ref={highRef} className={`text-lg font-semibold ${textPrimary}`}>--</span>
                                            <span className={`ml-1 text-xs ${labelText}`}>BPM</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 py-2">
                                {/* Divider Line */}
                                <div className="flex-1 h-px bg-stone-200 dark:bg-zinc-700" />

                                {/* Divider Label */}
                                <span className={`text-xs font-medium px-2 ${darkMode ? ' text-white' : 'text-black'} ${labelText}`}>
                                    HEART RATE VARIABILITY
                                </span>

                                {/* Affective State */}
                                <div className="flex items-center gap-2">
                                    <StateIndicator state={userState} />
                                </div>

                                {/* Divider Line */}
                                <div className="flex-1 h-px bg-stone-200 dark:bg-zinc-700" />
                            </div>


                            {/* ── Middle Section: HRV stats ── */}
                            <div className="grid grid-cols-4 gap-1 px-3">
                                <div className={`flex flex-col items-center ${statCardBg} rounded-md py-1`}>
                                    <span className={`text-xs ${labelText}`}>LATEST</span>
                                    <div className="flex items-baseline">
                                        <span ref={hrvRef} className={`text-sm font-semibold ${secondaryAccent}`}>--</span>
                                        <span className={`ml-1 text-xs ${labelText}`}>ms</span>
                                    </div>
                                </div>

                                <div className={`flex flex-col items-center ${statCardBg} rounded-md py-1`}>
                                    <span className={`text-xs ${labelText}`}>LOW</span>
                                    <div className="flex items-baseline">
                                        <span ref={hrvLowRef} className={`text-sm font-semibold ${textPrimary}`}>--</span>
                                        <span className={`ml-1 text-xs ${labelText}`}>ms</span>
                                    </div>
                                </div>

                                <div className={`flex flex-col items-center ${statCardBg} rounded-md py-1`}>
                                    <span className={`text-xs ${labelText}`}>AVG</span>
                                    <div className="flex items-baseline">
                                        <span ref={hrvAvgRef} className={`text-sm font-semibold ${primaryAccent}`}>--</span>
                                        <span className={`ml-1 text-xs ${labelText}`}>ms</span>
                                    </div>
                                </div>

                                <div className={`flex flex-col items-center ${statCardBg} rounded-md py-1`}>
                                    <span className={`text-xs ${labelText}`}>HIGH</span>
                                    <div className="flex items-baseline">
                                        <span ref={hrvHighRef} className={`text-sm font-semibold ${textPrimary}`}>--</span>
                                        <span className={`ml-1 text-xs ${labelText}`}>ms</span>
                                    </div>
                                </div>
                            </div>


                            <div className={`h-30 min-h-[10px] w-full rounded-lg overflow-hidden px-2 `}>
                                <HRVPlotCanvas
                                    ref={hrvplotRef}
                                    numPoints={2000}
                                    color={darkMode ? '#f59e0b' : '#d97706'}
                                />

                            </div>

                        </div>
                        {/* ECG Chart - Remaining height */}
                        <div className={`flex-1 min-h-0 rounded-xl overflow-hidden p-2 transition-colors duration-300 ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>
                            <WebglPlotCanvas
                                ref={canvasecgRef}
                                channels={[2]} // ECG Channel 2
                                colors={{ 2: CHANNEL_COLORS.ch2 }}
                            />
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer - Fixed height */}
            <footer className={`py-2 px-4 ${darkMode
                ? "bg-zinc-900/90 border-t border-amber-900/20"
                : "bg-white/90 backdrop-blur-sm border-t border-amber-100"
                } shadow-inner transition-colors duration-300 z-10`}
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
