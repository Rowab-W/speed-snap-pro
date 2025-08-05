export class ExtendedKalmanFilter {
  private x: number[]; // [speed (km/h), acceleration (m/s²)]
  private P: number[][]; // Covariance matrix
  private Q: number[][]; // Process noise
  private R: number[][]; // Measurement noise

  constructor() {
    this.x = [0, 0]; // [speed (km/h), acceleration (m/s²)]
    this.P = [[1, 0], [0, 1]]; // Initial covariance
    this.Q = [[0.005, 0], [0, 0.01]]; // Process noise
    this.R = [[0.1, 0], [0, 0.05]]; // Measurement noise
  }

  predict(dt: number): void {
    // Predict next state
    // speed += acceleration * dt * 3.6 (convert m/s to km/h)
    this.x[0] += this.x[1] * dt * 3.6;
    
    // Update covariance matrix
    this.P[0][0] += this.Q[0][0];
    this.P[1][1] += this.Q[1][1];
  }

  update(measurement: number[]): number {
    // measurement[0] = speed (km/h), measurement[1] = acceleration magnitude
    const K = [0, 0]; // Kalman gain
    const innovation = [
      measurement[0] - this.x[0], 
      measurement[1] - this.x[1]
    ];

    // Calculate Kalman gain
    K[0] = this.P[0][0] / (this.P[0][0] + this.R[0][0]);
    K[1] = this.P[1][1] / (this.P[1][1] + this.R[1][1]);

    // Update state
    this.x[0] += K[0] * innovation[0];
    this.x[1] += K[1] * innovation[1];

    // Update covariance
    this.P[0][0] *= (1 - K[0]);
    this.P[1][1] *= (1 - K[1]);

    return this.x[0]; // Return filtered speed
  }

  getState(): number[] {
    return [...this.x];
  }

  reset(): void {
    this.x = [0, 0];
    this.P = [[1, 0], [0, 1]];
  }
}