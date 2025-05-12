// app/SignalVisualizer.tsx
'use client'
import { useState, useRef, useCallback, useEffect } from 'react';
import {
    ResponsiveContainer,
    RadarChart,
    PolarGrid,
    PolarAngleAxis,
    PolarRadiusAxis,
    Radar,
} from 'recharts';
import { Activity, Brain, Settings, Heart, Box } from 'lucide-react';
import { useBleStream } from '../components/Bledata';
import WebglPlotCanvas from '../components/WebglPlotCanvas';



const CHANNEL_COLORS: Record<string, string> = {
    ch0: '#C29963',  // EEG channel 0
    ch1: '#63A2C2',  // EEG channel 1  
    ch2: '#E4967E',  // ECG channel 1

}


export default function SignalVisualizer() {

    const [darkMode, setDarkMode] = useState(false);
    const canvaseeg1Ref = useRef<any>(null); // Create a ref for the Canvas component
    const canvaseeg2Ref = useRef<any>(null); // Create a ref for the Canvas component
    const canvasecgRef = useRef<any>(null); // Create a ref for the Canvas component
    const [tick, setTick] = useState(0);
    const buf0Ref = useRef<number[]>([]);
    const buf1Ref = useRef<number[]>([]);
    const radarDataCh0Ref = useRef<{ subject: string; value: number }[]>([]);
    const radarDataCh1Ref = useRef<{ subject: string; value: number }[]>([]);
    const workerRef = useRef<Worker | null>(null);
    const dataProcessorWorkerRef = useRef<Worker | null>(null);
    const [processedData, setProcessedData] = useState<{
        eeg0: number;
        eeg1: number;
        ecg: number;
        counter: number;
    } | null>(null);

    let previousCounter: number | null = null; // Variable to store the previous counter value for loss detection


    // 1. Remove the direct canvas updates from `datastream`
    const datastream = useCallback((data: number[]) => {
        // Only send raw data to worker (no direct canvas updates)
        dataProcessorWorkerRef.current?.postMessage({
            command: 'process',
            rawData: {
                counter: data[0],
                raw0: data[1],  // EEG 1
                raw1: data[2],  // EEG 2
                raw2: data[3]   // ECG
            }
        });

        // Keep counter-loss detection
        if (previousCounter !== null && data[0] !== (previousCounter + 1) % 256) {
            console.warn(`Data loss detected! Previous: ${previousCounter}, Current: ${data[0]}`);
        }
        previousCounter = data[0];
    }, []);

    // 2. Let the worker's onmessage handle ALL visualization updates
    useEffect(() => {
        const worker = new Worker(
            new URL('../webworker/dataProcessor.worker.ts', import.meta.url),
            { type: 'module' }
        );
        worker.onmessage = (e) => {
            if (e.data.type === 'processedData') {
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
    const {
        counters,
        bpm,
        connected,
        streaming,
        connect,
        start,
        stop,
        disconnect,
    } = useBleStream(datastream);
    let highBPM = 0;
    let lowBPM = 0;
    let avgBPM = 0;


    const channelColors: Record<string, string> = {
        ch0: '#C29963',
        ch1: '#548687',
        ch2: '#9A7197'
    };

    // inside your component, before the return:
    const bandData = [
        { subject: 'Delta', value: 0 },
        { subject: 'Theta', value: 0 },
        { subject: 'Alpha', value: 0 },
        { subject: 'Beta', value: 0 },
        { subject: 'Gamma', value: 0 },
    ];

    // 2) Worker instantiation & message handling
    useEffect(() => {
        workerRef.current = new Worker(
            new URL('../webworker/bandPower.worker.ts', import.meta.url),
            { type: 'module' }
        );
        workerRef.current.onmessage = (e) => {
            const { bandPower0, bandPower1 } = e.data;
            // Build the radar-chart data arrays
            radarDataCh0Ref.current = [
                { subject: 'Delta', value: bandPower0.delta },
                { subject: 'Theta', value: bandPower0.theta },
                { subject: 'Alpha', value: bandPower0.alpha },
                { subject: 'Beta', value: bandPower0.beta },
                { subject: 'Gamma', value: bandPower0.gamma },
            ];
            radarDataCh1Ref.current = [
                { subject: 'Delta', value: bandPower1.delta },
                { subject: 'Theta', value: bandPower1.theta },
                { subject: 'Alpha', value: bandPower1.alpha },
                { subject: 'Beta', value: bandPower1.beta },
                { subject: 'Gamma', value: bandPower1.gamma },
            ];
            setTick((t) => t + 1);    // force re-render so charts update
        };
        return () => { workerRef.current?.terminate(); };
    }, []);

    // 3) On each new EEG sample, buffer and send to worker
    const onNewSample = useCallback((eeg0: number, eeg1: number) => {
        buf0Ref.current.push(eeg0);
        buf1Ref.current.push(eeg1);
        if (buf0Ref.current.length > 256) buf0Ref.current.shift();
        if (buf1Ref.current.length > 256) buf1Ref.current.shift();

        if (buf0Ref.current.length === 256) {
            workerRef.current?.postMessage({
                eeg0: [...buf0Ref.current],
                eeg1: [...buf1Ref.current],
                sampleRate: 500,
                fftSize: 256,
            });
        }
    }, []);


    const bgGradient = darkMode
        ? 'bg-gradient-to-b from-zinc-900 to-neutral-900'
        : 'bg-gradient-to-b from-neutral-50 to-stone-100';
    const cardBg = darkMode ? 'bg-zinc-800/90 border-zinc-700/50' : 'bg-white/95 border-stone-200';
    const primaryAccent = darkMode ? 'text-amber-300' : 'text-amber-600';
    const secondaryAccent = darkMode ? 'text-rose-300' : 'text-rose-500';
    const textPrimary = darkMode ? 'text-stone-300' : 'text-stone-800';
    const textSecondary = darkMode ? 'text-stone-400' : 'text-stone-500';
    const gridLines = darkMode ? '#3f3f46' : '#e5e7eb';
    const axisColor = darkMode ? '#71717a' : '#78716c';
    const iconBoxBg = darkMode ? 'bg-amber-900/20' : 'bg-amber-50';
    const heartIconBoxBg = darkMode ? 'bg-rose-900/20' : 'bg-rose-50';

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
                        <div className="flex items-center space-x-4">
                            <div className="flex space-x-2">
                                <button
                                    onClick={connect}
                                    disabled={connected}
                                    className={`px-3 py-1 rounded-full transition-all duration-300 text-white ${connected ? 'bg-[#548687]' : 'bg-[#7C9885]'
                                        }`}
                                >
                                    {connected ? 'Connected' : 'Connect'}
                                </button>
                                <button
                                    onClick={start}
                                    disabled={!connected || streaming}
                                    className={`px-3 py-1 rounded-full transition-all duration-300 text-white ${streaming ? 'bg-[#9A7197]' : 'bg-[#C29963]'
                                        }`}
                                >
                                    {streaming ? 'Streaming' : 'Start'}
                                </button>
                                <button
                                    onClick={stop}
                                    disabled={!streaming}
                                    className="px-3 py-1 bg-[#CA8A73] rounded-full transition-all duration-300 text-white"
                                >
                                    Stop
                                </button>
                                <button
                                    onClick={disconnect}
                                    disabled={!connected}
                                    className="px-3 py-1 bg-[#D9777B] rounded-full transition-all duration-300 text-white"
                                >
                                    Disconnect
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={() => setDarkMode(!darkMode)}
                            className={`p-1 rounded-full transition-all duration-300 ${darkMode
                                ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'
                                : 'bg-stone-200 hover:bg-stone-300 text-stone-700'
                                } shadow-sm`}
                        >
                            <Settings className="h-4 w-4" strokeWidth={2} />
                        </button>
                    </div>

                </div>
            </header>

            <main className="flex-1 container mx-auto px-2 py-2">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 h-full">
                    {/* First Column (20%) - Device Info */}
                    <div className="md:col-span-1 flex flex-col h-full gap-3">
                        <div
                            className={`flex-1 rounded-xl shadow-md p-3 border ${cardBg} flex flex-col items-center justify-center transition-colors duration-300`}
                        >
                            {/* Icon box */}
                            <div className={`p-3 rounded-full mb-2 ${iconBoxBg} transition-colors duration-300`}>
                                <Box className={primaryAccent} strokeWidth={1.5} />
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
                    <div className="md:col-span-2 flex flex-col gap-3">
                        {/* EEG Row 1: Brain Image */}
                        <div
                            className={`rounded-xl shadow-md p-3 border ${cardBg} flex flex-col items-center justify-center transition-colors duration-300`}>
                            <div className={`p-3 rounded-full mb-1 ${iconBoxBg} transition-colors duration-300`}>
                                <Brain className={primaryAccent} strokeWidth={1.5} />
                            </div>
                            <h2 className={`text-lg font-semibold mb-0 ${textPrimary}`}>Brain Activity</h2>
                            <p className={`text-xs ${textSecondary}`}>Electroencephalogram (EEG)</p>
                        </div>

                        {/* EEG Row 2: Spider Plot */}
                        <div className={`flex flex-col rounded-xl shadow-md p-1 px-3 border ${cardBg} transition-colors duration-300 h-[40%]`}>
                            {/* Header */}
                            <h3 className={`text-base font-semibold ${textPrimary}`}>Brainwave Distribution</h3>

                            {/* Charts container */}
                            <div className="flex flex-row flex-1">
                                {/* Left chart: Channel 0 */}
                                <div className="flex-1 pr-2 flex flex-col">

                                    <div className="flex-1 h-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart
                                                data={radarDataCh0Ref.current.length ? radarDataCh0Ref.current : bandData}
                                                cx="50%" cy="50%"
                                                outerRadius="70%"
                                            >
                                                <PolarGrid strokeDasharray="3 3" stroke={gridLines} />

                                                {/* Keep the subjects (Delta, Theta, etc.) */}
                                                <PolarAngleAxis
                                                    dataKey="subject"
                                                    tick={{ fill: axisColor, fontSize: 12 }}
                                                />

                                                {/* Hide the numeric radius labels and lines */}
                                                <PolarRadiusAxis
                                                    domain={[0, 'auto']}
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
                                </div>

                                {/* Right chart: Channel 1 */}
                                <div className="flex-1 pl-2 flex flex-col">
                                    <div className="flex-1 h-full">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <RadarChart
                                                data={radarDataCh1Ref.current.length ? radarDataCh0Ref.current : bandData}
                                                cx="50%" cy="50%" outerRadius="70%"
                                            >
                                                <PolarGrid strokeDasharray="3 3" stroke={gridLines} />

                                                {/* Keep only the band labels */}
                                                <PolarAngleAxis
                                                    dataKey="subject"
                                                    tick={{ fill: axisColor, fontSize: 12 }}
                                                />

                                                {/* Hide the numeric radius labels and axis lines */}
                                                <PolarRadiusAxis
                                                    domain={[0, 'auto']}
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
                                </div>
                            </div>
                        </div>


                        {/* EEG Row 3: EEG Chart */}
                        <div className="md:col-span-2 flex flex-col gap-3 ">
                            {/* Chart container */}
                            <div className={`h-30 max-h-[300px] rounded-xl overflow-hidden p-2 transition-colors duration-300  ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>

                                <WebglPlotCanvas
                                    ref={canvaseeg1Ref}
                                    channels={[0]} // EEG Channel 0
                                    colors={{ 0: CHANNEL_COLORS.ch0 }}
                                    counter={counters[0] ?? 0}
                                />
                            </div>
                            <div className={`h-30 max-h-[300px] rounded-xl overflow-hidden p-2 transition-colors duration-300  ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>

                                <WebglPlotCanvas
                                    ref={canvaseeg2Ref}
                                    channels={[1]} // EEG Channel 1
                                    colors={{ 1: CHANNEL_COLORS.ch1 }}
                                    counter={counters[0] ?? 0}
                                />
                            </div>
                        </div>

                    </div>

                    {/* Third Column (40%) - ECG */}
                    <div className="md:col-span-2 flex flex-col gap-3">
                        {/* ECG Row 1: Heart Image */}
                        <div
                            className={`rounded-xl shadow-md p-3 border ${cardBg} flex flex-col items-center justify-center transition-colors duration-300`}>
                            <div className={`p-3 rounded-full mb-1 ${heartIconBoxBg} transition-colors duration-300`}>
                                <Heart className={secondaryAccent} strokeWidth={1.5} />
                            </div>
                            <h2 className={`text-lg font-semibold mb-0 ${textPrimary}`}>Heart Activity</h2>
                            <p className={`text-xs ${textSecondary}`}>Electrocardiogram (ECG)</p>
                        </div>

                        {/* ECG Row 2: BPM Info */}   {/* ECG Row 2: BPM Info */}
                        <div className={`rounded-xl shadow-md p-1 px-3 border ${cardBg} transition-colors duration-300 h-[40%]`}>
                            <h3 className={`text-base font-semibold mb-1 ${textPrimary}`}>Heart Rate Analysis</h3>

                            <div className="flex items-center justify-between h-40 px-4">
                                {/* Left Side: BPM Display */}
                                <div className="flex items-center space-x-3">
                                    <div className={`text-5xl font-bold ${secondaryAccent}`}>
                                        99
                                    </div>
                                    <div className="text-sm font-medium self-end mb-1">BPM</div>
                                </div>

                                {/* Right Side: High, Low, Avg Values */}
                                <div className="text-right text-sm leading-6">
                                    <div><span className="font-semibold">High:</span> {highBPM ?? '—'}</div>
                                    <div><span className="font-semibold">Low:</span> {lowBPM ?? '—'}</div>
                                    <div><span className="font-semibold">Avg:</span> {avgBPM ?? '—'}</div>
                                </div>
                            </div>
                        </div>
                        {/* ECG Section */}
                        <div className="md:col-span-2 flex flex-col gap-3">
                            <div className={`h-60 max-h-[300px] rounded-xl overflow-hidden p-2 transition-colors duration-300  ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>

                                <WebglPlotCanvas
                                    ref={canvasecgRef}
                                    channels={[2]} // ECG Channel 2
                                    colors={{ 2: CHANNEL_COLORS.ch2 }}
                                    counter={counters[0] ?? 0}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            <footer className={`py-2 px-4 ${darkMode
                ? 'bg-zinc-900/90 border-t border-amber-900/20'
                : 'bg-white/90 backdrop-blur-sm border-t border-amber-100'
                } shadow-inner transition-colors duration-300`}>
                <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-xs">
                    <div className={textSecondary + ' mb-1 md:mb-0'}>
                        <span className="font-medium">Meditation Medusa</span> © {new Date().getFullYear()}
                    </div>
                </div>
            </footer>
        </div>
    );
}