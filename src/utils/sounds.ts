// Sound utility for target notifications
export class SoundNotifier {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;

  constructor() {
    this.initAudioContext();
  }

  private initAudioContext() {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('Audio context not supported:', error);
      this.isEnabled = false;
    }
  }

  // Play success sound for target hits
  playTargetHit() {
    if (!this.isEnabled || !this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Create a pleasant success sound (major chord)
      oscillator.frequency.setValueAtTime(523.25, this.audioContext.currentTime); // C5
      oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.1); // E5
      oscillator.frequency.setValueAtTime(783.99, this.audioContext.currentTime + 0.2); // G5

      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn('Failed to play sound:', error);
    }
  }

  // Play milestone sound for distance achievements
  playMilestone() {
    if (!this.isEnabled || !this.audioContext) return;

    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      // Create a different sound for milestones
      oscillator.frequency.setValueAtTime(440, this.audioContext.currentTime); // A4
      oscillator.frequency.setValueAtTime(554.37, this.audioContext.currentTime + 0.15); // C#5
      oscillator.frequency.setValueAtTime(659.25, this.audioContext.currentTime + 0.3); // E5

      gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.8);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.8);
    } catch (error) {
      console.warn('Failed to play milestone sound:', error);
    }
  }

  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }
}

export const soundNotifier = new SoundNotifier();