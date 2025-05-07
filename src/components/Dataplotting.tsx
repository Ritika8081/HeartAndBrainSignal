// app/SignalVisualizer.tsx
'use client'
import { useState } from 'react';
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

// For single-channel EEG we’ll use key 'ch0'
const EEG_CHANNELS = ['ch0', 'ch2']
// ECG data entries are already objects with ch2 & ch3
const ECG_CHANNELS = ['ch2']

// Color mapping for channels
const CHANNEL_COLORS: Record<string, string> = {
    ch0: '#C29963',  // EEG channel
    ch2: '#E4967E',  // ECG channel 1
    ch3: '#6A5D7B',  // ECG channel 2
}

export default function SignalVisualizer() {

    const [darkMode, setDarkMode] = useState(false);

    const {
        eegData,
        counters,
        ecgData,
        bpm,
        connected,
        streaming,
        connect,
        start,
        stop,
        disconnect,
        bandPower,
    } = useBleStream();
    // Map eegData (number[]) into array of objects { ch0: value }
    const eegBuffer = eegData.map(v => ({ ch0: v, ch2: v }))
    // Pull out the numeric ch2 field from each entry
    const ecgBuffer = ecgData.map(({ ch2 }) => ({ ch2 }));


    let highBPM = 0;
    let lowBPM = 0;
    let avgBPM = 0;


    const channelColors: Record<string, string> = {
        ch0: '#C29963',
        ch1: '#548687',
        ch2: '#9A7197'
    };

    const bands = [
        { subject: 'Delta', key: 'delta' },
        { subject: 'Theta', key: 'theta' },
        { subject: 'Alpha', key: 'alpha' },
        { subject: 'Beta', key: 'beta' },
        { subject: 'Gamma', key: 'gamma' },
    ] as const;

    const radarDataCh0 = bands.map(b => ({
        subject: b.subject,
        value: bandPower.ch0[b.key],
    }));
    const radarDataCh1 = bands.map(b => ({
        subject: b.subject,
        value: bandPower.ch1[b.key],
    }));

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
                                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarDataCh0}>
                                                <PolarGrid strokeDasharray="3 3" stroke={gridLines} />
                                                <PolarAngleAxis
                                                    dataKey="subject"
                                                    tick={{ fill: axisColor, fontSize: 10 }}
                                                />
                                                <PolarRadiusAxis
                                                    angle={30}
                                                    domain={[0, 100]}
                                                    tick={{ fill: axisColor, fontSize: 10 }}
                                                />
                                                <Radar
                                                    name="Ch0"
                                                    dataKey="value"
                                                    stroke={darkMode ? '#C29963' : '#A27C48'}
                                                    fill={darkMode ? '#C29963' : '#A27C48'}
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
                                            <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarDataCh1}>
                                                <PolarGrid strokeDasharray="3 3" stroke={gridLines} />
                                                <PolarAngleAxis
                                                    dataKey="subject"
                                                    tick={{ fill: axisColor, fontSize: 10 }}
                                                />
                                                <PolarRadiusAxis
                                                    angle={30}
                                                    domain={[0, 100]}
                                                    tick={{ fill: axisColor, fontSize: 10 }}
                                                />
                                                <Radar
                                                    name="Ch1"
                                                    dataKey="value"
                                                    stroke={darkMode ? '#548687' : '#2F6F6B'}
                                                    fill={darkMode ? '#548687' : '#2F6F6B'}
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
                            <div className={`h-64 max-h-[300px] rounded-xl overflow-hidden p-2 transition-colors duration-300  ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>

                                <WebglPlotCanvas
                                    data={ecgBuffer}
                                    channels={EEG_CHANNELS}
                                    colors={CHANNEL_COLORS}
                                    counter={counters}
                                />
                            </div></div>

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


                            <div className={`h-64 max-h-[300px] rounded-xl overflow-hidden p-2 transition-colors duration-300  ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>

                                <WebglPlotCanvas
                                    data={ecgBuffer}
                                    channels={ECG_CHANNELS}
                                    colors={{ ch2: CHANNEL_COLORS.ch2 }}
                                    counter={counters}        // if you still want to show sample-counter overlay
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