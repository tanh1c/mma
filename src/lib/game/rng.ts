export class PRNG {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Linear Congruential Generator
  next(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  randomInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  randomFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  randomItem<T>(arr: T[]): T {
    return arr[this.randomInt(0, arr.length - 1)];
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }
}
