/**
 * Perceptual Hash (pHash) 实现
 * 对应 Python imagehash.phash(hash_size=16)
 */

export class PHash {
  private hashSize: number;
  private dctSize: number;

  constructor(hashSize = 16) {
    this.hashSize = hashSize;
    this.dctSize = hashSize * 4; // DCT需要更大的尺寸
  }

  /**
   * 计算图像的感知哈希
   * @param imageData - 图像数据
   * @returns 十六进制哈希字符串
   */
  compute(imageData: ImageData): string {
    // 1. 转换为灰度并缩放到 dctSize x dctSize
    const gray = this.toGrayscale(imageData);
    const resized = this.resize(gray, imageData.width, imageData.height, this.dctSize, this.dctSize);

    // 2. 计算DCT
    const dct = this.dct2d(resized);

    // 3. 取左上角 hashSize x hashSize (低频部分)
    const lowFreq: number[] = [];
    for (let y = 0; y < this.hashSize; y++) {
      for (let x = 0; x < this.hashSize; x++) {
        lowFreq.push(dct[y * this.dctSize + x]);
      }
    }

    // 4. 计算中位数 (排除DC分量)
    const lowFreqNoDC = lowFreq.slice(1);
    const sorted = [...lowFreqNoDC].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];

    // 5. 生成哈希
    let hash = '';
    for (let i = 0; i < lowFreq.length; i++) {
      hash += lowFreq[i] > median ? '1' : '0';
    }

    // 6. 转换为十六进制
    return this.binaryToHex(hash);
  }

  /**
   * 转换为灰度
   */
  private toGrayscale(imageData: ImageData): Float32Array {
    const data = imageData.data;
    const gray = new Float32Array(imageData.width * imageData.height);
    for (let i = 0; i < gray.length; i++) {
      const idx = i * 4;
      // 使用标准灰度转换公式
      gray[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
    return gray;
  }

  /**
   * 双线性插值缩放
   */
  private resize(gray: Float32Array, srcW: number, srcH: number, dstW: number, dstH: number): Float32Array {
    const result = new Float32Array(dstW * dstH);
    const xRatio = srcW / dstW;
    const yRatio = srcH / dstH;

    for (let y = 0; y < dstH; y++) {
      for (let x = 0; x < dstW; x++) {
        const srcX = x * xRatio;
        const srcY = y * yRatio;
        const x1 = Math.floor(srcX);
        const y1 = Math.floor(srcY);
        const x2 = Math.min(x1 + 1, srcW - 1);
        const y2 = Math.min(y1 + 1, srcH - 1);
        const xFrac = srcX - x1;
        const yFrac = srcY - y1;

        const tl = gray[y1 * srcW + x1];
        const tr = gray[y1 * srcW + x2];
        const bl = gray[y2 * srcW + x1];
        const br = gray[y2 * srcW + x2];

        const top = tl + (tr - tl) * xFrac;
        const bottom = bl + (br - bl) * xFrac;
        result[y * dstW + x] = top + (bottom - top) * yFrac;
      }
    }
    return result;
  }

  /**
   * 2D DCT
   */
  private dct2d(data: Float32Array): Float32Array {
    const N = this.dctSize;
    const temp = new Float32Array(N * N);
    const result = new Float32Array(N * N);

    // 行DCT
    for (let y = 0; y < N; y++) {
      for (let k = 0; k < N; k++) {
        let sum = 0;
        for (let n = 0; n < N; n++) {
          sum += data[y * N + n] * Math.cos((Math.PI / N) * (n + 0.5) * k);
        }
        temp[y * N + k] = sum;
      }
    }

    // 列DCT
    for (let x = 0; x < N; x++) {
      for (let k = 0; k < N; k++) {
        let sum = 0;
        for (let n = 0; n < N; n++) {
          sum += temp[n * N + x] * Math.cos((Math.PI / N) * (n + 0.5) * k);
        }
        result[k * N + x] = sum;
      }
    }

    return result;
  }

  /**
   * 二进制字符串转十六进制
   */
  private binaryToHex(binary: string): string {
    let hex = '';
    for (let i = 0; i < binary.length; i += 4) {
      const nibble = binary.substring(i, i + 4);
      hex += parseInt(nibble, 2).toString(16);
    }
    return hex;
  }

  /**
   * 计算汉明距离
   */
  static hammingDistance(hash1: string, hash2: string): number {
    if (hash1.length !== hash2.length) {
      throw new Error('Hash length mismatch');
    }
    let distance = 0;
    for (let i = 0; i < hash1.length; i++) {
      const n1 = parseInt(hash1[i], 16);
      const n2 = parseInt(hash2[i], 16);
      let xor = n1 ^ n2;
      while (xor) {
        distance += xor & 1;
        xor >>= 1;
      }
    }
    return distance;
  }
}
