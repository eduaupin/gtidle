declare module 'gifenc' {
  export type Palette = number[][];
  export function quantize(data: Uint8ClampedArray | Uint8Array, maxColors: number, opts?: { format?: string }): Palette;
  export function applyPalette(data: Uint8ClampedArray | Uint8Array, palette: Palette, format?: string): Uint8Array;
  export function GIFEncoder(): {
    writeFrame(index: Uint8Array, w: number, h: number, opts?: { palette?: Palette; delay?: number; repeat?: number }): void;
    finish(): void;
    bytes(): Uint8Array;
  };
}
