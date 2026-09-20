import { describe, expect, test } from 'bun:test';
import { float32ToInt16, MicrophoneStream, MonoResampler, resampleMono } from './microphone-stream';

describe('microphone PCM conversion', () => {
  test('clamps float samples to signed linear16 without wrapping', () => {
    expect(Array.from(float32ToInt16(new Float32Array([-2, -1, -0.5, 0, 0.5, 1, 2, NaN]))))
      .toEqual([-32768, -32768, -16384, 0, 16383, 32767, 32767, 0]);
  });

  test('averages mono input over each 16 kHz output interval', () => {
    expect(Array.from(resampleMono(new Float32Array([0, 0.5, 1, -1, -0.5, 0]), 48000)))
      .toEqual([0.5, -0.5]);
  });

  test('preserves fractional 44.1 kHz sample boundaries across uneven buffers', () => {
    const resampler = new MonoResampler(44100);
    const samples = new Float32Array(44100).fill(0.25);
    const output: number[] = [];
    for (let start = 0; start < samples.length;) {
      const size = start % 2 === 0 ? 127 : 509;
      output.push(...resampler.process(samples.subarray(start, start + size)));
      start += size;
    }
    expect(output).toHaveLength(16000);
    expect(output.every((sample) => sample === 0.25)).toBe(true);

    const boundary = new MonoResampler(44100);
    expect(Array.from(boundary.process(new Float32Array([1, 1])))).toEqual([]);
    // One output interval spans 2 whole samples and 12100/16000 of the third.
    expect(boundary.process(new Float32Array([0]))[0]).toBeCloseTo(32000 / 44100, 6);
    // The second interval consumes the remaining zero and 2.5125 samples at -1.
    expect(boundary.process(new Float32Array([-1, -1, -1]))[0]).toBeCloseTo(-40200 / 44100, 6);
  });

  test('rejects invalid rates instead of hanging during resampling', () => {
    expect(() => new MonoResampler(0)).toThrow();
    expect(() => new MonoResampler(NaN)).toThrow();
    expect(() => new MonoResampler(48000, -1)).toThrow();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function captureHarness(options: {
  sampleRate?: number;
  permission?: Promise<MediaStream>;
  workletLoad?: Promise<void>;
  worklet?: boolean;
  fallbackFailure?: Error;
  resume?: Promise<void>;
} = {}) {
  const chunks: { sequence: number; audio: Uint8Array }[] = [];
  const errors: Error[] = [];
  const endedListeners = new Set<EventListener>();
  const track = {
    stopped: false,
    readyState: 'live' as MediaStreamTrackState,
    stop() { this.stopped = true; this.readyState = 'ended'; },
    addEventListener(type: string, listener: EventListener) {
      if (type === 'ended') endedListeners.add(listener);
    },
    removeEventListener(type: string, listener: EventListener) {
      if (type === 'ended') endedListeners.delete(listener);
    },
    end() {
      this.readyState = 'ended';
      for (const listener of [...endedListeners]) listener(new Event('ended'));
    },
    endedListenerCount: () => endedListeners.size,
  };
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  const node = () => ({
    connected: false,
    disconnected: false,
    connect() { this.connected = true; },
    disconnect() { this.disconnected = true; this.connected = false; },
  });
  const source = node();
  const script = { ...node(), onaudioprocess: null as ((event: AudioProcessingEvent) => void) | null };
  const worklet = {
    ...node(),
    onprocessorerror: null as ((event: Event) => void) | null,
    port: {
      onmessage: null as ((event: MessageEvent<Float32Array>) => void) | null,
      closed: false,
      close() { this.closed = true; },
    },
  };
  let requested = 0;
  let contextsCreated = 0;
  let modulesLoaded = 0;
  let processorCreated = 0;
  let workletCreated = 0;
  const urls: string[] = [];
  const revoked: string[] = [];
  const context = {
    sampleRate: options.sampleRate ?? 48000,
    state: 'suspended',
    destination: {},
    closed: false,
    audioWorklet: options.worklet ? { addModule: async () => { modulesLoaded += 1; await options.workletLoad; } } : undefined,
    createMediaStreamSource: () => source,
    createScriptProcessor: () => {
      if (options.fallbackFailure) throw options.fallbackFailure;
      processorCreated += 1;
      return script;
    },
    async resume() { await options.resume; this.state = 'running'; },
    async close() { this.closed = true; this.state = 'closed'; },
  };
  const dependencies = {
    mediaDevices: {
      async getUserMedia() { requested += 1; return options.permission ? await options.permission : stream; },
    },
    createAudioContext: () => { contextsCreated += 1; return context as unknown as AudioContext; },
    createAudioWorkletNode: () => { workletCreated += 1; return worklet as unknown as AudioWorkletNode; },
    createWorkletUrl: () => { urls.push('blob:microphone'); return 'blob:microphone'; },
    revokeWorkletUrl: (url: string) => { revoked.push(url); },
  };
  function feed(...channels: Float32Array[]) {
    script.onaudioprocess?.({ inputBuffer: {
      numberOfChannels: channels.length,
      length: channels[0].length,
      getChannelData: (channel: number) => channels[channel],
    } } as AudioProcessingEvent);
  }
  return {
    chunks, errors, track, stream, source, script, worklet, context, dependencies, feed, urls, revoked,
    stats: () => ({ requested, contextsCreated, modulesLoaded, processorCreated, workletCreated }),
  };
}

function makeCapture(harness: ReturnType<typeof captureHarness>) {
  return new MicrophoneStream({
    onChunk: (chunk) => harness.chunks.push(chunk),
    onError: (error) => harness.errors.push(error),
    dependencies: harness.dependencies,
  });
}

describe('microphone capture', () => {
  test('emits ordered 80 ms little-endian mono packets from uneven callbacks', async () => {
    const harness = captureHarness();
    const capture = makeCapture(harness);
    await Promise.all([capture.start(), capture.start()]);
    harness.feed(new Float32Array(1000).fill(1), new Float32Array(1000).fill(0));
    expect(harness.chunks).toHaveLength(0);
    harness.feed(new Float32Array(6680).fill(1), new Float32Array(6680).fill(0));
    expect(harness.chunks.map(({ sequence }) => sequence)).toEqual([0, 1]);
    expect(harness.chunks.map(({ audio }) => audio.length)).toEqual([2560, 2560]);
    for (const { audio } of harness.chunks) {
      expect(Array.from(audio.slice(0, 4))).toEqual([255, 63, 255, 63]);
      expect(Array.from(audio.slice(-4))).toEqual([255, 63, 255, 63]);
    }
    expect(harness.stats().requested).toBe(1);
    capture.stop();
  });

  test('stops tracks, disconnects the graph, and suppresses queued callbacks', async () => {
    const harness = captureHarness();
    const capture = makeCapture(harness);
    await capture.start();
    const queuedCallback = harness.script.onaudioprocess!;
    capture.stop();
    capture.stop();
    queuedCallback({ inputBuffer: {
      numberOfChannels: 1, length: 7680, getChannelData: () => new Float32Array(7680),
    } } as unknown as AudioProcessingEvent);
    expect(harness.track.stopped).toBe(true);
    expect(harness.context.closed).toBe(true);
    expect(harness.source.disconnected).toBe(true);
    expect(harness.script.disconnected).toBe(true);
    expect(harness.script.onaudioprocess).toBeNull();
    expect(harness.chunks).toEqual([]);
  });

  test('reports rejected permission without constructing audio resources', async () => {
    const error = new Error('Microphone permission denied');
    const permission = deferred<MediaStream>();
    const harness = captureHarness({ permission: permission.promise });
    const capture = makeCapture(harness);
    const started = capture.start();
    permission.reject(error);
    await expect(started).rejects.toThrow('Microphone permission denied');
    expect(harness.errors).toEqual([error]);
    expect(harness.stats().contextsCreated).toBe(0);
  });

  test('stops a late permission result without starting its audio graph', async () => {
    const permission = deferred<MediaStream>();
    const harness = captureHarness({ permission: permission.promise });
    const capture = makeCapture(harness);
    const started = capture.start();
    capture.stop();
    permission.resolve(harness.stream);
    await started;
    expect(harness.track.stopped).toBe(true);
    expect(harness.stats().contextsCreated).toBe(0);
    expect(harness.chunks).toEqual([]);
    expect(harness.errors).toEqual([]);
  });

  test('uses the worklet path and releases its port and module URL', async () => {
    const harness = captureHarness({ worklet: true, sampleRate: 16000 });
    const capture = makeCapture(harness);
    await capture.start();
    const queuedMessage = harness.worklet.port.onmessage!;
    queuedMessage({ data: new Float32Array(1280).fill(-1) } as MessageEvent<Float32Array>);
    expect(Array.from(harness.chunks[0].audio.slice(0, 4))).toEqual([0, 128, 0, 128]);
    expect(harness.stats().processorCreated).toBe(0);
    expect(harness.stats().workletCreated).toBe(1);
    expect(harness.revoked).toEqual(['blob:microphone']);
    capture.stop();
    queuedMessage({ data: new Float32Array(1280) } as MessageEvent<Float32Array>);
    expect(harness.chunks).toHaveLength(1);
    expect(harness.worklet.port.closed).toBe(true);
    expect(harness.worklet.port.onmessage).toBeNull();
    expect(harness.worklet.disconnected).toBe(true);
  });

  test('falls back to a script processor if worklet module loading fails', async () => {
    const workletLoad = deferred<void>();
    const harness = captureHarness({ worklet: true, workletLoad: workletLoad.promise });
    const capture = makeCapture(harness);
    const started = capture.start();
    workletLoad.reject(new Error('Worklet blocked'));
    await started;
    harness.feed(new Float32Array(3840).fill(1));
    expect(harness.chunks).toHaveLength(1);
    expect(harness.stats().processorCreated).toBe(1);
    expect(harness.revoked).toEqual(['blob:microphone']);
    expect(harness.errors).toEqual([]);
    capture.stop();
  });

  test('releases every resource if both worklet and fallback startup fail', async () => {
    const workletLoad = deferred<void>();
    const harness = captureHarness({
      worklet: true, workletLoad: workletLoad.promise, fallbackFailure: new Error('Capture unavailable'),
    });
    const capture = makeCapture(harness);
    const started = capture.start();
    workletLoad.reject(new Error('Worklet blocked'));
    await expect(started).rejects.toThrow('Capture unavailable');
    expect(harness.track.stopped).toBe(true);
    expect(harness.context.closed).toBe(true);
    expect(harness.source.disconnected).toBe(true);
    expect(harness.revoked).toEqual(['blob:microphone']);
    expect(harness.errors).toHaveLength(1);
  });

  test('does not construct a processor when stopped during worklet startup', async () => {
    const workletLoad = deferred<void>();
    const harness = captureHarness({ worklet: true, workletLoad: workletLoad.promise });
    const capture = makeCapture(harness);
    const started = capture.start();
    await Promise.resolve();
    await Promise.resolve();
    expect(harness.stats().modulesLoaded).toBe(1);
    capture.stop();
    workletLoad.resolve();
    await started;
    expect(harness.stats().workletCreated).toBe(0);
    expect(harness.stats().processorCreated).toBe(0);
    expect(harness.track.stopped).toBe(true);
    expect(harness.context.closed).toBe(true);
    expect(harness.revoked).toEqual(['blob:microphone']);
    expect(harness.errors).toEqual([]);
  });

  test('closes the capture after a runtime worklet processor error', async () => {
    const harness = captureHarness({ worklet: true });
    const capture = makeCapture(harness);
    await capture.start();
    harness.worklet.onprocessorerror!(new Event('processorerror'));
    expect(harness.track.stopped).toBe(true);
    expect(harness.context.closed).toBe(true);
    expect(harness.worklet.port.closed).toBe(true);
    expect(harness.errors).toHaveLength(1);
  });

  test('reports an unexpectedly ended microphone track and releases every resource', async () => {
    const harness = captureHarness();
    const capture = makeCapture(harness);
    await capture.start();
    expect(harness.track.endedListenerCount()).toBe(1);

    harness.track.end();

    expect(harness.errors.map((error) => error.message)).toEqual(['Microphone track ended']);
    expect(harness.track.stopped).toBe(true);
    expect(harness.track.endedListenerCount()).toBe(0);
    expect(harness.context.closed).toBe(true);
    expect(harness.source.disconnected).toBe(true);
    expect(harness.script.disconnected).toBe(true);
  });

  test('removes the track-ended listener before explicit stop without reporting failure', async () => {
    const harness = captureHarness();
    const capture = makeCapture(harness);
    await capture.start();
    expect(harness.track.endedListenerCount()).toBe(1);

    capture.stop();
    harness.track.end();

    expect(harness.track.endedListenerCount()).toBe(0);
    expect(harness.errors).toEqual([]);
  });

  test('does not connect a capture stopped while the audio context resumes', async () => {
    const resume = deferred<void>();
    const harness = captureHarness({ resume: resume.promise });
    const capture = makeCapture(harness);
    const started = capture.start();
    await Promise.resolve();
    await Promise.resolve();
    capture.stop();
    resume.resolve();
    await started;
    expect(harness.source.connected).toBe(false);
    expect(harness.script.connected).toBe(false);
    expect(harness.track.stopped).toBe(true);
    expect(harness.context.closed).toBe(true);
  });
});
