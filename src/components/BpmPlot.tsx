import { useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot
} from 'recharts';
import { Heart } from 'lucide-react';

type BpmPoint = {
  time: string;
  bpm: number | null;
  isPeak?: boolean;
};

type BpmTimelineChartProps = {
  darkMode: boolean;
  existingBpmWorker?: Worker | null;
};

const BpmTimelineChart = ({ darkMode, existingBpmWorker }: BpmTimelineChartProps) => {
  const [bpmData, setBpmData] = useState<BpmPoint[]>([]);
  const [peaks, setPeaks] = useState<{x: string, y: number}[]>([]);
  const maxPointsRef = useRef(60); // Store 60 seconds of data
  const bpmWorkerRef = useRef<Worker | null>(null);
  const bpmWindowRef = useRef<number[]>([]);
  const lastTimeRef = useRef<Date>(new Date());
  
  // Colors based on dark mode
  const lineColor = "#E4967E"; // ECG color consistent with your scheme
  const gridColor = darkMode ? "#3f3f46" : "#e5e7eb";
  const textColor = darkMode ? "#71717a" : "#78716c";
  const peakColor = "#f97316"; // Orange for peak markers
  
  useEffect(() => {
    // Initialize with empty data points
    const currentTime = new Date();
    const initialData: BpmPoint[] = Array(20).fill(0).map((_, i) => ({
      time: new Date(currentTime.getTime() - (20 - i) * 1000)
        .toISOString().substr(14, 5), // MM:SS format
      bpm: null
    }));
    
    setBpmData(initialData);
    
    // Use existing worker or create a new one
    const worker = existingBpmWorker || 
      new Worker(new URL("../webworker/bpm.worker.ts", import.meta.url), { type: "module" });
    
    const handleBpmUpdate = (e: MessageEvent<{
      bpm: number | null;
      high: number | null;
      low: number | null;
      avg: number | null;
      peaks: number[];
    }>) => {
      const { bpm, peaks: peakIndices } = e.data;
      
      // Get current time
      const now = new Date();
      lastTimeRef.current = now;
      const timeStr = now.toISOString().substr(14, 5); // MM:SS format
      
      // Update BPM window for smoothing (similar to your existing code)
      if (bpm !== null) {
        bpmWindowRef.current.push(bpm);
        if (bpmWindowRef.current.length > 5) bpmWindowRef.current.shift();
      }
      
      // Calculate smoothed BPM
      const smoothedBpm = bpm !== null 
        ? Math.round(bpmWindowRef.current.reduce((a, b) => a + b, 0) / bpmWindowRef.current.length) 
        : null;
      
      // Add new data point
      setBpmData(prevData => {
        const newData = [...prevData, { time: timeStr, bpm: smoothedBpm }];
        // Keep only the most recent points
        if (newData.length > maxPointsRef.current) {
          return newData.slice(newData.length - maxPointsRef.current);
        }
        return newData;
      });
      
      // Update peaks visualization
      if (peakIndices && peakIndices.length > 0 && bpm !== null) {
        const newPeaks = [{ x: timeStr, y: smoothedBpm || bpm }];
        setPeaks(prevPeaks => {
          const combinedPeaks = [...prevPeaks, ...newPeaks];
          // Keep only recent peaks
          return combinedPeaks.slice(-8);
        });
      }
    };
    
    // Connect to the worker
    if (!existingBpmWorker) {
      worker.onmessage = handleBpmUpdate;
    } else {
      worker.addEventListener('message', handleBpmUpdate);
    }
    
    bpmWorkerRef.current = worker;
    
    // If we don't have an existing worker, create some simulated data for demo
    let simulationInterval: number | null = null;
    if (!existingBpmWorker) {
      simulationInterval = window.setInterval(() => {
        const mockBpm = Math.round(60 + Math.random() * 20);
        const mockPeaks = Math.random() > 0.7 ? [1] : [];
        handleBpmUpdate({ 
          data: { 
            bpm: mockBpm, 
            high: mockBpm + 5,
            low: mockBpm - 5,
            avg: mockBpm,
            peaks: mockPeaks 
          } 
        } as any);
      }, 1000);
    }
    
    return () => {
      if (simulationInterval) clearInterval(simulationInterval);
      if (!existingBpmWorker && bpmWorkerRef.current) {
        bpmWorkerRef.current.terminate();
      } else if (existingBpmWorker) {
        existingBpmWorker.removeEventListener('message', handleBpmUpdate);
      }
    };
  }, [existingBpmWorker]);
  
  // Remove null BPM values for clean display
  const filteredData = bpmData.filter(point => point.bpm !== null);
  
  // Calculate Y-axis domain with some padding
  const minBpm = Math.min(...filteredData.map(d => d.bpm || 60)) - 10;
  const maxBpm = Math.max(...filteredData.map(d => d.bpm || 80)) + 10;
  const yDomain = [
    Math.max(40, Math.floor(minBpm / 10) * 10), // Bottom limit: 40 or rounded down
    Math.min(180, Math.ceil(maxBpm / 10) * 10)  // Top limit: 180 or rounded up
  ];
  
  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className={`rounded-md p-2 shadow-md ${darkMode ? 'bg-zinc-800 text-zinc-300' : 'bg-white text-stone-700'} border ${darkMode ? 'border-zinc-700' : 'border-stone-200'}`}>
          <p className="font-medium">{`Time: ${label}`}</p>
          <p className="text-rose-500">{`BPM: ${payload[0].value}`}</p>
        </div>
      );
    }
    return null;
  };
  
  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
    
        <div className={`flex items-center ${darkMode ? 'text-stone-400' : 'text-stone-500'} text-xs`}>
          <Heart size={14} className="mr-1" />
          <span>BPM Trend</span>
        </div>
      </div>
      
      <div className="flex-1 w-full">
        <ResponsiveContainer width="100%" height="95%">
          <LineChart
            data={filteredData}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
            <XAxis 
              dataKey="time" 
              stroke={textColor} 
              tick={{ fill: textColor, fontSize: 12 }} 
              tickLine={{ stroke: textColor }}
            />
            <YAxis 
              domain={yDomain}
              stroke={textColor} 
              tick={{ fill: textColor, fontSize: 12 }} 
              tickLine={{ stroke: textColor }}
              label={{ 
                value: 'BPM', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: textColor, fontSize: 12 }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="bpm" 
              stroke={lineColor} 
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 6, fill: peakColor }}
              isAnimationActive={false}
            />
            
            {/* Render peak markers */}
            {peaks.map((peak, index) => (
              <ReferenceDot
                key={`peak-${index}`}
                x={peak.x}
                y={peak.y}
                r={4}
                fill={peakColor}
                stroke="none"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default BpmTimelineChart;