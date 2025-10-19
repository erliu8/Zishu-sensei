#!/usr/bin/env node

/**
 * 构建和打包脚本
 * 用于本地构建和CI/CD流程
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

// 配置
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  desktopAppDir: path.resolve(__dirname, '../desktop_app'),
  distDir: path.resolve(__dirname, '../desktop_app/dist'),
  tauriDir: path.resolve(__dirname, '../desktop_app/src-tauri'),
  targetDir: path.resolve(__dirname, '../desktop_app/src-tauri/target'),
  outputDir: path.resolve(__dirname, '../build-output'),
  tempDir: path.resolve(__dirname, '../temp'),
};

// 平台配置
const PLATFORMS = {
  'win32': {
    name: 'Windows',
    targets: ['x86_64-pc-windows-msvc', 'aarch64-pc-windows-msvc'],
    extensions: ['.exe', '.msi'],
    arch: ['x64', 'arm64'],
  },
  'darwin': {
    name: 'macOS',
    targets: ['x86_64-apple-darwin', 'aarch64-apple-darwin'],
    extensions: ['.app', '.dmg'],
    arch: ['x64', 'arm64'],
  },
  'linux': {
    name: 'Linux',
    targets: ['x86_64-unknown-linux-gnu'],
    extensions: ['.deb', '.rpm', '.AppImage'],
    arch: ['x64'],
  },
};

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

function colorLog(color, message) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function info(message) {
  colorLog('blue', `ℹ️  ${message}`);
}

function success(message) {
  colorLog('green', `✅ ${message}`);
}

function warning(message) {
  colorLog('yellow', `⚠️  ${message}`);
}

function error(message) {
  colorLog('red', `❌ ${message}`);
}

function title(message) {
  colorLog('cyan', `\n🚀 ${message}`);
}

function step(message) {
  colorLog('magenta', `📋 ${message}`);
}

// 工具函数
function exec(command, cwd = CONFIG.rootDir, options = {}) {
  const { silent = false, stdio = 'inherit' } = options;
  
  if (!silent) {
    info(`执行命令: ${command}`);
    info(`工作目录: ${cwd}`);
  }
  
  try {
    const result = execSync(command, { 
      cwd, 
      encoding: 'utf8',
      stdio: silent ? 'pipe' : stdio,
      ...options
    });
    
    if (silent && result) {
      return result.trim();
    }
    
    return result;
  } catch (err) {
    if (!silent) {
      error(`命令执行失败: ${command}`);
      error(err.message);
    }
    throw err;
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    info(`创建目录: ${dirPath}`);
  }
}

function removeDir(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
    info(`删除目录: ${dirPath}`);
  }
}

function copyFile(src, dest) {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
  info(`复制文件: ${src} -> ${dest}`);
}

function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (err) {
    return 0;
  }
}

function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function getCurrentPlatform() {
  const platform = os.platform();
  return PLATFORMS[platform] || null;
}

function getTargetInfo(target) {
  for (const [platform, config] of Object.entries(PLATFORMS)) {
    const index = config.targets.indexOf(target);
    if (index !== -1) {
      return {
        platform,
        platformName: config.name,
        arch: config.arch[index] || 'unknown',
        extensions: config.extensions,
      };
    }
  }
  return null;
}

// 环境检查
function checkEnvironment() {
  title('检查构建环境');
  
  // 检查 Node.js
  try {
    const nodeVersion = exec('node --version', CONFIG.rootDir, { silent: true });
    success(`Node.js 版本: ${nodeVersion}`);
  } catch (err) {
    error('Node.js 未安装或无法访问');
    throw err;
  }
  
  // 检查 npm
  try {
    const npmVersion = exec('npm --version', CONFIG.rootDir, { silent: true });
    success(`npm 版本: ${npmVersion}`);
  } catch (err) {
    error('npm 未安装或无法访问');
    throw err;
  }
  
  // 检查 Rust
  try {
    const rustVersion = exec('rustc --version', CONFIG.rootDir, { silent: true });
    success(`Rust 版本: ${rustVersion}`);
  } catch (err) {
    error('Rust 未安装或无法访问');
    throw err;
  }
  
  // 检查 Cargo
  try {
    const cargoVersion = exec('cargo --version', CONFIG.rootDir, { silent: true });
    success(`Cargo 版本: ${cargoVersion}`);
  } catch (err) {
    error('Cargo 未安装或无法访问');
    throw err;
  }
  
  // 检查 Tauri CLI
  try {
    const tauriVersion = exec('npm run tauri -- --version', CONFIG.desktopAppDir, { silent: true });
    success(`Tauri CLI 版本: ${tauriVersion}`);
  } catch (err) {
    warning('Tauri CLI 可能未安装，尝试安装...');
    try {
      exec('npm install', CONFIG.desktopAppDir);
      success('依赖安装完成');
    } catch (installErr) {
      error('无法安装依赖');
      throw installErr;
    }
  }
  
  // 检查系统依赖 (Linux)
  if (os.platform() === 'linux') {
    const requiredPackages = [
      'libgtk-3-dev',
      'libwebkit2gtk-4.1-dev',
      'libayatana-appindicator3-dev',
      'librsvg2-dev'
    ];
    
    for (const pkg of requiredPackages) {
      try {
        exec(`dpkg -l | grep ${pkg}`, CONFIG.rootDir, { silent: true });
        success(`系统依赖已安装: ${pkg}`);
      } catch (err) {
        warning(`系统依赖缺失: ${pkg}`);
        warning('请运行: sudo apt-get install ' + requiredPackages.join(' '));
      }
    }
  }
}

// 清理构建产物
function clean() {
  title('清理构建产物');
  
  const dirsToClean = [
    CONFIG.distDir,
    CONFIG.targetDir,
    CONFIG.outputDir,
    CONFIG.tempDir,
    path.join(CONFIG.desktopAppDir, 'node_modules/.cache'),
  ];
  
  dirsToClean.forEach(dir => {
    if (fs.existsSync(dir)) {
      removeDir(dir);
    }
  });
  
  success('清理完成');
}

// 安装依赖
function installDependencies() {
  title('安装依赖');
  
  step('安装前端依赖...');
  exec('npm ci', CONFIG.desktopAppDir);
  success('前端依赖安装完成');
  
  step('检查 Rust 依赖...');
  exec('cargo check', CONFIG.tauriDir, { silent: true });
  success('Rust 依赖检查完成');
}

// 代码质量检查
function checkCodeQuality() {
  title('代码质量检查');
  
  step('TypeScript 类型检查...');
  try {
    exec('npm run type-check', CONFIG.desktopAppDir);
    success('TypeScript 类型检查通过');
  } catch (err) {
    error('TypeScript 类型检查失败');
    throw err;
  }
  
  step('ESLint 代码检查...');
  try {
    exec('npm run lint', CONFIG.desktopAppDir);
    success('ESLint 检查通过');
  } catch (err) {
    warning('ESLint 检查有警告或错误');
    // 不抛出错误，允许继续构建
  }
  
  step('Rust 代码检查...');
  try {
    exec('cargo clippy --all-targets --all-features -- -D warnings', CONFIG.tauriDir);
    success('Rust Clippy 检查通过');
  } catch (err) {
    warning('Rust Clippy 检查有警告');
    // 不抛出错误，允许继续构建
  }
  
  step('Rust 格式检查...');
  try {
    exec('cargo fmt --all -- --check', CONFIG.tauriDir);
    success('Rust 格式检查通过');
  } catch (err) {
    warning('Rust 格式检查失败，尝试自动格式化...');
    exec('cargo fmt --all', CONFIG.tauriDir);
    success('Rust 代码已自动格式化');
  }
}

// 运行测试
function runTests() {
  title('运行测试');
  
  step('前端单元测试...');
  try {
    exec('npm run test:run', CONFIG.desktopAppDir);
    success('前端测试通过');
  } catch (err) {
    error('前端测试失败');
    throw err;
  }
  
  step('Rust 测试...');
  try {
    exec('cargo test --verbose', CONFIG.tauriDir);
    success('Rust 测试通过');
  } catch (err) {
    error('Rust 测试失败');
    throw err;
  }
}

// 构建前端
function buildFrontend() {
  title('构建前端');
  
  step('构建 React 应用...');
  exec('npm run build', CONFIG.desktopAppDir);
  
  // 检查构建产物
  if (!fs.existsSync(CONFIG.distDir)) {
    error('前端构建失败，dist 目录不存在');
    throw new Error('Frontend build failed');
  }
  
  // 分析构建大小
  const distSize = exec(`du -sh ${CONFIG.distDir}`, CONFIG.rootDir, { silent: true });
  success(`前端构建完成，大小: ${distSize.split('\t')[0]}`);
  
  // 生成构建报告
  generateBuildReport();
}

// 生成构建报告
function generateBuildReport() {
  step('生成构建报告...');
  
  const reportPath = path.join(CONFIG.outputDir, 'build-report.json');
  ensureDir(CONFIG.outputDir);
  
  const report = {
    timestamp: new Date().toISOString(),
    platform: os.platform(),
    arch: os.arch(),
    nodeVersion: process.version,
    npmVersion: exec('npm --version', CONFIG.rootDir, { silent: true }),
    rustVersion: exec('rustc --version', CONFIG.rootDir, { silent: true }),
    buildFiles: {},
  };
  
  // 分析前端构建文件
  if (fs.existsSync(CONFIG.distDir)) {
    const distFiles = fs.readdirSync(CONFIG.distDir, { recursive: true });
    distFiles.forEach(file => {
      const filePath = path.join(CONFIG.distDir, file);
      if (fs.statSync(filePath).isFile()) {
        report.buildFiles[file] = {
          size: getFileSize(filePath),
          sizeFormatted: formatBytes(getFileSize(filePath)),
        };
      }
    });
  }
  
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  success(`构建报告已生成: ${reportPath}`);
}

// 构建 Tauri 应用
function buildTauri(target = null, debug = false) {
  title(`构建 Tauri 应用 ${target ? `(${target})` : ''}${debug ? ' (调试模式)' : ''}`);
  
  let command = 'npm run tauri:build';
  
  if (debug) {
    command = 'npm run tauri:build:debug';
  }
  
  if (target) {
    command += ` -- --target ${target}`;
  }
  
  step('构建 Tauri 应用...');
  exec(command, CONFIG.desktopAppDir);
  
  success('Tauri 应用构建完成');
}

// 收集构建产物
function collectArtifacts(target = null) {
  title('收集构建产物');
  
  ensureDir(CONFIG.outputDir);
  
  const targetDir = target ? 
    path.join(CONFIG.targetDir, target, 'release', 'bundle') :
    path.join(CONFIG.targetDir, 'release', 'bundle');
  
  if (!fs.existsSync(targetDir)) {
    warning('构建产物目录不存在');
    return;
  }
  
  const targetInfo = target ? getTargetInfo(target) : null;
  const platformName = targetInfo ? targetInfo.platformName : getCurrentPlatform()?.name || 'Unknown';
  const arch = targetInfo ? targetInfo.arch : 'x64';
  
  // 遍历构建产物目录
  const bundleTypes = fs.readdirSync(targetDir);
  let artifactCount = 0;
  
  bundleTypes.forEach(bundleType => {
    const bundlePath = path.join(targetDir, bundleType);
    if (!fs.statSync(bundlePath).isDirectory()) return;
    
    const files = fs.readdirSync(bundlePath);
    files.forEach(file => {
      const srcPath = path.join(bundlePath, file);
      const stats = fs.statSync(srcPath);
      
      if (stats.isFile()) {
        const ext = path.extname(file);
        const basename = path.basename(file, ext);
        const newName = `${basename}_${platformName}_${arch}${ext}`;
        const destPath = path.join(CONFIG.outputDir, newName);
        
        copyFile(srcPath, destPath);
        
        const size = formatBytes(stats.size);
        success(`收集产物: ${newName} (${size})`);
        artifactCount++;
      } else if (stats.isDirectory() && file.endsWith('.app')) {
        // macOS .app 目录需要打包
        const tarName = `${file}_${platformName}_${arch}.tar.gz`;
        const destPath = path.join(CONFIG.outputDir, tarName);
        
        exec(`tar -czf "${destPath}" -C "${bundlePath}" "${file}"`, CONFIG.rootDir);
        
        const size = formatBytes(getFileSize(destPath));
        success(`收集产物: ${tarName} (${size})`);
        artifactCount++;
      }
    });
  });
  
  if (artifactCount === 0) {
    warning('没有找到构建产物');
  } else {
    success(`共收集 ${artifactCount} 个构建产物`);
  }
}

// 验证构建产物
function validateArtifacts() {
  title('验证构建产物');
  
  if (!fs.existsSync(CONFIG.outputDir)) {
    error('构建产物目录不存在');
    return false;
  }
  
  const files = fs.readdirSync(CONFIG.outputDir);
  const artifacts = files.filter(file => {
    const ext = path.extname(file);
    return ['.exe', '.msi', '.dmg', '.app.tar.gz', '.deb', '.rpm', '.AppImage'].includes(ext);
  });
  
  if (artifacts.length === 0) {
    error('没有找到有效的构建产物');
    return false;
  }
  
  artifacts.forEach(artifact => {
    const filePath = path.join(CONFIG.outputDir, artifact);
    const size = formatBytes(getFileSize(filePath));
    success(`构建产物: ${artifact} (${size})`);
  });
  
  success(`验证完成，共 ${artifacts.length} 个有效构建产物`);
  return true;
}

// 生成签名
function signArtifacts() {
  title('生成签名');
  
  const platform = os.platform();
  
  if (platform === 'darwin' && process.env.APPLE_SIGNING_IDENTITY) {
    step('macOS 代码签名...');
    // macOS 代码签名逻辑
    info('macOS 代码签名已在构建过程中完成');
  } else if (platform === 'win32' && process.env.WINDOWS_CERTIFICATE_PATH) {
    step('Windows 代码签名...');
    // Windows 代码签名逻辑
    info('Windows 代码签名已在构建过程中完成');
  } else {
    warning('未配置代码签名，跳过签名步骤');
  }
  
  // 生成校验和文件
  step('生成校验和文件...');
  const checksumPath = path.join(CONFIG.outputDir, 'checksums.txt');
  
  const files = fs.readdirSync(CONFIG.outputDir);
  const artifacts = files.filter(file => {
    const ext = path.extname(file);
    return ['.exe', '.msi', '.dmg', '.app.tar.gz', '.deb', '.rpm', '.AppImage'].includes(ext);
  });
  
  let checksumContent = '# SHA256 校验和\n';
  
  artifacts.forEach(artifact => {
    const filePath = path.join(CONFIG.outputDir, artifact);
    try {
      const checksum = exec(`shasum -a 256 "${filePath}"`, CONFIG.rootDir, { silent: true });
      checksumContent += checksum + '\n';
    } catch (err) {
      warning(`生成 ${artifact} 校验和失败`);
    }
  });
  
  fs.writeFileSync(checksumPath, checksumContent);
  success(`校验和文件已生成: ${checksumPath}`);
}

// 显示构建摘要
function showBuildSummary() {
  title('构建摘要');
  
  const endTime = Date.now();
  const duration = Math.round((endTime - global.startTime) / 1000);
  
  info(`构建耗时: ${Math.floor(duration / 60)}分${duration % 60}秒`);
  
  if (fs.existsSync(CONFIG.outputDir)) {
    const files = fs.readdirSync(CONFIG.outputDir);
    const artifacts = files.filter(file => {
      const ext = path.extname(file);
      return ['.exe', '.msi', '.dmg', '.app.tar.gz', '.deb', '.rpm', '.AppImage'].includes(ext);
    });
    
    info(`构建产物数量: ${artifacts.length}`);
    
    let totalSize = 0;
    artifacts.forEach(artifact => {
      const filePath = path.join(CONFIG.outputDir, artifact);
      const size = getFileSize(filePath);
      totalSize += size;
      info(`  ${artifact}: ${formatBytes(size)}`);
    });
    
    info(`总大小: ${formatBytes(totalSize)}`);
    info(`输出目录: ${CONFIG.outputDir}`);
  }
  
  success('🎉 构建完成！');
}

// 主要命令
async function buildCommand(options = {}) {
  global.startTime = Date.now();
  
  const {
    target,
    debug = false,
    skipTests = false,
    skipLint = false,
    clean: shouldClean = false,
  } = options;
  
  try {
    if (shouldClean) {
      clean();
    }
    
    checkEnvironment();
    installDependencies();
    
    if (!skipLint) {
      checkCodeQuality();
    }
    
    if (!skipTests) {
      runTests();
    }
    
    buildFrontend();
    buildTauri(target, debug);
    collectArtifacts(target);
    
    if (!debug) {
      signArtifacts();
    }
    
    const isValid = validateArtifacts();
    if (!isValid) {
      process.exit(1);
    }
    
    showBuildSummary();
    
  } catch (err) {
    error('构建失败');
    error(err.message);
    process.exit(1);
  }
}

// 命令行处理
function showHelp() {
  console.log(`
🚀 Zishu Sensei 构建工具

用法:
  node scripts/build.js [command] [options]

命令:
  build                      完整构建 (默认)
  clean                      清理构建产物
  check                      检查环境和依赖
  frontend                   只构建前端
  artifacts                  收集构建产物
  help                       显示帮助信息

选项:
  --target <target>          指定构建目标 (如: x86_64-pc-windows-msvc)
  --debug                    调试模式构建
  --skip-tests               跳过测试
  --skip-lint                跳过代码检查
  --clean                    构建前清理

支持的构建目标:
  x86_64-pc-windows-msvc     Windows x64
  aarch64-pc-windows-msvc    Windows ARM64
  x86_64-apple-darwin        macOS Intel
  aarch64-apple-darwin       macOS Apple Silicon
  x86_64-unknown-linux-gnu   Linux x64

示例:
  node scripts/build.js
  node scripts/build.js build --target x86_64-pc-windows-msvc
  node scripts/build.js build --debug --skip-tests
  node scripts/build.js clean
  node scripts/build.js check

更多信息请查看: https://docs.zishu.dev/development/building
`);
}

function parseArgs(args) {
  const options = {};
  const commands = [];
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      if (key === 'target' && i + 1 < args.length) {
        options.target = args[++i];
      } else if (['debug', 'skip-tests', 'skip-lint', 'clean'].includes(key)) {
        options[key.replace('-', '_')] = true;
      }
    } else {
      commands.push(arg);
    }
  }
  
  return { commands, options };
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('help') || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  const { commands, options } = parseArgs(args);
  const command = commands[0] || 'build';
  
  try {
    switch (command) {
      case 'build':
        await buildCommand(options);
        break;
      
      case 'clean':
        clean();
        break;
      
      case 'check':
        checkEnvironment();
        break;
      
      case 'frontend':
        checkEnvironment();
        installDependencies();
        buildFrontend();
        break;
      
      case 'artifacts':
        collectArtifacts(options.target);
        validateArtifacts();
        break;
      
      default:
        error(`未知命令: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err) {
    error(err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  buildCommand,
  clean,
  checkEnvironment,
  buildFrontend,
  buildTauri,
  collectArtifacts,
};
