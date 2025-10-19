/**
 * 颜色工具函数
 * 
 * 提供颜色格式转换、颜色计算等功能：
 * - HEX ↔ RGB ↔ HSL ↔ HSV 转换
 * - 颜色亮度计算
 * - 颜色对比度计算
 * - 颜色混合
 * - 颜色调整（变亮、变暗、饱和度调整等）
 */

import type { ColorPickerValue, ColorConfig } from '@/types/theme'

/**
 * 将 HEX 颜色转换为 RGB
 * @param hex HEX颜色值 (#rrggbb 或 #rgb)
 * @returns RGB对象 {r, g, b}
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    // 移除 # 前缀
    const cleaned = hex.replace(/^#/, '')
    
    // 处理简写形式 (#rgb)
    const expanded = cleaned.length === 3
        ? cleaned.split('').map(c => c + c).join('')
        : cleaned
    
    // 验证格式
    if (!/^[0-9A-Fa-f]{6}$/.test(expanded)) {
        return null
    }
    
    const r = parseInt(expanded.slice(0, 2), 16)
    const g = parseInt(expanded.slice(2, 4), 16)
    const b = parseInt(expanded.slice(4, 6), 16)
    
    return { r, g, b }
}

/**
 * 将 RGB 颜色转换为 HEX
 * @param r 红色值 (0-255)
 * @param g 绿色值 (0-255)
 * @param b 蓝色值 (0-255)
 * @returns HEX颜色值
 */
export function rgbToHex(r: number, g: number, b: number): string {
    const toHex = (n: number) => {
        const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16)
        return hex.length === 1 ? '0' + hex : hex
    }
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * 将 RGB 颜色转换为 HSL
 * @param r 红色值 (0-255)
 * @param g 绿色值 (0-255)
 * @param b 蓝色值 (0-255)
 * @returns HSL对象 {h, s, l}
 */
export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255
    g /= 255
    b /= 255
    
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0
    let s = 0
    const l = (max + min) / 2
    
    if (max !== min) {
        const d = max - min
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
        
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6
                break
            case g:
                h = ((b - r) / d + 2) / 6
                break
            case b:
                h = ((r - g) / d + 4) / 6
                break
        }
    }
    
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100)
    }
}

/**
 * 将 HSL 颜色转换为 RGB
 * @param h 色相 (0-360)
 * @param s 饱和度 (0-100)
 * @param l 亮度 (0-100)
 * @returns RGB对象 {r, g, b}
 */
export function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    h = h / 360
    s = s / 100
    l = l / 100
    
    let r: number, g: number, b: number
    
    if (s === 0) {
        r = g = b = l
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1
            if (t > 1) t -= 1
            if (t < 1/6) return p + (q - p) * 6 * t
            if (t < 1/2) return q
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
            return p
        }
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s
        const p = 2 * l - q
        
        r = hue2rgb(p, q, h + 1/3)
        g = hue2rgb(p, q, h)
        b = hue2rgb(p, q, h - 1/3)
    }
    
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    }
}

/**
 * 将 RGB 颜色转换为 HSV
 * @param r 红色值 (0-255)
 * @param g 绿色值 (0-255)
 * @param b 蓝色值 (0-255)
 * @returns HSV对象 {h, s, v}
 */
export function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
    r /= 255
    g /= 255
    b /= 255
    
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const d = max - min
    let h = 0
    const s = max === 0 ? 0 : d / max
    const v = max
    
    if (max !== min) {
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6
                break
            case g:
                h = ((b - r) / d + 2) / 6
                break
            case b:
                h = ((r - g) / d + 4) / 6
                break
        }
    }
    
    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        v: Math.round(v * 100)
    }
}

/**
 * 将 HSV 颜色转换为 RGB
 * @param h 色相 (0-360)
 * @param s 饱和度 (0-100)
 * @param v 明度 (0-100)
 * @returns RGB对象 {r, g, b}
 */
export function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
    h = h / 360
    s = s / 100
    v = v / 100
    
    const i = Math.floor(h * 6)
    const f = h * 6 - i
    const p = v * (1 - s)
    const q = v * (1 - f * s)
    const t = v * (1 - (1 - f) * s)
    
    let r: number, g: number, b: number
    
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break
        case 1: r = q; g = v; b = p; break
        case 2: r = p; g = v; b = t; break
        case 3: r = p; g = q; b = v; break
        case 4: r = t; g = p; b = v; break
        case 5: r = v; g = p; b = q; break
        default: r = g = b = 0
    }
    
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    }
}

/**
 * 将 HEX 颜色转换为 HSL
 */
export function hexToHsl(hex: string): { h: number; s: number; l: number } | null {
    const rgb = hexToRgb(hex)
    if (!rgb) return null
    return rgbToHsl(rgb.r, rgb.g, rgb.b)
}

/**
 * 将 HSL 颜色转换为 HEX
 */
export function hslToHex(h: number, s: number, l: number): string {
    const rgb = hslToRgb(h, s, l)
    return rgbToHex(rgb.r, rgb.g, rgb.b)
}

/**
 * 解析颜色字符串为统一格式
 * @param color 颜色字符串（支持 hex, rgb, hsl 格式）
 * @returns ColorPickerValue 对象或 null
 */
export function parseColor(color: string): ColorPickerValue | null {
    // 移除空格
    color = color.trim()
    
    // HEX 格式
    if (color.startsWith('#')) {
        const rgb = hexToRgb(color)
        if (!rgb) return null
        
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
        
        return {
            hex: color,
            rgb,
            hsl,
            hsv,
            alpha: 1
        }
    }
    
    // RGB 格式: rgb(r, g, b) 或 rgba(r, g, b, a)
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1])
        const g = parseInt(rgbMatch[2])
        const b = parseInt(rgbMatch[3])
        const alpha = rgbMatch[4] ? parseFloat(rgbMatch[4]) : 1
        
        const hex = rgbToHex(r, g, b)
        const hsl = rgbToHsl(r, g, b)
        const hsv = rgbToHsv(r, g, b)
        
        return {
            hex,
            rgb: { r, g, b },
            hsl,
            hsv,
            alpha
        }
    }
    
    // HSL 格式: hsl(h, s%, l%) 或 hsla(h, s%, l%, a)
    const hslMatch = color.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%(?:,\s*([\d.]+))?\)/)
    if (hslMatch) {
        const h = parseInt(hslMatch[1])
        const s = parseInt(hslMatch[2])
        const l = parseInt(hslMatch[3])
        const alpha = hslMatch[4] ? parseFloat(hslMatch[4]) : 1
        
        const rgb = hslToRgb(h, s, l)
        const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
        const hsv = rgbToHsv(rgb.r, rgb.g, rgb.b)
        
        return {
            hex,
            rgb,
            hsl: { h, s, l },
            hsv,
            alpha
        }
    }
    
    return null
}

/**
 * 格式化颜色为字符串
 */
export function formatColor(color: ColorPickerValue, format: 'hex' | 'rgb' | 'hsl' = 'hex'): string {
    switch (format) {
        case 'hex':
            return color.hex
        case 'rgb':
            return color.alpha < 1
                ? `rgba(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b}, ${color.alpha})`
                : `rgb(${color.rgb.r}, ${color.rgb.g}, ${color.rgb.b})`
        case 'hsl':
            return color.alpha < 1
                ? `hsla(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%, ${color.alpha})`
                : `hsl(${color.hsl.h}, ${color.hsl.s}%, ${color.hsl.l}%)`
        default:
            return color.hex
    }
}

/**
 * 创建 ColorConfig 对象
 */
export function createColorConfig(color: ColorPickerValue | string): ColorConfig {
    const parsed = typeof color === 'string' ? parseColor(color) : color
    if (!parsed) {
        throw new Error(`Invalid color: ${color}`)
    }
    
    return {
        hex: parsed.hex,
        rgb: `${parsed.rgb.r} ${parsed.rgb.g} ${parsed.rgb.b}`,
        hsl: `${parsed.hsl.h} ${parsed.hsl.s}% ${parsed.hsl.l}%`
    }
}

/**
 * 计算颜色的相对亮度（按照 WCAG 2.0 标准）
 * @param color 颜色（HEX或RGB）
 * @returns 相对亮度 (0-1)
 */
export function getLuminance(color: string | { r: number; g: number; b: number }): number {
    let rgb: { r: number; g: number; b: number }
    
    if (typeof color === 'string') {
        const parsed = hexToRgb(color)
        if (!parsed) return 0
        rgb = parsed
    } else {
        rgb = color
    }
    
    const [r, g, b] = [rgb.r, rgb.g, rgb.b].map(c => {
        c = c / 255
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    
    return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * 计算两个颜色的对比度（按照 WCAG 2.0 标准）
 * @param color1 第一个颜色
 * @param color2 第二个颜色
 * @returns 对比度 (1-21)
 */
export function getContrast(color1: string, color2: string): number {
    const lum1 = getLuminance(color1)
    const lum2 = getLuminance(color2)
    
    const lighter = Math.max(lum1, lum2)
    const darker = Math.min(lum1, lum2)
    
    return (lighter + 0.05) / (darker + 0.05)
}

/**
 * 检查颜色对比度是否符合 WCAG AA 标准
 * @param foreground 前景色
 * @param background 背景色
 * @param largeText 是否为大文本（18pt或14pt粗体以上）
 * @returns 是否符合标准
 */
export function meetsWCAG_AA(foreground: string, background: string, largeText: boolean = false): boolean {
    const contrast = getContrast(foreground, background)
    return largeText ? contrast >= 3 : contrast >= 4.5
}

/**
 * 检查颜色对比度是否符合 WCAG AAA 标准
 */
export function meetsWCAG_AAA(foreground: string, background: string, largeText: boolean = false): boolean {
    const contrast = getContrast(foreground, background)
    return largeText ? contrast >= 4.5 : contrast >= 7
}

/**
 * 调整颜色亮度
 * @param color 颜色（HEX）
 * @param amount 调整量 (-100 到 100)，正数变亮，负数变暗
 * @returns 调整后的颜色（HEX）
 */
export function adjustBrightness(color: string, amount: number): string {
    const rgb = hexToRgb(color)
    if (!rgb) return color
    
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
    hsl.l = Math.max(0, Math.min(100, hsl.l + amount))
    
    return hslToHex(hsl.h, hsl.s, hsl.l)
}

/**
 * 调整颜色饱和度
 * @param color 颜色（HEX）
 * @param amount 调整量 (-100 到 100)
 * @returns 调整后的颜色（HEX）
 */
export function adjustSaturation(color: string, amount: number): string {
    const rgb = hexToRgb(color)
    if (!rgb) return color
    
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
    hsl.s = Math.max(0, Math.min(100, hsl.s + amount))
    
    return hslToHex(hsl.h, hsl.s, hsl.l)
}

/**
 * 旋转色相
 * @param color 颜色（HEX）
 * @param degrees 旋转角度（-360 到 360）
 * @returns 调整后的颜色（HEX）
 */
export function rotateHue(color: string, degrees: number): string {
    const rgb = hexToRgb(color)
    if (!rgb) return color
    
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
    hsl.h = (hsl.h + degrees + 360) % 360
    
    return hslToHex(hsl.h, hsl.s, hsl.l)
}

/**
 * 混合两个颜色
 * @param color1 第一个颜色（HEX）
 * @param color2 第二个颜色（HEX）
 * @param weight 混合权重 (0-1)，0表示完全使用color1，1表示完全使用color2
 * @returns 混合后的颜色（HEX）
 */
export function mixColors(color1: string, color2: string, weight: number = 0.5): string {
    const rgb1 = hexToRgb(color1)
    const rgb2 = hexToRgb(color2)
    
    if (!rgb1 || !rgb2) return color1
    
    const w = Math.max(0, Math.min(1, weight))
    const w1 = 1 - w
    const w2 = w
    
    const r = Math.round(rgb1.r * w1 + rgb2.r * w2)
    const g = Math.round(rgb1.g * w1 + rgb2.g * w2)
    const b = Math.round(rgb1.b * w1 + rgb2.b * w2)
    
    return rgbToHex(r, g, b)
}

/**
 * 生成颜色的补色
 * @param color 颜色（HEX）
 * @returns 补色（HEX）
 */
export function getComplementaryColor(color: string): string {
    return rotateHue(color, 180)
}

/**
 * 生成颜色的三元色
 * @param color 颜色（HEX）
 * @returns 三元色数组
 */
export function getTriadicColors(color: string): string[] {
    return [
        color,
        rotateHue(color, 120),
        rotateHue(color, 240)
    ]
}

/**
 * 生成颜色的类似色
 * @param color 颜色（HEX）
 * @param count 生成数量
 * @param angle 角度范围（默认30度）
 * @returns 类似色数组
 */
export function getAnalogousColors(color: string, count: number = 5, angle: number = 30): string[] {
    const colors: string[] = []
    const step = angle / Math.max(1, count - 1)
    const start = -angle / 2
    
    for (let i = 0; i < count; i++) {
        colors.push(rotateHue(color, start + step * i))
    }
    
    return colors
}

/**
 * 生成颜色渐变
 * @param startColor 起始颜色（HEX）
 * @param endColor 结束颜色（HEX）
 * @param steps 步数
 * @returns 渐变颜色数组
 */
export function generateGradient(startColor: string, endColor: string, steps: number): string[] {
    const colors: string[] = []
    
    for (let i = 0; i < steps; i++) {
        const weight = i / (steps - 1)
        colors.push(mixColors(startColor, endColor, weight))
    }
    
    return colors
}

/**
 * 判断颜色是否为深色
 * @param color 颜色（HEX）
 * @returns 是否为深色
 */
export function isDark(color: string): boolean {
    return getLuminance(color) < 0.5
}

/**
 * 判断颜色是否为浅色
 */
export function isLight(color: string): boolean {
    return !isDark(color)
}

/**
 * 获取适合文本显示的颜色（黑色或白色）
 * @param backgroundColor 背景色（HEX）
 * @returns 文本颜色（HEX）
 */
export function getTextColor(backgroundColor: string): string {
    return isDark(backgroundColor) ? '#ffffff' : '#000000'
}

/**
 * 生成随机颜色
 * @returns 随机颜色（HEX）
 */
export function randomColor(): string {
    const r = Math.floor(Math.random() * 256)
    const g = Math.floor(Math.random() * 256)
    const b = Math.floor(Math.random() * 256)
    return rgbToHex(r, g, b)
}

/**
 * 生成随机饱和度较高的颜色
 */
export function randomVibrantColor(): string {
    const h = Math.floor(Math.random() * 360)
    const s = 70 + Math.floor(Math.random() * 30) // 70-100
    const l = 40 + Math.floor(Math.random() * 20) // 40-60
    return hslToHex(h, s, l)
}

/**
 * 生成随机柔和的颜色
 */
export function randomPastelColor(): string {
    const h = Math.floor(Math.random() * 360)
    const s = 20 + Math.floor(Math.random() * 40) // 20-60
    const l = 70 + Math.floor(Math.random() * 20) // 70-90
    return hslToHex(h, s, l)
}

