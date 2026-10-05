export function systemRng(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
