'use client'
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { Activity, Brain, Settings, Info, Monitor, Heart, Box } from 'lucide-react';

interface EEGDataEntry {
  time: number;
  [key: string]: number;
}

interface ECGDataEntry {
  time: number;
  value: number;
}

const generateEEGData = (points = 100): EEGDataEntry[] => {
  const data: EEGDataEntry[] = [];
  const channels = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Theta'] as const;
  const frequencies = { Alpha: 0.1, Beta: 0.2, Gamma: 0.4, Delta: 0.05, Theta: 0.08 } as const;
  const amplitudes = { Alpha: 20, Beta: 10, Gamma: 5, Delta: 30, Theta: 15 } as const;

  for (let i = 0; i < points; i++) {
    const entry: EEGDataEntry = { time: i };
    channels.forEach(channel => {
      const freq = frequencies[channel];
      const amp = amplitudes[channel];
      entry[channel] = Math.sin(i * freq) * amp + Math.sin(i * freq * 2.5) * (amp * 0.5) + (Math.random() * 5 - 2.5);
    });
    data.push(entry);
  }
  return data;
};

const generateECGData = (points = 100): ECGDataEntry[] => {
  const data: ECGDataEntry[] = [];
  for (let i = 0; i < points; i++) {
    let value = 70;
    const position = i % 20;
    if (position === 3) value += 15;
    else if (position === 6) value -= 20;
    else if (position === 7) value += 80;
    else if (position === 8) value -= 40;
    else if (position === 12) value += 20;
    value += (Math.random() * 4 - 2);
    data.push({ time: i, value });
  }
  return data;
};

export default function BioSignalVisualizer() {
  const [eegData, setEegData] = useState<EEGDataEntry[]>([]);
  const [ecgData, setEcgData] = useState<ECGDataEntry[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [eegChannels, setEegChannels] = useState(['Alpha', 'Beta', 'Gamma', 'Delta', 'Theta']);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setEegData(generateEEGData());
    setEcgData(generateECGData());
    let interval: ReturnType<typeof setInterval>;
    if (isLive) {
      interval = setInterval(() => {
        setEegData(prev => {
          const nextTime = prev[prev.length - 1].time + 1;
          const newEntry: EEGDataEntry = { time: nextTime } as any;
          eegChannels.forEach(channel => {
            const lastVal = prev[prev.length - 1][channel];
            newEntry[channel] = lastVal + (Math.random() * (channel === 'Delta' ? 12 : channel === 'Alpha' ? 10 : channel === 'Beta' ? 8 : channel === 'Gamma' ? 4 : 8) - ((channel === 'Delta' ? 6 : channel === 'Alpha' ? 5 : channel === 'Beta' ? 4 : channel === 'Gamma' ? 2 : 4)));
          });
          return [...prev.slice(1), newEntry];
        });
        setEcgData(prev => {
          const last = prev[prev.length - 1];
          const nextTime = last.time + 1;
          let value = last.value;
          const pos = nextTime % 20;
          if (pos === 3) value += 15;
          else if (pos === 6) value -= 20;
          else if (pos === 7) value += 80;
          else if (pos === 8) value -= 40;
          else if (pos === 12) value += 20;
          value += (Math.random() * 4 - 2);
          return [...prev.slice(1), { time: nextTime, value }];
        });
      }, 100);
    }
    return () => clearInterval(interval);
  }, [isLive, eegChannels]);

  const channelColors: Record<string, string> = {
    Alpha: '#8884d8', Beta: '#82ca9d', Gamma: '#ffc658', Delta: '#ff8042', Theta: '#0088fe'
  };
  const toggleChannel = (ch: string) => {
    setEegChannels(prev => prev.includes(ch) ? prev.filter(x => x !== ch) : [...prev, ch]);
  };

  // Prepare data for radar chart
  const radarData = eegChannels.map(channel => ({
    subject: channel,
    value: eegData.length > 0 ? Math.abs(eegData[eegData.length - 1][channel]) : 0,
    fullMark: 50
  }));

  return (
    <div className={`flex flex-col h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50'}`}>
      <header className={`${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-md p-4`}>
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Activity className="h-8 w-8 text-blue-500" />
            <h1 className="text-2xl font-bold">Visualizer</h1>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={() => setIsLive(!isLive)} className={`flex items-center px-3 py-1 rounded ${isLive ? 'bg-green-500 text-white' : 'bg-gray-300'}`}>
              <Monitor className="h-4 w-4 mr-1" />{isLive ? 'Live' : 'Paused'}
            </button>
            <button onClick={() => setDarkMode(!darkMode)} className={`p-2 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}>
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 container mx-auto p-4 overflow-auto">
        <div className="flex h-full gap-4">
          {/* First Column (20%) - Box Image */}
          <div className="w-1/5 flex flex-col">
            <div className={`flex-1 rounded-lg shadow-lg p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'} flex items-center justify-center`}>
              <Box className="h-32 w-32" strokeWidth={1} />
            </div>
            <div className={`flex-1 rounded-lg shadow-lg p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'} flex items-center justify-center`}>
              <p className={darkMode ? 'text-gray-300' : 'text-gray-600'}>Device Status</p>
            </div>
          </div>

          {/* Second Column (40%) - EEG */}
          <div className="w-2/5 flex flex-col">
            {/* EEG Row 1: Brain Image */}
            <div className={`h-1/3 rounded-lg shadow-lg p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'} flex flex-col items-center justify-center`}>
              <Brain className="h-16 w-16 mb-2" strokeWidth={1} />
              <h2 className="text-xl font-semibold">Brain Activity (EEG)</h2>
            </div>

            {/* EEG Row 2: Spider Plot */}
            <div className={`h-1/3 rounded-lg shadow-lg p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={30} domain={[0, 50]} />
                    <Radar name="EEG" dataKey="value" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* EEG Row 3: EEG Chart */}
            <div className={`h-1/3 rounded-lg shadow-lg p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex justify-end items-center mb-2 space-x-1">
                {Object.keys(channelColors).map(ch => (
                  <button key={ch} onClick={() => toggleChannel(ch)} className="flex items-center px-2 py-1 text-xs rounded" style={{ backgroundColor: eegChannels.includes(ch) ? channelColors[ch] : 'transparent', color: eegChannels.includes(ch) ? 'white' : (darkMode ? 'white' : 'black'), border: `1px solid ${channelColors[ch]}` }}>
                    {ch}
                  </button>
                ))}
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={eegData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#555' : '#ccc'} />
                    <XAxis dataKey="time" stroke={darkMode ? '#aaa' : '#666'} />
                    <YAxis stroke={darkMode ? '#aaa' : '#666'} />
                    <Tooltip contentStyle={{ backgroundColor: darkMode ? '#333' : '#fff', borderColor: darkMode ? '#555' : '#ccc' }} labelStyle={{ color: darkMode ? '#eee' : '#333' }} />
                    {eegChannels.map(ch => (
                      <Line key={ch} type="monotone" dataKey={ch} stroke={channelColors[ch]} strokeWidth={2} dot={false} isAnimationActive={false} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Third Column (40%) - ECG */}
          <div className="w-2/5 flex flex-col">
            {/* ECG Row 1: Heart Image */}
            <div className={`h-1/3 rounded-lg shadow-lg p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'} flex flex-col items-center justify-center`}>
              <Heart className="h-16 w-16 mb-2" strokeWidth={1} />
              <h2 className="text-xl font-semibold">Heart Activity (ECG)</h2>
            </div>

            {/* ECG Row 2: BPM Info */}
            <div className={`h-1/3 rounded-lg shadow-lg p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'} flex flex-col items-center justify-center`}>
              <div className="text-4xl font-bold mb-2" style={{ color: darkMode ? '#ff4560' : '#ff4560' }}>
                {Math.floor(60 + Math.random() * 40)} BPM
              </div>
              <div className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {Math.floor(60 + Math.random() * 40) > 90 ? 'Elevated' : 'Normal'} heart rate
              </div>
            </div>

            {/* ECG Row 3: ECG Chart */}
            <div className={`h-1/3 rounded-lg shadow-lg p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ecgData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#555' : '#ccc'} />
                    <XAxis dataKey="time" stroke={darkMode ? '#aaa' : '#666'} />
                    <YAxis stroke={darkMode ? '#aaa' : '#666'} />
                    <Tooltip contentStyle={{ backgroundColor: darkMode ? '#333' : '#fff', borderColor: darkMode ? '#555' : '#ccc' }} labelStyle={{ color: darkMode ? '#eee' : '#333' }} />
                    <Line type="monotone" dataKey="value" stroke="#ff4560" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </main>
      <footer className={`py-3 px-4 ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-inner`}>
        <div className="container mx-auto flex justify-between items-center text-sm">
          <div className={darkMode ? 'text-gray-400' : 'text-gray-500'}>© {new Date().getFullYear()} Visualizer</div>
          <div className="flex space-x-4">
            <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Sampling Rate: 250 Hz</span>
            <span className={darkMode ? 'text-gray-400' : 'text-gray-500'}>Filter: 0.5-50 Hz</span>
          </div>
        </div>
      </footer>
    </div>
  );
}