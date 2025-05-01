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
  // Add here
  const [bpm, setBpm] = useState<number | null>(null);

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

  useEffect(() => {
    setBpm(Math.floor(60 + Math.random() * 40));
  }, []);


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
    <div className={`flex flex-col h-screen ${darkMode ? 'bg-gradient-to-b from-gray-900 to-gray-800' : 'bg-gradient-to-b from-gray-50 to-gray-100'} transition-colors duration-300`}>
      <header className={`${darkMode ? 'bg-gray-800 border-b border-gray-700' : 'bg-white/90 backdrop-blur-sm border-b border-gray-200'} shadow-lg p-2 transition-colors duration-300`}>
        <div className="container mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Activity className={`h-6 w-6 ${darkMode ? 'text-blue-400' : 'text-blue-600'}`} />
            <h1 className="text-xl font-light tracking-tight ">
              <span className={`font-bold ${darkMode ? 'text-gray-400' : 'text-gray-900'}`}>Meditation</span>
              <span className="text-blue-500 font-medium ml-1 ">Medusa</span>
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsLive(!isLive)}
              className={`flex items-center px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${isLive
                ? (darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600')
                : (darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300')
                } text-white shadow-sm`}
            >
              <Monitor className="h-3 w-3 mr-1" strokeWidth={2} />
              {isLive ? 'Live' : 'Paused'}
            </button>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-1 rounded-full transition-all duration-300 ${darkMode
                ? 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
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
          <div className="md:col-span-1 flex flex-col gap-3">
            <div className={`rounded-xl shadow-md p-3 ${darkMode
              ? 'bg-gray-800/80 border border-gray-700'
              : 'bg-white/90 border border-gray-100'
              } flex flex-col items-center justify-center transition-colors duration-300`}>
              <div className={`p-3 rounded-full mb-2 ${darkMode ? 'bg-gray-700' : 'bg-blue-50'
                } transition-colors duration-300`}>
                <Box className={`h-8 w-8 ${darkMode ? 'text-blue-400' : 'text-blue-500'}`} strokeWidth={1.5} />
              </div>
            </div>

            <div className={`rounded-xl shadow-md p-3 ${darkMode
              ? 'bg-gray-800/80 border border-gray-700'
              : 'bg-white/90 border border-gray-100'
              } flex flex-col transition-colors duration-300`}>
              <h3 className={`text-base font-semibold mb-2 ${darkMode ? 'text-gray-400' : 'text-gray-900'}`}>Device Status</h3>
              <div className={`flex items-center mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span className="text-sm">Connected</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Address</span>
                  <span className={`font-medium text-xs ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>SPS</span>
                  <span className={`font-medium text-xs ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>500</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Sample Lost</span>
                  <span className={`font-medium text-xs ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>27</span>
                </div>
              </div>
            </div>
          </div>

          {/* Second Column (40%) - EEG */}
          <div className="md:col-span-2 flex flex-col gap-3">
            {/* EEG Row 1: Brain Image */}
            <div className={`rounded-xl shadow-md p-3 ${darkMode
              ? 'bg-gray-800/80 border border-gray-700'
              : 'bg-white/90 border border-gray-100'
              } flex flex-col items-center justify-center transition-colors duration-300`}>
              <div className={`p-3 rounded-full mb-1 ${darkMode ? 'bg-purple-900/30' : 'bg-purple-50'
                } transition-colors duration-300`}>
                <Brain className={`h-8 w-8 ${darkMode ? 'text-purple-400' : 'text-purple-500'}`} strokeWidth={1.5} />
              </div>
              <h2 className={`text-lg font-semibold mb-0 ${darkMode ? 'text-gray-400' : 'text-gray-900'}`}>Brain Activity</h2>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Electroencephalogram (EEG)</p>
            </div>

            {/* EEG Row 2: Spider Plot - Using fixed height to match ECG equivalent */}
            <div className={`rounded-xl shadow-md p-3 ${darkMode
              ? 'bg-gray-800/80 border border-gray-700'
              : 'bg-white/90 border border-gray-100'
              } transition-colors duration-300 h-52`}> {/* Fixed height to match Heart Rate Analysis */}
              <h3 className={`text-base font-semibold mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-900'}`}>Brainwave Distribution</h3>
              <div className="h-40"> {/* Fixed height for the chart */}
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid strokeDasharray="3 3" stroke={darkMode ? '#4b5563' : '#d1d5db'} />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: darkMode ? '#e5e7eb' : '#4b5563', fontSize: 10 }}
                    />
                    <PolarRadiusAxis angle={30} domain={[0, 50]} tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 10 }} />
                    <Radar
                      name="EEG"
                      dataKey="value"
                      stroke={darkMode ? '#a78bfa' : '#8b5cf6'}
                      fill={darkMode ? '#a78bfa' : '#8b5cf6'}
                      fillOpacity={0.6}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* EEG Row 3: EEG Chart - Using flex-1 to match ECG equivalent */}
            <div className={`flex-1 rounded-xl shadow-md p-3 ${darkMode
              ? 'bg-gray-800/80 border border-gray-700'
              : 'bg-white/90 border border-gray-100'
              } transition-colors duration-300 flex flex-col`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className={`text-base font-semibold ${darkMode ? 'text-gray-400' : 'text-gray-900'} `}>Brainwave Patterns</h3>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(channelColors).map(ch => (
                    <button
                      key={ch}
                      onClick={() => toggleChannel(ch)}
                      className={`px-2 py-0.5 text-xs rounded-full font-medium transition-all duration-200 ${eegChannels.includes(ch)
                        ? 'text-white shadow-sm'
                        : `text-gray-600 bg-transparent border ${darkMode ? 'border-gray-600' : 'border-gray-300'}`
                        }`}
                      style={{ backgroundColor: eegChannels.includes(ch) ? channelColors[ch] : 'transparent' }}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={eegData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={darkMode ? '#374151' : '#e5e7eb'}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="time"
                      stroke={darkMode ? '#9ca3af' : '#6b7280'}
                      tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 10 }}
                      axisLine={{ stroke: darkMode ? '#4b5563' : '#d1d5db' }}
                    />
                    <YAxis
                      stroke={darkMode ? '#9ca3af' : '#6b7280'}
                      tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 10 }}
                      axisLine={{ stroke: darkMode ? '#4b5563' : '#d1d5db' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                        borderColor: darkMode ? '#374151' : '#e5e7eb',
                        borderRadius: '0.375rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                      }}
                      labelStyle={{ color: darkMode ? '#e5e7eb' : '#111827', fontWeight: 600, marginBottom: '2px', fontSize: '12px' }}
                      itemStyle={{ padding: '1px 0', fontSize: '11px' }}
                    />
                    {eegChannels.map(ch => (
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
            <div className={`rounded-xl shadow-md p-3 ${darkMode
              ? 'bg-gray-800/80 border border-gray-700'
              : 'bg-white/90 border border-gray-100'
              } flex flex-col items-center justify-center transition-colors duration-300`}>
              <div className={`p-3 rounded-full mb-1 ${darkMode ? 'bg-red-900/30' : 'bg-red-50'
                } transition-colors duration-300`}>
                <Heart className={`h-8 w-8 ${darkMode ? 'text-red-400' : 'text-red-500'}`} strokeWidth={1.5} />
              </div>
              <h2 className={`text-lg font-semibold mb-0 ${darkMode ? 'text-gray-400' : 'text-gray-900'}`}>Heart Activity</h2>
              <p className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>Electrocardiogram (ECG)</p>
            </div>

            {/* ECG Row 2: BPM Info - Using fixed height to match EEG equivalent */}
            <div className={`rounded-xl shadow-md p-3 ${darkMode
              ? 'bg-gray-800/80 border border-gray-700'
              : 'bg-white/90 border border-gray-100'
              } transition-colors duration-300 h-52`}> {/* Fixed height to match Brainwave Distribution */}
              <h3 className={`text-base font-semibold mb-1  ${darkMode ? 'text-gray-400' : 'text-gray-900'}`}>Heart Rate Analysis</h3>
              <div className="flex items-center justify-center h-40"> {/* Fixed height for the content */}
                <div className={`text-center p-6 rounded-full ${darkMode ? 'bg-red-900/20' : 'bg-red-50'
                  } transition-colors duration-300`}>
                  <div className={`text-4xl font-bold ${darkMode ? 'text-red-400' : 'text-red-500'}`}>
                    {bpm !== null ? bpm : '...'}
                  </div>

                  <div className="text-sm font-medium mt-1">BPM</div>
                </div>
              </div>
              <div className="mt-1 flex justify-center">

              </div>
            </div>

            {/* ECG Row 3: ECG Chart - Using flex-1 to match EEG equivalent */}
            <div className={`flex-1 rounded-xl shadow-md p-3 ${darkMode
              ? 'bg-gray-800/80 border border-gray-700'
              : 'bg-white/90 border border-gray-100'
              } transition-colors duration-300 flex flex-col`}>
              <div className="flex justify-between items-center mb-2">
                <h3 className={`text-base font-semibold  ${darkMode ? 'text-gray-400' : 'text-gray-900'}`}>Cardiac Rhythm</h3>

              </div>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={ecgData} margin={{ top: 5, right: 5, bottom: 5, left: -10 }}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={darkMode ? '#374151' : '#e5e7eb'}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="time"
                      stroke={darkMode ? '#9ca3af' : '#6b7280'}
                      tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 10 }}
                      axisLine={{ stroke: darkMode ? '#4b5563' : '#d1d5db' }}
                    />
                    <YAxis
                      stroke={darkMode ? '#9ca3af' : '#6b7280'}
                      tick={{ fill: darkMode ? '#9ca3af' : '#6b7280', fontSize: 10 }}
                      axisLine={{ stroke: darkMode ? '#4b5563' : '#d1d5db' }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                        borderColor: darkMode ? '#374151' : '#e5e7eb',
                        borderRadius: '0.375rem',
                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
                      }}
                      labelStyle={{ color: darkMode ? '#e5e7eb' : '#111827', fontWeight: 600, fontSize: '12px' }}
                      itemStyle={{ fontSize: '11px' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke={darkMode ? '#f87171' : '#ef4444'}
                      strokeWidth={1.5}
                      dot={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className={`py-2 px-4 ${darkMode
        ? 'bg-gray-800 border-t border-gray-700'
        : 'bg-white/90 backdrop-blur-sm border-t border-gray-200'
        } shadow-inner transition-colors duration-300`}>
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center text-xs">
          <div className={`${darkMode ? 'text-gray-400' : 'text-gray-500'} mb-1 md:mb-0`}>
            <span className="font-medium">Meditation Medusa</span> © {new Date().getFullYear()}
          </div>

        </div>
      </footer>
    </div>
  );
}