/**
 * Launch Detection Logic for Speed Measurement
 * Uses IMU data to intelligently detect when vehicle starts moving
 */

import { IMUFilters, FilteredData } from './ButterworthFilter';

export interface LaunchDetectionConfig {
  // Acceleration thresholds
  horizontalAccelThreshold: number; // m/s² - minimum horizontal acceleration to trigger
  verticalAccelLimit: number; // m/s² - maximum vertical acceleration allowed
  speedThreshold: number; // km/h - speed must be below this to consider as launch
  
  // Timing requirements
  sustainedDurationMs: number; // How long acceleration must be sustained
  samplingRateHz: number; // Expected sensor sampling rate
  
  // Filtering
  enableFiltering: boolean;
}

export interface AccelerationData {
  x: number; // Forward/backward acceleration
  y: number; // Left/right acceleration  
  z: number; // Up/down acceleration
  timestamp: number;
}

export class LaunchDetector {
  private config: LaunchDetectionConfig;
  private accelerationHistory: AccelerationData[] = [];
  private filteredHistory: FilteredData[] = [];
  private lastProcessedTime: number = 0;
  private isLaunchDetected: boolean = false;
  private launchStartTime: number | null = null;

  constructor(config: Partial<LaunchDetectionConfig> = {}) {
    this.config = {
      horizontalAccelThreshold: 2.0, // m/s² - reasonable for car launch detection
      verticalAccelLimit: 3.0, // m/s² - ignore if too much vertical movement
      speedThreshold: 3.0, // km/h - must be nearly stationary
      sustainedDurationMs: 250, // 250ms of sustained acceleration
      samplingRateHz: 60,
      enableFiltering: true,
      ...config
    };
  }

  /**
   * Process new acceleration and speed data
   * Returns true if launch is detected
   */
  processData(acceleration: AccelerationData, currentSpeedKmh: number): boolean {
    const now = Date.now();
    
    // Ensure minimum time between samples
    const minIntervalMs = 1000 / this.config.samplingRateHz;
    if (now - this.lastProcessedTime < minIntervalMs) {
      return this.isLaunchDetected;
    }
    this.lastProcessedTime = now;

    // Only detect launch if speed is low enough
    if (currentSpeedKmh > this.config.speedThreshold) {
      this.reset(); // Reset if we're already moving
      return false;
    }

    // Add raw data to history
    this.accelerationHistory.push(acceleration);
    
    // Apply filtering if enabled
    let processedAccel: FilteredData;
    if (this.config.enableFiltering) {
      processedAccel = IMUFilters.filterAcceleration({
        x: acceleration.x,
        y: acceleration.y,
        z: acceleration.z
      });
      this.filteredHistory.push(processedAccel);
    } else {
      processedAccel = {
        x: acceleration.x,
        y: acceleration.y,
        z: acceleration.z
      };
    }

    // Keep history manageable (last 2 seconds)
    const maxHistoryLength = this.config.samplingRateHz * 2;
    if (this.accelerationHistory.length > maxHistoryLength) {
      this.accelerationHistory.shift();
      if (this.config.enableFiltering && this.filteredHistory.length > maxHistoryLength) {
        this.filteredHistory.shift();
      }
    }

    // Check for launch conditions
    return this.checkLaunchConditions(processedAccel, currentSpeedKmh);
  }

  private checkLaunchConditions(acceleration: FilteredData, currentSpeedKmh: number): boolean {
    // Calculate horizontal acceleration magnitude (forward direction primarily)
    const horizontalAccel = Math.sqrt(acceleration.x * acceleration.x + acceleration.y * acceleration.y);
    const verticalAccel = Math.abs(acceleration.z);

    console.log('🔍 Launch detection - Horizontal:', horizontalAccel.toFixed(2), 
                'Vertical:', verticalAccel.toFixed(2), 'Speed:', currentSpeedKmh.toFixed(1));

    // Check basic thresholds
    const hasSignificantHorizontalAccel = horizontalAccel > this.config.horizontalAccelThreshold;
    const hasLowVerticalAccel = verticalAccel < this.config.verticalAccelLimit;
    const isNearStationary = currentSpeedKmh < this.config.speedThreshold;

    if (hasSignificantHorizontalAccel && hasLowVerticalAccel && isNearStationary) {
      // Start tracking sustained acceleration
      if (!this.launchStartTime) {
        this.launchStartTime = Date.now();
        console.log('🚀 Potential launch detected - checking sustained acceleration...');
      } else {
        // Check if acceleration has been sustained long enough
        const sustainedTime = Date.now() - this.launchStartTime;
        if (sustainedTime >= this.config.sustainedDurationMs && !this.isLaunchDetected) {
          this.isLaunchDetected = true;
          console.log('✅ LAUNCH CONFIRMED! Sustained acceleration for', sustainedTime, 'ms');
          return true;
        }
      }
    } else {
      // Reset launch detection if conditions not met
      this.launchStartTime = null;
    }

    return this.isLaunchDetected;
  }

  /**
   * Reset launch detection state
   */
  reset(): void {
    this.isLaunchDetected = false;
    this.launchStartTime = null;
    this.accelerationHistory = [];
    this.filteredHistory = [];
    console.log('🔄 Launch detector reset');
  }

  /**
   * Get current launch status
   */
  isLaunched(): boolean {
    return this.isLaunchDetected;
  }

  /**
   * Get acceleration statistics for debugging
   */
  getStats(): {
    horizontalAccel: number;
    verticalAccel: number;
    sustainedTime: number;
    sampleCount: number;
  } {
    if (this.accelerationHistory.length === 0) {
      return { horizontalAccel: 0, verticalAccel: 0, sustainedTime: 0, sampleCount: 0 };
    }

    const latest = this.config.enableFiltering 
      ? this.filteredHistory[this.filteredHistory.length - 1]
      : this.accelerationHistory[this.accelerationHistory.length - 1];

    const horizontalAccel = latest ? Math.sqrt(latest.x * latest.x + latest.y * latest.y) : 0;
    const verticalAccel = latest ? Math.abs(latest.z) : 0;
    const sustainedTime = this.launchStartTime ? Date.now() - this.launchStartTime : 0;

    return {
      horizontalAccel,
      verticalAccel,
      sustainedTime,
      sampleCount: this.accelerationHistory.length
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<LaunchDetectionConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('🔧 Launch detector config updated:', this.config);
  }
}
