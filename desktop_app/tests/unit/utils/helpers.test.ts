/**
 * 工具函数测试
 * 
 * 测试 helpers.ts 中的所有工具函数
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as helpers from '../../../src/utils/helpers'

describe('helpers - 对象处理函数', () => {
  describe('deepClone', () => {
    it('应该能够深度克隆简单对象', () => {
      const obj = { a: 1, b: 2, c: { d: 3 } }
      const cloned = helpers.deepClone(obj)
      
      expect(cloned).toEqual(obj)
      expect(cloned).not.toBe(obj)
      expect(cloned.c).not.toBe(obj.c)
    })

    it('应该能够克隆数组', () => {
      const arr = [1, 2, [3, 4]]
      const cloned = helpers.deepClone(arr)
      
      expect(cloned).toEqual(arr)
      expect(cloned).not.toBe(arr)
      expect(cloned[2]).not.toBe(arr[2])
    })

    it('应该能够克隆日期对象', () => {
      const date = new Date('2024-01-01')
      const cloned = helpers.deepClone(date)
      
      expect(cloned).toEqual(date)
      expect(cloned).not.toBe(date)
    })

    it('应该正确处理 null 和 undefined', () => {
      expect(helpers.deepClone(null)).toBe(null)
      expect(helpers.deepClone(undefined)).toBe(undefined)
    })

    it('应该正确处理原始类型', () => {
      expect(helpers.deepClone(42)).toBe(42)
      expect(helpers.deepClone('hello')).toBe('hello')
      expect(helpers.deepClone(true)).toBe(true)
    })
  })

  describe('deepMerge', () => {
    it('应该能够深度合并对象', () => {
      const target = { a: 1, b: { c: 2 } }
      const source = { b: { d: 3 }, e: 4 }
      const result = helpers.deepMerge(target, source)
      
      expect(result).toEqual({
        a: 1,
        b: { c: 2, d: 3 },
        e: 4,
      })
    })

    it('应该能够合并多个源对象', () => {
      const target = { a: 1 }
      const source1 = { b: 2 }
      const source2 = { c: 3 }
      const result = helpers.deepMerge(target, source1, source2)
      
      expect(result).toEqual({ a: 1, b: 2, c: 3 })
    })

    it('应该覆盖目标对象的值', () => {
      const target = { a: 1, b: 2 }
      const source = { b: 3 }
      const result = helpers.deepMerge(target, source)
      
      expect(result.b).toBe(3)
    })

    it('没有源对象时应该返回目标对象', () => {
      const target = { a: 1 }
      const result = helpers.deepMerge(target)
      
      expect(result).toBe(target)
    })
  })

  describe('isObject', () => {
    it('应该正确识别对象', () => {
      expect(helpers.isObject({})).toBe(true)
      expect(helpers.isObject({ a: 1 })).toBe(true)
    })

    it('应该拒绝非对象类型', () => {
      expect(helpers.isObject(null)).toBe(false)
      expect(helpers.isObject([])).toBe(false)
      expect(helpers.isObject('string')).toBe(false)
      expect(helpers.isObject(42)).toBe(false)
      expect(helpers.isObject(undefined)).toBe(false)
    })
  })

  describe('getNestedValue', () => {
    it('应该能够获取嵌套属性值', () => {
      const obj = { a: { b: { c: 42 } } }
      expect(helpers.getNestedValue(obj, 'a.b.c')).toBe(42)
    })

    it('应该在路径不存在时返回默认值', () => {
      const obj = { a: { b: 1 } }
      expect(helpers.getNestedValue(obj, 'a.x.y', 'default')).toBe('default')
    })

    it('应该处理 null 和 undefined', () => {
      const obj = { a: null }
      expect(helpers.getNestedValue(obj, 'a.b', 'default')).toBe('default')
    })
  })

  describe('setNestedValue', () => {
    it('应该能够设置嵌套属性值', () => {
      const obj: any = { a: { b: 1 } }
      helpers.setNestedValue(obj, 'a.b', 42)
      expect(obj.a.b).toBe(42)
    })

    it('应该创建不存在的路径', () => {
      const obj: any = {}
      helpers.setNestedValue(obj, 'a.b.c', 42)
      expect(obj.a.b.c).toBe(42)
    })
  })

  describe('pick', () => {
    it('应该能够挑选指定的键', () => {
      const obj = { a: 1, b: 2, c: 3 }
      const result = helpers.pick(obj, ['a', 'c'])
      expect(result).toEqual({ a: 1, c: 3 })
    })

    it('应该忽略不存在的键', () => {
      const obj = { a: 1, b: 2 }
      const result = helpers.pick(obj, ['a', 'c' as any])
      expect(result).toEqual({ a: 1 })
    })
  })

  describe('omit', () => {
    it('应该能够排除指定的键', () => {
      const obj = { a: 1, b: 2, c: 3 }
      const result = helpers.omit(obj, ['b'])
      expect(result).toEqual({ a: 1, c: 3 })
    })

    it('应该忽略不存在的键', () => {
      const obj = { a: 1, b: 2 }
      const result = helpers.omit(obj, ['c' as any])
      expect(result).toEqual({ a: 1, b: 2 })
    })
  })

  describe('isEmpty', () => {
    it('应该正确判断空对象', () => {
      expect(helpers.isEmpty({})).toBe(true)
      expect(helpers.isEmpty({ a: 1 })).toBe(false)
    })

    it('应该正确判断空数组', () => {
      expect(helpers.isEmpty([])).toBe(true)
      expect(helpers.isEmpty([1])).toBe(false)
    })

    it('应该正确判断空字符串', () => {
      expect(helpers.isEmpty('')).toBe(true)
      expect(helpers.isEmpty('hello')).toBe(false)
    })

    it('应该正确判断 null 和 undefined', () => {
      expect(helpers.isEmpty(null)).toBe(true)
      expect(helpers.isEmpty(undefined)).toBe(true)
    })
  })

  describe('deepEqual', () => {
    it('应该正确比较相等的对象', () => {
      const obj1 = { a: 1, b: { c: 2 } }
      const obj2 = { a: 1, b: { c: 2 } }
      expect(helpers.deepEqual(obj1, obj2)).toBe(true)
    })

    it('应该正确比较不相等的对象', () => {
      const obj1 = { a: 1, b: 2 }
      const obj2 = { a: 1, b: 3 }
      expect(helpers.deepEqual(obj1, obj2)).toBe(false)
    })

    it('应该正确处理原始类型', () => {
      expect(helpers.deepEqual(42, 42)).toBe(true)
      expect(helpers.deepEqual('hello', 'hello')).toBe(true)
      expect(helpers.deepEqual(42, 43)).toBe(false)
    })

    it('应该正确处理 null', () => {
      expect(helpers.deepEqual(null, null)).toBe(true)
      expect(helpers.deepEqual(null, undefined)).toBe(false)
    })
  })
})

describe('helpers - 数组处理函数', () => {
  describe('unique', () => {
    it('应该能够去重数组', () => {
      const arr = [1, 2, 2, 3, 3, 3]
      expect(helpers.unique(arr)).toEqual([1, 2, 3])
    })

    it('应该能够处理字符串数组', () => {
      const arr = ['a', 'b', 'a', 'c', 'b']
      expect(helpers.unique(arr)).toEqual(['a', 'b', 'c'])
    })
  })

  describe('uniqueBy', () => {
    it('应该根据属性去重', () => {
      const arr = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
        { id: 1, name: 'c' },
      ]
      const result = helpers.uniqueBy(arr, 'id')
      expect(result).toHaveLength(2)
      expect(result[0].id).toBe(1)
      expect(result[1].id).toBe(2)
    })
  })

  describe('chunk', () => {
    it('应该能够分块数组', () => {
      const arr = [1, 2, 3, 4, 5]
      const result = helpers.chunk(arr, 2)
      expect(result).toEqual([[1, 2], [3, 4], [5]])
    })

    it('应该处理空数组', () => {
      const result = helpers.chunk([], 2)
      expect(result).toEqual([])
    })
  })

  describe('flatten', () => {
    it('应该能够扁平化数组', () => {
      const arr = [1, [2, [3, [4]]]]
      expect(helpers.flatten(arr)).toEqual([1, 2, 3, 4])
    })

    it('应该支持深度参数', () => {
      const arr = [1, [2, [3, [4]]]]
      expect(helpers.flatten(arr, 1)).toEqual([1, 2, [3, [4]]])
      expect(helpers.flatten(arr, 2)).toEqual([1, 2, 3, [4]])
    })
  })

  describe('groupBy', () => {
    it('应该根据属性分组', () => {
      const arr = [
        { type: 'a', value: 1 },
        { type: 'b', value: 2 },
        { type: 'a', value: 3 },
      ]
      const result = helpers.groupBy(arr, 'type')
      expect(result).toHaveProperty('a')
      expect(result).toHaveProperty('b')
      expect(result.a).toHaveLength(2)
      expect(result.b).toHaveLength(1)
    })
  })

  describe('shuffle', () => {
    it('应该能够打乱数组', () => {
      const arr = [1, 2, 3, 4, 5]
      const shuffled = helpers.shuffle(arr)
      
      expect(shuffled).toHaveLength(arr.length)
      expect(shuffled).toEqual(expect.arrayContaining(arr))
      expect(arr).toEqual([1, 2, 3, 4, 5]) // 原数组不变
    })
  })

  describe('sum', () => {
    it('应该能够计算数组总和', () => {
      expect(helpers.sum([1, 2, 3, 4, 5])).toBe(15)
      expect(helpers.sum([0])).toBe(0)
      expect(helpers.sum([])).toBe(0)
    })
  })

  describe('average', () => {
    it('应该能够计算平均值', () => {
      expect(helpers.average([1, 2, 3, 4, 5])).toBe(3)
      expect(helpers.average([10])).toBe(10)
      expect(helpers.average([])).toBe(0)
    })
  })

  describe('max', () => {
    it('应该能够找到最大值', () => {
      expect(helpers.max([1, 5, 3, 2, 4])).toBe(5)
      expect(helpers.max([1])).toBe(1)
      expect(helpers.max([-1, -5, -3])).toBe(-1)
    })
  })

  describe('min', () => {
    it('应该能够找到最小值', () => {
      expect(helpers.min([1, 5, 3, 2, 4])).toBe(1)
      expect(helpers.min([1])).toBe(1)
      expect(helpers.min([-1, -5, -3])).toBe(-5)
    })
  })
})

describe('helpers - 字符串处理函数', () => {
  describe('capitalize', () => {
    it('应该能够首字母大写', () => {
      expect(helpers.capitalize('hello')).toBe('Hello')
      expect(helpers.capitalize('HELLO')).toBe('Hello')
      expect(helpers.capitalize('')).toBe('')
    })
  })

  describe('camelToSnake', () => {
    it('应该能够转换驼峰到下划线', () => {
      expect(helpers.camelToSnake('helloWorld')).toBe('hello_world')
      expect(helpers.camelToSnake('HelloWorld')).toBe('_hello_world')
      expect(helpers.camelToSnake('hello')).toBe('hello')
    })
  })

  describe('snakeToCamel', () => {
    it('应该能够转换下划线到驼峰', () => {
      expect(helpers.snakeToCamel('hello_world')).toBe('helloWorld')
      expect(helpers.snakeToCamel('hello')).toBe('hello')
      expect(helpers.snakeToCamel('hello_world_test')).toBe('helloWorldTest')
    })
  })

  describe('truncate', () => {
    it('应该能够截断字符串', () => {
      expect(helpers.truncate('hello world', 8)).toBe('hello...')
      expect(helpers.truncate('hello', 10)).toBe('hello')
    })

    it('应该支持自定义后缀', () => {
      expect(helpers.truncate('hello world', 8, '---')).toBe('hello---')
    })
  })

  describe('randomString', () => {
    it('应该生成指定长度的随机字符串', () => {
      const str = helpers.randomString(10)
      expect(str).toHaveLength(10)
      expect(typeof str).toBe('string')
    })

    it('应该支持自定义字符集', () => {
      const str = helpers.randomString(10, '01')
      expect(str).toHaveLength(10)
      expect(str).toMatch(/^[01]+$/)
    })
  })

  describe('uuid', () => {
    it('应该生成有效的 UUID', () => {
      const id = helpers.uuid()
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
    })

    it('每次生成的 UUID 应该不同', () => {
      const id1 = helpers.uuid()
      const id2 = helpers.uuid()
      expect(id1).not.toBe(id2)
    })
  })

  describe('toBase64 和 fromBase64', () => {
    it('应该能够编码和解码 Base64', () => {
      const original = 'Hello, World! 你好世界'
      const encoded = helpers.toBase64(original)
      const decoded = helpers.fromBase64(encoded)
      expect(decoded).toBe(original)
    })
  })
})

describe('helpers - 数字处理函数', () => {
  describe('formatNumber', () => {
    it('应该格式化数字', () => {
      expect(helpers.formatNumber(123.456, 2)).toBe('123.46')
      expect(helpers.formatNumber(123.456, 0)).toBe('123')
      expect(helpers.formatNumber(123, 2)).toBe('123.00')
    })
  })

  describe('formatThousands', () => {
    it('应该添加千分位分隔符', () => {
      expect(helpers.formatThousands(1234567)).toBe('1,234,567')
      expect(helpers.formatThousands(123)).toBe('123')
    })
  })

  describe('formatPercent', () => {
    it('应该格式化百分比', () => {
      expect(helpers.formatPercent(50, 100, 0)).toBe('50%')
      expect(helpers.formatPercent(1, 3, 2)).toBe('33.33%')
    })

    it('应该处理除零错误', () => {
      expect(helpers.formatPercent(50, 0)).toBe('0%')
    })
  })

  describe('clamp', () => {
    it('应该限制数字范围', () => {
      expect(helpers.clamp(5, 0, 10)).toBe(5)
      expect(helpers.clamp(-5, 0, 10)).toBe(0)
      expect(helpers.clamp(15, 0, 10)).toBe(10)
    })
  })

  describe('randomInt', () => {
    it('应该生成指定范围的随机整数', () => {
      const num = helpers.randomInt(1, 10)
      expect(num).toBeGreaterThanOrEqual(1)
      expect(num).toBeLessThanOrEqual(10)
      expect(Number.isInteger(num)).toBe(true)
    })
  })

  describe('randomFloat', () => {
    it('应该生成指定范围的随机浮点数', () => {
      const num = helpers.randomFloat(1.0, 10.0, 2)
      expect(num).toBeGreaterThanOrEqual(1.0)
      expect(num).toBeLessThanOrEqual(10.0)
    })
  })
})

describe('helpers - 验证函数', () => {
  describe('isValidEmail', () => {
    it('应该验证有效的邮箱', () => {
      expect(helpers.isValidEmail('test@example.com')).toBe(true)
      expect(helpers.isValidEmail('user.name@domain.co.uk')).toBe(true)
    })

    it('应该拒绝无效的邮箱', () => {
      expect(helpers.isValidEmail('invalid')).toBe(false)
      expect(helpers.isValidEmail('@example.com')).toBe(false)
      expect(helpers.isValidEmail('test@')).toBe(false)
    })
  })

  describe('isValidUrl', () => {
    it('应该验证有效的 URL', () => {
      expect(helpers.isValidUrl('https://example.com')).toBe(true)
      expect(helpers.isValidUrl('http://localhost:3000')).toBe(true)
    })

    it('应该拒绝无效的 URL', () => {
      expect(helpers.isValidUrl('invalid')).toBe(false)
      expect(helpers.isValidUrl('not a url')).toBe(false)
    })
  })

  describe('isValidPort', () => {
    it('应该验证有效的端口号', () => {
      expect(helpers.isValidPort(80)).toBe(true)
      expect(helpers.isValidPort('8080')).toBe(true)
      expect(helpers.isValidPort(65535)).toBe(true)
    })

    it('应该拒绝无效的端口号', () => {
      expect(helpers.isValidPort(0)).toBe(false)
      expect(helpers.isValidPort(65536)).toBe(false)
      expect(helpers.isValidPort(-1)).toBe(false)
    })
  })
})

describe('helpers - 性能优化函数', () => {
  describe('sleep', () => {
    it('应该能够延迟执行', async () => {
      const start = Date.now()
      await helpers.sleep(100)
      const end = Date.now()
      expect(end - start).toBeGreaterThanOrEqual(90)
    })
  })

  describe('retry', () => {
    it('应该在成功时立即返回', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await helpers.retry(fn, { maxAttempts: 3 })
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该在失败时重试', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')
      
      const result = await helpers.retry(fn, { maxAttempts: 3, delay: 10 })
      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('应该在达到最大重试次数后抛出错误', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('always fail'))
      
      await expect(
        helpers.retry(fn, { maxAttempts: 3, delay: 10 })
      ).rejects.toThrow('always fail')
      
      expect(fn).toHaveBeenCalledTimes(3)
    })
  })

  describe('timeout', () => {
    it('应该在超时前返回结果', async () => {
      const promise = Promise.resolve('success')
      const result = await helpers.timeout(promise, 1000)
      expect(result).toBe('success')
    })

    it('应该在超时后抛出错误', async () => {
      const promise = new Promise(resolve => setTimeout(resolve, 200))
      await expect(
        helpers.timeout(promise, 100)
      ).rejects.toThrow('Operation timed out')
    })
  })
})

describe('helpers - 其他工具函数', () => {
  describe('safeJsonParse', () => {
    it('应该能够安全解析 JSON', () => {
      expect(helpers.safeJsonParse('{"a":1}')).toEqual({ a: 1 })
      expect(helpers.safeJsonParse('[1,2,3]')).toEqual([1, 2, 3])
    })

    it('应该在解析失败时返回默认值', () => {
      expect(helpers.safeJsonParse('invalid', { default: true })).toEqual({ default: true })
      expect(helpers.safeJsonParse('invalid')).toBe(null)
    })
  })

  describe('safeJsonStringify', () => {
    it('应该能够安全序列化 JSON', () => {
      expect(helpers.safeJsonStringify({ a: 1 })).toBe('{"a":1}')
      expect(helpers.safeJsonStringify({ a: 1 }, true)).toContain('\n')
    })

    it('应该在序列化失败时返回 null', () => {
      const circular: any = {}
      circular.self = circular
      expect(helpers.safeJsonStringify(circular)).toBe(null)
    })
  })

  describe('getType', () => {
    it('应该正确获取数据类型', () => {
      expect(helpers.getType({})).toBe('object')
      expect(helpers.getType([])).toBe('array')
      expect(helpers.getType('hello')).toBe('string')
      expect(helpers.getType(42)).toBe('number')
      expect(helpers.getType(true)).toBe('boolean')
      expect(helpers.getType(null)).toBe('null')
      expect(helpers.getType(undefined)).toBe('undefined')
      expect(helpers.getType(new Date())).toBe('date')
      expect(helpers.getType(/regex/)).toBe('regexp')
    })
  })

  describe('is 类型检查', () => {
    it('应该正确检查字符串', () => {
      expect(helpers.is.string('hello')).toBe(true)
      expect(helpers.is.string(42)).toBe(false)
    })

    it('应该正确检查数字', () => {
      expect(helpers.is.number(42)).toBe(true)
      expect(helpers.is.number(NaN)).toBe(false)
      expect(helpers.is.number('42')).toBe(false)
    })

    it('应该正确检查布尔值', () => {
      expect(helpers.is.boolean(true)).toBe(true)
      expect(helpers.is.boolean(false)).toBe(true)
      expect(helpers.is.boolean(1)).toBe(false)
    })

    it('应该正确检查数组', () => {
      expect(helpers.is.array([])).toBe(true)
      expect(helpers.is.array([1, 2, 3])).toBe(true)
      expect(helpers.is.array({})).toBe(false)
    })

    it('应该正确检查对象', () => {
      expect(helpers.is.object({})).toBe(true)
      expect(helpers.is.object([])).toBe(false)
      expect(helpers.is.object(null)).toBe(false)
    })

    it('应该正确检查 null 和 undefined', () => {
      expect(helpers.is.null(null)).toBe(true)
      expect(helpers.is.undefined(undefined)).toBe(true)
      expect(helpers.is.nil(null)).toBe(true)
      expect(helpers.is.nil(undefined)).toBe(true)
    })
  })

  describe('hashCode', () => {
    it('应该生成一致的哈希值', () => {
      const hash1 = helpers.hashCode('hello')
      const hash2 = helpers.hashCode('hello')
      expect(hash1).toBe(hash2)
    })

    it('不同字符串应该生成不同的哈希值', () => {
      const hash1 = helpers.hashCode('hello')
      const hash2 = helpers.hashCode('world')
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('throttle', () => {
    it('应该节流函数调用', async () => {
      const fn = vi.fn()
      const throttled = helpers.throttle(fn, 100)
      
      throttled()
      throttled()
      throttled()
      
      expect(fn).toHaveBeenCalledTimes(1)
      
      await helpers.sleep(150)
      throttled()
      
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('debounce', () => {
    it('应该防抖函数调用', async () => {
      const fn = vi.fn()
      const debounced = helpers.debounce(fn, 100)
      
      debounced()
      debounced()
      debounced()
      
      expect(fn).toHaveBeenCalledTimes(0)
      
      await helpers.sleep(150)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('应该支持立即执行模式', async () => {
      const fn = vi.fn()
      const debounced = helpers.debounce(fn, 100, true)
      
      debounced()
      expect(fn).toHaveBeenCalledTimes(1)
      
      debounced()
      debounced()
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })
})

