#!/usr/bin/env node

/**
 * 跨平台构建脚本
 * 处理 SWC 原生绑定兼容性问题
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

class CrossPlatformBuilder {
    constructor() {
        this.platform = os.platform();
        this.arch = os.arch();
        this.isCI = process.env.CI === 'true';
        this.targetArch = process.env.TARGET_ARCH || this.arch;
        this.targetPlatform = process.env.TARGET_PLATFORM || this.platform;
        
        console.log(`🔧 跨平台构建器启动`);
        console.log(`📋 平台信息:`);
        console.log(`   - 当前平台: ${this.platform}`);
        console.log(`   - 当前架构: ${this.arch}`);
        console.log(`   - 目标平台: ${this.targetPlatform}`);
        console.log(`   - 目标架构: ${this.targetArch}`);
        console.log(`   - CI 环境: ${this.isCI}`);
    }

    /**
     * 检查 SWC 原生绑定是否可用
     */
    checkSWCBinding() {
        console.log(`🔍 检查 SWC 原生绑定...`);
        
        try {
            // 尝试加载 @swc/core
            require('@swc/core');
            console.log(`✅ SWC 原生绑定可用`);
            return true;
        } catch (error) {
            console.log(`❌ SWC 原生绑定不可用: ${error.message}`);
            return false;
        }
    }

    /**
     * 安装平台特定的 SWC 包
     */
    async installPlatformSpecificSWC() {
        console.log(`📦 安装平台特定的 SWC 包...`);
        
        const swcPackages = {
            'darwin-arm64': '@swc/core-darwin-arm64',
            'darwin-x64': '@swc/core-darwin-x64',
            'linux-x64': '@swc/core-linux-x64-gnu',
            'linux-arm64': '@swc/core-linux-arm64-gnu',
            'win32-x64': '@swc/core-win32-x64-msvc',
            'win32-arm64': '@swc/core-win32-arm64-msvc'
        };

        const platformKey = `${this.targetPlatform}-${this.targetArch === 'arm64' ? 'arm64' : 'x64'}`;
        const swcPackage = swcPackages[platformKey];

        if (!swcPackage) {
            console.log(`⚠️ 未找到平台 ${platformKey} 的 SWC 包`);
            return false;
        }

        try {
            console.log(`📥 安装 ${swcPackage}...`);
            execSync(`npm install ${swcPackage} --force`, {
                stdio: 'inherit',
                cwd: process.cwd()
            });
            console.log(`✅ ${swcPackage} 安装成功`);
            return true;
        } catch (error) {
            console.log(`❌ ${swcPackage} 安装失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 修改 Vite 配置以使用备用方案
     */
    async setupFallbackConfig() {
        console.log(`🔧 设置 Vite 备用配置...`);
        
        const viteConfigPath = path.join(process.cwd(), 'vite.config.ts');
        
        if (!fs.existsSync(viteConfigPath)) {
            console.log(`❌ 未找到 vite.config.ts`);
            return false;
        }

        try {
            // 创建环境变量来指示使用备用方案
            process.env.USE_SWC_FALLBACK = 'true';
            console.log(`✅ 设置环境变量 USE_SWC_FALLBACK=true`);
            return true;
        } catch (error) {
            console.log(`❌ 设置备用配置失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 执行构建
     */
    async build(target) {
        console.log(`🚀 开始构建 (目标: ${target})...`);
        
        const buildCommand = target 
            ? `npm run tauri:build -- --target ${target}`
            : `npm run tauri:build`;

        try {
            execSync(buildCommand, {
                stdio: 'inherit',
                cwd: process.cwd(),
                env: {
                    ...process.env,
                    RUST_LOG: 'debug',
                    TAURI_DEBUG: 'true'
                }
            });
            console.log(`✅ 构建成功完成`);
            return true;
        } catch (error) {
            console.log(`❌ 构建失败: ${error.message}`);
            return false;
        }
    }

    /**
     * 主构建流程
     */
    async run() {
        console.log(`🎯 开始跨平台构建流程...`);
        
        const target = process.argv[2];
        
        // 1. 检查 SWC 绑定
        const swcAvailable = this.checkSWCBinding();
        
        // 2. 如果 SWC 不可用，尝试安装平台特定包
        if (!swcAvailable) {
            console.log(`🔄 尝试修复 SWC 绑定问题...`);
            
            const installed = await this.installPlatformSpecificSWC();
            
            if (!installed) {
                console.log(`🔄 使用备用配置...`);
                await this.setupFallbackConfig();
            }
        }

        // 3. 执行构建
        const success = await this.build(target);
        
        if (success) {
            console.log(`🎉 跨平台构建完成！`);
            process.exit(0);
        } else {
            console.log(`💥 跨平台构建失败！`);
            process.exit(1);
        }
    }
}

// 运行构建器
if (require.main === module) {
    const builder = new CrossPlatformBuilder();
    builder.run().catch(error => {
        console.error(`💥 构建器运行失败:`, error);
        process.exit(1);
    });
}

module.exports = CrossPlatformBuilder;
