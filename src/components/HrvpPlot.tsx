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

type HrvPoint = {
  time: string;
  hrv: number | null;
};

type HrvTimelineChartProps = {
  darkMode: boolean;
  existingWorker?: Worker | null;
};

const HrvTimelineChart = ({ darkMode, existingWorker }: HrvTimelineChartProps) => {
  const [hrvData, setHrvData] = useState<HrvPoint[]>([]);
  const [peaks, setPeaks] = useState<{ x: string; y: number }[]>([]);
  const [currentBpm, setCurrentBpm] = useState<number | null>(null);
  const maxPointsRef = useRef(60);
  const windowRef = useRef<number[]>([]);

  const lineColor = "#84bfff";
  const gridColor = darkMode ? "#3f3f46" : "#e5e7eb";
  const textColor = darkMode ? "#71717a" : "#78716c";
  const peakColor = "#60a5fa";

  useEffect(() => {
    const now = new Date();
    const initial = Array(20).fill(0).map((_, i) => ({
      time: new Date(now.getTime() - (20 - i) * 1000)
        .toISOString()
        .substr(14, 5),
      hrv: null
    }));
    setHrvData(initial);

    const worker = existingWorker ||
      new Worker(new URL("../webworker/bpm.worker.ts", import.meta.url), { type: "module" });

    const handleUpdate = (e: MessageEvent<{ bpm?: number; hrv: number | null; peaks: number[] }>) => {
      const { bpm, hrv } = e.data;
      const timeStr = new Date().toISOString().substr(14, 5);

      // update BPM state
      if (bpm !== undefined) {
        setCurrentBpm(bpm);
      }

      // update HRV smoothing
      if (hrv !== null) {
        windowRef.current.push(hrv);
        if (windowRef.current.length > 5) windowRef.current.shift();
      }
      const smooth = hrv !== null
        ? Math.round(windowRef.current.reduce((a, b) => a + b, 0) / windowRef.current.length)
        : null;

      setHrvData(prev => {
        const arr = [...prev, { time: timeStr, hrv: smooth }];
        return arr.length > maxPointsRef.current
          ? arr.slice(-maxPointsRef.current)
          : arr;
      });

      if (e.data.peaks?.length && hrv !== null) {
        setPeaks(prev => [...prev.slice(-8), { x: timeStr, y: smooth! }]);
      }
    };

    worker.onmessage = handleUpdate;
    !existingWorker && worker.terminate();
    return () => {
      worker.terminate();
    };
  }, [existingWorker]);

  const data = hrvData.filter(p => p.hrv !== null) as { time: string; hrv: number }[];
  const minVal = Math.max(0, Math.floor(Math.min(...data.map(d => d.hrv)) / 10) * 10);
  const maxVal = Math.ceil(Math.max(...data.map(d => d.hrv)) / 10) * 10;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className={`rounded-md p-2 shadow-md ${darkMode ? 'bg-zinc-800 text-zinc-300' : 'bg-white text-stone-700'} border ${darkMode ? 'border-zinc-700' : 'border-stone-200'}`}>
          <p className="font-medium">{`Time: ${label}`}</p>
          <p className="text-blue-500">{`HRV: ${payload[0].value} ms`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      
      {/* HRV chart */}
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
          <XAxis dataKey="time" stroke={textColor} tick={{ fill: textColor, fontSize: 12 }} tickLine={{ stroke: textColor }} />
          <YAxis domain={[minVal, maxVal]} stroke={textColor} tick={{ fill: textColor, fontSize: 12 }} tickLine={{ stroke: textColor }} label={{ value: 'HRV (ms)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: textColor, fontSize: 12 } }} />
          <Tooltip content={<CustomTooltip />} />
          <Line type="monotone" dataKey="hrv" stroke={lineColor} strokeWidth={2} dot={false} activeDot={{ r: 6, fill: peakColor }} isAnimationActive={false} />
          {peaks.map((p, i) => <ReferenceDot key={i} x={p.x} y={p.y} r={4} fill={peakColor} stroke="none" />)}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default HrvTimelineChart;