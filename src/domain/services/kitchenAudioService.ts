/**
 * Kitchen Audio & Notification Service (Shared Singleton Architecture)
 * 
 * Complies with strict browser autoplay policies, maintains persistent audio context state,
 * provides debounced multi-order queuing, and provides visual / browser notification fallbacks.
 */

export type AudioState = 'ready' | 'blocked' | 'muted' | 'suspended' | 'error' | 'unsupported';

class KitchenAudioServiceImpl {
  private audioCtx: AudioContext | null = null;
  private isMuted: boolean = false;
  private lastError: string | null = null;
  private stateListeners: Array<(state: AudioState) => void> = [];
  private isPlaying: boolean = false;
  private queueCount: number = 0;
  private lastPlayTimestamp: number = 0;
  private debounceTimer: any = null;

  constructor() {
    // Check local storage for preference
    const savedPref = typeof localStorage !== 'undefined' ? localStorage.getItem('kds_audio_enabled') : null;
    if (savedPref !== null) {
      this.isMuted = savedPref === 'false';
    }
  }

  public subscribeState(listener: (state: AudioState) => void): () => void {
    this.stateListeners.push(listener);
    listener(this.getState());
    return () => {
      this.stateListeners = this.stateListeners.filter(l => l !== listener);
    };
  }

  private notifyState() {
    const current = this.getState();
    this.stateListeners.forEach(l => l(current));
  }

  public getState(): AudioState {
    if (typeof window === 'undefined') return 'unsupported';
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return 'unsupported';

    if (this.isMuted) return 'muted';
    if (this.lastError) return 'error';
    if (!this.audioCtx) return 'blocked';
    
    if (this.audioCtx.state === 'running') return 'ready';
    if (this.audioCtx.state === 'suspended') return 'suspended';
    if (this.audioCtx.state === 'closed') return 'blocked';
    return 'blocked';
  }

  private ensureAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!this.audioCtx) {
      try {
        this.audioCtx = new AudioContextClass();
        this.audioCtx.onstatechange = () => {
          this.notifyState();
        };
      } catch (err: any) {
        console.warn('Could not instantiate AudioContext:', err);
        this.lastError = err?.message || 'AudioContext creation failed';
        return null;
      }
    }
    return this.audioCtx;
  }

  /**
   * Unlock AudioContext via explicit user gesture (button click)
   */
  public async unlockAudio(): Promise<{ success: boolean; state: AudioState; error?: string }> {
    this.lastError = null;
    try {
      const ctx = this.ensureAudioContext();
      if (!ctx) {
        this.notifyState();
        return { success: false, state: this.getState(), error: 'Web Audio API is unsupported in this browser.' };
      }

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      this.isMuted = false;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('kds_audio_enabled', 'true');
      }
      this.notifyState();

      if (ctx.state === 'running') {
        // Play a crisp confirmation sound
        await this.playChimeSequence(true);

        // Request browser notification permission if available
        if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().catch(() => {});
        }

        return { success: true, state: 'ready' };
      } else {
        return { success: false, state: this.getState(), error: `AudioContext in ${ctx.state} state.` };
      }
    } catch (err: any) {
      console.error('Failed to unlock Kitchen AudioContext:', err);
      this.lastError = err?.message || 'Unlock failed';
      this.notifyState();
      return { success: false, state: 'error', error: this.lastError || undefined };
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    this.lastError = null;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('kds_audio_enabled', muted ? 'false' : 'true');
    }
    this.notifyState();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return !this.isMuted;
  }

  /**
   * Play explicit test alarm
   */
  public async playTestAlarm(): Promise<{ success: boolean; state: AudioState; error?: string }> {
    if (this.isMuted) {
      this.setMuted(false);
    }

    const unlockResult = await this.unlockAudio();
    if (!unlockResult.success) {
      return unlockResult;
    }

    return { success: true, state: 'ready' };
  }

  /**
   * Trigger alarm for incoming orders with debouncing & queuing
   */
  public triggerNewOrderAlarm(orderCount: number = 1) {
    if (this.isMuted) return;

    this.queueCount += orderCount;
    const now = Date.now();

    // Debounce rapid order arrivals within 1.2s to prevent chaotic overlapping tones
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (now - this.lastPlayTimestamp > 1500 && !this.isPlaying) {
      this.executeAlarmPlayback();
    } else {
      this.debounceTimer = setTimeout(() => {
        this.executeAlarmPlayback();
      }, 1200);
    }

    // Trigger visual and browser notification
    this.showBrowserNotification(orderCount);
  }

  private async executeAlarmPlayback() {
    if (this.isMuted) return;
    this.lastPlayTimestamp = Date.now();
    this.queueCount = 0;

    const ctx = this.ensureAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        this.notifyState();
        return;
      }
    }

    if (ctx.state === 'running') {
      this.notifyState();
      await this.playChimeSequence(false);
    } else {
      this.notifyState();
    }
  }

  private async playChimeSequence(isTest: boolean): Promise<void> {
    if (!this.audioCtx || this.audioCtx.state !== 'running') return;

    this.isPlaying = true;
    const ctx = this.audioCtx;

    try {
      const playNote = (freq: number, startTime: number, duration: number, volume: number = 0.3) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startTime);

        gain.gain.setValueAtTime(volume, ctx.currentTime + startTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startTime + duration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + startTime);
        osc.stop(ctx.currentTime + startTime + duration);
      };

      if (isTest) {
        // Crisp dual chime for test (C5 -> G5 -> C6)
        playNote(523.25, 0, 0.2, 0.25);
        playNote(783.99, 0.15, 0.2, 0.25);
        playNote(1046.50, 0.3, 0.4, 0.3);
        await new Promise(r => setTimeout(r, 700));
      } else {
        // High-clarity kitchen attention chime (A5 -> C#6 -> E6 -> A6)
        playNote(880.00, 0, 0.22, 0.35);
        playNote(1108.73, 0.15, 0.22, 0.35);
        playNote(1318.51, 0.3, 0.25, 0.4);
        playNote(1760.00, 0.45, 0.5, 0.4);
        await new Promise(r => setTimeout(r, 950));
      }
    } catch (e) {
      console.warn('Kitchen chime playback encountered error:', e);
    } finally {
      this.isPlaying = false;
    }
  }

  private showBrowserNotification(count: number) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification('👨‍🍳 New Kitchen Order!', {
          body: count > 1 ? `${count} new tickets received in KDS.` : 'New kitchen ticket received. Ready to prepare!',
          icon: '/favicon.ico',
          tag: 'kds-new-order'
        });
      } catch {}
    }
  }
}

export const kitchenAudioService = new KitchenAudioServiceImpl();
