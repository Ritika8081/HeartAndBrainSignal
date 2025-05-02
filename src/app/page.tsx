'use client'
import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Activity, Brain, Settings, Info, Monitor, Heart, Box } from 'lucide-react';

interface EEGDataEntry { time: number; ch0: number; ch1: number; ch2: number; }
interface ECGDataEntry { time: number; ch0: number; ch1: number; ch2: number; }

const SERVICE_UUID = "4fafc201-1fb5-459e-8fcc-c5c9c331914b";
const DATA_CHAR_UUID = "beb5483e-36e1-4688-b7f5-ea07361b26a8";
const CONTROL_CHAR_UUID = "0000ff01-0000-1000-8000-00805f9b34fb";



export default function BioSignalVisualizer() {
  const [eegData, setEegData] = useState<EEGDataEntry[]>([]);
  const [ecgData, setEcgData] = useState<ECGDataEntry[]>([]);
  const [eegChannels, setEegChannels] = useState(['ch0', 'ch1', 'ch2']);
  const [ecgChannels, setEcgChannels] = useState(['ch0', 'ch1', 'ch2']);
  const [isLive, setIsLive] = useState(true);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [bpm, setBpm] = useState<number | null>(null);

  // Refs for BLE
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const controlRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const dataRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const timeIndex = useRef(0);

  // BLE Functions
  const connectBLE = async () => {
    try {
      const device = await navigator.bluetooth.requestDevice({ filters: [{ namePrefix: 'NPG' }], optionalServices: [SERVICE_UUID] });
      deviceRef.current = device;
      const server = await device.gatt!.connect();
      const svc = await server.getPrimaryService(SERVICE_UUID);
      controlRef.current = await svc.getCharacteristic(CONTROL_CHAR_UUID);
      dataRef.current = await svc.getCharacteristic(DATA_CHAR_UUID);
      setConnected(true);
    } catch (err) { console.error('BLE connect error', err); }
  };

  const startStream = async () => {
    if (!controlRef.current || !dataRef.current) return;
    await controlRef.current.writeValue(new TextEncoder().encode('START'));
    await dataRef.current.startNotifications();
    dataRef.current.addEventListener('characteristicvaluechanged', handleNotification);
    setStreaming(true);
  };

  const stopStream = async () => {
    if (!dataRef.current) return;
    await dataRef.current.stopNotifications();
    dataRef.current.removeEventListener('characteristicvaluechanged', handleNotification);
    setStreaming(false);
  };

  const disconnectBLE = () => {
    stopStream();
    deviceRef.current?.gatt?.disconnect();
    setConnected(false);
  };

  // Handle incoming notifications
  const handleNotification = (evt: Event) => {
    const char = evt.target as BluetoothRemoteGATTCharacteristic;
    const raw = new Uint8Array(char.value!.buffer);
    // Parse three channels for EEG and ECG
    const ch0 = raw[0] | (raw[1] << 8);
    const ch1 = raw[2] | (raw[3] << 8);
    const ch2 = raw[4] | (raw[5] << 8);

    console.log(`EEG ch0:${ch0} ch1:${ch1} ch2:${ch2}`);

    const newEEG: EEGDataEntry = { time: timeIndex.current, ch0, ch1, ch2 };
    const newECG: ECGDataEntry = { time: timeIndex.current, ch0, ch1, ch2 };

    setEegData(prev => [...prev.slice(-99), newEEG]);
    setEcgData(prev => [...prev.slice(-99), newECG]);
    setBpm(ch0);  // or any logic for BPM
    timeIndex.current++;
  };

  // Cleanup on unmount
  useEffect(() => () => disconnectBLE(), []);

  // Toggle channel visibility
  const toggleEegChannel = (ch: string) => {
    setEegChannels(prev => {
      if (prev.includes(ch)) {
        // Prevent removing the last channel
        if (prev.length === 1) return prev;
        return prev.filter(x => x !== ch);
      }
      return [...prev, ch];
    });
  };

  const toggleEcgChannel = (ch: string) => {
    setEcgChannels(prev => prev.includes(ch) ? prev.filter(x => x !== ch) : [...prev, ch]);
  };



  useEffect(() => {
    setBpm(Math.floor(60 + Math.random() * 40));
  }, []);

  // Assign distinct colors per channel
  const channelColors: Record<string, string> = {
    ch0: '#C29963',
    ch1: '#548687',
    ch2: '#9A7197'
  };

  const toggleChannel = (ch: string) => {
    setEegChannels(prev => prev.includes(ch) ? prev.filter(x => x !== ch) : [...prev, ch]);
  };
  const radarData = (() => {
    const last = eegData[eegData.length - 1];
    return last
      ? [
        { subject: 'ch0', value: last.ch0 },
        { subject: 'ch1', value: last.ch1 },
        { subject: 'ch2', value: last.ch2 },
      ]
      : [];
  })();



  // Light/dark mode color sets
  const bgGradient = darkMode ? 'bg-gradient-to-b from-zinc-900 to-neutral-900' : 'bg-gradient-to-b from-neutral-50 to-stone-100';
  const cardBg = darkMode ? 'bg-zinc-800/90 border-zinc-700/50' : 'bg-white/95 border-stone-200';
  const primaryAccent = darkMode ? 'text-amber-300' : 'text-amber-600';
  const secondaryAccent = darkMode ? 'text-rose-300' : 'text-rose-500';
  const textPrimary = darkMode ? 'text-stone-300' : 'text-stone-800';
  const textSecondary = darkMode ? 'text-stone-400' : 'text-stone-500';
  const buttonAccent = darkMode ? 'bg-amber-500 hover:bg-amber-600' : 'bg-amber-500 hover:bg-amber-600';
  const buttonNeutral = darkMode ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-stone-200 hover:bg-stone-300';
  const gridLines = darkMode ? '#3f3f46' : '#e5e7eb';
  const axisColor = darkMode ? '#71717a' : '#78716c';
  const tooltipBg = darkMode ? '#27272a' : '#ffffff';
  const tooltipBorder = darkMode ? '#3f3f46' : '#e7e5e4';
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
                  onClick={connectBLE}
                  disabled={connected}
                  className={`px-3 py-1 rounded-full transition-all duration-300 text-white ${connected ? 'bg-[#548687]' : 'bg-[#7C9885]'
                    }`}
                >
                  {connected ? 'Connected' : 'Connect'}
                </button>
                <button
                  onClick={startStream}
                  disabled={!connected || streaming}
                  className={`px-3 py-1 rounded-full transition-all duration-300 text-white ${streaming ? 'bg-[#9A7197]' : 'bg-[#C29963]'
                    }`}
                >
                  {streaming ? 'Streaming' : 'Start'}
                </button>
                <button
                  onClick={stopStream}
                  disabled={!streaming}
                  className="px-3 py-1 bg-[#CA8A73] rounded-full transition-all duration-300 text-white"
                >
                  Stop
                </button>
                <button
                  onClick={disconnectBLE}
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
            <div className={`rounded-xl shadow-md p-3 border ${cardBg} transition-colors duration-300 h-52`}>
              <h3 className={`text-base font-semibold mb-1 ${textPrimary}`}>Brainwave Distribution</h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>

                    <PolarGrid strokeDasharray="3 3" stroke={gridLines} />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: axisColor, fontSize: 10 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 50]} tick={{ fill: axisColor, fontSize: 10 }} />
                    <Radar
                      name="EEG"
                      dataKey="value"
                      stroke={darkMode ? '#C29963' : '#A27C48'}
                      fill={darkMode ? '#C29963' : '#A27C48'}
                      fillOpacity={0.6}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* EEG Row 3: EEG Chart */}
            <div className="md:col-span-2 flex flex-col gap-3">
              {/* Chart container */}
              <div className={`flex-1 rounded-xl overflow-hidden p-2 transition-colors duration-300 ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>
                {/* Channel toggles */}
                <div className="flex gap-2 mb-2">
                  {['ch0', 'ch1', 'ch2'].map(ch => (
                    <button
                      key={ch}
                      onClick={() => toggleEcgChannel(ch)}
                      disabled={ecgChannels.length === 1 && ecgChannels.includes(ch)}
                      className={`px-2  rounded transition-all duration-200 ${ecgChannels.includes(ch) ? 'text-white' : 'text-gray-600'
                        }`}
                      style={{
                        backgroundColor: ecgChannels.includes(ch) ? channelColors[ch] : 'transparent',
                        border: '1px solid ' + (ecgChannels.includes(ch) ? channelColors[ch] : '#cbd5e1'),
                        opacity: ecgChannels.length === 1 && ecgChannels.includes(ch) ? 0.5 : 1,
                        cursor: ecgChannels.length === 1 && ecgChannels.includes(ch) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={228}>
                  <LineChart data={ecgData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" />
                    <YAxis />
                    <Tooltip />
                    {ecgChannels.map(ch => (
                      <Line
                        key={ch}
                        type="monotone"
                        dataKey={ch}
                        stroke={channelColors[ch]}
                        strokeWidth={1.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
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

            {/* ECG Row 2: BPM Info */}
            <div className={`rounded-xl shadow-md p-3 border ${cardBg} transition-colors duration-300 h-52`}>
              <h3 className={`text-base font-semibold mb-1 ${textPrimary}`}>Heart Rate Analysis</h3>
              <div className="flex items-center justify-center h-40">
                <div className={`text-center p-6 rounded-full ${heartIconBoxBg} transition-colors duration-300`}>
                  <div className={`text-4xl font-bold ${secondaryAccent}`}>
                    {bpm !== null ? bpm : '...'}
                  </div>
                  <div className="text-sm font-medium mt-1">BPM</div>
                </div>
              </div>
            </div>


            {/* ECG Section */}
            <div className="md:col-span-2 flex flex-col gap-3">


              <div className={`flex-1 rounded-xl overflow-hidden transition-colors duration-300 p-2 ${darkMode ? 'bg-zinc-800/90' : 'bg-white'}`}>
                <div className="flex gap-2 mb-2">
                  {['ch0', 'ch1', 'ch2'].map(ch => (
                    <button
                      key={ch}
                      onClick={() => toggleEcgChannel(ch)}
                      disabled={ecgChannels.length === 1 && ecgChannels.includes(ch)}
                      className={`px-2  rounded ${ecgChannels.includes(ch) ? 'text-white' : 'text-gray-600'} transition-all duration-200`}
                      style={{
                        backgroundColor: ecgChannels.includes(ch) ? channelColors[ch] : 'transparent',
                        border: '1px solid ' + (ecgChannels.includes(ch) ? channelColors[ch] : '#cbd5e1'),
                        opacity: (ecgChannels.length === 1 && ecgChannels.includes(ch)) ? 0.5 : 1,
                        cursor: (ecgChannels.length === 1 && ecgChannels.includes(ch)) ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
                <ResponsiveContainer width="100%" height={228}>
                  <LineChart data={ecgData}>
                    <XAxis dataKey="time" />
                    <YAxis />
                    <CartesianGrid strokeDasharray="3 3" />
                    <Tooltip />
                    {ecgChannels.map(ch => (
                      <Line key={ch} dataKey={ch} stroke={channelColors[ch]} dot={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div> </div>
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