
import { EntityState } from '../types';

/**
 * SECTION: AUDIO CONSTANTS
 * Defines music tracks and conceptual themes for different game phases.
 */
export enum ThemeType {
  MENU = 'MENU',
  PHASE_1 = 'PHASE_1',
  PHASE_2 = 'PHASE_2',
  PHASE_3 = 'PHASE_3',
  PHASE_4 = 'PHASE_4',
  PHASE_5 = 'PHASE_5',
  BOSS_1 = 'BOSS_1',
  BOSS_2 = 'BOSS_2',
  DEFEAT = 'DEFEAT',
  VICTORY = 'VICTORY'
}

const THEME_PATHS: Record<ThemeType, string> = {
  [ThemeType.MENU]: 'assets/music/mainTheme.ogg',
  [ThemeType.PHASE_1]: './assets/music/phaseOneTheme.ogg',
  [ThemeType.PHASE_2]: './assets/music/phaseTwoTheme.ogg',
  [ThemeType.PHASE_3]: './assets/music/phaseThreeTheme.ogg',
  [ThemeType.PHASE_4]: './assets/music/phaseFourTheme.ogg',
  [ThemeType.PHASE_5]: './assets/music/phaseFiveTheme.ogg',
  [ThemeType.BOSS_1]: './assets/music/bossOneTheme.ogg',
  [ThemeType.BOSS_2]: './assets/music/bossTwoTheme.ogg',
  [ThemeType.DEFEAT]: './assets/music/defeatTheme.ogg',
  [ThemeType.VICTORY]: './assets/music/victoryTheme.ogg',
};

/**
 * SECTION: AUDIO MANAGER
 * Summary: Controls all sound in the game. It uses the Web Audio API to handle 
 * crossfading between themes and playing immediate SFX (both synth and OGG).
 */
class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private volume: number = 0.4;
  private musicMuted: boolean = false;

  private currentTheme: ThemeType | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private activeGain: GainNode | null = null;
  
  private buffers: Map<string, AudioBuffer> = new Map();
  private loadingMap: Map<string, Promise<AudioBuffer | null>> = new Map();
  private trackOffsets: Map<ThemeType, number> = new Map();
  private lastStartTime: number = 0;

  constructor() {}

  /**
   * Initializes the AudioContext on first user interaction.
   */
  public async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        try {
          await this.ctx.resume();
        } catch (e) {
          console.warn("AudioManager: Failed to resume AudioContext", e);
        }
      }
      return;
    }
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.setVolume(this.volume);
      
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
    } catch (e) {
      console.error("AudioManager: Could not initialize AudioContext", e);
    }
  }

  setVolume(volume: number) {
    this.volume = volume;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.musicMuted ? 0 : volume, this.ctx.currentTime, 0.1);
    }
  }

  setMusicMute(muted: boolean) {
    this.musicMuted = muted;
    this.setVolume(this.volume);
  }

  /**
   * SECTION: BUFFER LOADING
   * Summary: Fetches and decodes audio files into usable RAM buffers.
   */
  private async getBuffer(path: string): Promise<AudioBuffer | null> {
    if (!this.ctx) await this.init();
    if (this.buffers.has(path)) return this.buffers.get(path)!;
    if (this.loadingMap.has(path)) return this.loadingMap.get(path)!;

    const loadPromise = (async () => {
      try {
        const response = await fetch(encodeURI(path));
        if (!response.ok) throw new Error("File not found");
        const arrayBuffer = await response.arrayBuffer();
        const decoded = await this.ctx!.decodeAudioData(arrayBuffer);
        this.buffers.set(path, decoded);
        return decoded;
      } catch (e) {
        console.warn(`AudioManager: Failed to load ${path}.`);
        return null;
      } finally {
        this.loadingMap.delete(path);
      }
    })();

    this.loadingMap.set(path, loadPromise);
    return loadPromise;
  }

  /**
   * SECTION: MUSIC CONTROLLER
   * Summary: Plays a specific background theme with crossfading support.
   */
  async playTheme(type: ThemeType, resume: boolean = false) {
    await this.init();
    if (!this.ctx || !this.masterGain) return;
    
    if (this.ctx.state === 'suspended') return;
    if (this.currentTheme === type) return;

    const oldGain = this.activeGain;
    const oldTheme = this.currentTheme;

    if (oldTheme && this.activeSource) {
      const elapsed = this.ctx.currentTime - this.lastStartTime;
      const buffer = this.buffers.get(THEME_PATHS[oldTheme]);
      if (buffer) {
        const currentOffset = this.trackOffsets.get(oldTheme) || 0;
        this.trackOffsets.set(oldTheme, (currentOffset + elapsed) % buffer.duration);
      }
    }

    this.currentTheme = type;

    const fadeTime = 0.5;
    if (oldGain) {
      oldGain.gain.setTargetAtTime(0.001, this.ctx.currentTime, fadeTime / 3);
      const prevSource = this.activeSource;
      setTimeout(() => {
        try { prevSource?.stop(); } catch(e) {}
      }, fadeTime * 1000 + 100);
    }

    const buffer = await this.getBuffer(THEME_PATHS[type]);
    if (!buffer || this.currentTheme !== type) return;

    const newSource = this.ctx.createBufferSource();
    const newGain = this.ctx.createGain();
    
    newSource.buffer = buffer;
    newSource.loop = true;
    newSource.connect(newGain);
    newGain.connect(this.masterGain);

    const offset = resume ? (this.trackOffsets.get(type) || 0) : 0;
    
    newGain.gain.setValueAtTime(0.001, this.ctx.currentTime);
    newGain.gain.exponentialRampToValueAtTime(1.0, this.ctx.currentTime + fadeTime);

    try {
      newSource.start(0, offset);
      this.lastStartTime = this.ctx.currentTime;
      this.activeSource = newSource;
      this.activeGain = newGain;
    } catch (e) {
      console.error("AudioManager: Failed to start theme source.", e);
    }
  }

  /**
   * SECTION: OGG SFX PLAYER
   * Summary: Helper function to play a recorded sound clip (e.g., .ogg or .wav).
   */
  public async playSfxBuffer(path: string, volume: number = 0.5) {
    if (!this.ctx || !this.masterGain || this.ctx.state === 'suspended') return;
    
    const buffer = await this.getBuffer(path);
    if (!buffer) return;

    const source = this.ctx.createBufferSource();
    const gainNode = this.ctx.createGain();
    
    source.buffer = buffer;
    gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
    
    source.connect(gainNode);
    gainNode.connect(this.masterGain);
    
    source.start(0);
  }

  /**
   * SECTION: PROCEDURAL SFX
   * Summary: Generates sounds mathematically using oscillators. 
   * Useful for hits and UI feedback without needing assets.
   */
  playSFX(freq: number, type: 'square' | 'sawtooth' | 'triangle' = 'square', duration: number = 0.1) {
    if (!this.ctx || !this.masterGain || this.ctx.state === 'suspended') return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    g.gain.setValueAtTime(0.15, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playHit() {
    if (!this.ctx || !this.masterGain || this.ctx.state === 'suspended') return;
    const bufferSize = this.ctx.sampleRate * 0.1;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.2, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.08);
    noise.connect(g);
    g.connect(this.masterGain);
    noise.start();
  }
}

export const audioManager = new AudioManager();
