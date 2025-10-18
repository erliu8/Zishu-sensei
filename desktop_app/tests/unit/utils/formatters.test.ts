/**
 * 格式化函数测试
 * 
 * 测试 formatters.ts 中的所有格式化函数
 */

import { describe, it, expect } from 'vitest'
import * as formatters from '../../../src/utils/formatters'

describe('formatters - 文件大小格式化', () => {
  describe('formatFileSize', () => {
    it('应该格式化字节大小', () => {
      expect(formatters.formatFileSize(0)).toBe('0 B')
      expect(formatters.formatFileSize(1024)).toBe('1 KB')
      expect(formatters.formatFileSize(1536000)).toContain('MB')
      expect(formatters.formatFileSize(1073741824)).toContain('GB')
    })

    it('应该支持自定义精度', () => {
      const result = formatters.formatFileSize(1536000, { precision: 1 })
      expect(result).toMatch(/^\d+\.\d{1}\s\w+$/)
    })

    it('应该支持十进制单位', () => {
      const result = formatters.formatFileSize(1000, { unit: 'decimal' })
      expect(result).toContain('KB')
    })

    it('应该处理无效输入', () => {
      expect(formatters.formatFileSize(Infinity)).toBe('N/A')
      expect(formatters.formatFileSize(-100)).toBe('N/A')
      expect(formatters.formatFileSize(NaN)).toBe('N/A')
    })
  })

  describe('formatFileSizeCompact', () => {
    it('应该生成紧凑格式', () => {
      const result = formatters.formatFileSizeCompact(1536000)
      expect(result).not.toContain(' ')
      expect(result).toMatch(/^\d+\.?\d*[A-Z]+$/)
    })
  })
})

describe('formatters - 时间和日期格式化', () => {
  describe('formatDuration', () => {
    it('应该格式化毫秒', () => {
      expect(formatters.formatDuration(500)).toBe('500毫秒')
      expect(formatters.formatDuration(1500)).toContain('秒')
      expect(formatters.formatDuration(65000)).toContain('分')
      expect(formatters.formatDuration(3665000)).toContain('小时')
      expect(formatters.formatDuration(90000000)).toContain('天')
    })

    it('应该支持详细模式', () => {
      const verbose = formatters.formatDuration(3665000, { verbose: true })
      expect(verbose).toContain('小时')
      expect(verbose).toContain('分')
    })

    it('应该处理无效输入', () => {
      expect(formatters.formatDuration(Infinity)).toBe('N/A')
      expect(formatters.formatDuration(-100)).toBe('N/A')
    })
  })

  describe('formatDurationCompact', () => {
    it('应该生成紧凑时长格式', () => {
      expect(formatters.formatDurationCompact(0)).toBe('00:00')
      expect(formatters.formatDurationCompact(65000)).toBe('01:05')
      expect(formatters.formatDurationCompact(3665000)).toBe('01:01:05')
    })

    it('应该处理无效输入', () => {
      expect(formatters.formatDurationCompact(-100)).toBe('00:00')
    })
  })

  describe('formatRelativeTime', () => {
    const now = Date.now()
    
    it('应该格式化相对时间', () => {
      expect(formatters.formatRelativeTime(now - 5000)).toBe('刚刚')
      expect(formatters.formatRelativeTime(now - 30000)).toContain('秒前')
      expect(formatters.formatRelativeTime(now - 120000)).toContain('分钟前')
      expect(formatters.formatRelativeTime(now - 7200000)).toContain('小时前')
      expect(formatters.formatRelativeTime(now - 86400000)).toBe('昨天')
      expect(formatters.formatRelativeTime(now - 172800000)).toContain('天前')
    })

    it('应该支持未来时间', () => {
      expect(formatters.formatRelativeTime(now + 30000)).toContain('秒后')
      expect(formatters.formatRelativeTime(now + 86400000)).toBe('明天')
    })
  })

  describe('formatDateTime', () => {
    it('应该格式化日期时间', () => {
      const timestamp = new Date('2024-01-15 10:30:45').getTime()
      const result = formatters.formatDateTime(timestamp)
      expect(result).toContain('2024')
      expect(result).toContain('01')
      expect(result).toContain('15')
      expect(result).toContain('10:30:45')
    })

    it('应该支持只显示日期', () => {
      const timestamp = new Date('2024-01-15').getTime()
      const result = formatters.formatDateTime(timestamp, { showTime: false })
      expect(result).toBe('2024-01-15')
    })

    it('应该处理无效输入', () => {
      expect(formatters.formatDateTime(NaN)).toBe('N/A')
    })
  })

  describe('formatSmartDateTime', () => {
    const now = Date.now()
    
    it('应该智能选择格式', () => {
      // 最近的使用相对时间
      const recent = formatters.formatSmartDateTime(now - 3600000)
      expect(recent).toContain('小时前')
      
      // 今年内显示月-日
      const thisYear = formatters.formatSmartDateTime(now - 86400000 * 10)
      expect(thisYear).toMatch(/^\d{2}-\d{2}$/)
    })
  })
})

describe('formatters - 文本格式化', () => {
  describe('truncateText', () => {
    it('应该截断文本', () => {
      const text = 'Hello World'
      const result = formatters.truncateText(text, { maxLength: 8 })
      expect(result).toBe('Hello...')
    })

    it('应该支持中间截断', () => {
      const text = 'Hello World Test'
      const result = formatters.truncateText(text, { maxLength: 10, position: 'middle' })
      expect(result).toMatch(/^Hel\.\.\.est$/)
    })

    it('应该支持开头截断', () => {
      const text = 'Hello World'
      const result = formatters.truncateText(text, { maxLength: 8, position: 'start' })
      expect(result).toBe('...World')
    })

    it('不应该截断短文本', () => {
      const text = 'Hello'
      const result = formatters.truncateText(text, { maxLength: 10 })
      expect(result).toBe('Hello')
    })
  })

  describe('escapeHtml', () => {
    it('应该转义 HTML 特殊字符', () => {
      expect(formatters.escapeHtml('<div>')).toBe('&lt;div&gt;')
      expect(formatters.escapeHtml('"test"')).toBe('&quot;test&quot;')
      expect(formatters.escapeHtml("'test'")).toBe('&#39;test&#39;')
      expect(formatters.escapeHtml('&')).toBe('&amp;')
    })
  })

  describe('stripHtml', () => {
    it('应该移除 HTML 标签', () => {
      expect(formatters.stripHtml('<p>Hello</p>')).toBe('Hello')
      expect(formatters.stripHtml('<div><span>Test</span></div>')).toBe('Test')
    })
  })

  describe('highlightKeyword', () => {
    it('应该高亮关键词', () => {
      const result = formatters.highlightKeyword('Hello World', 'World')
      expect(result).toContain('<mark')
      expect(result).toContain('World')
    })

    it('应该处理空关键词', () => {
      const result = formatters.highlightKeyword('Hello World', '')
      expect(result).not.toContain('<mark')
    })
  })

  describe('nl2br', () => {
    it('应该将换行符转换为 HTML', () => {
      const result = formatters.nl2br('Line 1\nLine 2')
      expect(result).toBe('Line 1<br/>Line 2')
    })
  })

  describe('camelToKebab', () => {
    it('应该转换驼峰到短横线', () => {
      expect(formatters.camelToKebab('helloWorld')).toBe('hello-world')
      expect(formatters.camelToKebab('HelloWorld')).toBe('-hello-world')
    })
  })

  describe('kebabToCamel', () => {
    it('应该转换短横线到驼峰', () => {
      expect(formatters.kebabToCamel('hello-world')).toBe('helloWorld')
      expect(formatters.kebabToCamel('hello-world-test')).toBe('helloWorldTest')
    })
  })

  describe('capitalize', () => {
    it('应该首字母大写', () => {
      expect(formatters.capitalize('hello')).toBe('Hello')
      expect(formatters.capitalize('HELLO')).toBe('HELLO')
      expect(formatters.capitalize('')).toBe('')
    })
  })

  describe('titleCase', () => {
    it('应该每个单词首字母大写', () => {
      expect(formatters.titleCase('hello world')).toBe('Hello World')
      expect(formatters.titleCase('hello world test')).toBe('Hello World Test')
    })
  })
})

describe('formatters - 数字格式化', () => {
  describe('formatNumber', () => {
    it('应该格式化数字', () => {
      const result = formatters.formatNumber(1234567.89)
      expect(result).toContain(',')
      expect(result).toContain('.')
    })

    it('应该处理无效输入', () => {
      expect(formatters.formatNumber(Infinity)).toBe('N/A')
      expect(formatters.formatNumber(NaN)).toBe('N/A')
    })
  })

  describe('formatPercentage', () => {
    it('应该格式化百分比', () => {
      expect(formatters.formatPercentage(0.856)).toBe('85.6%')
      expect(formatters.formatPercentage(85.6, { isDecimal: false })).toBe('85.6%')
    })

    it('应该处理无效输入', () => {
      expect(formatters.formatPercentage(Infinity)).toBe('N/A')
    })
  })

  describe('formatCompactNumber', () => {
    it('应该格式化为紧凑数字', () => {
      expect(formatters.formatCompactNumber(999)).toBe('999')
      expect(formatters.formatCompactNumber(1234)).toBe('1.2K')
      expect(formatters.formatCompactNumber(1234567)).toBe('1.2M')
      expect(formatters.formatCompactNumber(1234567890)).toBe('1.2B')
    })

    it('应该处理无效输入', () => {
      expect(formatters.formatCompactNumber(Infinity)).toBe('N/A')
    })
  })
})

describe('formatters - Token 和使用量格式化', () => {
  describe('formatTokenUsage', () => {
    it('应该格式化 Token 使用量', () => {
      const result = formatters.formatTokenUsage({
        prompt: 100,
        completion: 200,
        total: 300,
      })
      expect(result).toContain('300')
      expect(result).toContain('tokens')
      expect(result).toContain('提示')
      expect(result).toContain('完成')
    })

    it('应该处理只有总数的情况', () => {
      const result = formatters.formatTokenUsage({ total: 300 })
      expect(result).toContain('300')
      expect(result).toContain('tokens')
      expect(result).not.toContain('提示')
    })
  })

  describe('formatCost', () => {
    it('应该格式化成本', () => {
      const result = formatters.formatCost(1000, 0.00002)
      expect(result).toContain('¥')
      expect(result).toContain('0.02')
    })
  })
})

describe('formatters - URL 格式化', () => {
  describe('formatUrl', () => {
    it('应该格式化长 URL', () => {
      const longUrl = 'https://example.com/very/long/path/that/should/be/truncated'
      const result = formatters.formatUrl(longUrl, 30)
      expect(result.length).toBeLessThanOrEqual(30 + 3) // +3 for ellipsis
    })

    it('不应该截断短 URL', () => {
      const shortUrl = 'https://example.com'
      const result = formatters.formatUrl(shortUrl, 50)
      expect(result).toBe(shortUrl)
    })

    it('应该处理无效 URL', () => {
      const invalid = 'not a url'
      const result = formatters.formatUrl(invalid, 10)
      expect(result.length).toBeLessThanOrEqual(13) // 10 + ellipsis
    })
  })

  describe('extractDomain', () => {
    it('应该提取域名', () => {
      expect(formatters.extractDomain('https://www.example.com/path')).toBe('example.com')
      expect(formatters.extractDomain('https://example.com')).toBe('example.com')
    })

    it('应该处理无效 URL', () => {
      expect(formatters.extractDomain('invalid')).toBe('invalid')
    })
  })
})

describe('formatters - 消息格式化', () => {
  describe('formatMessagePreview', () => {
    it('应该生成消息预览', () => {
      const long = 'This is a very long message that should be truncated'
      const result = formatters.formatMessagePreview(long, 20)
      expect(result.length).toBeLessThanOrEqual(20)
      expect(result).toContain('...')
    })

    it('应该移除多余空白', () => {
      const messy = 'Hello    \n\n   World'
      const result = formatters.formatMessagePreview(messy)
      expect(result).toBe('Hello World')
    })
  })

  describe('formatCodeBlock', () => {
    it('应该格式化代码块', () => {
      const result = formatters.formatCodeBlock('console.log("hello")', 'javascript')
      expect(result).toContain('```javascript')
      expect(result).toContain('console.log("hello")')
      expect(result).toContain('```')
    })

    it('应该支持无语言', () => {
      const result = formatters.formatCodeBlock('code')
      expect(result).toContain('```')
    })
  })

  describe('formatQuote', () => {
    it('应该格式化引用', () => {
      const result = formatters.formatQuote('Quote line 1\nQuote line 2')
      expect(result).toBe('> Quote line 1\n> Quote line 2')
    })
  })
})

describe('formatters - 列表和数组格式化', () => {
  describe('formatList', () => {
    it('应该格式化列表', () => {
      expect(formatters.formatList(['a', 'b', 'c'])).toBe('a, b 和 c')
      expect(formatters.formatList(['a'])).toBe('a')
      expect(formatters.formatList([])).toBe('')
    })

    it('应该限制项目数量', () => {
      const result = formatters.formatList(['a', 'b', 'c', 'd'], { maxItems: 2 })
      expect(result).toContain('另外')
      expect(result).toContain('2')
    })

    it('应该支持自定义分隔符', () => {
      const result = formatters.formatList(['a', 'b', 'c'], { separator: ' | ', lastSeparator: ' 或 ' })
      expect(result).toBe('a | b 或 c')
    })
  })
})

describe('formatters - 数据格式化', () => {
  describe('formatJson', () => {
    it('应该格式化 JSON', () => {
      const result = formatters.formatJson({ name: 'test', value: 42 })
      expect(result).toContain('"name"')
      expect(result).toContain('"test"')
      expect(result).toContain('42')
    })

    it('应该支持自定义缩进', () => {
      const result = formatters.formatJson({ a: 1 }, 4)
      expect(result).toContain('    ')
    })

    it('应该处理无法序列化的对象', () => {
      const circular: any = {}
      circular.self = circular
      const result = formatters.formatJson(circular)
      expect(typeof result).toBe('string')
    })
  })

  describe('formatQueryString', () => {
    it('应该格式化查询字符串', () => {
      const result = formatters.formatQueryString({ page: 1, limit: 10 })
      expect(result).toContain('page=1')
      expect(result).toContain('limit=10')
      expect(result).toContain('&')
    })

    it('应该忽略 null 和 undefined', () => {
      const result = formatters.formatQueryString({ a: 1, b: null, c: undefined })
      expect(result).toBe('a=1')
    })

    it('应该编码特殊字符', () => {
      const result = formatters.formatQueryString({ q: 'hello world' })
      expect(result).toContain('hello%20world')
    })
  })
})

