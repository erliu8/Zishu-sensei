/**
 * 验证工具测试
 * 
 * 测试 validators.ts 中的所有验证函数
 * 确保验证逻辑的准确性和健壮性
 */

import { describe, it, expect } from 'vitest'
import * as validators from '../../../utils/validators'

describe('validators - 基础验证函数', () => {
  describe('isEmpty', () => {
    it('应该正确判断空值', () => {
      expect(validators.isEmpty(null)).toBe(true)
      expect(validators.isEmpty(undefined)).toBe(true)
      expect(validators.isEmpty('')).toBe(true)
      expect(validators.isEmpty('  ')).toBe(true)
      expect(validators.isEmpty([])).toBe(true)
      expect(validators.isEmpty({})).toBe(true)
    })

    it('应该正确判断非空值', () => {
      expect(validators.isEmpty('hello')).toBe(false)
      expect(validators.isEmpty(' hello ')).toBe(false)
      expect(validators.isEmpty([1])).toBe(false)
      expect(validators.isEmpty({ a: 1 })).toBe(false)
      expect(validators.isEmpty(0)).toBe(false)
      expect(validators.isEmpty(false)).toBe(false)
    })
  })

  describe('isRequired', () => {
    it('应该验证必填字段', () => {
      const result = validators.isRequired('hello')
      expect(result.valid).toBe(true)
      expect(result.message).toBeUndefined()
    })

    it('应该拒绝空值', () => {
      const result = validators.isRequired('')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('此字段为必填项')
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.REQUIRED)
    })

    it('应该拒绝空白字符串', () => {
      const result = validators.isRequired('   ')
      expect(result.valid).toBe(false)
    })

    it('应该支持自定义错误消息', () => {
      const result = validators.isRequired('', '用户名不能为空')
      expect(result.message).toBe('用户名不能为空')
    })
  })
})

describe('validators - 文本验证', () => {
  describe('validateTextLength', () => {
    it('应该验证文本长度', () => {
      const result = validators.validateTextLength('hello', {
        minLength: 3,
        maxLength: 10,
      })
      expect(result.valid).toBe(true)
    })

    it('应该拒绝过短的文本', () => {
      const result = validators.validateTextLength('hi', { minLength: 3 })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('不能少于3个字符')
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.TOO_SHORT)
      expect(result.data?.minLength).toBe(3)
    })

    it('应该拒绝过长的文本', () => {
      const result = validators.validateTextLength('hello world test', {
        maxLength: 10,
      })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('不能超过10个字符')
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.TOO_LONG)
      expect(result.data?.maxLength).toBe(10)
    })

    it('应该支持 trim 选项', () => {
      const result = validators.validateTextLength('  hello  ', {
        minLength: 3,
        maxLength: 10,
        trim: true,
      })
      expect(result.valid).toBe(true)
    })

    it('应该拒绝空文本（默认）', () => {
      const result = validators.validateTextLength('', { minLength: 1 })
      expect(result.valid).toBe(false)
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.REQUIRED)
    })

    it('应该允许空文本（当设置 allowEmpty）', () => {
      const result = validators.validateTextLength('', { allowEmpty: true })
      expect(result.valid).toBe(true)
    })
  })

  describe('validateTextPattern', () => {
    it('应该验证匹配的模式', () => {
      const result = validators.validateTextPattern('hello', /^[a-z]+$/)
      expect(result.valid).toBe(true)
    })

    it('应该拒绝不匹配的模式', () => {
      const result = validators.validateTextPattern('hello123', /^[a-z]+$/)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('文本格式不正确')
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.INVALID_FORMAT)
    })

    it('应该支持自定义错误消息', () => {
      const result = validators.validateTextPattern(
        '123',
        /^[a-z]+$/,
        '只能包含小写字母'
      )
      expect(result.message).toBe('只能包含小写字母')
    })
  })

  describe('validateSensitiveWords', () => {
    it('应该通过正常内容', () => {
      const result = validators.validateSensitiveWords('这是正常内容', [
        '敏感词',
        '违禁词',
      ])
      expect(result.valid).toBe(true)
    })

    it('应该检测敏感词', () => {
      const result = validators.validateSensitiveWords('这包含敏感词', [
        '敏感词',
      ])
      expect(result.valid).toBe(false)
      expect(result.message).toContain('敏感词')
      expect(result.code).toBe(
        validators.VALIDATION_ERROR_CODES.CONTAINS_MALICIOUS_CONTENT
      )
      expect(result.data?.sensitiveWords).toContain('敏感词')
    })

    it('应该忽略大小写', () => {
      const result = validators.validateSensitiveWords('这包含SENSITIVE', [
        'sensitive',
      ])
      expect(result.valid).toBe(false)
    })

    it('应该检测多个敏感词', () => {
      const result = validators.validateSensitiveWords('包含敏感词和违禁词', [
        '敏感词',
        '违禁词',
      ])
      expect(result.valid).toBe(false)
      expect(result.data?.sensitiveWords).toHaveLength(2)
    })
  })

  describe('validateXSS', () => {
    it('应该通过正常内容', () => {
      const result = validators.validateXSS('这是正常的文本内容')
      expect(result.valid).toBe(true)
    })

    it('应该检测 script 标签', () => {
      const result = validators.validateXSS('<script>alert("xss")</script>')
      expect(result.valid).toBe(false)
      expect(result.code).toBe(
        validators.VALIDATION_ERROR_CODES.CONTAINS_MALICIOUS_CONTENT
      )
    })

    it('应该检测 javascript: 协议', () => {
      const result = validators.validateXSS('javascript:alert(1)')
      expect(result.valid).toBe(false)
    })

    it('应该检测事件处理器', () => {
      const result = validators.validateXSS('<img src=x onerror=alert(1)>')
      expect(result.valid).toBe(false)
    })

    it('应该检测 iframe 标签', () => {
      const result = validators.validateXSS('<iframe src="evil.com"></iframe>')
      expect(result.valid).toBe(false)
    })

    it('应该检测 object 和 embed 标签', () => {
      expect(validators.validateXSS('<object data="evil"></object>').valid).toBe(
        false
      )
      expect(validators.validateXSS('<embed src="evil">').valid).toBe(false)
    })
  })
})

describe('validators - 文件验证', () => {
  describe('validateFileSize', () => {
    const createMockFile = (size: number): File => {
      const blob = new Blob(['x'.repeat(size)])
      return new File([blob], 'test.txt', { type: 'text/plain' })
    }

    it('应该验证文件大小在范围内', () => {
      const file = createMockFile(1024 * 1024) // 1MB
      const result = validators.validateFileSize(file, {
        maxSize: 10 * 1024 * 1024, // 10MB
      })
      expect(result.valid).toBe(true)
    })

    it('应该拒绝过大的文件', () => {
      const file = createMockFile(11 * 1024 * 1024) // 11MB
      const result = validators.validateFileSize(file, {
        maxSize: 10 * 1024 * 1024, // 10MB
      })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('不能超过')
      expect(result.message).toContain('10.00 MB')
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.FILE_TOO_LARGE)
    })

    it('应该拒绝过小的文件', () => {
      const file = createMockFile(512) // 512 bytes
      const result = validators.validateFileSize(file, {
        minSize: 1024, // 1KB
      })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('不能小于')
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.FILE_TOO_SMALL)
    })

    it('应该验证文件在最小和最大范围内', () => {
      const file = createMockFile(2 * 1024) // 2KB
      const result = validators.validateFileSize(file, {
        minSize: 1024, // 1KB
        maxSize: 10 * 1024, // 10KB
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('validateFileType', () => {
    it('应该验证允许的 MIME 类型', () => {
      const file = new File([''], 'image.png', { type: 'image/png' })
      const result = validators.validateFileType(file, {
        allowedTypes: validators.FILE_TYPES.IMAGE,
      })
      expect(result.valid).toBe(true)
    })

    it('应该拒绝不允许的 MIME 类型', () => {
      const file = new File([''], 'script.js', { type: 'text/javascript' })
      const result = validators.validateFileType(file, {
        allowedTypes: validators.FILE_TYPES.IMAGE,
      })
      expect(result.valid).toBe(false)
      expect(result.code).toBe(
        validators.VALIDATION_ERROR_CODES.INVALID_FILE_TYPE
      )
    })

    it('应该支持通配符类型', () => {
      const file = new File([''], 'image.png', { type: 'image/png' })
      const result = validators.validateFileType(file, {
        allowedTypes: ['image/*'],
      })
      expect(result.valid).toBe(true)
    })

    it('应该验证文件扩展名', () => {
      const file = new File([''], 'document.pdf', { type: 'application/pdf' })
      const result = validators.validateFileType(file, {
        allowedExtensions: ['pdf', 'doc', 'docx'],
      })
      expect(result.valid).toBe(true)
    })

    it('应该拒绝不允许的扩展名', () => {
      const file = new File([''], 'script.exe', { type: 'application/exe' })
      const result = validators.validateFileType(file, {
        allowedExtensions: ['pdf', 'doc'],
      })
      expect(result.valid).toBe(false)
      expect(result.code).toBe(
        validators.VALIDATION_ERROR_CODES.INVALID_EXTENSION
      )
    })

    it('应该忽略扩展名大小写', () => {
      const file = new File([''], 'document.PDF', { type: 'application/pdf' })
      const result = validators.validateFileType(file, {
        allowedExtensions: ['pdf'],
      })
      expect(result.valid).toBe(true)
    })
  })

  describe('validateFile', () => {
    it('应该综合验证文件大小和类型', () => {
      const file = new File(['x'.repeat(1024)], 'image.png', {
        type: 'image/png',
      })
      const result = validators.validateFile(file, {
        maxSize: 10 * 1024,
        allowedTypes: validators.FILE_TYPES.IMAGE,
      })
      expect(result.valid).toBe(true)
    })

    it('应该在大小验证失败时返回错误', () => {
      const file = new File(['x'.repeat(11 * 1024)], 'image.png', {
        type: 'image/png',
      })
      const result = validators.validateFile(file, {
        maxSize: 10 * 1024,
      })
      expect(result.valid).toBe(false)
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.FILE_TOO_LARGE)
    })

    it('应该在类型验证失败时返回错误', () => {
      const file = new File([''], 'script.js', { type: 'text/javascript' })
      const result = validators.validateFile(file, {
        allowedTypes: validators.FILE_TYPES.IMAGE,
      })
      expect(result.valid).toBe(false)
      expect(result.code).toBe(
        validators.VALIDATION_ERROR_CODES.INVALID_FILE_TYPE
      )
    })
  })

  describe('getFileTypeCategory', () => {
    it('应该识别图片类型', () => {
      expect(validators.getFileTypeCategory('image/png')).toBe('image')
      expect(validators.getFileTypeCategory('image/jpeg')).toBe('image')
    })

    it('应该识别文档类型', () => {
      expect(validators.getFileTypeCategory('application/pdf')).toBe('document')
      expect(validators.getFileTypeCategory('text/plain')).toBe('document')
    })

    it('应该识别音频类型', () => {
      expect(validators.getFileTypeCategory('audio/mpeg')).toBe('audio')
    })

    it('应该识别视频类型', () => {
      expect(validators.getFileTypeCategory('video/mp4')).toBe('video')
    })

    it('应该返回 other 对于未知类型', () => {
      expect(validators.getFileTypeCategory('application/unknown')).toBe('other')
    })
  })
})

describe('validators - URL 验证', () => {
  describe('validateUrl', () => {
    it('应该验证有效的 URL', () => {
      expect(validators.validateUrl('https://example.com').valid).toBe(true)
      expect(validators.validateUrl('http://localhost:3000').valid).toBe(true)
      expect(
        validators.validateUrl('https://example.com/path?query=value').valid
      ).toBe(true)
    })

    it('应该拒绝无效的 URL', () => {
      const result = validators.validateUrl('not a url')
      expect(result.valid).toBe(false)
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.INVALID_URL)
    })

    it('应该验证协议', () => {
      const result = validators.validateUrl('ftp://example.com', {
        allowedProtocols: ['http', 'https'],
      })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('不支持的协议')
    })

    it('应该允许指定的协议', () => {
      const result = validators.validateUrl('https://example.com', {
        allowedProtocols: ['https'],
      })
      expect(result.valid).toBe(true)
    })

    it('应该要求协议（当设置时）', () => {
      const result = validators.validateUrl('example.com', {
        requireProtocol: true,
      })
      // Note: 'example.com' without protocol will fail URL parsing
      expect(result.valid).toBe(false)
    })
  })

  describe('validateSafeUrl', () => {
    it('应该通过安全的 URL', () => {
      expect(validators.validateSafeUrl('https://example.com').valid).toBe(true)
      expect(validators.validateSafeUrl('http://example.com').valid).toBe(true)
    })

    it('应该拒绝 javascript: 协议', () => {
      const result = validators.validateSafeUrl('javascript:alert(1)')
      expect(result.valid).toBe(false)
      expect(result.message).toContain('不安全的协议')
    })

    it('应该拒绝 data: 协议', () => {
      const result = validators.validateSafeUrl('data:text/html,<script>alert(1)</script>')
      expect(result.valid).toBe(false)
    })

    it('应该拒绝 vbscript: 协议', () => {
      const result = validators.validateSafeUrl('vbscript:msgbox(1)')
      expect(result.valid).toBe(false)
    })

    it('应该拒绝 file: 协议', () => {
      const result = validators.validateSafeUrl('file:///etc/passwd')
      expect(result.valid).toBe(false)
    })

    it('应该忽略协议大小写', () => {
      const result = validators.validateSafeUrl('JAVASCRIPT:alert(1)')
      expect(result.valid).toBe(false)
    })
  })
})

describe('validators - 邮箱验证', () => {
  describe('validateEmail', () => {
    it('应该验证有效的邮箱', () => {
      expect(validators.validateEmail('user@example.com').valid).toBe(true)
      expect(validators.validateEmail('user.name@example.com').valid).toBe(true)
      expect(validators.validateEmail('user+tag@example.co.uk').valid).toBe(
        true
      )
    })

    it('应该拒绝无效的邮箱', () => {
      const result = validators.validateEmail('invalid-email')
      expect(result.valid).toBe(false)
      expect(result.message).toBe('邮箱格式不正确')
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.INVALID_EMAIL)
    })

    it('应该拒绝缺少 @ 符号的邮箱', () => {
      expect(validators.validateEmail('userexample.com').valid).toBe(false)
    })

    it('应该拒绝缺少域名的邮箱', () => {
      expect(validators.validateEmail('user@').valid).toBe(false)
    })

    it('应该拒绝缺少用户名的邮箱', () => {
      expect(validators.validateEmail('@example.com').valid).toBe(false)
    })
  })
})

describe('validators - 数字验证', () => {
  describe('validateNumberRange', () => {
    it('应该验证范围内的数字', () => {
      const result = validators.validateNumberRange(5, { min: 1, max: 10 })
      expect(result.valid).toBe(true)
    })

    it('应该拒绝小于最小值的数字', () => {
      const result = validators.validateNumberRange(0, { min: 1 })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('不能小于 1')
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.OUT_OF_RANGE)
    })

    it('应该拒绝大于最大值的数字', () => {
      const result = validators.validateNumberRange(15, { max: 10 })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('不能大于 10')
    })

    it('应该验证边界值', () => {
      expect(validators.validateNumberRange(1, { min: 1, max: 10 }).valid).toBe(
        true
      )
      expect(
        validators.validateNumberRange(10, { min: 1, max: 10 }).valid
      ).toBe(true)
    })

    it('应该拒绝浮点数（当设置 allowFloat=false）', () => {
      const result = validators.validateNumberRange(5.5, { allowFloat: false })
      expect(result.valid).toBe(false)
      expect(result.message).toBe('必须为整数')
    })

    it('应该允许浮点数（默认）', () => {
      const result = validators.validateNumberRange(5.5)
      expect(result.valid).toBe(true)
    })
  })

  describe('validatePositiveNumber', () => {
    it('应该验证正数', () => {
      expect(validators.validatePositiveNumber(5).valid).toBe(true)
      expect(validators.validatePositiveNumber(0.1).valid).toBe(true)
    })

    it('应该拒绝负数', () => {
      const result = validators.validatePositiveNumber(-5)
      expect(result.valid).toBe(false)
      expect(result.message).toBe('必须为正数')
    })

    it('应该拒绝零（默认）', () => {
      const result = validators.validatePositiveNumber(0)
      expect(result.valid).toBe(false)
    })

    it('应该允许零（当设置 allowZero=true）', () => {
      const result = validators.validatePositiveNumber(0, true)
      expect(result.valid).toBe(true)
    })

    it('应该有正确的错误消息（允许零时）', () => {
      const result = validators.validatePositiveNumber(-1, true)
      expect(result.message).toBe('必须为非负数')
    })
  })
})

describe('validators - 密码验证', () => {
  describe('validatePasswordStrength', () => {
    it('应该验证强密码', () => {
      const result = validators.validatePasswordStrength('Abc123!@#')
      expect(result.valid).toBe(true)
    })

    it('应该拒绝过短的密码', () => {
      const result = validators.validatePasswordStrength('Abc1!', {
        minLength: 8,
      })
      expect(result.valid).toBe(false)
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.PASSWORD_TOO_WEAK)
      expect(result.message).toContain('长度')
    })

    it('应该拒绝缺少大写字母的密码', () => {
      const result = validators.validatePasswordStrength('abc123!@#', {
        requireUppercase: true,
      })
      expect(result.valid).toBe(false)
      expect(result.code).toBe(
        validators.VALIDATION_ERROR_CODES.PASSWORD_TOO_WEAK
      )
      expect(result.message).toContain('大写字母')
    })

    it('应该拒绝缺少小写字母的密码', () => {
      const result = validators.validatePasswordStrength('ABC123!@#', {
        requireLowercase: true,
      })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('小写字母')
    })

    it('应该拒绝缺少数字的密码', () => {
      const result = validators.validatePasswordStrength('Abcdef!@#', {
        requireNumbers: true,
      })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('数字')
    })

    it('应该拒绝缺少特殊字符的密码', () => {
      const result = validators.validatePasswordStrength('Abc12345', {
        requireSpecialChars: true,
      })
      expect(result.valid).toBe(false)
      expect(result.message).toContain('特殊字符')
    })

    it('应该列出所有缺失的要求', () => {
      const result = validators.validatePasswordStrength('abc', {
        minLength: 8,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
      })
      expect(result.valid).toBe(false)
      expect(result.data?.errors).toHaveLength(4) // 长度、大写、数字、特殊字符
    })

    it('应该支持自定义选项', () => {
      const result = validators.validatePasswordStrength('abc123', {
        minLength: 6,
        requireUppercase: false,
        requireLowercase: false,
        requireNumbers: false,
        requireSpecialChars: false,
      })
      expect(result.valid).toBe(true)
    })
  })
})

describe('validators - 消息验证', () => {
  describe('validateMessage', () => {
    it('应该验证有效的消息', () => {
      const result = validators.validateMessage('Hello, world!')
      expect(result.valid).toBe(true)
    })

    it('应该拒绝空消息（默认）', () => {
      const result = validators.validateMessage('')
      expect(result.valid).toBe(false)
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.REQUIRED)
    })

    it('应该允许空消息（当设置 allowEmpty）', () => {
      const result = validators.validateMessage('', { allowEmpty: true })
      expect(result.valid).toBe(true)
    })

    it('应该拒绝过长的消息', () => {
      const longMessage = 'x'.repeat(10001)
      const result = validators.validateMessage(longMessage, { maxLength: 10000 })
      expect(result.valid).toBe(false)
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.TOO_LONG)
    })

    it('应该拒绝过短的消息', () => {
      const result = validators.validateMessage('hi', { minLength: 3 })
      expect(result.valid).toBe(false)
      expect(result.code).toBe(validators.VALIDATION_ERROR_CODES.TOO_SHORT)
    })

    it('应该检测 XSS 攻击（默认）', () => {
      const result = validators.validateMessage('<script>alert("xss")</script>')
      expect(result.valid).toBe(false)
      expect(result.code).toBe(
        validators.VALIDATION_ERROR_CODES.CONTAINS_MALICIOUS_CONTENT
      )
    })

    it('应该跳过 XSS 检测（当设置 checkXSS=false）', () => {
      const result = validators.validateMessage(
        '<script>alert("xss")</script>',
        { checkXSS: false }
      )
      // 仍然会因为长度验证通过，但不会因为 XSS 失败
      expect(result.valid).toBe(true)
    })

    it('应该检测敏感词', () => {
      const result = validators.validateMessage('这包含敏感词', {
        sensitiveWords: ['敏感词'],
      })
      expect(result.valid).toBe(false)
      expect(result.code).toBe(
        validators.VALIDATION_ERROR_CODES.CONTAINS_MALICIOUS_CONTENT
      )
    })

    it('应该综合验证多个条件', () => {
      const result = validators.validateMessage('正常的消息内容', {
        minLength: 5,
        maxLength: 100,
        checkXSS: true,
        sensitiveWords: ['禁词'],
      })
      expect(result.valid).toBe(true)
    })
  })
})

describe('validators - 批量验证', () => {
  describe('validateAll', () => {
    it('应该通过所有验证规则', () => {
      const result = validators.validateAll('test@example.com', [
        {
          name: 'required',
          validator: (v) => validators.isRequired(v),
        },
        {
          name: 'email',
          validator: (v) => validators.validateEmail(v),
        },
      ])
      expect(result.valid).toBe(true)
    })

    it('应该在第一个失败的规则停止', () => {
      const result = validators.validateAll('', [
        {
          name: 'required',
          validator: (v) => validators.isRequired(v),
          message: '邮箱不能为空',
        },
        {
          name: 'email',
          validator: (v) => validators.validateEmail(v),
        },
      ])
      expect(result.valid).toBe(false)
      expect(result.message).toBe('邮箱不能为空')
    })

    it('应该支持返回布尔值的验证器', () => {
      const result = validators.validateAll('hello', [
        {
          name: 'custom',
          validator: (v) => v.length > 3,
          message: '长度必须大于3',
        },
      ])
      expect(result.valid).toBe(true)
    })

    it('应该处理布尔验证器失败的情况', () => {
      const result = validators.validateAll('hi', [
        {
          name: 'custom',
          validator: (v) => v.length > 3,
          message: '长度必须大于3',
        },
      ])
      expect(result.valid).toBe(false)
      expect(result.message).toBe('长度必须大于3')
    })
  })

  describe('validateSchema', () => {
    it('应该验证所有字段', () => {
      const result = validators.validateSchema(
        {
          email: 'test@example.com',
          age: 25,
        },
        {
          email: [(v) => validators.validateEmail(v)],
          age: [(v) => validators.validateNumberRange(v, { min: 0, max: 150 })],
        }
      )
      expect(result.valid).toBe(true)
      expect(result.errors).toEqual({})
    })

    it('应该收集所有字段的错误', () => {
      const result = validators.validateSchema(
        {
          email: 'invalid-email',
          age: 200,
        },
        {
          email: [(v) => validators.validateEmail(v)],
          age: [(v) => validators.validateNumberRange(v, { min: 0, max: 150 })],
        }
      )
      expect(result.valid).toBe(false)
      expect(result.errors.email).toBe('邮箱格式不正确')
      expect(result.errors.age).toContain('不能大于 150')
    })

    it('应该在第一个失败的验证器停止（每个字段）', () => {
      const result = validators.validateSchema(
        {
          password: 'weak',
        },
        {
          password: [
            (v) => validators.validateTextLength(v, { minLength: 8 }),
            (v) => validators.validatePasswordStrength(v),
          ],
        }
      )
      expect(result.valid).toBe(false)
      expect(result.errors.password).toContain('不能少于8个字符')
    })

    it('应该验证多个验证器', () => {
      const result = validators.validateSchema(
        {
          email: 'test@example.com',
        },
        {
          email: [
            (v) => validators.isRequired(v),
            (v) => validators.validateEmail(v),
          ],
        }
      )
      expect(result.valid).toBe(true)
    })
  })
})

describe('validators - 常量和工具', () => {
  it('应该导出文件类型常量', () => {
    expect(validators.FILE_TYPES.IMAGE).toBeDefined()
    expect(validators.FILE_TYPES.DOCUMENT).toBeDefined()
    expect(validators.FILE_TYPES.AUDIO).toBeDefined()
    expect(validators.FILE_TYPES.VIDEO).toBeDefined()
    expect(Array.isArray(validators.FILE_TYPES.IMAGE)).toBe(true)
  })

  it('应该导出正则表达式常量', () => {
    expect(validators.REGEX_PATTERNS.EMAIL).toBeInstanceOf(RegExp)
    expect(validators.REGEX_PATTERNS.URL).toBeInstanceOf(RegExp)
    expect(validators.REGEX_PATTERNS.PHONE_CN).toBeInstanceOf(RegExp)
    expect(validators.REGEX_PATTERNS.HEX_COLOR).toBeInstanceOf(RegExp)
  })

  it('应该导出验证错误代码常量', () => {
    expect(validators.VALIDATION_ERROR_CODES.REQUIRED).toBe('REQUIRED')
    expect(validators.VALIDATION_ERROR_CODES.INVALID_FORMAT).toBe(
      'INVALID_FORMAT'
    )
    expect(validators.VALIDATION_ERROR_CODES.TOO_SHORT).toBe('TOO_SHORT')
    expect(validators.VALIDATION_ERROR_CODES.TOO_LONG).toBe('TOO_LONG')
  })
})

