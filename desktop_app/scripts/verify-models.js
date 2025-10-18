#!/usr/bin/env node

/**
 * Live2D 模型验证脚本
 * 检查所有模型文件的完整性和可访问性
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// 模型目录路径
const modelsDir = path.join(__dirname, '../public/live2d_models')
const modelsJsonPath = path.join(modelsDir, 'models.json')

// 验证结果统计
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  warnings: 0,
  errors: []
}

/**
 * 检查文件是否存在
 */
function fileExists(filePath) {
  try {
    return fs.existsSync(filePath)
  } catch (error) {
    return false
  }
}

/**
 * 获取文件大小（人类可读格式）
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath)
    const bytes = stats.size
    
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  } catch (error) {
    return 'N/A'
  }
}

/**
 * 验证模型配置文件
 */
function verifyModelConfig(modelPath) {
  const fullPath = path.join(modelsDir, modelPath.replace('/live2d_models/', ''))
  
  if (!fileExists(fullPath)) {
    return {
      valid: false,
      error: `模型配置文件不存在: ${modelPath}`
    }
  }

  try {
    const content = fs.readFileSync(fullPath, 'utf-8')
    const config = JSON.parse(content)
    
    // 检查必需字段
    if (!config.FileReferences) {
      return {
        valid: false,
        error: '缺少 FileReferences 字段'
      }
    }

    if (!config.FileReferences.Moc) {
      return {
        valid: false,
        error: '缺少 Moc 文件引用'
      }
    }

    // 检查相关文件
    const baseDir = path.dirname(fullPath)
    const mocPath = path.join(baseDir, config.FileReferences.Moc)
    
    if (!fileExists(mocPath)) {
      return {
        valid: false,
        error: `Moc 文件不存在: ${config.FileReferences.Moc}`
      }
    }

    // 统计资源
    const resources = {
      textures: config.FileReferences.Textures?.length || 0,
      motions: 0,
      expressions: config.FileReferences.Expressions?.length || 0,
      physics: config.FileReferences.Physics ? 1 : 0
    }

    if (config.FileReferences.Motions) {
      Object.keys(config.FileReferences.Motions).forEach(key => {
        resources.motions += config.FileReferences.Motions[key].length
      })
    }

    return {
      valid: true,
      resources,
      size: getFileSize(fullPath)
    }
  } catch (error) {
    return {
      valid: false,
      error: `解析配置文件失败: ${error.message}`
    }
  }
}

/**
 * 验证预览图片
 */
function verifyPreviewImage(imagePath) {
  const fullPath = path.join(modelsDir, imagePath.replace('/live2d_models/', ''))
  
  if (!fileExists(fullPath)) {
    return {
      valid: false,
      error: '预览图片不存在'
    }
  }

  return {
    valid: true,
    size: getFileSize(fullPath)
  }
}

/**
 * 主验证流程
 */
async function main() {
  log('\n🔍 Live2D 模型验证工具\n', 'cyan')

  // 检查 models.json
  if (!fileExists(modelsJsonPath)) {
    log('❌ 错误: models.json 文件不存在', 'red')
    process.exit(1)
  }

  // 读取模型库配置
  let modelsConfig
  try {
    const content = fs.readFileSync(modelsJsonPath, 'utf-8')
    modelsConfig = JSON.parse(content)
  } catch (error) {
    log(`❌ 错误: 无法解析 models.json - ${error.message}`, 'red')
    process.exit(1)
  }

  if (!modelsConfig.models || !Array.isArray(modelsConfig.models)) {
    log('❌ 错误: models.json 格式不正确', 'red')
    process.exit(1)
  }

  log(`📦 找到 ${modelsConfig.models.length} 个模型配置\n`, 'blue')

  results.total = modelsConfig.models.length

  // 验证每个模型
  for (const model of modelsConfig.models) {
    log(`\n🎭 验证模型: ${model.name} (${model.id})`, 'yellow')
    log(`   显示名称: ${model.displayName}`)
    log(`   描述: ${model.description}`)
    log(`   性别: ${model.gender}`)
    log(`   预估大小: ${model.size}`)

    let modelPassed = true

    // 验证模型配置文件
    log(`   🔧 检查模型配置: ${model.path}`)
    const configResult = verifyModelConfig(model.path)
    
    if (configResult.valid) {
      log(`      ✅ 配置文件有效 (${configResult.size})`, 'green')
      log(`      📊 资源统计:`)
      log(`         - 纹理: ${configResult.resources.textures}`)
      log(`         - 动作: ${configResult.resources.motions}`)
      log(`         - 表情: ${configResult.resources.expressions}`)
      log(`         - 物理: ${configResult.resources.physics}`)
    } else {
      log(`      ❌ ${configResult.error}`, 'red')
      results.errors.push(`${model.id}: ${configResult.error}`)
      modelPassed = false
    }

    // 验证预览图片
    log(`   🖼️  检查预览图片: ${model.previewImage}`)
    const imageResult = verifyPreviewImage(model.previewImage)
    
    if (imageResult.valid) {
      log(`      ✅ 预览图片有效 (${imageResult.size})`, 'green')
    } else {
      log(`      ⚠️  ${imageResult.error}`, 'yellow')
      results.warnings++
    }

    // 验证特性标签
    if (!model.features || model.features.length === 0) {
      log(`      ⚠️  缺少特性标签`, 'yellow')
      results.warnings++
    }

    if (modelPassed) {
      results.passed++
      log(`   ✅ 模型验证通过`, 'green')
    } else {
      results.failed++
      log(`   ❌ 模型验证失败`, 'red')
    }
  }

  // 输出总结
  log('\n' + '='.repeat(60), 'cyan')
  log('📊 验证结果总结', 'cyan')
  log('='.repeat(60), 'cyan')
  log(`总计: ${results.total} 个模型`)
  log(`通过: ${results.passed} 个`, results.passed === results.total ? 'green' : 'yellow')
  log(`失败: ${results.failed} 个`, results.failed > 0 ? 'red' : 'green')
  log(`警告: ${results.warnings} 个`, results.warnings > 0 ? 'yellow' : 'green')

  if (results.errors.length > 0) {
    log('\n❌ 错误详情:', 'red')
    results.errors.forEach(error => {
      log(`   - ${error}`, 'red')
    })
  }

  log('\n' + '='.repeat(60) + '\n', 'cyan')

  // 返回退出码
  process.exit(results.failed > 0 ? 1 : 0)
}

// 运行验证
main().catch(error => {
  log(`\n❌ 验证过程出错: ${error.message}`, 'red')
  console.error(error)
  process.exit(1)
})

