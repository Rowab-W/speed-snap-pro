export class CubicSpline {
  private x: number[];
  private y: number[];
  private n: number;
  private a: number[];
  private b: number[];
  private c: number[];
  private d: number[];

  constructor(x: number[], y: number[]) {
    this.x = [...x];
    this.y = [...y];
    this.n = x.length;
    this.a = [...y];
    this.b = new Array(this.n - 1);
    this.c = new Array(this.n).fill(0);
    this.d = new Array(this.n - 1);
    this.computeCoefficients();
  }

  private computeCoefficients(): void {
    const h = new Array(this.n - 1);
    for (let i = 0; i < this.n - 1; i++) {
      h[i] = this.x[i + 1] - this.x[i];
    }

    const alpha = new Array(this.n - 1);
    for (let i = 1; i < this.n - 1; i++) {
      alpha[i] = (3 / h[i]) * (this.a[i + 1] - this.a[i]) - (3 / h[i - 1]) * (this.a[i] - this.a[i - 1]);
    }

    const l = new Array(this.n).fill(1);
    const mu = new Array(this.n).fill(0);
    const z = new Array(this.n).fill(0);
    
    for (let i = 1; i < this.n - 1; i++) {
      l[i] = 2 * (this.x[i + 1] - this.x[i - 1]) - h[i - 1] * mu[i - 1];
      mu[i] = h[i] / l[i];
      z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
    }

    for (let j = this.n - 2; j >= 0; j--) {
      this.c[j] = z[j] - mu[j] * this.c[j + 1];
      this.b[j] = (this.a[j + 1] - this.a[j]) / h[j] - h[j] * (this.c[j + 1] + 2 * this.c[j]) / 3;
      this.d[j] = (this.c[j + 1] - this.c[j]) / (3 * h[j]);
    }
  }

  interpolate(t: number): number {
    let i = 0;
    for (i = 0; i < this.n - 1; i++) {
      if (t <= this.x[i + 1]) break;
    }
    if (i >= this.n - 1) i = this.n - 2;

    const dt = t - this.x[i];
    return (
      this.a[i] +
      this.b[i] * dt +
      this.c[i] * dt ** 2 +
      this.d[i] * dt ** 3
    );
  }

  findTime(targetSpeed: number): number {
    let left = this.x[0];
    let right = this.x[this.n - 1];
    const epsilon = 0.001;

    while (right - left > epsilon) {
      const mid = (left + right) / 2;
      const speed = this.interpolate(mid);
      if (speed < targetSpeed) {
        left = mid;
      } else {
        right = mid;
      }
    }
    return (left + right) / 2;
  }
}