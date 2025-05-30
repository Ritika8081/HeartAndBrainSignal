import React, { useRef, useEffect } from 'react';
import { Award } from 'lucide-react';

interface EEGSample {
  timestamp?: number;
  alpha: number;
  beta: number;
  theta: number;
  delta?: number;
}

interface Props {
  data: EEGSample[];
  sessionDuration: number;
  darkMode?: boolean;
  className?: string;
}

const MeditationAnalysis: React.FC<Props> = ({
  data,
  sessionDuration,
  darkMode = true,
  className = ''
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const calculateMetrics = () => {
    if (!data.length) return {
      avgAlpha: 0,
      avgBeta: 0,
      avgTheta: 0,
      avgDelta: 0,
      peakAlpha: 0,
      deepestTheta: 0,
      consistency: 0,
      flowState: 0,
      statePercentages: {
        Relaxed: 0,
        Focused: 0,
        'Deep Meditation': 0,
        Drowsy: 0
      },
      mostFrequent: 'alpha',
      phases: []
    };

    // Calculate averages
    const avgAlpha = data.reduce((sum, s) => sum + s.alpha, 0) / data.length;
    const avgBeta = data.reduce((sum, s) => sum + s.beta, 0) / data.length;
    const avgTheta = data.reduce((sum, s) => sum + s.theta, 0) / data.length;
    const avgDelta = data.reduce((sum, s) => sum + (s.delta ?? 0), 0) / data.length;

    // Calculate state percentages (consistent with modal)
    const totalSamples = data.length;
    const stateCounts = {
      Relaxed: data.filter(s => s.alpha > Math.max(s.beta, s.theta, s.delta ?? 0)).length,
      Focused: data.filter(s => s.beta > Math.max(s.alpha, s.theta, s.delta ?? 0)).length,
      'Deep Meditation': data.filter(s => s.theta > Math.max(s.alpha, s.beta, s.delta ?? 0)).length,
      Drowsy: data.filter(s => (s.delta ?? 0) > Math.max(s.alpha, s.beta, s.theta)).length
    };

    const statePercentages = {
      Relaxed: Math.round((stateCounts.Relaxed / totalSamples) * 100),
      Focused: Math.round((stateCounts.Focused / totalSamples) * 100),
      'Deep Meditation': Math.round((stateCounts['Deep Meditation'] / totalSamples) * 100),
      Drowsy: Math.round((stateCounts.Drowsy / totalSamples) * 100)
    };

    // Determine most frequent state
    const mostFrequent = Object.entries(stateCounts).reduce((a, b) => a[1] > b[1] ? a : b)[0];

    // Flow state score
    const flowState = Math.min(1, (avgAlpha + avgTheta) * 0.6 + (1 - avgBeta) * 0.4);

    // Phase segmentation for visualization only
    const phases: Array<{ phase: string; alpha: number; theta: number; beta: number; height: number }> = [];
    const numPhases = 8;
    const phaseLength = Math.ceil(data.length / numPhases);

    for (let i = 0; i < data.length; i += phaseLength) {
      const segment = data.slice(i, i + phaseLength);
      const avgA = segment.reduce((sum, s) => sum + s.alpha, 0) / segment.length;
      const avgT = segment.reduce((sum, s) => sum + s.theta, 0) / segment.length;
      const avgB = segment.reduce((sum, s) => sum + s.beta, 0) / segment.length;
      const avgD = segment.reduce((sum, s) => sum + (s.delta ?? 0), 0) / segment.length;

      // Determine phase by highest average
      const phaseName = avgA > Math.max(avgB, avgT, avgD) ? 'relaxed' :
        avgB > Math.max(avgA, avgT, avgD) ? 'focused' :
          avgT > Math.max(avgA, avgB, avgD) ? 'deep' : 'drowsy';

      phases.push({
        phase: phaseName,
        alpha: avgA,
        theta: avgT,
        beta: avgB,
        height: Math.max(0.2, (avgA + avgT) * 0.8)
      });
    }

    return {
      avgAlpha,
      avgBeta,
      avgTheta,
      avgDelta,
      statePercentages,
      mostFrequent,
      flowState,
      phases
    };
  };

  const metrics = calculateMetrics();
  const meditationScore = Math.min(100, Math.round(metrics.flowState * 100));

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !data.length) return;

    const width = canvas.width;
    const height = canvas.height;
    const padding = 20;
    const barWidth = (width - padding * 2) / metrics.phases.length;

    ctx.clearRect(0, 0, width, height);

    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(15, 23, 42, 0.9)');
    bgGradient.addColorStop(1, 'rgba(15, 23, 42, 0.4)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    metrics.phases.forEach((phase, i) => {
      const x = padding + i * barWidth;
      const barHeight = phase.height * (height - padding * 2);
      const y = height - padding - barHeight;

      let gradient;
      switch (phase.phase) {
        case 'deep':
          gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, '#8b5cf6');
          gradient.addColorStop(0.5, '#a855f7');
          gradient.addColorStop(1, '#6366f1');
          break;
        case 'relaxed':
          gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, '#06b6d4');
          gradient.addColorStop(0.5, '#0891b2');
          gradient.addColorStop(1, '#0e7490');
          break;
        case 'focused':
          gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, '#f59e0b');
          gradient.addColorStop(0.5, '#d97706');
          gradient.addColorStop(1, '#b45309');
          break;
        case 'drowsy':
          gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, '#fbbf24');
          gradient.addColorStop(0.5, '#f59e0b');
          gradient.addColorStop(1, '#d97706');
          break;
      }

      ctx.fillStyle = gradient || 'rgba(100,116,139,0.6)';
      ctx.beginPath();
      ctx.roundRect(x + 2, y, barWidth - 4, barHeight, 4);
      ctx.fill();
    });

    // Time labels
    ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 4; i++) {
      const x = padding + (width - padding * 2) * (i / 4);
      const timeLabel = Math.round((sessionDuration / 4) * i) + 'm';
      ctx.fillText(timeLabel, x, height - 5);
    }
  }, [data, metrics.phases, sessionDuration]);

  const getPhaseColor = (phase: string) => {
    switch (phase.toLowerCase()) {
      case 'deep': return 'from-purple-500 to-indigo-600';
      case 'relaxed': return 'from-cyan-500 to-blue-600';
      case 'focused': return 'from-amber-500 to-orange-600';
      case 'drowsy': return 'from-yellow-400 to-amber-500';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  return (
    <div className={`w-full max-w-xl mx-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-sm overflow-hidden shadow-2xl ${className}`}>
      <div className="p-6">
        {/* Phases Canvas */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Session Phases</span>
            <span className="text-xs text-slate-500">{metrics.phases.length} phases detected</span>
          </div>
          <canvas ref={canvasRef} width={320} height={120} className="w-full rounded-xl" />
        </div>

        {/* Meditation Breakdown */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          {Object.entries(metrics.statePercentages).map(([state, pct]) => (
            <div key={state} className="text-center">
              <div className={`w-3 h-3 rounded-full mx-auto mb-1 bg-gradient-to-r ${getPhaseColor(state)}`}></div>
              <div className="text-xs text-slate-300">{state}</div>
              <div className="text-xs text-slate-500">{pct}%</div>
            </div>
          ))}
        </div>

        {/* Session Insights */}
        <div className="mt-6 p-4 bg-gradient-to-r from-emerald-900/20 to-teal-900/20 rounded-xl border border-emerald-800/30">
          <div className="flex items-center space-x-2 mb-2">
            <Award className="w-4 h-4 text-emerald-400" />
            <span className="text-sm font-medium text-emerald-300">Session Insights</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {meditationScore >= 80
              ? "Outstanding session! You maintained deep meditative states with excellent mind control."
              : meditationScore >= 60
                ? "Good progress! Your relaxation response is developing well. Try extending session time."
                : "Keep practicing! Focus on breathing techniques to improve alpha wave consistency."}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Progress to next level</span>
            <span>{Math.min(100, meditationScore + 15)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className={`h-2 rounded-full bg-gradient-to-r ${meditationScore >= 80 ? 'from-emerald-400 to-green-500' :
                meditationScore >= 60 ? 'from-yellow-400 to-amber-500' :
                  'from-orange-400 to-red-500'
              }`}
              style={{ width: `${Math.min(100, meditationScore + 15)}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeditationAnalysis;