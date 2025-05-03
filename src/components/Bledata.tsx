// lib/useBleStream.ts
import { useState, useRef, useEffect } from 'react';
import { FFT, calculateBandPower } from '@/lib/fft';

// Separate types for EEG and ECG
export interface EEGDataEntry { time: number; ch0: number; ch1: number; }
export interface ECGDataEntry { time: number; ch2: number; }

// BLE & packet settings
const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const DATA_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const CONTROL_CHAR_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';
const SINGLE_SAMPLE_LEN = 7;        // bytes per sample packet

// FFT settings
const FFT_SIZE = 256;
const SAMPLE_RATE = 500;
const DELTA_RANGE: [number, number] = [0.5, 4];
const THETA_RANGE: [number, number] = [4, 8];
const ALPHA_RANGE: [number, number] = [8, 12];
const BETA_RANGE: [number, number] = [12, 30];
const GAMMA_RANGE: [number, number] = [30, 100];

// --- IIR EEG band-pass filter ---
function applyFilter(input: number, state: { z1: number; z2: number; x1: number }): number {
  state.x1 = input - (-1.47548044 * state.z1) - (0.58691951 * state.z2);
  const output = 0.02785977 * state.x1 + 0.05571953 * state.z1 + 0.02785977 * state.z2;
  state.z2 = state.z1;
  state.z1 = state.x1;
  return output;
}


export function useBleStream() {
  const [eegData, setEegData] = useState<EEGDataEntry[]>([]);
  const [ecgData, setEcgData] = useState<ECGDataEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);

  let lastPeakTime = useRef<number | null>(null);
  let rrIntervals = useRef<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);

  const deviceRef = useRef<BluetoothDevice | null>(null);
  const controlRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const dataRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const timeIndex = useRef(0);

  // --- EEG band-pass filter states ---
  const filterState0 = useRef({ z1: 0, z2: 0, x1: 0 });
  const filterState1 = useRef({ z1: 0, z2: 0, x1: 0 });

  class NotchFilter {
    private z1 = 0;
    private z2 = 0;
    constructor(private fs = 500) { }
    process(x: number) {
      // 50 Hz notch coefficients for 500 Hz sampling
      const a0 = 0.96508099;
      const a1 = -1.56202714;
      const a2 = 0.96508099;
      const b1 = -1.56858163;
      const b2 = 0.96424138;

      const w = x - b1 * this.z1 - b2 * this.z2;
      const y = a0 * w + a1 * this.z1 + a2 * this.z2;
      this.z2 = this.z1;
      this.z1 = w;
      return y;
    }
  }
  const notch0 = useRef(new NotchFilter(500));
  const notch1 = useRef(new NotchFilter(500));
  const notch2 = useRef(new NotchFilter(500));  // for ECG ch2

  const normalize = (value: number) => (value - 2048) * (2 / 4096); // for 12-bit ADC



  // FFT buffers & processors
  const fft0 = useRef(new FFT(FFT_SIZE));
  const fft1 = useRef(new FFT(FFT_SIZE));
  const buf0 = useRef<number[]>(Array(FFT_SIZE).fill(0));
  const buf1 = useRef<number[]>(Array(FFT_SIZE).fill(0));
  const sampleCounter = useRef(0);

  // Band power state
  const [bandPower, setBandPower] = useState({
    ch0: { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
    ch1: { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
  });


  const handleNotification = (evt: Event) => {
    const char = evt.target as BluetoothRemoteGATTCharacteristic;
    const raw = new Uint8Array(char.value!.buffer);
    if (raw.length % SINGLE_SAMPLE_LEN !== 0) return;

    const newEegEntries: EEGDataEntry[] = [];
    const newEcgEntries: ECGDataEntry[] = [];

    for (let offset = 0; offset < raw.length; offset += SINGLE_SAMPLE_LEN) {
      // --- raw channel samples ---
      const raw0 = raw[offset + 1] | (raw[offset + 2] << 8);
      const raw1 = raw[offset + 3] | (raw[offset + 4] << 8);
      const raw2 = raw[offset + 5] | (raw[offset + 6] << 8);

      // --- notch filter ---
      const notch0Out = notch0.current.process(raw0);
      const notch1Out = notch1.current.process(raw1);
      const notch2Out = notch2.current.process(raw2);

      // --- normalize & band-pass EEG channels ---
      const norm0 = normalize(notch0Out);
      const norm1 = normalize(notch1Out);
      const eeg0 = applyFilter(norm0, filterState0.current);
      const eeg1 = applyFilter(norm1, filterState1.current);
      const ecg = normalize(notch2Out);

      // --- timestamp ---
      const time = timeIndex.current++;
      newEegEntries.push({ time, ch0: eeg0, ch1: eeg1 });
      newEcgEntries.push({ time, ch2: ecg });

      // --- FFT buffer accumulation ---
      buf0.current.push(eeg0);
      buf1.current.push(eeg1);
      if (buf0.current.length > FFT_SIZE) buf0.current.shift();
      if (buf1.current.length > FFT_SIZE) buf1.current.shift();

      // --- compute band power every 5 samples ---
      if ((sampleCounter.current = (sampleCounter.current + 1) % 5) === 0) {
        const mags0 = fft0.current.computeMagnitudes(new Float32Array(buf0.current));
        const mags1 = fft1.current.computeMagnitudes(new Float32Array(buf1.current));
        setBandPower({
          ch0: {
            delta: calculateBandPower(mags0, DELTA_RANGE, SAMPLE_RATE, FFT_SIZE),
            theta: calculateBandPower(mags0, THETA_RANGE, SAMPLE_RATE, FFT_SIZE),
            alpha: calculateBandPower(mags0, ALPHA_RANGE, SAMPLE_RATE, FFT_SIZE),
            beta: calculateBandPower(mags0, BETA_RANGE, SAMPLE_RATE, FFT_SIZE),
            gamma: calculateBandPower(mags0, GAMMA_RANGE, SAMPLE_RATE, FFT_SIZE),
          },
          ch1: {
            delta: calculateBandPower(mags1, DELTA_RANGE, SAMPLE_RATE, FFT_SIZE),
            theta: calculateBandPower(mags1, THETA_RANGE, SAMPLE_RATE, FFT_SIZE),
            alpha: calculateBandPower(mags1, ALPHA_RANGE, SAMPLE_RATE, FFT_SIZE),
            beta: calculateBandPower(mags1, BETA_RANGE, SAMPLE_RATE, FFT_SIZE),
            gamma: calculateBandPower(mags1, GAMMA_RANGE, SAMPLE_RATE, FFT_SIZE),
          },
        });
      }

      // --- BPM detection logic (unchanged) ---
      if (lastPeakTime.current !== null) {
        const interval = time - lastPeakTime.current;
        if (interval > 30) {
          rrIntervals.current.push(interval);
          if (rrIntervals.current.length > 5) rrIntervals.current.shift();
          const avgRR = rrIntervals.current.reduce((a, b) => a + b, 0) / rrIntervals.current.length;
          setBpm(Math.round((60 * SAMPLE_RATE) / avgRR));
        }
        lastPeakTime.current = time;
      }
    }

    const MAX_POINTS = 1000;

    setEegData(prev => {
      const combined = [...prev, ...newEegEntries];
      // if you want exactly MAX_POINTS, drop the oldest:
      return combined.length > MAX_POINTS
        ? combined.slice(combined.length - MAX_POINTS)
        : combined;
    });

    setEcgData(prev => {
      const combined = [...prev, ...newEcgEntries];
      return combined.length > MAX_POINTS
        ? combined.slice(combined.length - MAX_POINTS)
        : combined;
    }); 
  };



  const connect = async () => {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'NPG' }],
      optionalServices: [SERVICE_UUID],
    });
    deviceRef.current = device;
    const server = await device.gatt!.connect();
    const svc = await server.getPrimaryService(SERVICE_UUID);
    controlRef.current = await svc.getCharacteristic(CONTROL_CHAR_UUID);
    dataRef.current = await svc.getCharacteristic(DATA_CHAR_UUID);
    setConnected(true);
  };

  const start = async () => {
    if (!controlRef.current || !dataRef.current) return;
    await controlRef.current.writeValue(new TextEncoder().encode('START'));
    await dataRef.current.startNotifications();
    dataRef.current.addEventListener('characteristicvaluechanged', handleNotification);
    setStreaming(true);
  };

  const stop = async () => {
    if (!dataRef.current) return;
    await dataRef.current.stopNotifications();
    dataRef.current.removeEventListener('characteristicvaluechanged', handleNotification);
    setStreaming(false);
  };

  const disconnect = () => {
    stop();
    deviceRef.current?.gatt?.disconnect();
    setConnected(false);
  };

  useEffect(() => {
    return () => disconnect();
  }, []);

  return {
    eegData,
    ecgData,
    bpm,
    connected,
    streaming,
    connect,
    start,
    stop,
    disconnect,
    bandPower,
  };
}
