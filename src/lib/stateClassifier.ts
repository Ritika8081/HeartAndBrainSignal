// lib/stateClassifier.ts
import type { State } from '@/components/StateIndicator';

export function predictState({
  sdnn,
  rmssd,
  pnn50
}: {
  sdnn: number;
  rmssd: number;
  pnn50: number;
}): State {
    if (rmssd < 20 && sdnn < 30) return "stressed";

    if (rmssd > 50 && sdnn > 50 && pnn50 > 0.5) return "happy"; // move happy up
    
    if (rmssd > 50 && sdnn > 50 && pnn50 > 0.4) return "relaxed"; // then relaxed
    
    if (rmssd >= 20 && rmssd <= 50 && sdnn >= 30 && pnn50 < 0.3) return "focused";
    
    return "relaxed";
    
}
