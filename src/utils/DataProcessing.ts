// Data processing utilities for signal filtering and outlier detection

export interface DataPoint {
  time: number;
  speed: number;
}

/**
 * Savitzky-Golay filter for smoothing GPS noise while preserving acceleration characteristics
 * Uses a 5-point quadratic/cubic polynomial fit
 */
export class SavitzkyGolayFilter {
  private readonly coefficients: number[][];
  
  constructor() {
    // Pre-computed coefficients for 5-point quadratic Savitzky-Golay filter
    this.coefficients = [
      [-3, 12, 17, 12, -3], // For first point
      [5, 20, 35, 20, 5],   // For normal points (divided by 35)
      [-3, 12, 17, 12, -3], // For last point
    ];
  }

  filter(data: DataPoint[]): DataPoint[] {
    if (data.length < 5) return data;

    const filtered: DataPoint[] = [];
    
    for (let i = 0; i < data.length; i++) {
      let smoothedSpeed = 0;
      let coeffSum = 0;

      if (i < 2) {
        // Use forward difference for first few points
        const windowStart = 0;
        const coeffs = this.coefficients[0];
        for (let j = 0; j < 5 && j < data.length; j++) {
          smoothedSpeed += coeffs[j] * data[windowStart + j].speed;
          coeffSum += coeffs[j];
        }
      } else if (i >= data.length - 2) {
        // Use backward difference for last few points
        const windowStart = Math.max(0, data.length - 5);
        const coeffs = this.coefficients[2];
        for (let j = 0; j < 5 && windowStart + j < data.length; j++) {
          smoothedSpeed += coeffs[j] * data[windowStart + j].speed;
          coeffSum += coeffs[j];
        }
      } else {
        // Use centered difference for middle points
        const coeffs = this.coefficients[1];
        for (let j = -2; j <= 2; j++) {
          smoothedSpeed += coeffs[j + 2] * data[i + j].speed;
        }
        coeffSum = 35; // Sum of normal coefficients
      }

      filtered.push({
        time: data[i].time,
        speed: smoothedSpeed / coeffSum
      });
    }

    return filtered;
  }
}

/**
 * Outlier detection using Modified Z-Score method
 */
export class OutlierDetector {
  private readonly threshold: number;

  constructor(threshold: number = 3.5) {
    this.threshold = threshold;
  }

  private median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private medianAbsoluteDeviation(values: number[]): number {
    const med = this.median(values);
    const deviations = values.map(v => Math.abs(v - med));
    return this.median(deviations);
  }

  detectOutliers(data: DataPoint[]): boolean[] {
    const speeds = data.map(d => d.speed);
    const mad = this.medianAbsoluteDeviation(speeds);
    const median = this.median(speeds);

    if (mad === 0) return new Array(data.length).fill(false);

    return speeds.map(speed => {
      const modifiedZScore = 0.6745 * (speed - median) / mad;
      return Math.abs(modifiedZScore) > this.threshold;
    });
  }

  removeOutliers(data: DataPoint[]): DataPoint[] {
    const outliers = this.detectOutliers(data);
    return data.filter((_, index) => !outliers[index]);
  }
}

/**
 * Multi-pass interpolation with different parameters for robustness
 */
export class MultiPassInterpolator {
  findTimeForSpeed(data: DataPoint[], targetSpeed: number): number | null {
    if (data.length < 2) return null;

    // First pass: Remove outliers
    const outlierDetector = new OutlierDetector(3.0);
    const cleanedData = outlierDetector.removeOutliers(data);

    if (cleanedData.length < 2) return null;

    // Second pass: Apply Savitzky-Golay smoothing
    const filter = new SavitzkyGolayFilter();
    const smoothedData = filter.filter(cleanedData);

    // Third pass: Multiple interpolation attempts with different methods
    const results: number[] = [];

    // Method 1: Linear interpolation between adjacent points
    for (let i = 0; i < smoothedData.length - 1; i++) {
      const current = smoothedData[i];
      const next = smoothedData[i + 1];

      if (
        (current.speed <= targetSpeed && next.speed >= targetSpeed) ||
        (current.speed >= targetSpeed && next.speed <= targetSpeed)
      ) {
        if (Math.abs(next.speed - current.speed) < 0.1) continue; // Skip near-constant sections
        
        const ratio = (targetSpeed - current.speed) / (next.speed - current.speed);
        const interpolatedTime = current.time + ratio * (next.time - current.time);
        results.push(interpolatedTime);
      }
    }

    // Method 2: Polynomial fit (if we have enough points)
    if (smoothedData.length >= 4) {
      try {
        const polynomialResult = this.polynomialInterpolation(smoothedData, targetSpeed);
        if (polynomialResult !== null) {
          results.push(polynomialResult);
        }
      } catch (error) {
        console.warn('Polynomial interpolation failed:', error);
      }
    }

    // Return median of results for robustness
    if (results.length === 0) return null;
    
    results.sort((a, b) => a - b);
    const median = results.length % 2 === 0
      ? (results[results.length / 2 - 1] + results[results.length / 2]) / 2
      : results[Math.floor(results.length / 2)];

    return median;
  }

  private polynomialInterpolation(data: DataPoint[], targetSpeed: number): number | null {
    // Simple quadratic fit for speed vs time
    if (data.length < 3) return null;

    // Find a good subset around the target speed
    let startIdx = 0;
    let endIdx = data.length - 1;

    for (let i = 0; i < data.length; i++) {
      if (data[i].speed >= targetSpeed * 0.8) {
        startIdx = Math.max(0, i - 2);
        break;
      }
    }

    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i].speed <= targetSpeed * 1.2) {
        endIdx = Math.min(data.length - 1, i + 2);
        break;
      }
    }

    const subset = data.slice(startIdx, endIdx + 1);
    if (subset.length < 3) return null;

    // Fit quadratic polynomial: speed = at² + bt + c
    const n = subset.length;
    let sumT = 0, sumT2 = 0, sumT3 = 0, sumT4 = 0;
    let sumS = 0, sumST = 0, sumST2 = 0;

    for (const point of subset) {
      const t = point.time;
      const s = point.speed;
      sumT += t;
      sumT2 += t * t;
      sumT3 += t * t * t;
      sumT4 += t * t * t * t;
      sumS += s;
      sumST += s * t;
      sumST2 += s * t * t;
    }

    // Solve the system of equations
    const A = [
      [n, sumT, sumT2],
      [sumT, sumT2, sumT3],
      [sumT2, sumT3, sumT4]
    ];
    const B = [sumS, sumST, sumST2];

    const coeffs = this.solveLinearSystem(A, B);
    if (!coeffs) return null;

    const [c, b, a] = coeffs;

    // Solve quadratic equation: at² + bt + c = targetSpeed
    // at² + bt + (c - targetSpeed) = 0
    const discriminant = b * b - 4 * a * (c - targetSpeed);
    
    if (discriminant < 0) return null;

    const t1 = (-b + Math.sqrt(discriminant)) / (2 * a);
    const t2 = (-b - Math.sqrt(discriminant)) / (2 * a);

    // Choose the solution within our time range
    const minTime = subset[0].time;
    const maxTime = subset[subset.length - 1].time;

    if (t1 >= minTime && t1 <= maxTime) return t1;
    if (t2 >= minTime && t2 <= maxTime) return t2;

    return null;
  }

  private solveLinearSystem(A: number[][], B: number[]): number[] | null {
    const n = A.length;
    
    // Gaussian elimination with partial pivoting
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) {
          maxRow = k;
        }
      }

      // Swap rows
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [B[i], B[maxRow]] = [B[maxRow], B[i]];

      // Make all rows below this one 0 in current column
      for (let k = i + 1; k < n; k++) {
        if (Math.abs(A[i][i]) < 1e-10) return null; // Singular matrix
        
        const factor = A[k][i] / A[i][i];
        B[k] -= factor * B[i];
        for (let j = i; j < n; j++) {
          A[k][j] -= factor * A[i][j];
        }
      }
    }

    // Back substitution
    const solution: number[] = new Array(n);
    for (let i = n - 1; i >= 0; i--) {
      solution[i] = B[i];
      for (let j = i + 1; j < n; j++) {
        solution[i] -= A[i][j] * solution[j];
      }
      if (Math.abs(A[i][i]) < 1e-10) return null;
      solution[i] /= A[i][i];
    }

    return solution;
  }
}