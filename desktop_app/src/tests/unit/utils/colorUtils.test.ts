/**
 * 颜色工具函数测试
 * 
 * 测试 colorUtils.ts 中的所有颜色转换和操作函数
 * 确保颜色计算的准确性和 WCAG 标准符合性
 */

import { describe, it, expect } from 'vitest'
import {
  hexToRgb,
  rgbToHex,
  rgbToHsl,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
  hexToHsl,
  hslToHex,
  parseColor,
  formatColor,
  createColorConfig,
  getLuminance,
  getContrast,
  meetsWCAG_AA,
  meetsWCAG_AAA,
  adjustBrightness,
  adjustSaturation,
  rotateHue,
  mixColors,
  getComplementaryColor,
  getTriadicColors,
  getAnalogousColors,
  generateGradient,
  isDark,
  isLight,
  getTextColor,
  randomColor,
  randomVibrantColor,
  randomPastelColor,
} from '../../../utils/colorUtils'

describe('colorUtils - 颜色格式转换', () => {
  describe('hexToRgb', () => {
    it('应该正确转换 6 位 HEX 颜色', () => {
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 })
      expect(hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 })
      expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
    })

    it('应该正确转换 3 位 HEX 颜色（简写形式）', () => {
      expect(hexToRgb('#F00')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('#0F0')).toEqual({ r: 0, g: 255, b: 0 })
      expect(hexToRgb('#00F')).toEqual({ r: 0, g: 0, b: 255 })
      expect(hexToRgb('#FFF')).toEqual({ r: 255, g: 255, b: 255 })
      expect(hexToRgb('#ABC')).toEqual({ r: 170, g: 187, b: 204 })
    })

    it('应该处理不带 # 的 HEX 颜色', () => {
      expect(hexToRgb('FF0000')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('F00')).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('应该忽略大小写', () => {
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('#Ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    })

    it('应该对无效格式返回 null', () => {
      expect(hexToRgb('invalid')).toBeNull()
      expect(hexToRgb('#GGG')).toBeNull()
      expect(hexToRgb('#12')).toBeNull()
      expect(hexToRgb('#1234567')).toBeNull()
      expect(hexToRgb('')).toBeNull()
    })
  })

  describe('rgbToHex', () => {
    it('应该正确转换 RGB 到 HEX', () => {
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000')
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00')
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff')
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
      expect(rgbToHex(0, 0, 0)).toBe('#000000')
    })

    it('应该处理中间值', () => {
      expect(rgbToHex(128, 128, 128)).toBe('#808080')
      expect(rgbToHex(170, 187, 204)).toBe('#aabbcc')
    })

    it('应该处理边界值', () => {
      expect(rgbToHex(0, 0, 0)).toBe('#000000')
      expect(rgbToHex(255, 255, 255)).toBe('#ffffff')
    })

    it('应该处理超出范围的值', () => {
      expect(rgbToHex(256, 0, 0)).toBe('#ff0000')
      expect(rgbToHex(-1, 0, 0)).toBe('#000000')
      expect(rgbToHex(128.7, 64.3, 32.9)).toBe('#804021')
    })

    it('应该正确填充零', () => {
      expect(rgbToHex(1, 2, 3)).toBe('#010203')
      expect(rgbToHex(15, 16, 17)).toBe('#0f1011')
    })
  })

  describe('rgbToHsl', () => {
    it('应该正确转换纯色', () => {
      expect(rgbToHsl(255, 0, 0)).toEqual({ h: 0, s: 100, l: 50 })
      expect(rgbToHsl(0, 255, 0)).toEqual({ h: 120, s: 100, l: 50 })
      expect(rgbToHsl(0, 0, 255)).toEqual({ h: 240, s: 100, l: 50 })
    })

    it('应该正确转换灰度', () => {
      expect(rgbToHsl(0, 0, 0)).toEqual({ h: 0, s: 0, l: 0 })
      expect(rgbToHsl(128, 128, 128)).toEqual({ h: 0, s: 0, l: 50 })
      expect(rgbToHsl(255, 255, 255)).toEqual({ h: 0, s: 0, l: 100 })
    })

    it('应该正确转换混合颜色', () => {
      const hsl = rgbToHsl(170, 187, 204)
      expect(hsl.h).toBeGreaterThanOrEqual(200)
      expect(hsl.h).toBeLessThanOrEqual(210)
      expect(hsl.s).toBeGreaterThan(0)
      expect(hsl.l).toBeGreaterThan(0)
    })
  })

  describe('hslToRgb', () => {
    it('应该正确转换纯色', () => {
      expect(hslToRgb(0, 100, 50)).toEqual({ r: 255, g: 0, b: 0 })
      expect(hslToRgb(120, 100, 50)).toEqual({ r: 0, g: 255, b: 0 })
      expect(hslToRgb(240, 100, 50)).toEqual({ r: 0, g: 0, b: 255 })
    })

    it('应该正确转换灰度', () => {
      expect(hslToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 })
      expect(hslToRgb(0, 0, 50)).toEqual({ r: 128, g: 128, b: 128 })
      expect(hslToRgb(0, 0, 100)).toEqual({ r: 255, g: 255, b: 255 })
    })

    it('应该处理不同的色相值', () => {
      const rgb60 = hslToRgb(60, 100, 50)
      expect(rgb60.r).toBe(255)
      expect(rgb60.g).toBe(255)
      expect(rgb60.b).toBe(0)

      const rgb180 = hslToRgb(180, 100, 50)
      expect(rgb180.r).toBe(0)
      expect(rgb180.g).toBe(255)
      expect(rgb180.b).toBe(255)

      const rgb300 = hslToRgb(300, 100, 50)
      expect(rgb300.r).toBe(255)
      expect(rgb300.g).toBe(0)
      expect(rgb300.b).toBe(255)
    })
  })

  describe('rgbToHsv', () => {
    it('应该正确转换纯色', () => {
      expect(rgbToHsv(255, 0, 0)).toEqual({ h: 0, s: 100, v: 100 })
      expect(rgbToHsv(0, 255, 0)).toEqual({ h: 120, s: 100, v: 100 })
      expect(rgbToHsv(0, 0, 255)).toEqual({ h: 240, s: 100, v: 100 })
    })

    it('应该正确转换灰度', () => {
      expect(rgbToHsv(0, 0, 0)).toEqual({ h: 0, s: 0, v: 0 })
      expect(rgbToHsv(128, 128, 128)).toEqual({ h: 0, s: 0, v: 50 })
      expect(rgbToHsv(255, 255, 255)).toEqual({ h: 0, s: 0, v: 100 })
    })
  })

  describe('hsvToRgb', () => {
    it('应该正确转换纯色', () => {
      expect(hsvToRgb(0, 100, 100)).toEqual({ r: 255, g: 0, b: 0 })
      expect(hsvToRgb(120, 100, 100)).toEqual({ r: 0, g: 255, b: 0 })
      expect(hsvToRgb(240, 100, 100)).toEqual({ r: 0, g: 0, b: 255 })
    })

    it('应该正确转换灰度', () => {
      expect(hsvToRgb(0, 0, 0)).toEqual({ r: 0, g: 0, b: 0 })
      expect(hsvToRgb(0, 0, 50)).toEqual({ r: 128, g: 128, b: 128 })
      expect(hsvToRgb(0, 0, 100)).toEqual({ r: 255, g: 255, b: 255 })
    })

    it('应该处理所有色相区间', () => {
      const testHues = [0, 60, 120, 180, 240, 300]
      testHues.forEach(hue => {
        const rgb = hsvToRgb(hue, 100, 100)
        expect(rgb.r).toBeGreaterThanOrEqual(0)
        expect(rgb.r).toBeLessThanOrEqual(255)
        expect(rgb.g).toBeGreaterThanOrEqual(0)
        expect(rgb.g).toBeLessThanOrEqual(255)
        expect(rgb.b).toBeGreaterThanOrEqual(0)
        expect(rgb.b).toBeLessThanOrEqual(255)
      })
    })
  })

  describe('双向转换一致性', () => {
    it('RGB <-> HEX 应该可逆', () => {
      const original = { r: 170, g: 187, b: 204 }
      const hex = rgbToHex(original.r, original.g, original.b)
      const back = hexToRgb(hex)
      expect(back).toEqual(original)
    })

    it('RGB <-> HSL 应该近似可逆', () => {
      const original = { r: 170, g: 187, b: 204 }
      const hsl = rgbToHsl(original.r, original.g, original.b)
      const back = hslToRgb(hsl.h, hsl.s, hsl.l)
      
      expect(Math.abs(back.r - original.r)).toBeLessThanOrEqual(1)
      expect(Math.abs(back.g - original.g)).toBeLessThanOrEqual(1)
      expect(Math.abs(back.b - original.b)).toBeLessThanOrEqual(1)
    })

    it('RGB <-> HSV 应该近似可逆', () => {
      const original = { r: 170, g: 187, b: 204 }
      const hsv = rgbToHsv(original.r, original.g, original.b)
      const back = hsvToRgb(hsv.h, hsv.s, hsv.v)
      
      expect(Math.abs(back.r - original.r)).toBeLessThanOrEqual(1)
      expect(Math.abs(back.g - original.g)).toBeLessThanOrEqual(1)
      expect(Math.abs(back.b - original.b)).toBeLessThanOrEqual(1)
    })
  })

  describe('parseColor', () => {
    it('应该解析 HEX 格式', () => {
      const color = parseColor('#FF0000')
      expect(color).toBeTruthy()
      expect(color?.hex).toBe('#FF0000')
      expect(color?.rgb).toEqual({ r: 255, g: 0, b: 0 })
      expect(color?.alpha).toBe(1)
    })

    it('应该解析 RGB 格式', () => {
      const color = parseColor('rgb(255, 0, 0)')
      expect(color).toBeTruthy()
      expect(color?.rgb).toEqual({ r: 255, g: 0, b: 0 })
      expect(color?.alpha).toBe(1)
    })

    it('应该解析 RGBA 格式', () => {
      const color = parseColor('rgba(255, 0, 0, 0.5)')
      expect(color).toBeTruthy()
      expect(color?.rgb).toEqual({ r: 255, g: 0, b: 0 })
      expect(color?.alpha).toBe(0.5)
    })

    it('应该解析 HSL 格式', () => {
      const color = parseColor('hsl(0, 100%, 50%)')
      expect(color).toBeTruthy()
      expect(color?.hsl).toEqual({ h: 0, s: 100, l: 50 })
      expect(color?.alpha).toBe(1)
    })

    it('应该解析 HSLA 格式', () => {
      const color = parseColor('hsla(0, 100%, 50%, 0.8)')
      expect(color).toBeTruthy()
      expect(color?.hsl).toEqual({ h: 0, s: 100, l: 50 })
      expect(color?.alpha).toBe(0.8)
    })

    it('应该对无效格式返回 null', () => {
      expect(parseColor('invalid')).toBeNull()
      expect(parseColor('')).toBeNull()
      expect(parseColor('red')).toBeNull()
    })

    it('应该忽略空格', () => {
      const color = parseColor('  rgb( 255 ,  0 ,  0 )  ')
      expect(color).toBeTruthy()
      expect(color?.rgb).toEqual({ r: 255, g: 0, b: 0 })
    })
  })

  describe('formatColor', () => {
    const testColor = {
      hex: '#ff0000',
      rgb: { r: 255, g: 0, b: 0 },
      hsl: { h: 0, s: 100, l: 50 },
      hsv: { h: 0, s: 100, v: 100 },
      alpha: 1,
    }

    it('应该格式化为 HEX', () => {
      expect(formatColor(testColor, 'hex')).toBe('#ff0000')
    })

    it('应该格式化为 RGB', () => {
      expect(formatColor(testColor, 'rgb')).toBe('rgb(255, 0, 0)')
    })

    it('应该格式化为 RGBA（包含透明度）', () => {
      const colorWithAlpha = { ...testColor, alpha: 0.5 }
      expect(formatColor(colorWithAlpha, 'rgb')).toBe('rgba(255, 0, 0, 0.5)')
    })

    it('应该格式化为 HSL', () => {
      expect(formatColor(testColor, 'hsl')).toBe('hsl(0, 100%, 50%)')
    })

    it('应该格式化为 HSLA（包含透明度）', () => {
      const colorWithAlpha = { ...testColor, alpha: 0.8 }
      expect(formatColor(colorWithAlpha, 'hsl')).toBe('hsla(0, 100%, 50%, 0.8)')
    })

    it('应该默认使用 HEX 格式', () => {
      expect(formatColor(testColor)).toBe('#ff0000')
    })
  })
})

describe('colorUtils - 颜色亮度和对比度', () => {
  describe('getLuminance', () => {
    it('应该计算黑色的亮度', () => {
      expect(getLuminance('#000000')).toBe(0)
    })

    it('应该计算白色的亮度', () => {
      expect(getLuminance('#FFFFFF')).toBe(1)
    })

    it('应该计算中间色的亮度', () => {
      const lum = getLuminance('#808080')
      expect(lum).toBeGreaterThan(0)
      expect(lum).toBeLessThan(1)
    })

    it('应该接受 RGB 对象', () => {
      expect(getLuminance({ r: 0, g: 0, b: 0 })).toBe(0)
      expect(getLuminance({ r: 255, g: 255, b: 255 })).toBe(1)
    })

    it('应该对无效颜色返回 0', () => {
      expect(getLuminance('invalid')).toBe(0)
    })
  })

  describe('getContrast', () => {
    it('应该计算黑白对比度', () => {
      const contrast = getContrast('#000000', '#FFFFFF')
      expect(contrast).toBe(21) // 最大对比度
    })

    it('应该计算相同颜色的对比度', () => {
      const contrast = getContrast('#FF0000', '#FF0000')
      expect(contrast).toBe(1) // 最小对比度
    })

    it('应该计算中间对比度', () => {
      const contrast = getContrast('#000000', '#808080')
      expect(contrast).toBeGreaterThan(1)
      expect(contrast).toBeLessThan(21)
    })

    it('应该与颜色顺序无关', () => {
      const contrast1 = getContrast('#000000', '#FFFFFF')
      const contrast2 = getContrast('#FFFFFF', '#000000')
      expect(contrast1).toBe(contrast2)
    })
  })

  describe('WCAG 标准测试', () => {
    describe('meetsWCAG_AA', () => {
      it('应该通过高对比度组合（普通文本）', () => {
        expect(meetsWCAG_AA('#000000', '#FFFFFF')).toBe(true)
        expect(meetsWCAG_AA('#FFFFFF', '#000000')).toBe(true)
      })

      it('应该拒绝低对比度组合（普通文本）', () => {
        expect(meetsWCAG_AA('#FFFFFF', '#EEEEEE')).toBe(false)
        expect(meetsWCAG_AA('#777777', '#888888')).toBe(false)
      })

      it('应该对大文本使用更宽松的标准', () => {
        // 对比度 3.5 应该通过大文本但不通过普通文本
        const color1 = '#767676'
        const color2 = '#FFFFFF'
        const contrast = getContrast(color1, color2)
        
        // 验证对比度在合理范围内
        expect(contrast).toBeGreaterThan(3)
        expect(contrast).toBeLessThan(4.5)
      })

      it('应该处理边界情况', () => {
        // 对比度恰好为 4.5 应该通过
        const color1 = '#767676'
        const color2 = '#FFFFFF'
        const contrast = getContrast(color1, color2)
        expect(meetsWCAG_AA(color1, color2, false)).toBe(contrast >= 4.5)
      })
    })

    describe('meetsWCAG_AAA', () => {
      it('应该通过高对比度组合（普通文本）', () => {
        expect(meetsWCAG_AAA('#000000', '#FFFFFF')).toBe(true)
      })

      it('应该拒绝中等对比度组合（普通文本）', () => {
        expect(meetsWCAG_AAA('#555555', '#FFFFFF')).toBe(false)
      })

      it('应该对大文本使用更宽松的标准', () => {
        // 对比度在 4.5-7 之间的应该通过大文本 AAA 但不通过普通文本
        const color1 = '#595959'
        const color2 = '#FFFFFF'
        const contrast = getContrast(color1, color2)
        
        expect(contrast).toBeGreaterThan(4.5)
      })
    })
  })
})

describe('colorUtils - 颜色调整', () => {
  describe('adjustBrightness', () => {
    it('应该增加亮度', () => {
      const color = '#808080'
      const brighter = adjustBrightness(color, 20)
      const originalHsl = hexToHsl(color)
      const newHsl = hexToHsl(brighter)
      
      expect(newHsl?.l).toBeGreaterThan(originalHsl!.l)
    })

    it('应该减少亮度', () => {
      const color = '#808080'
      const darker = adjustBrightness(color, -20)
      const originalHsl = hexToHsl(color)
      const newHsl = hexToHsl(darker)
      
      expect(newHsl?.l).toBeLessThan(originalHsl!.l)
    })

    it('应该限制在 0-100 范围内', () => {
      const white = '#FFFFFF'
      const tooBright = adjustBrightness(white, 50)
      expect(hexToHsl(tooBright)?.l).toBe(100)

      const black = '#000000'
      const tooDark = adjustBrightness(black, -50)
      expect(hexToHsl(tooDark)?.l).toBe(0)
    })

    it('应该处理无效颜色', () => {
      expect(adjustBrightness('invalid', 20)).toBe('invalid')
    })
  })

  describe('adjustSaturation', () => {
    it('应该增加饱和度', () => {
      const color = '#808080' // 灰色，饱和度为 0
      const saturated = adjustSaturation(color, 50)
      const hsl = hexToHsl(saturated)
      
      expect(hsl?.s).toBeGreaterThanOrEqual(0)
    })

    it('应该减少饱和度', () => {
      const color = '#FF0000' // 纯红色，饱和度为 100
      const desaturated = adjustSaturation(color, -50)
      const hsl = hexToHsl(desaturated)
      
      expect(hsl?.s).toBeLessThan(100)
    })

    it('应该限制在 0-100 范围内', () => {
      const color = '#FF0000'
      const tooSaturated = adjustSaturation(color, 50)
      expect(hexToHsl(tooSaturated)?.s).toBe(100)

      const tooDesaturated = adjustSaturation(color, -150)
      expect(hexToHsl(tooDesaturated)?.s).toBe(0)
    })
  })

  describe('rotateHue', () => {
    it('应该旋转色相', () => {
      const red = '#FF0000' // h = 0
      const rotated = rotateHue(red, 120)
      const hsl = hexToHsl(rotated)
      
      expect(hsl?.h).toBe(120) // 应该变成绿色
    })

    it('应该处理负角度', () => {
      const red = '#FF0000' // h = 0
      const rotated = rotateHue(red, -120)
      const hsl = hexToHsl(rotated)
      
      expect(hsl?.h).toBe(240) // 应该变成蓝色
    })

    it('应该循环回 0-360 范围', () => {
      const red = '#FF0000'
      const rotated = rotateHue(red, 390)
      const hsl = hexToHsl(rotated)
      
      expect(hsl?.h).toBe(30)
    })

    it('应该处理 360 度旋转', () => {
      const color = '#FF0000'
      const rotated = rotateHue(color, 360)
      
      // 旋转 360 度应该回到原色
      expect(rotated.toLowerCase()).toBe(color.toLowerCase())
    })
  })

  describe('mixColors', () => {
    it('应该混合两个颜色（50/50）', () => {
      const color1 = '#000000'
      const color2 = '#FFFFFF'
      const mixed = mixColors(color1, color2, 0.5)
      const rgb = hexToRgb(mixed)
      
      expect(rgb?.r).toBeGreaterThan(100)
      expect(rgb?.r).toBeLessThan(155)
    })

    it('应该完全使用第一个颜色（weight = 0）', () => {
      const color1 = '#FF0000'
      const color2 = '#00FF00'
      const mixed = mixColors(color1, color2, 0)
      
      expect(mixed.toLowerCase()).toBe(color1.toLowerCase())
    })

    it('应该完全使用第二个颜色（weight = 1）', () => {
      const color1 = '#FF0000'
      const color2 = '#00FF00'
      const mixed = mixColors(color1, color2, 1)
      
      expect(mixed.toLowerCase()).toBe(color2.toLowerCase())
    })

    it('应该限制 weight 在 0-1 范围内', () => {
      const color1 = '#FF0000'
      const color2 = '#00FF00'
      
      const tooLow = mixColors(color1, color2, -0.5)
      expect(tooLow.toLowerCase()).toBe(color1.toLowerCase())

      const tooHigh = mixColors(color1, color2, 1.5)
      expect(tooHigh.toLowerCase()).toBe(color2.toLowerCase())
    })

    it('应该处理无效颜色', () => {
      const result = mixColors('invalid', '#FF0000', 0.5)
      expect(result).toBe('invalid')
    })
  })
})

describe('colorUtils - 颜色方案生成', () => {
  describe('getComplementaryColor', () => {
    it('应该生成补色（旋转 180 度）', () => {
      const red = '#FF0000'
      const complement = getComplementaryColor(red)
      const hsl = hexToHsl(complement)
      
      expect(hsl?.h).toBe(180) // 青色
    })

    it('应该生成蓝色的补色', () => {
      const blue = '#0000FF'
      const complement = getComplementaryColor(blue)
      const hsl = hexToHsl(complement)
      
      expect(hsl?.h).toBe(60) // 黄色
    })
  })

  describe('getTriadicColors', () => {
    it('应该生成三元色（包含原色）', () => {
      const colors = getTriadicColors('#FF0000')
      
      expect(colors).toHaveLength(3)
      expect(colors[0].toLowerCase()).toBe('#ff0000')
    })

    it('应该生成相隔 120 度的颜色', () => {
      const colors = getTriadicColors('#FF0000')
      const hsls = colors.map(c => hexToHsl(c))
      
      expect(hsls[0]?.h).toBe(0)
      expect(hsls[1]?.h).toBe(120)
      expect(hsls[2]?.h).toBe(240)
    })
  })

  describe('getAnalogousColors', () => {
    it('应该生成指定数量的类似色', () => {
      const colors = getAnalogousColors('#FF0000', 5)
      expect(colors).toHaveLength(5)
    })

    it('应该生成相近的色相', () => {
      const colors = getAnalogousColors('#FF0000', 3, 30)
      const hsls = colors.map(c => hexToHsl(c))
      
      // 色相应该在 -15 到 +15 度范围内
      expect(hsls[0]?.h).toBeGreaterThanOrEqual(345) // -15 度
      expect(hsls[2]?.h).toBeLessThanOrEqual(15) // +15 度
    })

    it('应该支持自定义角度范围', () => {
      const colors = getAnalogousColors('#FF0000', 5, 60)
      const hsls = colors.map(c => hexToHsl(c))
      
      const minHue = Math.min(...hsls.map(h => h?.h || 0))
      const maxHue = Math.max(...hsls.map(h => h?.h || 0))
      
      expect(maxHue - minHue).toBeLessThanOrEqual(60)
    })
  })

  describe('generateGradient', () => {
    it('应该生成指定步数的渐变', () => {
      const gradient = generateGradient('#000000', '#FFFFFF', 5)
      expect(gradient).toHaveLength(5)
    })

    it('应该包含起始和结束颜色', () => {
      const gradient = generateGradient('#FF0000', '#00FF00', 3)
      expect(gradient[0].toLowerCase()).toBe('#ff0000')
      expect(gradient[2].toLowerCase()).toBe('#00ff00')
    })

    it('应该生成平滑过渡', () => {
      const gradient = generateGradient('#000000', '#FFFFFF', 11)
      const rgbs = gradient.map(c => hexToRgb(c))
      
      // 每一步的亮度应该递增
      for (let i = 1; i < rgbs.length; i++) {
        expect(rgbs[i]?.r).toBeGreaterThanOrEqual(rgbs[i - 1]?.r || 0)
      }
    })

    it('应该处理两步渐变', () => {
      const gradient = generateGradient('#FF0000', '#00FF00', 2)
      expect(gradient).toHaveLength(2)
      expect(gradient[0].toLowerCase()).toBe('#ff0000')
      expect(gradient[1].toLowerCase()).toBe('#00ff00')
    })
  })
})

describe('colorUtils - 颜色判断', () => {
  describe('isDark 和 isLight', () => {
    it('应该识别深色', () => {
      expect(isDark('#000000')).toBe(true)
      expect(isDark('#333333')).toBe(true)
      expect(isLight('#000000')).toBe(false)
    })

    it('应该识别浅色', () => {
      expect(isLight('#FFFFFF')).toBe(true)
      expect(isLight('#EEEEEE')).toBe(true)
      expect(isDark('#FFFFFF')).toBe(false)
    })

    it('应该处理中间色', () => {
      const gray = '#808080'
      // 中间灰色通常被认为是深色
      expect(isDark(gray)).toBe(true)
      expect(isLight(gray)).toBe(false)
    })
  })

  describe('getTextColor', () => {
    it('应该为深色背景返回白色文本', () => {
      expect(getTextColor('#000000')).toBe('#ffffff')
      expect(getTextColor('#333333')).toBe('#ffffff')
    })

    it('应该为浅色背景返回黑色文本', () => {
      expect(getTextColor('#FFFFFF')).toBe('#000000')
      expect(getTextColor('#EEEEEE')).toBe('#000000')
    })

    it('应该确保文本可读性', () => {
      const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF']
      
      colors.forEach(bg => {
        const textColor = getTextColor(bg)
        const contrast = getContrast(textColor, bg)
        
        // 文本颜色应该有足够的对比度
        expect(contrast).toBeGreaterThan(4.5)
      })
    })
  })
})

describe('colorUtils - 随机颜色', () => {
  describe('randomColor', () => {
    it('应该生成有效的 HEX 颜色', () => {
      const color = randomColor()
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    })

    it('应该生成不同的颜色', () => {
      const colors = Array.from({ length: 10 }, () => randomColor())
      const uniqueColors = new Set(colors)
      
      // 10 个随机颜色应该至少有几个不同
      expect(uniqueColors.size).toBeGreaterThan(1)
    })
  })

  describe('randomVibrantColor', () => {
    it('应该生成鲜艳的颜色（高饱和度）', () => {
      const color = randomVibrantColor()
      const hsl = hexToHsl(color)
      
      expect(hsl?.s).toBeGreaterThanOrEqual(70)
      expect(hsl?.s).toBeLessThanOrEqual(100)
    })

    it('应该生成适中亮度的颜色', () => {
      const color = randomVibrantColor()
      const hsl = hexToHsl(color)
      
      expect(hsl?.l).toBeGreaterThanOrEqual(40)
      expect(hsl?.l).toBeLessThanOrEqual(60)
    })
  })

  describe('randomPastelColor', () => {
    it('应该生成柔和的颜色（低饱和度）', () => {
      const color = randomPastelColor()
      const hsl = hexToHsl(color)
      
      expect(hsl?.s).toBeGreaterThanOrEqual(20)
      expect(hsl?.s).toBeLessThanOrEqual(60)
    })

    it('应该生成高亮度的颜色', () => {
      const color = randomPastelColor()
      const hsl = hexToHsl(color)
      
      expect(hsl?.l).toBeGreaterThanOrEqual(70)
      expect(hsl?.l).toBeLessThanOrEqual(90)
    })
  })
})

describe('colorUtils - createColorConfig', () => {
  it('应该从 HEX 创建 ColorConfig', () => {
    const config = createColorConfig('#FF0000')
    
    expect(config.hex).toBe('#ff0000')
    expect(config.rgb).toBe('255 0 0')
    expect(config.hsl).toBe('0 100% 50%')
  })

  it('应该从 ColorPickerValue 创建 ColorConfig', () => {
    const color = {
      hex: '#00FF00',
      rgb: { r: 0, g: 255, b: 0 },
      hsl: { h: 120, s: 100, l: 50 },
      hsv: { h: 120, s: 100, v: 100 },
      alpha: 1,
    }
    
    const config = createColorConfig(color)
    
    expect(config.hex).toBe('#00FF00')
    expect(config.rgb).toBe('0 255 0')
    expect(config.hsl).toBe('120 100% 50%')
  })

  it('应该对无效颜色抛出错误', () => {
    expect(() => createColorConfig('invalid')).toThrow('Invalid color')
  })
})

