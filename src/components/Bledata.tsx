'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { FFT, calculateBandPower } from '@/lib/fft';
import { NotchFilter } from '@/lib/notchfilter';
import { EXGFilter, Notch } from '@/lib/filters';

export interface EEGDataEntry { ch0: number }
export interface ECGDataEntry { ch2: number }

const SERVICE_UUID = '4fafc201-1fb5-459e-8fcc-c5c9c331914b';
const DATA_CHAR_UUID = 'beb5483e-36e1-4688-b7f5-ea07361b26a8';
const CONTROL_CHAR_UUID = '0000ff01-0000-1000-8000-00805f9b34fb';

const SAMPLE_RATE = 500;
const FFT_SIZE = 256;
const SINGLE_SAMPLE_LEN = 7;
const BLOCK_COUNT = 10;
const NEW_PACKET_LEN = SINGLE_SAMPLE_LEN * BLOCK_COUNT;

const DELTA_RANGE: [number, number] = [0.5, 4];
const THETA_RANGE: [number, number] = [4, 8];
const ALPHA_RANGE: [number, number] = [8, 12];
const BETA_RANGE: [number, number] = [12, 30];
const GAMMA_RANGE: [number, number] = [30, 45];

export function useBleStream(datastreamCallback?: (data: number[]) => void) {
  const [eegData, setEegData] = useState<number[]>([]);
  const [ecgData, setEcgData] = useState<ECGDataEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [counters, setCounters] = useState<number[]>([]);
  const [bpm, setBpm] = useState<number | null>(null);

  const counterLog = useRef<number[]>([]);
  const ecgLog = useRef<number[]>([]);
  const lastPeakTime = useRef<number | null>(null);
  const rrIntervals = useRef<number[]>([]);
  const deviceRef = useRef<BluetoothDevice | null>(null);
  const controlRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const dataRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null);
  const timeIndex = useRef(0);

  const fft0 = useRef(new FFT(FFT_SIZE));
  const fft1 = useRef(new FFT(FFT_SIZE));
  const buf0 = useRef<number[]>(Array(FFT_SIZE).fill(0));
  const buf1 = useRef<number[]>(Array(FFT_SIZE).fill(0));
  const sampleCounter = useRef(0);

  const [bandPower, setBandPower] = useState({
    ch0: { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
    ch1: { delta: 0, theta: 0, alpha: 0, beta: 0, gamma: 0 },
  });

  const notchFilters = useRef(Array.from({ length: 3 }, () => new Notch()));
  const exgFilters = useRef(Array.from({ length: 3 }, () => new EXGFilter()));

  useEffect(() => {
    // Configure filters
    notchFilters.current.forEach((filter) => filter.setbits(500));
    exgFilters.current.forEach((filter) => filter.setbits("12", 500));
  }, []);

  const processSample = useCallback((dataView: DataView): void => {
    if (dataView.byteLength !== SINGLE_SAMPLE_LEN) {
      console.log("Unexpected sample length: " + dataView.byteLength);
      return;
    }

    const counter = dataView.getUint8(0);
    const raw0 = dataView.getInt16(1, false);
    const raw1 = dataView.getInt16(3, false);
    const raw2 = dataView.getInt16(5, false);

    const eeg0 = notchFilters.current[0].process(
      exgFilters.current[0].process(raw0, 3),
      1
    );
    const eeg1 = notchFilters.current[1].process(
      exgFilters.current[1].process(raw1, 3),
      1
    );
    const ecg = notchFilters.current[2].process(
      exgFilters.current[2].process(raw2, 1),
      1
    );

    const data: number[] = [counter, eeg0, eeg1, ecg];
    if (datastreamCallback) {
      datastreamCallback(data);
    }

    const time = timeIndex.current++;
    setEegData((prev) => {
      const updated = [...prev, eeg0];
      return updated.length > 500 ? updated.slice(updated.length - 500) : updated;
    });
    setEcgData((prev) => {
      const updated = [...prev, { ch2: ecg }];
      return updated.length > 500 ? updated.slice(updated.length - 500) : updated;
    });
    setCounters((prev) => {
      const updated = [...prev, counter];
      return updated.length > 500 ? updated.slice(updated.length - 500) : updated;
    });

    counterLog.current.push(counter);
    ecgLog.current.push(ecg);

    buf0.current.push(eeg0);
    buf1.current.push(eeg1);
    if (buf0.current.length > FFT_SIZE) buf0.current.shift();
    if (buf1.current.length > FFT_SIZE) buf1.current.shift();

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

    if (lastPeakTime.current !== null) {
      const interval = time - lastPeakTime.current;
      if (interval > 30) {
        rrIntervals.current.push(interval);
        if (rrIntervals.current.length > 5) rrIntervals.current.shift();
        const avgRR = rrIntervals.current.reduce((a, b) => a + b, 0) / rrIntervals.current.length;
        setBpm(Math.round((60 * SAMPLE_RATE) / avgRR));
      }
    }
    lastPeakTime.current = time;
  }, [datastreamCallback]);

  const handleNotification = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (!target.value) {
      console.log("Received event with no value.");
      return;
    }
    const value = target.value;

    if (value.byteLength === NEW_PACKET_LEN) {
      for (let i = 0; i < NEW_PACKET_LEN; i += SINGLE_SAMPLE_LEN) {
        const sampleBuffer = value.buffer.slice(i, i + SINGLE_SAMPLE_LEN);
        const sampleDataView = new DataView(sampleBuffer);
        processSample(sampleDataView);
      }
    } else if (value.byteLength === SINGLE_SAMPLE_LEN) {
      processSample(new DataView(value.buffer));
    } else {
      console.log("Unexpected packet length: " + value.byteLength);
    }
  };

  const connect = async () => {
    try {
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
    } catch (error) {
      console.error("Connection failed:", error);
    }
  };

  const start = async () => {
    if (!controlRef.current || !dataRef.current) return;
    await controlRef.current.writeValue(new TextEncoder().encode('START'));
    await dataRef.current.startNotifications();
    dataRef.current.addEventListener('characteristicvaluechanged', handleNotification);
    setStreaming(true);
  };

  // Stop notifications and streaming
  const stop = async () => {
    dataRef.current?.removeEventListener('characteristicvaluechanged', handleNotification);

    try {
      if (dataRef.current?.service.device.gatt?.connected) {
        await dataRef.current.stopNotifications();
      }
    } catch (err) {
      console.warn('stopNotifications failed:', err);
    }

    try {
      if (controlRef.current?.service.device.gatt?.connected) {
        await controlRef.current.writeValue(new TextEncoder().encode('STOP'));
      }
    } catch (err) {
      console.warn('write STOP failed:', err);
    }

    setStreaming(false);
  };

  // Disconnect and clean up everything
  const disconnect = async () => {
    if (streaming) {
      await stop();
    }

    try {
      if (deviceRef.current?.gatt?.connected) {
        deviceRef.current.gatt.disconnect();
      }
    } catch (err) {
      console.warn('BLE disconnect failed:', err);
    }

    // State update triggers clearCanvas via effect
    setStreaming(false);
    setConnected(false);
  };

  // Handle unexpected disconnections
  useEffect(() => {
    const device = deviceRef.current;
    const onDisconnect = () => {
      console.warn('Device unexpectedly disconnected.');
      setConnected(false);
      setStreaming(false);
    };

    device?.addEventListener('gattserverdisconnected', onDisconnect);
    return () => {
      device?.removeEventListener('gattserverdisconnected', onDisconnect);
      disconnect();
    };
  }, []);


  return {
    counters,
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