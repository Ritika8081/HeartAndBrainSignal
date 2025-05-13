// src/webworker/bpm.worker.ts

export type BPMRequest = {
    ecgBuffer: number[];
    sampleRate: number;
};

export type BPMResponse = {
    bpm: number | null;      // smoothed “current” BPM or null
    high: number | null;     // max BPM in buffer or null
    low: number | null;      // min BPM in buffer or null
    avg: number | null;      // average BPM in buffer or null
    peaks: number[];         // indices of detected R‐peaks
};

const computeBPMStats = (
    signal: number[],
    sampleRate: number
): BPMResponse => {
    const peaks: number[] = [];
    const len = signal.length;
    if (len < 3) {
        return { bpm: null, high: null, low: null, avg: null, peaks };
    }

    const maxVal = Math.max(...signal);
    const threshold = maxVal * 0.5;
    const refractory = Math.floor(sampleRate * 0.2);
    let lastPeak = -refractory;

    // detect peaks
    for (let i = 1; i < len - 1; i++) {
        if (
            signal[i] > threshold &&
            signal[i] > signal[i - 1] &&
            signal[i] >= signal[i + 1] &&
            i - lastPeak >= refractory
        ) {
            peaks.push(i);
            lastPeak = i;
        }
    }

    if (peaks.length < 2) {
        return { bpm: null, high: null, low: null, avg: null, peaks };
    }

    // build BPM list from intervals
    const bpms: number[] = [];
    for (let j = 1; j < peaks.length; j++) {
        const dt = (peaks[j] - peaks[j - 1]) / sampleRate;
        const val = 60 / dt;
        if (val >= 40 && val <= 200) {
            bpms.push(val);
        }
    }

    if (!bpms.length) {
        return { bpm: null, high: null, low: null, avg: null, peaks };
    }

    const sum = bpms.reduce((a, b) => a + b, 0);
    const avg = sum / bpms.length;
    const high = Math.max(...bpms);
    const low = Math.min(...bpms);

    // “current” BPM = rounded average of this buffer
    const bpm = Math.round(avg);

    return {
        bpm,
        high: Math.round(high),
        low: Math.round(low),
        avg: Math.round(avg),
        peaks,
    };
};

self.onmessage = (e: MessageEvent<BPMRequest>) => {
    const { ecgBuffer, sampleRate } = e.data;
    const resp = computeBPMStats(ecgBuffer, sampleRate);
    (self as any).postMessage(resp);
};
