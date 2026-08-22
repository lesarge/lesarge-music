import { FilterState, HistogramDataPoint, DominantColor } from '../types';

export const DEFAULT_FILTER_STATE: FilterState = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  hue: 0,
  gamma: 1.0,
  blur: 0,
  sharpen: 0,
  edgeDetection: 'none',
  threshold: 0,
  grayscale: false,
  sepia: false,
  invert: false,
  pixelate: 1,
  noise: 0,
  redChannel: 100,
  greenChannel: 100,
  blueChannel: 100,
};

export function applyFiltersToCanvas(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  filters: FilterState
) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  if (width === 0 || height === 0) return;

  targetCanvas.width = width;
  targetCanvas.height = height;

  const targetCtx = targetCanvas.getContext('2d', { willReadFrequently: true });
  if (!targetCtx) return;

  // Draw initial image
  targetCtx.drawImage(sourceCanvas, 0, 0);

  // Apply Pixelation if > 1
  if (filters.pixelate > 1) {
    const pSize = Math.max(2, Math.floor(filters.pixelate));
    const wSmall = Math.max(1, Math.floor(width / pSize));
    const hSmall = Math.max(1, Math.floor(height / pSize));

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = wSmall;
    tempCanvas.height = hSmall;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx) {
      tempCtx.imageSmoothingEnabled = false;
      tempCtx.drawImage(sourceCanvas, 0, 0, wSmall, hSmall);

      targetCtx.imageSmoothingEnabled = false;
      targetCtx.clearRect(0, 0, width, height);
      targetCtx.drawImage(tempCanvas, 0, 0, wSmall, hSmall, 0, 0, width, height);
    }
  }

  // Get ImageData for pixel manipulations
  const imageData = targetCtx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const len = data.length;

  // Precompute LUTs & Constants
  const brightAdj = filters.brightness * 2.55; // -255 to 255
  const contrastFactor = (259 * (filters.contrast + 255)) / (255 * (259 - filters.contrast));
  const gammaExp = 1 / Math.max(0.1, filters.gamma);
  const radHue = (filters.hue * Math.PI) / 180;
  const cosHue = Math.cos(radHue);
  const sinHue = Math.sin(radHue);

  const satMult = (filters.saturation + 100) / 100;
  const rMult = filters.redChannel / 100;
  const gMult = filters.greenChannel / 100;
  const bMult = filters.blueChannel / 100;

  for (let i = 0; i < len; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // 1. Channel Multipliers
    r *= rMult;
    g *= gMult;
    b *= bMult;

    // 2. Brightness & Contrast
    r = contrastFactor * (r + brightAdj - 128) + 128;
    g = contrastFactor * (g + brightAdj - 128) + 128;
    b = contrastFactor * (b + brightAdj - 128) + 128;

    // 3. Gamma
    if (filters.gamma !== 1.0) {
      r = 255 * Math.pow(Math.max(0, r) / 255, gammaExp);
      g = 255 * Math.pow(Math.max(0, g) / 255, gammaExp);
      b = 255 * Math.pow(Math.max(0, b) / 255, gammaExp);
    }

    // 4. Hue & Saturation
    if (filters.hue !== 0) {
      // Matrix transformation for Hue rotation
      const newR = r * (0.213 + cosHue * 0.787 - sinHue * 0.213) +
                   g * (0.715 - cosHue * 0.715 - sinHue * 0.715) +
                   b * (0.072 - cosHue * 0.072 + sinHue * 0.928);
      const newG = r * (0.213 - cosHue * 0.213 + sinHue * 0.143) +
                   g * (0.715 + cosHue * 0.285 + sinHue * 0.140) +
                   b * (0.072 - cosHue * 0.072 - sinHue * 0.283);
      const newB = r * (0.213 - cosHue * 0.213 - sinHue * 0.787) +
                   g * (0.715 - cosHue * 0.715 + sinHue * 0.715) +
                   b * (0.072 + cosHue * 0.928 + sinHue * 0.072);
      r = newR;
      g = newG;
      b = newB;
    }

    if (filters.saturation !== 0) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      r = lum + (r - lum) * satMult;
      g = lum + (g - lum) * satMult;
      b = lum + (b - lum) * satMult;
    }

    // 5. Grayscale or Sepia
    if (filters.grayscale) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;
      r = gray;
      g = gray;
      b = gray;
    } else if (filters.sepia) {
      const sr = r * 0.393 + g * 0.769 + b * 0.189;
      const sg = r * 0.349 + g * 0.686 + b * 0.168;
      const sb = r * 0.272 + g * 0.534 + b * 0.131;
      r = sr;
      g = sg;
      b = sb;
    }

    // 6. Invert
    if (filters.invert) {
      r = 255 - r;
      g = 255 - g;
      b = 255 - b;
    }

    // 7. Threshold / Binarization
    if (filters.threshold > 0) {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const val = lum >= filters.threshold ? 255 : 0;
      r = val;
      g = val;
      b = val;
    }

    // 8. Noise
    if (filters.noise > 0) {
      const n = (Math.random() - 0.5) * filters.noise * 2.55;
      r += n;
      g += n;
      b += n;
    }

    // Clamp
    data[i] = Math.min(255, Math.max(0, r));
    data[i + 1] = Math.min(255, Math.max(0, g));
    data[i + 2] = Math.min(255, Math.max(0, b));
  }

  targetCtx.putImageData(imageData, 0, 0);

  // 9. Convolution Filters (Sharpen, Edge Detection, Blur)
  if (filters.sharpen > 0 || filters.edgeDetection !== 'none' || filters.blur > 0) {
    applyConvolutions(targetCtx, width, height, filters);
  }
}

function applyConvolutions(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  filters: FilterState
) {
  const srcImageData = ctx.getImageData(0, 0, width, height);
  const src = srcImageData.data;
  const dstImageData = ctx.createImageData(width, height);
  const dst = dstImageData.data;

  // Edge detection overrides sharpen
  if (filters.edgeDetection !== 'none') {
    if (filters.edgeDetection === 'sobel') {
      const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let rx = 0, gxVal = 0, bx = 0;
          let ry = 0, gyVal = 0, by = 0;

          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4;
              const wX = gx[(ky + 1) * 3 + (kx + 1)];
              const wY = gy[(ky + 1) * 3 + (kx + 1)];

              rx += src[idx] * wX;
              gxVal += src[idx + 1] * wX;
              bx += src[idx + 2] * wX;

              ry += src[idx] * wY;
              gyVal += src[idx + 1] * wY;
              by += src[idx + 2] * wY;
            }
          }

          const dstIdx = (y * width + x) * 4;
          const magR = Math.sqrt(rx * rx + ry * ry);
          const magG = Math.sqrt(gxVal * gxVal + gyVal * gyVal);
          const magB = Math.sqrt(bx * bx + by * by);

          dst[dstIdx] = Math.min(255, magR);
          dst[dstIdx + 1] = Math.min(255, magG);
          dst[dstIdx + 2] = Math.min(255, magB);
          dst[dstIdx + 3] = 255;
        }
      }
    } else if (filters.edgeDetection === 'laplacian') {
      const k = [0, 1, 0, 1, -4, 1, 0, 1, 0];
      convolveKernel(src, dst, width, height, k, 1);
    } else if (filters.edgeDetection === 'prewitt') {
      const gx = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
      const gy = [-1, -1, -1, 0, 0, 0, 1, 1, 1];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let rx = 0, ry = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const idx = ((y + ky) * width + (x + kx)) * 4;
              const lum = 0.299 * src[idx] + 0.587 * src[idx + 1] + 0.114 * src[idx + 2];
              rx += lum * gx[(ky + 1) * 3 + (kx + 1)];
              ry += lum * gy[(ky + 1) * 3 + (kx + 1)];
            }
          }
          const mag = Math.min(255, Math.sqrt(rx * rx + ry * ry));
          const dstIdx = (y * width + x) * 4;
          dst[dstIdx] = mag;
          dst[dstIdx + 1] = mag;
          dst[dstIdx + 2] = mag;
          dst[dstIdx + 3] = 255;
        }
      }
    }
    ctx.putImageData(dstImageData, 0, 0);
    return;
  }

  // Sharpening Kernel
  if (filters.sharpen > 0) {
    const factor = filters.sharpen / 5;
    const k = [0, -factor, 0, -factor, 1 + 4 * factor, -factor, 0, -factor, 0];
    convolveKernel(src, dst, width, height, k, 1);
    ctx.putImageData(dstImageData, 0, 0);
  }
}

function convolveKernel(
  src: Uint8ClampedArray,
  dst: Uint8ClampedArray,
  width: number,
  height: number,
  kernel: number[],
  divisor: number = 1
) {
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let r = 0, g = 0, b = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const w = kernel[(ky + 1) * 3 + (kx + 1)];
          r += src[idx] * w;
          g += src[idx + 1] * w;
          b += src[idx + 2] * w;
        }
      }

      const dstIdx = (y * width + x) * 4;
      dst[dstIdx] = Math.min(255, Math.max(0, r / divisor));
      dst[dstIdx + 1] = Math.min(255, Math.max(0, g / divisor));
      dst[dstIdx + 2] = Math.min(255, Math.max(0, b / divisor));
      dst[dstIdx + 3] = src[dstIdx + 3];
    }
  }
}

// Calculate 32-bin downsampled histogram for Recharts
export function calculateHistogramData(canvas: HTMLCanvasElement): HistogramDataPoint[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) return [];

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  const numBins = 32;
  const redBins = new Array(numBins).fill(0);
  const greenBins = new Array(numBins).fill(0);
  const blueBins = new Array(numBins).fill(0);
  const lumBins = new Array(numBins).fill(0);

  // Subsample every 4th pixel for speed
  const step = 4 * 4;
  for (let i = 0; i < data.length; i += step) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;

    const rBin = Math.min(numBins - 1, Math.floor((r / 256) * numBins));
    const gBin = Math.min(numBins - 1, Math.floor((g / 256) * numBins));
    const bBin = Math.min(numBins - 1, Math.floor((b / 256) * numBins));
    const lBin = Math.min(numBins - 1, Math.floor((lum / 256) * numBins));

    redBins[rBin]++;
    greenBins[gBin]++;
    blueBins[bBin]++;
    lumBins[lBin]++;
  }

  const result: HistogramDataPoint[] = [];
  for (let b = 0; b < numBins; b++) {
    result.push({
      bin: b * 8, // intensity scale 0..255
      red: redBins[b],
      green: greenBins[b],
      blue: blueBins[b],
      luminance: lumBins[b],
    });
  }

  return result;
}

// Fast Dominant Color Extraction
export function extractDominantColors(canvas: HTMLCanvasElement, count: number = 5): DominantColor[] {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || canvas.width === 0 || canvas.height === 0) return [];

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Simple color quantization bucket map
  const colorBuckets: { [key: string]: { rgb: [number, number, number]; count: number } } = {};
  let totalSamples = 0;

  const step = 4 * 16; // Sample every 16th pixel
  for (let i = 0; i < data.length; i += step) {
    // Quantize RGB to 32-level steps
    const r = Math.round(data[i] / 32) * 32;
    const g = Math.round(data[i + 1] / 32) * 32;
    const b = Math.round(data[i + 2] / 32) * 32;

    const key = `${r},${g},${b}`;
    if (!colorBuckets[key]) {
      colorBuckets[key] = { rgb: [r, g, b], count: 0 };
    }
    colorBuckets[key].count++;
    totalSamples++;
  }

  const sortedBuckets = Object.values(colorBuckets).sort((a, b) => b.count - a.count);
  const topBuckets = sortedBuckets.slice(0, count);

  return topBuckets.map((bucket) => {
    const [r, g, b] = bucket.rgb;
    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    return {
      hex,
      rgb: bucket.rgb,
      percentage: Math.round((bucket.count / totalSamples) * 100),
    };
  });
}

// Python Code Exporter
export function generatePythonScript(filters: FilterState): string {
  const codeLines: string[] = [
    '# VisionLab AI - Automated Python Image Pipeline',
    '# Dependencies: Pillow, numpy, opencv-python',
    'from PIL import Image, ImageEnhance, ImageOps, ImageFilter',
    'import numpy as np',
    'import cv2',
    '',
    'def process_image(input_path: str, output_path: str):',
    '    # Load image',
    '    img = Image.open(input_path).convert("RGB")',
    '',
  ];

  if (filters.redChannel !== 100 || filters.greenChannel !== 100 || filters.blueChannel !== 100) {
    codeLines.push('    # Channel Multipliers');
    codeLines.push('    img_np = np.array(img).astype(np.float32)');
    codeLines.push(
      `    img_np[:, :, 0] *= ${filters.redChannel / 100}`
    );
    codeLines.push(
      `    img_np[:, :, 1] *= ${filters.greenChannel / 100}`
    );
    codeLines.push(
      `    img_np[:, :, 2] *= ${filters.blueChannel / 100}`
    );
    codeLines.push('    img_np = np.clip(img_np, 0, 255).astype(np.uint8)');
    codeLines.push('    img = Image.fromarray(img_np)');
    codeLines.push('');
  }

  if (filters.brightness !== 0) {
    const factor = 1 + filters.brightness / 100;
    codeLines.push(`    # Brightness adjustment (${filters.brightness}%)`);
    codeLines.push(`    enhancer = ImageEnhance.Brightness(img)`);
    codeLines.push(`    img = enhancer.enhance(${factor.toFixed(2)})`);
  }

  if (filters.contrast !== 0) {
    const factor = 1 + filters.contrast / 100;
    codeLines.push(`    # Contrast adjustment (${filters.contrast}%)`);
    codeLines.push(`    enhancer = ImageEnhance.Contrast(img)`);
    codeLines.push(`    img = enhancer.enhance(${factor.toFixed(2)})`);
  }

  if (filters.saturation !== 0) {
    const factor = 1 + filters.saturation / 100;
    codeLines.push(`    # Saturation adjustment (${filters.saturation}%)`);
    codeLines.push(`    enhancer = ImageEnhance.Color(img)`);
    codeLines.push(`    img = enhancer.enhance(${factor.toFixed(2)})`);
  }

  if (filters.grayscale) {
    codeLines.push('    # Convert to Grayscale');
    codeLines.push('    img = ImageOps.grayscale(img).convert("RGB")');
  } else if (filters.sepia) {
    codeLines.push('    # Sepia Filter');
    codeLines.push('    img_np = np.array(img)');
    codeLines.push('    r, g, b = img_np[:,:,0], img_np[:,:,1], img_np[:,:,2]');
    codeLines.push('    sr = np.clip(r*0.393 + g*0.769 + b*0.189, 0, 255)');
    codeLines.push('    sg = np.clip(r*0.349 + g*0.686 + b*0.168, 0, 255)');
    codeLines.push('    sb = np.clip(r*0.272 + g*0.534 + b*0.131, 0, 255)');
    codeLines.push('    img_np = np.stack([sr, sg, sb], axis=-1).astype(np.uint8)');
    codeLines.push('    img = Image.fromarray(img_np)');
  }

  if (filters.edgeDetection === 'sobel') {
    codeLines.push('    # Sobel Edge Detection via OpenCV');
    codeLines.push('    gray = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)');
    codeLines.push('    sobelx = cv2.Sobel(gray, cv2.CV_64F, 1, 0, ksize=3)');
    codeLines.push('    sobely = cv2.Sobel(gray, cv2.CV_64F, 0, 1, ksize=3)');
    codeLines.push('    magnitude = cv2.magnitude(sobelx, sobely)');
    codeLines.push('    edges = np.clip(magnitude, 0, 255).astype(np.uint8)');
    codeLines.push('    img = Image.fromarray(cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB))');
  } else if (filters.edgeDetection === 'laplacian') {
    codeLines.push('    # Laplacian Edge Filter');
    codeLines.push('    gray = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2GRAY)');
    codeLines.push('    lap = cv2.Laplacian(gray, cv2.CV_64F)');
    codeLines.push('    edges = np.clip(np.abs(lap), 0, 255).astype(np.uint8)');
    codeLines.push('    img = Image.fromarray(cv2.cvtColor(edges, cv2.COLOR_GRAY2RGB))');
  }

  if (filters.sharpen > 0) {
    codeLines.push(`    # Sharpen Kernel`);
    codeLines.push('    img = img.filter(ImageFilter.SHARPEN)');
  }

  if (filters.threshold > 0) {
    codeLines.push(`    # Binarization / Threshold (${filters.threshold})`);
    codeLines.push(`    fn = lambda p: 255 if p > ${filters.threshold} else 0`);
    codeLines.push('    img = img.convert("L").point(fn, mode="1").convert("RGB")');
  }

  codeLines.push('');
  codeLines.push('    # Save output');
  codeLines.push('    img.save(output_path)');
  codeLines.push('    print(f"Processed image saved to {output_path}")');
  codeLines.push('');
  codeLines.push('if __name__ == "__main__":');
  codeLines.push('    process_image("sample_input.jpg", "processed_output.jpg")');

  return codeLines.join('\n');
}
