/**
 * Butterworth Digital Filter Implementation
 * Provides high-pass and low-pass filtering for IMU sensor data noise reduction
 */

export interface FilteredData {
  x: number;
  y: number;
  z: number;
}

export class ButterworthFilter {
  private order: number;
  private cutoffFreq: number;
  private samplingRate: number;
  private filterType: 'lowpass' | 'highpass';
  
  // Filter state variables for each axis
  private xHistory: number[] = [];
  private yHistory: number[] = [];
  private zHistory: number[] = [];
  private xOutputHistory: number[] = [];
  private yOutputHistory: number[] = [];
  private zOutputHistory: number[] = [];
  
  // Filter coefficients
  private a: number[] = [];
  private b: number[] = [];

  constructor(
    order: number = 2,
    cutoffFreq: number = 10, // Hz
    samplingRate: number = 60, // Hz (typical for device motion)
    filterType: 'lowpass' | 'highpass' = 'lowpass'
  ) {
    this.order = order;
    this.cutoffFreq = cutoffFreq;
    this.samplingRate = samplingRate;
    this.filterType = filterType;
    
    this.calculateCoefficients();
    this.initializeHistory();
  }

  private calculateCoefficients(): void {
    // Normalized frequency (0 to 1, where 1 is Nyquist frequency)
    const nyquist = this.samplingRate / 2;
    const normalizedFreq = this.cutoffFreq / nyquist;
    
    // For 2nd order Butterworth filter
    if (this.order === 2) {
      const sqrt2 = Math.sqrt(2);
      const theta = Math.PI * normalizedFreq;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      
      if (this.filterType === 'lowpass') {
        // Low-pass Butterworth coefficients
        const k = Math.tan(theta / 2);
        const k2 = k * k;
        const sqrt2k = sqrt2 * k;
        const norm = 1 + sqrt2k + k2;
        
        this.b = [k2 / norm, 2 * k2 / norm, k2 / norm];
        this.a = [1, (2 * (k2 - 1)) / norm, (1 - sqrt2k + k2) / norm];
      } else {
        // High-pass Butterworth coefficients
        const k = Math.tan(theta / 2);
        const k2 = k * k;
        const sqrt2k = sqrt2 * k;
        const norm = 1 + sqrt2k + k2;
        
        this.b = [1 / norm, -2 / norm, 1 / norm];
        this.a = [1, (2 * (k2 - 1)) / norm, (1 - sqrt2k + k2) / norm];
      }
    }
  }

  private initializeHistory(): void {
    const historyLength = this.order + 1;
    this.xHistory = new Array(historyLength).fill(0);
    this.yHistory = new Array(historyLength).fill(0);
    this.zHistory = new Array(historyLength).fill(0);
    this.xOutputHistory = new Array(this.order).fill(0);
    this.yOutputHistory = new Array(this.order).fill(0);
    this.zOutputHistory = new Array(this.order).fill(0);
  }

  private filterAxis(input: number, history: number[], outputHistory: number[]): number {
    // Shift input history
    for (let i = history.length - 1; i > 0; i--) {
      history[i] = history[i - 1];
    }
    history[0] = input;

    // Calculate output using difference equation
    let output = 0;
    
    // Add input terms (b coefficients)
    for (let i = 0; i < this.b.length; i++) {
      output += this.b[i] * history[i];
    }
    
    // Subtract output terms (a coefficients, skip a[0] which is 1)
    for (let i = 1; i < this.a.length; i++) {
      output -= this.a[i] * outputHistory[i - 1];
    }

    // Shift output history
    for (let i = outputHistory.length - 1; i > 0; i--) {
      outputHistory[i] = outputHistory[i - 1];
    }
    outputHistory[0] = output;

    return output;
  }

  /**
   * Filter 3-axis accelerometer/gyroscope data
   */
  filter(data: FilteredData): FilteredData {
    return {
      x: this.filterAxis(data.x, this.xHistory, this.xOutputHistory),
      y: this.filterAxis(data.y, this.yHistory, this.yOutputHistory),
      z: this.filterAxis(data.z, this.zHistory, this.zOutputHistory)
    };
  }

  /**
   * Reset filter state
   */
  reset(): void {
    this.initializeHistory();
  }

  /**
   * Update filter parameters
   */
  updateParameters(cutoffFreq: number, samplingRate?: number): void {
    this.cutoffFreq = cutoffFreq;
    if (samplingRate) {
      this.samplingRate = samplingRate;
    }
    this.calculateCoefficients();
    this.reset();
  }
}

/**
 * Pre-configured filter instances for common use cases
 */
export class IMUFilters {
  // Low-pass filter for acceleration (removes high-frequency noise)
  static accelerationLowPass = new ButterworthFilter(2, 8, 60, 'lowpass');
  
  // High-pass filter for acceleration (removes gravity/bias)
  static accelerationHighPass = new ButterworthFilter(2, 0.5, 60, 'highpass');
  
  // Low-pass filter for gyroscope (removes high-frequency noise)
  static gyroscopeLowPass = new ButterworthFilter(2, 15, 60, 'lowpass');

  /**
   * Apply comprehensive filtering to accelerometer data
   * First high-pass to remove gravity, then low-pass to remove noise
   */
  static filterAcceleration(data: FilteredData): FilteredData {
    const highPassed = this.accelerationHighPass.filter(data);
    return this.accelerationLowPass.filter(highPassed);
  }

  /**
   * Apply low-pass filtering to gyroscope data
   */
  static filterGyroscope(data: FilteredData): FilteredData {
    return this.gyroscopeLowPass.filter(data);
  }
}