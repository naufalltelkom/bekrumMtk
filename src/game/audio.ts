/**
 * Procedural Web Audio API sound synthesizer for MathCipher 3D
 * Zero external audio files, 100% procedural sound effects
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private ambientGain: GainNode | null = null;
  private humOsc1: OscillatorNode | null = null;
  private humOsc2: OscillatorNode | null = null;
  private isHumming: boolean = false;

  // Sprint / Running whoosh wind effect
  private sprintGain: GainNode | null = null;
  private sprintNoise: AudioBufferSourceNode | null = null;
  private isSprintAudioActive: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.ambientGain && this.ctx) {
      this.ambientGain.gain.setValueAtTime(
        muted ? 0 : 0.045,
        this.ctx.currentTime
      );
    }
    if (this.sprintGain && this.ctx) {
      this.sprintGain.gain.setValueAtTime(0, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Starts ambient Backrooms fluorescent light hum
   */
  public startAmbientHum() {
    if (this.isHumming) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.setValueAtTime(this.isMuted ? 0 : 0.045, now);

      // Low pass filter for muffled eerie hum
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, now);

      // 60Hz and 120Hz electrical buzz
      this.humOsc1 = this.ctx.createOscillator();
      this.humOsc1.type = 'sawtooth';
      this.humOsc1.frequency.setValueAtTime(60, now);

      this.humOsc2 = this.ctx.createOscillator();
      this.humOsc2.type = 'sine';
      this.humOsc2.frequency.setValueAtTime(120, now);

      // Subtle LFO modulation for flickering realism
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.setValueAtTime(0.4, now);
      lfoGain.gain.setValueAtTime(0.015, now);
      lfo.connect(lfoGain.gain);

      this.humOsc1.connect(filter);
      this.humOsc2.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.ctx.destination);

      this.humOsc1.start();
      this.humOsc2.start();
      lfo.start();
      this.isHumming = true;
    } catch {
      // Audio autoplay policy fallback
    }
  }

  public stopAmbientHum() {
    if (!this.isHumming) return;
    try {
      this.humOsc1?.stop();
      this.humOsc2?.stop();
      this.humOsc1?.disconnect();
      this.humOsc2?.disconnect();
      this.ambientGain?.disconnect();
      this.isHumming = false;
    } catch {
      // ignore
    }
  }

  /**
   * Sprint wind whoosh sound effect
   */
  public setSprinting(isSprinting: boolean) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    if (isSprinting && !this.isSprintAudioActive) {
      try {
        const now = this.ctx.currentTime;

        // Generate pink noise buffer for aerodynamic rushing air
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          data[i] = (b0 + b1 + b2) * 0.25;
        }

        this.sprintNoise = this.ctx.createBufferSource();
        this.sprintNoise.buffer = buffer;
        this.sprintNoise.loop = true;

        // Bandpass filter for muffled wind rush
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(320, now);
        filter.Q.setValueAtTime(1.8, now);

        this.sprintGain = this.ctx.createGain();
        this.sprintGain.gain.setValueAtTime(0, now);
        this.sprintGain.gain.linearRampToValueAtTime(0.08, now + 0.25);

        this.sprintNoise.connect(filter);
        filter.connect(this.sprintGain);
        this.sprintGain.connect(this.ctx.destination);

        this.sprintNoise.start(now);
        this.isSprintAudioActive = true;
      } catch {
        // ignore
      }
    } else if (!isSprinting && this.isSprintAudioActive) {
      try {
        const now = this.ctx.currentTime;
        if (this.sprintGain) {
          this.sprintGain.gain.linearRampToValueAtTime(0.001, now + 0.2);
          setTimeout(() => {
            try {
              this.sprintNoise?.stop();
              this.sprintNoise?.disconnect();
              this.sprintGain?.disconnect();
              this.sprintNoise = null;
              this.sprintGain = null;
              this.isSprintAudioActive = false;
            } catch {
              // ignore
            }
          }, 220);
        }
      } catch {
        // ignore
      }
    }
  }

  /**
   * Procedural footstep on Backrooms carpet / tile
   * Stronger impact and scuff sound when sprinting
   */
  public playFootstep(isSprinting: boolean = false) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;

      // 1. Synthesize carpet scuff noise
      const bufferSize = Math.floor(
        this.ctx.sampleRate * (isSprinting ? 0.08 : 0.05)
      );
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isSprinting ? 380 : 220, now);
      filter.Q.setValueAtTime(isSprinting ? 3.5 : 2.5, now);

      // 2. Heavy boot heel impact (thump)
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isSprinting ? 110 : 70, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + (isSprinting ? 0.07 : 0.05));

      // Higher volume and punch when running
      const gain = this.ctx.createGain();
      const volume = isSprinting ? 0.22 : 0.12;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        now + (isSprinting ? 0.07 : 0.06)
      );

      noise.connect(filter);
      filter.connect(gain);
      osc.connect(gain);
      gain.connect(this.ctx.destination);

      noise.start(now);
      osc.start(now);
      noise.stop(now + 0.09);
      osc.stop(now + 0.09);
    } catch {
      // ignore
    }
  }

  /**
   * UI Click / Interact sound
   */
  public playClick() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    } catch {
      // ignore
    }
  }

  /**
   * Terminal boot / open chime
   */
  public playTerminalOpen() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      [329.63, 440, 659.25, 880].forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);

        gain.gain.setValueAtTime(0, now + idx * 0.06);
        gain.gain.linearRampToValueAtTime(0.1, now + idx * 0.06 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.26);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Access Granted / Password Correct
   */
  public playSuccess() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.1);

        gain.gain.setValueAtTime(0.15, now + idx * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.1 + 0.4);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now + idx * 0.1);
        osc.stop(now + idx * 0.1 + 0.42);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Wrong code buzzer
   */
  public playError() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      [140, 130].forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0.16, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx!.destination);

        osc.start(now);
        osc.stop(now + 0.3);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Door opening servo / sliding sound
   */
  public playDoorOpen() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(220, now + 1.2);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 1.35);
    } catch {
      // ignore
    }
  }

  // ==========================================================
  // ENEMY CHASE BACKSOUNDS & HORROR / LOCKER SFX
  // ==========================================================
  private currentChaser: 'NONE' | 'TEACHER' | 'CHUBBY' | 'SLENDER' = 'NONE';
  private chaserIntervalId: number | null = null;
  private chaserStepIndex: number = 0;

  public setChaserAudio(chaser: 'NONE' | 'TEACHER' | 'CHUBBY' | 'SLENDER') {
    if (this.currentChaser === chaser) return;
    this.currentChaser = chaser;

    if (this.chaserIntervalId !== null) {
      window.clearInterval(this.chaserIntervalId);
      this.chaserIntervalId = null;
    }

    if (chaser === 'NONE') return;

    this.chaserStepIndex = 0;
    const stepMs = chaser === 'CHUBBY' ? 185 : chaser === 'TEACHER' ? 280 : 210;

    const triggerStep = () => {
      if (this.isMuted) return;
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const idx = this.chaserStepIndex++;

      try {
        if (this.currentChaser === 'TEACHER') {
          // Scary Math Teacher chase: ominous minor pulse + ruler snap accents
          const notes = [110, 116.54, 130.81, 103.83, 98.0, 116.54, 146.83, 103.83];
          const freq = notes[idx % notes.length];
          const osc = this.ctx.createOscillator();
          const filter = this.ctx.createBiquadFilter();
          const gain = this.ctx.createGain();

          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, now);
          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(480, now);

          gain.gain.setValueAtTime(0.08, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.25);

          // Eerie high tension sting + ruler slap on downbeats
          if (idx % 4 === 0) {
            const sting = this.ctx.createOscillator();
            const sGain = this.ctx.createGain();
            sting.type = 'triangle';
            sting.frequency.setValueAtTime(880, now);
            sting.frequency.exponentialRampToValueAtTime(420, now + 0.14);
            sGain.gain.setValueAtTime(0.07, now);
            sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            sting.connect(sGain);
            sGain.connect(this.ctx.destination);
            sting.start(now);
            sting.stop(now + 0.16);
          }
        } else if (this.currentChaser === 'CHUBBY') {
          // Funny bouncy comedic synth beat ("Oke Gas" upbeat energetic groove)
          const bassSeq = [130.81, 130.81, 164.81, 196.0, 174.61, 164.81, 146.83, 196.0];
          const leadSeq = [523.25, 0, 659.25, 587.33, 523.25, 659.25, 783.99, 659.25];
          const bassFreq = bassSeq[idx % bassSeq.length];
          const leadFreq = leadSeq[idx % leadSeq.length];

          // Bouncy bass
          const bOsc = this.ctx.createOscillator();
          const bGain = this.ctx.createGain();
          bOsc.type = 'triangle';
          bOsc.frequency.setValueAtTime(bassFreq, now);
          bOsc.frequency.exponentialRampToValueAtTime(bassFreq * 0.88, now + 0.14);
          bGain.gain.setValueAtTime(0.11, now);
          bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
          bOsc.connect(bGain);
          bGain.connect(this.ctx.destination);
          bOsc.start(now);
          bOsc.stop(now + 0.17);

          // Comical bouncy lead blip
          if (leadFreq > 0) {
            const lOsc = this.ctx.createOscillator();
            const lGain = this.ctx.createGain();
            lOsc.type = 'square';
            lOsc.frequency.setValueAtTime(leadFreq, now);
            lOsc.frequency.exponentialRampToValueAtTime(leadFreq * 1.06, now + 0.09);
            lGain.gain.setValueAtTime(0.045, now);
            lGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
            lOsc.connect(lGain);
            lGain.connect(this.ctx.destination);
            lOsc.start(now);
            lOsc.stop(now + 0.13);
          }
        } else if (this.currentChaser === 'SLENDER') {
          // Extreme terrifying Slenderman horror: sub-bass dread + dissonant screech + static crackle
          const subOsc = this.ctx.createOscillator();
          const subGain = this.ctx.createGain();
          subOsc.type = 'sawtooth';
          subOsc.frequency.setValueAtTime(idx % 2 === 0 ? 48 : 41, now);
          subGain.gain.setValueAtTime(0.12, now);
          subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
          subOsc.connect(subGain);
          subGain.connect(this.ctx.destination);
          subOsc.start(now);
          subOsc.stop(now + 0.2);

          // Dissonant horror cluster
          if (idx % 3 === 0) {
            [622.25, 659.25].forEach((f) => {
              const sOsc = this.ctx!.createOscillator();
              const sGain = this.ctx!.createGain();
              sOsc.type = 'sawtooth';
              sOsc.frequency.setValueAtTime(f, now);
              sGain.gain.setValueAtTime(0.045, now);
              sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
              sOsc.connect(sGain);
              sGain.connect(this.ctx!.destination);
              sOsc.start(now);
              sOsc.stop(now + 0.36);
            });
          }

          // Static interference crackle
          if (idx % 2 === 0) {
            const bufSize = Math.floor(this.ctx.sampleRate * 0.06);
            const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
            const ch = buf.getChannelData(0);
            for (let i = 0; i < bufSize; i++) ch[i] = Math.random() * 2 - 1;
            const noise = this.ctx.createBufferSource();
            noise.buffer = buf;
            const nGain = this.ctx.createGain();
            nGain.gain.setValueAtTime(0.055, now);
            nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            noise.connect(nGain);
            nGain.connect(this.ctx.destination);
            noise.start(now);
            noise.stop(now + 0.065);
          }
        }
      } catch {
        // ignore
      }
    };

    triggerStep();
    this.chaserIntervalId = window.setInterval(triggerStep, stepMs);
  }

  public playSlenderJumpscare() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // Intense horror dissonance chord + loud static blast
      [185, 277.18, 554.37, 740, 1108.73].forEach((freq) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.linearRampToValueAtTime(freq * 0.85, now + 1.1);
        gain.gain.setValueAtTime(0.11, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now);
        osc.stop(now + 1.28);
      });

      const bufSize = Math.floor(this.ctx.sampleRate * 0.9);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) ch[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.24, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);
      noise.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.96);
    } catch {
      // ignore
    }
  }

  public playTeacherHit() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.38);
    } catch {
      // ignore
    }
  }

  public playLockerToggle(entering: boolean) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(entering ? 160 : 240, now);
      osc.frequency.exponentialRampToValueAtTime(entering ? 95 : 340, now + 0.14);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // ignore
    }
  }

  // ==========================================================
  // EMOTIONAL SAD CUTSCENE MUSIC (15s Hug Scene)
  // ==========================================================
  private sadIntervalId: number | null = null;
  private sadStep: number = 0;

  public startSadCutsceneMusic() {
    this.stopSadCutsceneMusic();
    // Gentle slow minor piano-like melody: Am -> F -> C -> G -> Dm -> Am
    const melody = [
      220.0, 261.63, 329.63, 440.0, // Am
      174.61, 220.0, 261.63, 349.23, // F
      196.0, 261.63, 329.63, 392.0, // C
      196.0, 246.94, 293.66, 392.0, // G
      293.66, 349.23, 440.0, 329.63, // Dm
      220.0, 261.63, 329.63, 220.0, // Am resolve
    ];
    this.sadStep = 0;

    const playNote = () => {
      if (this.isMuted) return;
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const freq = melody[this.sadStep % melody.length];
      this.sadStep++;

      try {
        // Warm soft sine + triangle harmony for melancholic piano feel
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(freq, now);

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freq * 0.5, now);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.09, now + 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
      } catch {
        // ignore
      }
    };

    playNote();
    this.sadIntervalId = window.setInterval(playNote, 620);
  }

  public stopSadCutsceneMusic() {
    if (this.sadIntervalId !== null) {
      window.clearInterval(this.sadIntervalId);
      this.sadIntervalId = null;
    }
  }

  // ==========================================================
  // SPACE DIMENSION AMBIENT & STAFF COMBAT SFX
  // ==========================================================
  private spaceIntervalId: number | null = null;
  private spaceStep: number = 0;

  public startSpaceAudio() {
    this.stopSpaceAudio();
    this.spaceStep = 0;
    const notes = [65.41, 77.78, 98.0, 73.42];
    const tickSpace = () => {
      if (this.isMuted) return;
      this.initCtx();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      const f = notes[this.spaceStep % notes.length];
      this.spaceStep++;
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.08, now + 0.2);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.95);
      } catch {
        // ignore
      }
    };
    tickSpace();
    this.spaceIntervalId = window.setInterval(tickSpace, 750);
  }

  public stopSpaceAudio() {
    if (this.spaceIntervalId !== null) {
      window.clearInterval(this.spaceIntervalId);
      this.spaceIntervalId = null;
    }
  }

  public playStaffPickup() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [440, 554.37, 659.25, 880, 1108.73].forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.11, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.45);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.46);
      });
    } catch {
      // ignore
    }
  }

  public playTeacherBanish() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(520, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.45);
      gain.gain.setValueAtTime(0.24, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.5);
    } catch {
      // ignore
    }
  }

  public playTeacherStomp() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(115, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.24);
      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.28);
    } catch {
      // ignore
    }
  }

  public playTeleportWarp() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.65);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.75);
    } catch {
      // ignore
    }
  }

  public playChubbyGrowl() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(92, now);
      osc1.frequency.linearRampToValueAtTime(64, now + 1.1);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(138, now);
      osc2.frequency.linearRampToValueAtTime(84, now + 1.1);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(340, now);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.24, now + 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.15);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.2);
      osc2.stop(now + 1.2);
    } catch {
      // ignore
    }
  }

  public playPunch() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(160, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);

      const bufSize = Math.floor(this.ctx.sampleRate * 0.12);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) ch[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.18, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.13);
    } catch {
      // ignore
    }
  }

  public playBodyShake() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140 + Math.random() * 60, now);
      osc.frequency.exponentialRampToValueAtTime(75, now + 0.08);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // ignore
    }
  }

  public playDoorCreak() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.linearRampToValueAtTime(315, now + 0.35);
      osc.frequency.linearRampToValueAtTime(175, now + 0.85);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.92);
    } catch {
      // ignore
    }
  }

  public playDragSfx() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const bufSize = Math.floor(this.ctx.sampleRate * 0.55);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) ch[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240, now);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.56);
    } catch {
      // ignore
    }
  }

  public playLightningCast() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1450, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.16);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);

      const bufSize = Math.floor(this.ctx.sampleRate * 0.1);
      const buf = this.ctx.createBuffer(1, bufSize, this.ctx.sampleRate);
      const ch = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) ch[i] = Math.random() * 2 - 1;
      const noise = this.ctx.createBufferSource();
      noise.buffer = buf;
      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.12, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      noise.connect(nGain);
      nGain.connect(this.ctx.destination);
      noise.start(now);
      noise.stop(now + 0.11);
    } catch {
      // ignore
    }
  }

  public playElectricShock() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [620, 930, 1280, 480].forEach((freq, i) => {
        const osc = this.ctx!.createOscillator();
        const gain = this.ctx!.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.55, now + i * 0.06 + 0.08);
        gain.gain.setValueAtTime(0.11, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.09);
        osc.connect(gain);
        gain.connect(this.ctx!.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.1);
      });
    } catch {
      // ignore
    }
  }
}

export const sound = new SoundEngine();
