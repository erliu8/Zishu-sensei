#!/usr/bin/env node

/**
 * 版本管理脚本
 * 用于自动化版本号更新和发布流程
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

// 配置
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  desktopAppDir: path.resolve(__dirname, '../desktop_app'),
  packageJsonPath: path.resolve(__dirname, '../desktop_app/package.json'),
  cargoTomlPath: path.resolve(__dirname, '../desktop_app/src-tauri/Cargo.toml'),
  tauriConfPath: path.resolve(__dirname, '../desktop_app/src-tauri/tauri.conf.json'),
  changelogPath: path.resolve(__dirname, '../CHANGELOG.md'),
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

// 版本类型枚举
const VERSION_TYPES = {
  major: 'major',
  minor: 'minor',
  patch: 'patch',
  premajor: 'premajor',
  preminor: 'preminor',
  prepatch: 'prepatch',
  prerelease: 'prerelease',
};

// 工具函数
function exec(command, cwd = CONFIG.rootDir) {
  try {
    return execSync(command, { 
      cwd, 
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
  } catch (err) {
    throw new Error(`命令执行失败: ${command}\n${err.message}`);
  }
}

function execSilent(command, cwd = CONFIG.rootDir) {
  try {
    return execSync(command, { 
      cwd, 
      encoding: 'utf8',
      stdio: 'pipe'
    }).trim();
  } catch (err) {
    return null;
  }
}

function readJsonFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (err) {
    throw new Error(`无法读取 JSON 文件: ${filePath}\n${err.message}`);
  }
}

function writeJsonFile(filePath, data) {
  try {
    const content = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (err) {
    throw new Error(`无法写入 JSON 文件: ${filePath}\n${err.message}`);
  }
}

function readTomlFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`无法读取 TOML 文件: ${filePath}\n${err.message}`);
  }
}

function writeTomlFile(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, 'utf8');
  } catch (err) {
    throw new Error(`无法写入 TOML 文件: ${filePath}\n${err.message}`);
  }
}

async function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// 版本相关函数
function getCurrentVersion() {
  const packageJson = readJsonFile(CONFIG.packageJsonPath);
  return packageJson.version;
}

function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!match) {
    throw new Error(`无效的版本格式: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
  };
}

function bumpVersion(currentVersion, type, preId = 'beta') {
  const { major, minor, patch, prerelease } = parseVersion(currentVersion);

  switch (type) {
    case VERSION_TYPES.major:
      return `${major + 1}.0.0`;
    
    case VERSION_TYPES.minor:
      return `${major}.${minor + 1}.0`;
    
    case VERSION_TYPES.patch:
      return `${major}.${minor}.${patch + 1}`;
    
    case VERSION_TYPES.premajor:
      return `${major + 1}.0.0-${preId}.0`;
    
    case VERSION_TYPES.preminor:
      return `${major}.${minor + 1}.0-${preId}.0`;
    
    case VERSION_TYPES.prepatch:
      return `${major}.${minor}.${patch + 1}-${preId}.0`;
    
    case VERSION_TYPES.prerelease:
      if (prerelease) {
        const parts = prerelease.split('.');
        const id = parts[0];
        const num = parseInt(parts[1] || '0', 10);
        return `${major}.${minor}.${patch}-${id}.${num + 1}`;
      } else {
        return `${major}.${minor}.${patch}-${preId}.0`;
      }
    
    default:
      throw new Error(`不支持的版本类型: ${type}`);
  }
}

function validateVersion(version) {
  const versionRegex = /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9-]+)?$/;
  return versionRegex.test(version);
}

// Git 相关函数
function isGitRepo() {
  return execSilent('git rev-parse --git-dir') !== null;
}

function getGitStatus() {
  const status = execSilent('git status --porcelain');
  return status ? status.split('\n').filter(line => line.trim()) : [];
}

function isWorkingTreeClean() {
  const status = getGitStatus();
  return status.length === 0;
}

function getCurrentBranch() {
  return execSilent('git branch --show-current') || 'unknown';
}

function getLastTag() {
  return execSilent('git describe --tags --abbrev=0') || null;
}

function createTag(version, message) {
  exec(`git tag -a v${version} -m "${message}"`);
}

function pushTag(version) {
  exec(`git push origin v${version}`);
}

function getCommitsSinceTag(tag) {
  if (!tag) {
    return exec('git log --oneline').split('\n');
  }
  return exec(`git log ${tag}..HEAD --oneline`).split('\n').filter(line => line.trim());
}

// 文件更新函数
function updatePackageJson(version) {
  const packageJson = readJsonFile(CONFIG.packageJsonPath);
  packageJson.version = version;
  writeJsonFile(CONFIG.packageJsonPath, packageJson);
  success(`已更新 package.json 版本: ${version}`);
}

function updateCargoToml(version) {
  let content = readTomlFile(CONFIG.cargoTomlPath);
  content = content.replace(/^version = ".*"/m, `version = "${version}"`);
  writeTomlFile(CONFIG.cargoTomlPath, content);
  success(`已更新 Cargo.toml 版本: ${version}`);
}

function updateTauriConf(version) {
  const tauriConf = readJsonFile(CONFIG.tauriConfPath);
  tauriConf.package.version = version;
  writeJsonFile(CONFIG.tauriConfPath, tauriConf);
  success(`已更新 tauri.conf.json 版本: ${version}`);
}

function updateAllVersions(version) {
  updatePackageJson(version);
  updateCargoToml(version);
  updateTauriConf(version);
}

// 更新日志函数
function ensureChangelogExists() {
  if (!fs.existsSync(CONFIG.changelogPath)) {
    const initialContent = `# 更新日志

所有重要的项目变更都会记录在此文件中。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.0.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [未发布]

### 新增
- 初始版本

`;
    fs.writeFileSync(CONFIG.changelogPath, initialContent, 'utf8');
    info('已创建 CHANGELOG.md 文件');
  }
}

function updateChangelog(version, changes) {
  ensureChangelogExists();
  
  let content = fs.readFileSync(CONFIG.changelogPath, 'utf8');
  const date = new Date().toISOString().split('T')[0];
  
  const newSection = `## [${version}] - ${date}

${changes}

`;
  
  // 在 [未发布] 部分后插入新版本
  const unreleasedIndex = content.indexOf('## [未发布]');
  if (unreleasedIndex !== -1) {
    const nextSectionIndex = content.indexOf('\n## [', unreleasedIndex + 1);
    const insertIndex = nextSectionIndex !== -1 ? nextSectionIndex : content.length;
    
    content = content.slice(0, insertIndex) + '\n' + newSection + content.slice(insertIndex);
  } else {
    // 如果找不到未发布部分，就在文件开头插入
    content = newSection + '\n' + content;
  }
  
  fs.writeFileSync(CONFIG.changelogPath, content, 'utf8');
  success(`已更新 CHANGELOG.md`);
}

function generateChangelogFromCommits(lastTag) {
  const commits = getCommitsSinceTag(lastTag);
  
  if (commits.length === 0) {
    return '### 修改\n- 更新版本号\n';
  }
  
  const categories = {
    feat: '### 新增',
    fix: '### 修复', 
    docs: '### 文档',
    style: '### 样式',
    refactor: '### 重构',
    perf: '### 性能',
    test: '### 测试',
    chore: '### 其他',
  };
  
  const changesByCategory = {};
  const otherChanges = [];
  
  commits.forEach(commit => {
    const match = commit.match(/^([a-f0-9]+)\s+(\w+)(?:\(([^)]+)\))?\s*:\s*(.+)$/);
    if (match) {
      const [, hash, type, scope, message] = match;
      const category = categories[type] || categories.chore;
      
      if (!changesByCategory[category]) {
        changesByCategory[category] = [];
      }
      
      const scopeText = scope ? `**${scope}**: ` : '';
      changesByCategory[category].push(`- ${scopeText}${message}`);
    } else {
      otherChanges.push(`- ${commit.substring(8)}`); // 去掉 hash
    }
  });
  
  let changelog = '';
  
  // 按优先级排序类别
  const orderedCategories = [
    '### 新增',
    '### 修复',
    '### 重构',
    '### 性能',
    '### 文档',
    '### 样式',
    '### 测试',
    '### 其他',
  ];
  
  orderedCategories.forEach(category => {
    if (changesByCategory[category] && changesByCategory[category].length > 0) {
      changelog += `${category}\n${changesByCategory[category].join('\n')}\n\n`;
    }
  });
  
  if (otherChanges.length > 0) {
    changelog += `### 其他\n${otherChanges.join('\n')}\n\n`;
  }
  
  return changelog.trim() || '### 修改\n- 更新版本号';
}

// 主要命令
async function showCurrentVersion() {
  title('当前版本信息');
  
  const currentVersion = getCurrentVersion();
  info(`当前版本: ${currentVersion}`);
  
  if (isGitRepo()) {
    const branch = getCurrentBranch();
    const lastTag = getLastTag();
    const isClean = isWorkingTreeClean();
    
    info(`当前分支: ${branch}`);
    info(`最近标签: ${lastTag || '无'}`);
    info(`工作树状态: ${isClean ? '干净' : '有未提交的更改'}`);
    
    if (lastTag) {
      const commits = getCommitsSinceTag(lastTag);
      info(`自上次发布以来的提交数: ${commits.length}`);
    }
  }
}

async function bumpVersionCommand(type, preId = 'beta') {
  title(`版本升级 (${type})`);
  
  // 检查 Git 状态
  if (isGitRepo()) {
    const branch = getCurrentBranch();
    if (branch !== 'main' && branch !== 'develop') {
      warning(`当前分支是 ${branch}，建议在 main 或 develop 分支进行版本升级`);
      const confirm = await prompt('是否继续? (y/N): ');
      if (confirm.toLowerCase() !== 'y') {
        process.exit(0);
      }
    }
    
    if (!isWorkingTreeClean()) {
      error('工作树不干净，请先提交或储藏更改');
      process.exit(1);
    }
  }
  
  const currentVersion = getCurrentVersion();
  const newVersion = bumpVersion(currentVersion, type, preId);
  
  info(`当前版本: ${currentVersion}`);
  info(`新版本: ${newVersion}`);
  
  const confirm = await prompt('确认升级版本? (Y/n): ');
  if (confirm.toLowerCase() === 'n') {
    process.exit(0);
  }
  
  // 更新所有版本文件
  updateAllVersions(newVersion);
  
  // 生成更新日志
  if (isGitRepo()) {
    const lastTag = getLastTag();
    const changelog = generateChangelogFromCommits(lastTag);
    updateChangelog(newVersion, changelog);
  }
  
  success(`版本已升级到 ${newVersion}`);
  
  // 提交更改
  if (isGitRepo()) {
    const commitConfirm = await prompt('是否提交更改并创建标签? (Y/n): ');
    if (commitConfirm.toLowerCase() !== 'n') {
      exec('git add -A');
      exec(`git commit -m "chore: bump version to ${newVersion}"`);
      createTag(newVersion, `Release version ${newVersion}`);
      success(`已创建标签 v${newVersion}`);
      
      const pushConfirm = await prompt('是否推送到远程仓库? (Y/n): ');
      if (pushConfirm.toLowerCase() !== 'n') {
        exec('git push');
        pushTag(newVersion);
        success('已推送到远程仓库');
      }
    }
  }
}

async function setVersionCommand(version) {
  title(`设置版本: ${version}`);
  
  if (!validateVersion(version)) {
    error('无效的版本格式，请使用 semver 格式 (例如: 1.0.0, 1.0.0-beta.1)');
    process.exit(1);
  }
  
  const currentVersion = getCurrentVersion();
  
  if (currentVersion === version) {
    warning('新版本与当前版本相同');
    process.exit(0);
  }
  
  info(`当前版本: ${currentVersion}`);
  info(`新版本: ${version}`);
  
  const confirm = await prompt('确认设置版本? (Y/n): ');
  if (confirm.toLowerCase() === 'n') {
    process.exit(0);
  }
  
  updateAllVersions(version);
  success(`版本已设置为 ${version}`);
}

async function releaseCommand(type = 'patch') {
  title(`创建发布 (${type})`);
  
  if (!isGitRepo()) {
    error('当前目录不是 Git 仓库');
    process.exit(1);
  }
  
  const branch = getCurrentBranch();
  if (branch !== 'main') {
    error('发布只能在 main 分支进行');
    process.exit(1);
  }
  
  if (!isWorkingTreeClean()) {
    error('工作树不干净，请先提交或储藏更改');
    process.exit(1);
  }
  
  // 先拉取最新代码
  exec('git pull origin main');
  
  const currentVersion = getCurrentVersion();
  const newVersion = bumpVersion(currentVersion, type);
  
  info(`准备发布版本: ${newVersion}`);
  
  // 更新版本
  updateAllVersions(newVersion);
  
  // 生成更新日志
  const lastTag = getLastTag();
  const changelog = generateChangelogFromCommits(lastTag);
  updateChangelog(newVersion, changelog);
  
  // 运行测试
  info('运行测试...');
  try {
    exec('npm test', CONFIG.desktopAppDir);
    success('测试通过');
  } catch (err) {
    error('测试失败，取消发布');
    process.exit(1);
  }
  
  // 构建应用
  info('构建应用...');
  try {
    exec('npm run build', CONFIG.desktopAppDir);
    success('构建完成');
  } catch (err) {
    error('构建失败，取消发布');
    process.exit(1);
  }
  
  // 提交和标签
  exec('git add -A');
  exec(`git commit -m "chore: release ${newVersion}"`);
  createTag(newVersion, `Release version ${newVersion}`);
  
  // 推送到远程
  exec('git push origin main');
  pushTag(newVersion);
  
  success(`🎉 版本 ${newVersion} 发布成功！`);
  info('GitHub Actions 将自动构建和发布安装包');
}

// 命令行处理
function showHelp() {
  console.log(`
🚀 Zishu Sensei 版本管理工具

用法:
  node scripts/version.js <command> [options]

命令:
  current                    显示当前版本信息
  bump <type> [preId]        升级版本
  set <version>              设置指定版本
  release [type]             创建发布 (默认: patch)
  help                       显示帮助信息

版本升级类型:
  major                      主版本 (1.0.0 -> 2.0.0)
  minor                      次版本 (1.0.0 -> 1.1.0)
  patch                      补丁版本 (1.0.0 -> 1.0.1)
  premajor [preId]           预发布主版本 (1.0.0 -> 2.0.0-beta.0)
  preminor [preId]           预发布次版本 (1.0.0 -> 1.1.0-beta.0)
  prepatch [preId]           预发布补丁版本 (1.0.0 -> 1.0.1-beta.0)
  prerelease [preId]         预发布版本 (1.0.0-beta.0 -> 1.0.0-beta.1)

示例:
  node scripts/version.js current
  node scripts/version.js bump patch
  node scripts/version.js bump minor
  node scripts/version.js bump premajor alpha
  node scripts/version.js set 1.2.3
  node scripts/version.js release minor

更多信息请查看: https://docs.zishu.dev/development/versioning
`);
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }
  
  try {
    switch (command) {
      case 'current':
        await showCurrentVersion();
        break;
      
      case 'bump':
        const type = args[1];
        const preId = args[2];
        if (!type || !VERSION_TYPES[type]) {
          error(`无效的版本类型: ${type}`);
          error(`支持的类型: ${Object.keys(VERSION_TYPES).join(', ')}`);
          process.exit(1);
        }
        await bumpVersionCommand(type, preId);
        break;
      
      case 'set':
        const version = args[1];
        if (!version) {
          error('请指定版本号');
          process.exit(1);
        }
        await setVersionCommand(version);
        break;
      
      case 'release':
        const releaseType = args[1] || 'patch';
        if (!VERSION_TYPES[releaseType]) {
          error(`无效的发布类型: ${releaseType}`);
          process.exit(1);
        }
        await releaseCommand(releaseType);
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
  getCurrentVersion,
  bumpVersion,
  updateAllVersions,
  validateVersion,
  parseVersion,
};
