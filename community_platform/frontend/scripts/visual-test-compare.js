#!/usr/bin/env node

/**
 * 视觉测试比对工具
 * 用于比对基准截图和新截图的差异
 */

const fs = require('fs');
const path = require('path');

// 颜色定义
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function printHeader() {
  console.log('');
  log('======================================', colors.blue);
  log('  🔍 视觉差异分析工具', colors.blue);
  log('======================================', colors.blue);
  console.log('');
}

/**
 * 查找所有差异图片
 */
function findDiffImages(outputDir) {
  const diffImages = [];
  
  if (!fs.existsSync(outputDir)) {
    return diffImages;
  }
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        scanDirectory(filePath);
      } else if (file.endsWith('-diff.png')) {
        diffImages.push(filePath);
      }
    }
  }
  
  scanDirectory(outputDir);
  return diffImages;
}

/**
 * 获取文件大小（KB）
 */
function getFileSize(filePath) {
  const stats = fs.statSync(filePath);
  return (stats.size / 1024).toFixed(2);
}

/**
 * 生成 HTML 报告
 */
function generateHtmlReport(diffImages, outputPath) {
  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>视觉差异报告</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 30px;
    }
    
    h1 {
      color: #333;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .summary {
      background: #f0f9ff;
      border-left: 4px solid #0ea5e9;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    
    .summary h2 {
      color: #0369a1;
      font-size: 18px;
      margin-bottom: 10px;
    }
    
    .summary p {
      color: #075985;
      margin: 5px 0;
    }
    
    .diff-item {
      margin: 30px 0;
      padding: 20px;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      background: #fafafa;
    }
    
    .diff-item h3 {
      color: #374151;
      margin-bottom: 15px;
      font-size: 16px;
    }
    
    .image-container {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
      margin-top: 15px;
    }
    
    .image-box {
      background: white;
      padding: 15px;
      border-radius: 6px;
      border: 1px solid #e5e7eb;
    }
    
    .image-box h4 {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 10px;
      text-transform: uppercase;
      font-weight: 600;
    }
    
    .image-box img {
      max-width: 100%;
      height: auto;
      border: 1px solid #d1d5db;
      border-radius: 4px;
    }
    
    .no-diff {
      text-align: center;
      padding: 60px 20px;
      color: #059669;
    }
    
    .no-diff h2 {
      font-size: 24px;
      margin-top: 20px;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>
      🔍 视觉差异报告
    </h1>
    
    <div class="summary">
      <h2>摘要</h2>
      <p><strong>发现差异:</strong> ${diffImages.length} 个</p>
      <p><strong>生成时间:</strong> ${new Date().toLocaleString('zh-CN')}</p>
    </div>
    
    ${diffImages.length === 0 ? `
      <div class="no-diff">
        ✅
        <h2>未发现视觉差异</h2>
        <p>所有截图与基准一致</p>
      </div>
    ` : diffImages.map((diffPath, index) => {
      const relativePath = path.relative(process.cwd(), diffPath);
      const dir = path.dirname(diffPath);
      const baseName = path.basename(diffPath, '-diff.png');
      
      const expectedPath = path.join(dir, `${baseName}-expected.png`);
      const actualPath = path.join(dir, `${baseName}-actual.png`);
      
      return `
        <div class="diff-item">
          <h3>差异 #${index + 1}: ${baseName}</h3>
          <p style="color: #6b7280; font-size: 14px; margin-bottom: 10px;">
            📁 ${relativePath}
          </p>
          
          <div class="image-container">
            ${fs.existsSync(expectedPath) ? `
              <div class="image-box">
                <h4>预期 (Expected)</h4>
                <img src="${path.relative(path.dirname(outputPath), expectedPath)}" alt="Expected">
              </div>
            ` : ''}
            
            ${fs.existsSync(actualPath) ? `
              <div class="image-box">
                <h4>实际 (Actual)</h4>
                <img src="${path.relative(path.dirname(outputPath), actualPath)}" alt="Actual">
              </div>
            ` : ''}
            
            <div class="image-box">
              <h4>差异 (Diff)</h4>
              <img src="${path.relative(path.dirname(outputPath), diffPath)}" alt="Diff">
            </div>
          </div>
        </div>
      `;
    }).join('')}
    
    <div class="footer">
      <p>由视觉回归测试系统生成</p>
    </div>
  </div>
</body>
</html>
  `;
  
  fs.writeFileSync(outputPath, html, 'utf-8');
  log(`✅ HTML 报告已生成: ${outputPath}`, colors.green);
}

/**
 * 主函数
 */
function main() {
  printHeader();
  
  const outputDir = path.join(process.cwd(), 'playwright-visual-output');
  const reportPath = path.join(process.cwd(), 'visual-diff-report.html');
  
  log('📂 扫描目录: ' + outputDir, colors.blue);
  
  const diffImages = findDiffImages(outputDir);
  
  if (diffImages.length === 0) {
    log('✅ 未发现视觉差异', colors.green);
  } else {
    log(`⚠️  发现 ${diffImages.length} 个视觉差异`, colors.yellow);
    console.log('');
    
    diffImages.forEach((img, index) => {
      const size = getFileSize(img);
      log(`  ${index + 1}. ${path.basename(img)} (${size} KB)`, colors.yellow);
    });
  }
  
  console.log('');
  log('📊 生成 HTML 报告...', colors.blue);
  generateHtmlReport(diffImages, reportPath);
  
  console.log('');
  log('======================================', colors.blue);
  log('✨ 分析完成', colors.green);
  log('======================================', colors.blue);
  console.log('');
  
  if (diffImages.length > 0) {
    log(`📄 查看详细报告: ${reportPath}`, colors.yellow);
    
    // 尝试在浏览器中打开报告
    const open = require('child_process').spawn;
    const command = process.platform === 'darwin' ? 'open' :
                    process.platform === 'win32' ? 'start' : 'xdg-open';
    
    try {
      open(command, [reportPath]);
    } catch (err) {
      // 忽略错误，用户可以手动打开
    }
    
    process.exit(1); // 有差异时返回非零退出码
  } else {
    process.exit(0);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = { findDiffImages, generateHtmlReport };

