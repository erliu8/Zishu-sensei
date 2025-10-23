/**
 * 文件处理相关工具函数
 */

/**
 * 获取文件扩展名
 * @param filename - 文件名
 * @returns 扩展名（不含点号）
 * @example
 * getFileExtension('image.jpg') // 'jpg'
 * getFileExtension('archive.tar.gz') // 'gz'
 */
export function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * 获取文件名（不含扩展名）
 * @param filename - 文件名
 * @returns 文件名（不含扩展名）
 * @example
 * getFileName('image.jpg') // 'image'
 */
export function getFileName(filename: string): string {
  const lastDotIndex = filename.lastIndexOf('.');
  return lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
}

/**
 * 验证文件类型
 * @param file - File 对象
 * @param allowedTypes - 允许的 MIME 类型数组
 * @returns 是否为允许的类型
 * @example
 * validateFileType(file, ['image/jpeg', 'image/png']) // true/false
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.includes(file.type);
}

/**
 * 验证文件大小
 * @param file - File 对象
 * @param maxSizeInMB - 最大文件大小（MB）
 * @returns 是否符合大小限制
 * @example
 * validateFileSize(file, 5) // true/false (文件是否小于5MB)
 */
export function validateFileSize(file: File, maxSizeInMB: number): boolean {
  const maxSizeInBytes = maxSizeInMB * 1024 * 1024;
  return file.size <= maxSizeInBytes;
}

/**
 * 读取文件为 Data URL
 * @param file - File 对象
 * @returns Promise<Data URL>
 */
export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 读取文件为文本
 * @param file - File 对象
 * @param encoding - 编码，默认为 'UTF-8'
 * @returns Promise<文本内容>
 */
export function readFileAsText(file: File, encoding: string = 'UTF-8'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file, encoding);
  });
}

/**
 * 读取文件为 ArrayBuffer
 * @param file - File 对象
 * @returns Promise<ArrayBuffer>
 */
export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * 下载文件
 * @param data - 文件数据（Blob 或 URL）
 * @param filename - 文件名
 */
export function downloadFile(data: Blob | string, filename: string): void {
  const url = typeof data === 'string' ? data : URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (typeof data !== 'string') {
    URL.revokeObjectURL(url);
  }
}

/**
 * 将 Base64 转换为 Blob
 * @param base64 - Base64 字符串
 * @param contentType - 内容类型
 * @returns Blob 对象
 */
export function base64ToBlob(base64: string, contentType: string = ''): Blob {
  const byteCharacters = atob(base64.split(',')[1] || base64);
  const byteArrays: Uint8Array[] = [];

  for (let offset = 0; offset < byteCharacters.length; offset += 512) {
    const slice = byteCharacters.slice(offset, offset + 512);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: contentType });
}

/**
 * 压缩图片
 * @param file - 图片文件
 * @param maxWidth - 最大宽度
 * @param maxHeight - 最大高度
 * @param quality - 质量 (0-1)
 * @returns Promise<压缩后的 Blob>
 */
export function compressImage(
  file: File,
  maxWidth: number = 1920,
  maxHeight: number = 1080,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法获取 Canvas 上下文'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('图片压缩失败'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = reject;
      img.src = e.target?.result as string;
    };

    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * 判断是否为图片文件
 * @param file - File 对象或文件名
 * @returns 是否为图片
 */
export function isImageFile(file: File | string): boolean {
  if (typeof file === 'string') {
    const ext = getFileExtension(file);
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
  }
  return file.type.startsWith('image/');
}

/**
 * 判断是否为视频文件
 * @param file - File 对象或文件名
 * @returns 是否为视频
 */
export function isVideoFile(file: File | string): boolean {
  if (typeof file === 'string') {
    const ext = getFileExtension(file);
    return ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'].includes(ext);
  }
  return file.type.startsWith('video/');
}

/**
 * 判断是否为音频文件
 * @param file - File 对象或文件名
 * @returns 是否为音频
 */
export function isAudioFile(file: File | string): boolean {
  if (typeof file === 'string') {
    const ext = getFileExtension(file);
    return ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext);
  }
  return file.type.startsWith('audio/');
}

