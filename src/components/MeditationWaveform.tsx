import React, { useRef, useEffect, useState } from 'react';
import { Brain, Zap, Target, Moon, Activity, Award } from 'lucide-react';

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
      avgAlpha: 0, avgBeta: 0, avgTheta: 0, avgDelta: 0,
      peakAlpha: 0, deepestTheta: 0, consistency: 0, flowState: 0,
      phases: []
    };

    const avgAlpha = data.reduce((sum, sample) => sum + sample.alpha, 0) / data.length;
    const avgBeta = data.reduce((sum, sample) => sum + sample.beta, 0) / data.length;
    const avgTheta = data.reduce((sum, sample) => sum + sample.theta, 0) / data.length;
    const avgDelta = data.reduce((sum, sample) => sum + (sample.delta || 0), 0) / data.length;

    const peakAlpha = Math.max(...data.map(s => s.alpha));
    const deepestTheta = Math.max(...data.map(s => s.theta));

    const alphaVariance = data.reduce((sum, sample) => sum + Math.pow(sample.alpha - avgAlpha, 2), 0) / data.length;
    const consistency = Math.max(0, 1 - Math.sqrt(alphaVariance));

    const flowState = Math.min(1, (avgAlpha + avgTheta) * 0.6 + (1 - avgBeta) * 0.4);

    const phases = [];
    const phaseLength = Math.ceil(data.length / 8);

    for (let i = 0; i < data.length; i += phaseLength) {
      const phaseData = data.slice(i, i + phaseLength);
      const phaseAlpha = phaseData.reduce((sum, s) => sum + s.alpha, 0) / phaseData.length;
      const phaseTheta = phaseData.reduce((sum, s) => sum + s.theta, 0) / phaseData.length;
      const phaseBeta = phaseData.reduce((sum, s) => sum + s.beta, 0) / phaseData.length;
      const phaseDelta = phaseData.reduce((sum, s) => sum + (s.delta || 0), 0) / phaseData.length;

      const total = phaseAlpha + phaseTheta + phaseBeta + phaseDelta + 0.001;
      const alphaRatio = phaseAlpha / total;
      const thetaRatio = phaseTheta / total;
      const betaRatio = phaseBeta / total;
      const deltaRatio = phaseDelta / total;

      let phase = 'awake';
      if (deltaRatio > 0.4) phase = 'drowsy';
      else if (thetaRatio > 0.4) phase = 'deep';
      else if (alphaRatio > 0.4) phase = 'relaxed';
      else if (betaRatio > 0.4) phase = 'focused';

      phases.push({
        phase,
        alpha: phaseAlpha,
        theta: phaseTheta,
        beta: phaseBeta,
        height: Math.max(0.2, (phaseAlpha + phaseTheta) * 0.8)
      });
    }

    return { avgAlpha, avgBeta, avgTheta, avgDelta, peakAlpha, deepestTheta, consistency, flowState, phases };
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
        default:
          gradient = ctx.createLinearGradient(x, y, x, y + barHeight);
          gradient.addColorStop(0, '#64748b');
          gradient.addColorStop(0.5, '#475569');
          gradient.addColorStop(1, '#334155');
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.roundRect(x + 2, y, barWidth - 4, barHeight, 4);
      ctx.fill();
      ctx.shadowColor = 'rgba(0,0,0,0)';
    });

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
    switch (phase) {
      case 'deep': return 'from-purple-500 to-indigo-600';
      case 'relaxed': return 'from-cyan-500 to-blue-600';
      case 'focused': return 'from-amber-500 to-orange-600';
      case 'drowsy': return 'from-yellow-400 to-amber-500';
      default: return 'from-slate-500 to-slate-600';
    }
  };

  const getScoreGradient = (score: number) => {
    if (score >= 80) return 'from-emerald-400 to-green-500';
    if (score >= 60) return 'from-yellow-400 to-amber-500';
    return 'from-orange-400 to-red-500';
  };

  return (
    <div className={`w-full max-w-xl mx-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl overflow-hidden shadow-2xl ${className}`}>

      <div className="p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-400">Session Phases</span>
            <span className="text-xs text-slate-500">{metrics.phases.length} phases detected</span>
          </div>
          <canvas ref={canvasRef} width={320} height={120} className="w-full rounded-xl" />
        </div>

        <div className="grid grid-cols-5 gap-2 mb-6">
          {['awake', 'focused', 'relaxed', 'deep', 'drowsy'].map(key => {
            const labelMap: Record<string, string> = {
              awake: 'Awake', focused: 'Focus', relaxed: 'Calm', deep: 'Deep', drowsy: 'Drowsy'
            };
            const count = metrics.phases.filter(p => p.phase === key).length;
            return (
              <div key={key} className="text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-1 bg-gradient-to-r ${getPhaseColor(key)}`}></div>
                <div className="text-xs text-slate-300">{labelMap[key]}</div>
                <div className="text-xs text-slate-500">{count}</div>
              </div>
            );
          })}
        </div>

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

        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Progress to next level</span>
            <span>{Math.min(100, meditationScore + 15)}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div className={`h-2 rounded-full bg-gradient-to-r ${getScoreGradient(meditationScore)} transition-all duration-1000`} style={{ width: `${Math.min(100, meditationScore + 15)}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeditationAnalysis;