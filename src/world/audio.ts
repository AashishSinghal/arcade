// Tiny WebAudio synth: rain-ish ambience, footsteps, blips. No audio files. The context is
// only created after a user gesture, and sound is off by default.

const STORAGE_KEY = "arcade-sound"

export function readSoundPref(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "on"
  } catch {
    return false
  }
}

export function writeSoundPref(on: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, on ? "on" : "off")
  } catch {
    /* storage unavailable: the preference just won't persist */
  }
}

const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]

export class MapAudio {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private nodes: AudioNode[] = []
  private chimeTimer: number | undefined
  private noise: AudioBuffer | null = null
  private on = false

  get enabled() {
    return this.on
  }

  /** Must be called from a user gesture the first time. */
  async setEnabled(on: boolean) {
    this.on = on
    if (!on) {
      this.stopAmbience()
      return
    }
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      this.ctx = new Ctor()
      this.master = this.ctx.createGain()
      this.master.gain.value = 0.9
      this.master.connect(this.ctx.destination)
    }
    try {
      await this.ctx.resume()
    } catch {
      return
    }
    if (this.on) this.startAmbience()
  }

  private noiseBuffer(ctx: AudioContext) {
    if (this.noise) return this.noise
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b = 0
    for (let i = 0; i < len; i++) {
      b = 0.97 * b + (Math.random() * 2 - 1) * 0.3
      d[i] = b
    }
    this.noise = buf
    return buf
  }

  private startAmbience() {
    const ctx = this.ctx
    const master = this.master
    if (!ctx || !master || this.nodes.length) return
    const out = ctx.createGain()
    out.gain.value = 0
    out.gain.linearRampToValueAtTime(1, ctx.currentTime + 1.5)
    out.connect(master)
    this.nodes.push(out)

    // rain
    const rain = ctx.createBufferSource()
    rain.buffer = this.noiseBuffer(ctx)
    rain.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = "highpass"
    hp.frequency.value = 900
    const rg = ctx.createGain()
    rg.gain.value = 0.16
    rain.connect(hp).connect(rg).connect(out)
    rain.start()
    this.nodes.push(rain)

    // city hum and neon buzz
    const hum = ctx.createOscillator()
    hum.frequency.value = 55
    const hg = ctx.createGain()
    hg.gain.value = 0.035
    hum.connect(hg).connect(out)
    hum.start()
    this.nodes.push(hum)
    const buzz = ctx.createOscillator()
    buzz.type = "square"
    buzz.frequency.value = 120
    const bf = ctx.createBiquadFilter()
    bf.type = "lowpass"
    bf.frequency.value = 380
    const bg = ctx.createGain()
    bg.gain.value = 0.004
    buzz.connect(bf).connect(bg).connect(out)
    buzz.start()
    this.nodes.push(buzz)

    // occasional far-off chime
    const chime = () => {
      if (!this.on) return
      this.tone(PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)], 1.6, 0.025, "sine")
      this.chimeTimer = window.setTimeout(chime, 6000 + Math.random() * 9000)
    }
    this.chimeTimer = window.setTimeout(chime, 3000)
  }

  private stopAmbience() {
    window.clearTimeout(this.chimeTimer)
    const ctx = this.ctx
    for (const n of this.nodes) {
      try {
        if (n instanceof AudioScheduledSourceNode) n.stop()
        n.disconnect()
      } catch {
        /* already stopped */
      }
    }
    this.nodes = []
    void ctx
  }

  private tone(freq: number, dur: number, vol: number, type: OscillatorType, slideTo?: number) {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.on) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(freq, t)
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(this.master)
    o.start(t)
    o.stop(t + dur + 0.05)
  }

  step() {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.on) return
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuffer(ctx)
    const f = ctx.createBiquadFilter()
    f.type = "bandpass"
    f.frequency.value = 500 + Math.random() * 300
    const g = ctx.createGain()
    const t = ctx.currentTime
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.25, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    src.connect(f).connect(g).connect(this.master)
    src.start(t, Math.random(), 0.08)
  }

  /** Soft blip when a prompt appears. */
  blip() {
    this.tone(880, 0.08, 0.06, "square")
    window.setTimeout(() => this.tone(1320, 0.1, 0.05, "square"), 70)
  }

  /** Little arpeggio when entering a game. */
  enter() {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      window.setTimeout(() => this.tone(f, 0.12, 0.07, "square"), i * 60)
    )
  }

  bump() {
    this.tone(150, 0.08, 0.06, "triangle", 90)
  }

  dispose() {
    this.on = false
    this.stopAmbience()
    void this.ctx?.close()
    this.ctx = null
    this.master = null
  }
}
