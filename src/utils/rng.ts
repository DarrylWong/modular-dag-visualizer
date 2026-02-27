// Seeded PRNG using a linear congruential generator.
// Uses Math.imul for correct 32-bit multiplication to avoid
// JavaScript floating-point precision loss on large integers.
export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
    if (this.state === 0) this.state = 1;
  }

  private next(): number {
    // LCG: state = (state * 1103515245 + 12345) mod 2^31
    // Math.imul gives correct low 32 bits of integer multiplication
    this.state = (Math.imul(this.state, 1103515245) + 12345) | 0;
    return (this.state >>> 1); // unsigned shift to get positive [0, 2^30)
  }

  // Returns a random integer in [0, n)
  intn(n: number): number {
    if (n <= 0) return 0;
    return this.next() % n;
  }

  // Returns a random float in [0, 1)
  float64(): number {
    return this.next() / 0x40000000; // 2^30
  }

  // Fisher-Yates shuffle
  shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.intn(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  clone(): SeededRNG {
    const rng = new SeededRNG(0);
    rng.state = this.state;
    return rng;
  }
}
