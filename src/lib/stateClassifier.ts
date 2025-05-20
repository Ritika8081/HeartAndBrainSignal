// lib/stateClassifier.ts
import type { State } from '@/components/StateIndicator';

export function predictState({ sdnn, rmssd, pnn50 }: { sdnn: number; rmssd: number; pnn50: number; }): State {
    if (rmssd < 20 && sdnn < 30) return "stressed";
    if (rmssd > 50 && sdnn > 50) return "relaxed";
    if (rmssd >= 20 && sdnn >= 30 && rmssd <= 50) return "focused";
    return "happy";
}
