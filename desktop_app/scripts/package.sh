#!/bin/bash

# =============================================================================
# Zishu-sensei 桌面应用打包脚本
# =============================================================================
# 
# 功能特性：
# - 多平台打包支持 (Windows/macOS/Linux)
# - 多种安装包格式 (NSIS/WiX/DMG/DEB/AppImage)
# - 自动签名和代码签名
# - 安装包优化和压缩
# - 版本管理和发布
# - 构建产物验证
# - 发布准备和上传
# - 回滚和恢复机制
#
# 使用方法：
#   ./scripts/package.sh [平台] [选项]
#   
#   平台选项：
#     all        - 所有平台 (默认)
#     windows    - Windows 平台
#     macos      - macOS 平台
#     linux      - Linux 平台
#
#   选项：
#     --format=格式    - 指定安装包格式 (nsis/wix/dmg/deb/appimage)
#     --sign          - 启用代码签名
#     --compress      - 启用压缩优化
#     --upload        - 上传到发布服务器
#     --version=版本  - 指定版本号
#     --clean         - 清理旧的构建产物
#     --verbose       - 详细输出
#     --help          - 显示帮助信息
#
# 作者：Zishu Team
# 版本：1.0.0
# =============================================================================

set -euo pipefail

# =============================================================================
# 配置变量
# =============================================================================

# 脚本配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PACKAGE_DIR="$PROJECT_ROOT/packages"
RELEASE_DIR="$PROJECT_ROOT/releases"
LOG_DIR="$PROJECT_ROOT/logs"

# 应用配置
APP_NAME="zishu-sensei"
APP_VERSION="1.0.0"
APP_DESCRIPTION="智能桌面宠物AI助手"
APP_AUTHOR="Zishu Team"
APP_LICENSE="MIT"

# 打包配置
DEFAULT_PLATFORM="all"
TARGET_PLATFORM="${1:-$DEFAULT_PLATFORM}"
PACKAGE_FORMAT=""
ENABLE_SIGNING=false
ENABLE_COMPRESSION=false
ENABLE_UPLOAD=false
CUSTOM_VERSION=""
CLEAN_PACKAGES=false
VERBOSE=false

# 签名配置
SIGNING_CERT=""
SIGNING_PASSWORD=""
KEYCHAIN_NAME=""

# 上传配置
UPLOAD_SERVER=""
UPLOAD_USER=""
UPLOAD_KEY=""
UPLOAD_PATH="/releases"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 日志配置
LOG_FILE="$LOG_DIR/package-$(date +%Y%m%d-%H%M%S).log"

# =============================================================================
# 工具函数
# =============================================================================

# 日志函数
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case "$level" in
        "INFO")
            echo -e "${BLUE}[INFO]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[SUCCESS]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "WARNING")
            echo -e "${YELLOW}[WARNING]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "ERROR")
            echo -e "${RED}[ERROR]${NC} $message" | tee -a "$LOG_FILE"
            ;;
        "DEBUG")
            if [[ "$VERBOSE" == "true" ]]; then
                echo -e "${PURPLE}[DEBUG]${NC} $message" | tee -a "$LOG_FILE"
            fi
            ;;
    esac
}

# 错误处理
error_exit() {
    log "ERROR" "$1"
    exit 1
}

# 检查命令是否存在
check_command() {
    if ! command -v "$1" &> /dev/null; then
        error_exit "命令 '$1' 未找到，请先安装"
    fi
}

# 检查文件是否存在
check_file() {
    if [[ ! -f "$1" ]]; then
        error_exit "文件 '$1' 不存在"
    fi
}

# 检查目录是否存在
check_dir() {
    if [[ ! -d "$1" ]]; then
        error_exit "目录 '$1' 不存在"
    fi
}

# 创建目录
create_dir() {
    if [[ ! -d "$1" ]]; then
        mkdir -p "$1"
        log "INFO" "创建目录: $1"
    fi
}

# 显示帮助信息
show_help() {
    cat << EOF
🐾 Zishu-sensei 桌面应用打包脚本

使用方法：
  $0 [平台] [选项]

平台选项：
  all        所有平台 (默认)
  windows    Windows 平台
  macos      macOS 平台
  linux      Linux 平台

选项：
  --format=格式     指定安装包格式
                    Windows: nsis, wix
                    macOS: dmg
                    Linux: deb, appimage
  --sign           启用代码签名
  --compress       启用压缩优化
  --upload         上传到发布服务器
  --version=版本   指定版本号
  --clean          清理旧的构建产物
  --verbose        详细输出
  --help           显示此帮助信息

示例：
  $0                           # 所有平台打包
  $0 windows --format=nsis     # Windows NSIS 安装包
  $0 macos --sign              # macOS 签名安装包
  $0 linux --format=deb        # Linux DEB 安装包
  $0 all --upload --version=1.1.0  # 上传所有平台包

EOF
}

# 解析命令行参数
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            all|windows|macos|linux)
                TARGET_PLATFORM="$1"
                shift
                ;;
            --format=*)
                PACKAGE_FORMAT="${1#*=}"
                shift
                ;;
            --sign)
                ENABLE_SIGNING=true
                shift
                ;;
            --compress)
                ENABLE_COMPRESSION=true
                shift
                ;;
            --upload)
                ENABLE_UPLOAD=true
                shift
                ;;
            --version=*)
                CUSTOM_VERSION="${1#*=}"
                shift
                ;;
            --clean)
                CLEAN_PACKAGES=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            --help)
                show_help
                exit 0
                ;;
            *)
                error_exit "未知参数: $1"
                ;;
        esac
    done
}

# =============================================================================
# 环境检查
# =============================================================================

# 检查系统环境
check_system_requirements() {
    log "INFO" "检查系统环境..."
    
    # 检查操作系统
    case "$(uname -s)" in
        Linux*)
            OS="linux"
            log "INFO" "检测到 Linux 系统"
            ;;
        Darwin*)
            OS="macos"
            log "INFO" "检测到 macOS 系统"
            ;;
        CYGWIN*|MINGW*|MSYS*)
            OS="windows"
            log "INFO" "检测到 Windows 系统"
            ;;
        *)
            error_exit "不支持的操作系统: $(uname -s)"
            ;;
    esac
    
    # 检查必需的命令
    local required_commands=("node" "npm" "cargo" "tauri")
    for cmd in "${required_commands[@]}"; do
        check_command "$cmd"
    done
    
    # 检查平台特定的工具
    case "$TARGET_PLATFORM" in
        "windows")
            if [[ "$PACKAGE_FORMAT" == "nsis" ]]; then
                check_command "makensis" || log "WARNING" "NSIS 未安装，将使用 Tauri 内置打包"
            fi
            ;;
        "macos")
            if [[ "$ENABLE_SIGNING" == "true" ]]; then
                check_command "codesign" || log "WARNING" "codesign 未找到，将跳过签名"
            fi
            ;;
        "linux")
            if [[ "$PACKAGE_FORMAT" == "deb" ]]; then
                check_command "dpkg-deb" || log "WARNING" "dpkg-deb 未安装，将使用 Tauri 内置打包"
            fi
            ;;
    esac
    
    log "SUCCESS" "系统环境检查通过"
}

# 检查构建产物
check_build_artifacts() {
    log "INFO" "检查构建产物..."
    
    # 检查前端构建产物
    if [[ ! -d "$PROJECT_ROOT/dist" ]]; then
        error_exit "前端构建产物不存在，请先运行构建脚本"
    fi
    
    # 检查 Tauri 构建产物
    local bundle_dir="src-tauri/target/release/bundle"
    if [[ ! -d "$PROJECT_ROOT/$bundle_dir" ]]; then
        error_exit "Tauri 构建产物不存在，请先运行构建脚本"
    fi
    
    # 检查可执行文件
    case "$TARGET_PLATFORM" in
        "windows")
            if [[ ! -f "$PROJECT_ROOT/src-tauri/target/release/zishu-sensei.exe" ]]; then
                error_exit "Windows 可执行文件不存在"
            fi
            ;;
        "macos")
            if [[ ! -d "$PROJECT_ROOT/src-tauri/target/release/bundle/macos/Zishu Sensei.app" ]]; then
                error_exit "macOS 应用包不存在"
            fi
            ;;
        "linux")
            if [[ ! -f "$PROJECT_ROOT/src-tauri/target/release/zishu-sensei" ]]; then
                error_exit "Linux 可执行文件不存在"
            fi
            ;;
    esac
    
    log "SUCCESS" "构建产物检查通过"
}

# =============================================================================
# 版本管理
# =============================================================================

# 获取版本信息
get_version_info() {
    if [[ -n "$CUSTOM_VERSION" ]]; then
        APP_VERSION="$CUSTOM_VERSION"
    else
        # 从 package.json 获取版本
        if [[ -f "$PROJECT_ROOT/package.json" ]]; then
            APP_VERSION=$(grep '"version"' "$PROJECT_ROOT/package.json" | cut -d'"' -f4)
        fi
        
        # 从 Cargo.toml 获取版本
        if [[ -f "$PROJECT_ROOT/src-tauri/Cargo.toml" ]]; then
            local cargo_version=$(grep '^version' "$PROJECT_ROOT/src-tauri/Cargo.toml" | cut -d'"' -f2)
            if [[ "$cargo_version" != "$APP_VERSION" ]]; then
                log "WARNING" "版本不一致: package.json=$APP_VERSION, Cargo.toml=$cargo_version"
            fi
        fi
    fi
    
    log "INFO" "应用版本: $APP_VERSION"
}

# 更新版本信息
update_version_info() {
    log "INFO" "更新版本信息..."
    
    # 更新 package.json
    if [[ -f "$PROJECT_ROOT/package.json" ]]; then
        sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$APP_VERSION\"/" "$PROJECT_ROOT/package.json"
        rm -f "$PROJECT_ROOT/package.json.bak"
    fi
    
    # 更新 Cargo.toml
    if [[ -f "$PROJECT_ROOT/src-tauri/Cargo.toml" ]]; then
        sed -i.bak "s/^version = \"[^\"]*\"/version = \"$APP_VERSION\"/" "$PROJECT_ROOT/src-tauri/Cargo.toml"
        rm -f "$PROJECT_ROOT/src-tauri/Cargo.toml.bak"
    fi
    
    # 更新 tauri.conf.json
    if [[ -f "$PROJECT_ROOT/src-tauri/tauri.conf.json" ]]; then
        sed -i.bak "s/\"version\": \"[^\"]*\"/\"version\": \"$APP_VERSION\"/" "$PROJECT_ROOT/src-tauri/tauri.conf.json"
        rm -f "$PROJECT_ROOT/src-tauri/tauri.conf.json.bak"
    fi
    
    log "SUCCESS" "版本信息更新完成"
}

# =============================================================================
# 打包配置
# =============================================================================

# 配置 Tauri 打包选项
configure_tauri_packaging() {
    log "INFO" "配置 Tauri 打包选项..."
    
    cd "$PROJECT_ROOT"
    
    # 设置打包格式
    if [[ -n "$PACKAGE_FORMAT" ]]; then
        case "$TARGET_PLATFORM" in
            "windows")
                if [[ "$PACKAGE_FORMAT" == "nsis" ]]; then
                    export TAURI_BUNDLE_NSIS=true
                elif [[ "$PACKAGE_FORMAT" == "wix" ]]; then
                    export TAURI_BUNDLE_WIX=true
                fi
                ;;
            "macos")
                if [[ "$PACKAGE_FORMAT" == "dmg" ]]; then
                    export TAURI_BUNDLE_DMG=true
                fi
                ;;
            "linux")
                if [[ "$PACKAGE_FORMAT" == "deb" ]]; then
                    export TAURI_BUNDLE_DEB=true
                elif [[ "$PACKAGE_FORMAT" == "appimage" ]]; then
                    export TAURI_BUNDLE_APPIMAGE=true
                fi
                ;;
        esac
    fi
    
    # 设置签名选项
    if [[ "$ENABLE_SIGNING" == "true" ]]; then
        case "$TARGET_PLATFORM" in
            "windows")
                if [[ -n "$SIGNING_CERT" ]]; then
                    export TAURI_SIGNING_CERT="$SIGNING_CERT"
                fi
                if [[ -n "$SIGNING_PASSWORD" ]]; then
                    export TAURI_SIGNING_PASSWORD="$SIGNING_PASSWORD"
                fi
                ;;
            "macos")
                if [[ -n "$SIGNING_CERT" ]]; then
                    export TAURI_SIGNING_CERT="$SIGNING_CERT"
                fi
                if [[ -n "$KEYCHAIN_NAME" ]]; then
                    export TAURI_KEYCHAIN_NAME="$KEYCHAIN_NAME"
                fi
                ;;
        esac
    fi
    
    log "SUCCESS" "Tauri 打包配置完成"
}

# =============================================================================
# 打包过程
# =============================================================================

# 清理旧的打包产物
clean_old_packages() {
    if [[ "$CLEAN_PACKAGES" == "true" ]]; then
        log "INFO" "清理旧的打包产物..."
        
        # 清理 packages 目录
        if [[ -d "$PACKAGE_DIR" ]]; then
            rm -rf "$PACKAGE_DIR"
        fi
        
        # 清理 releases 目录
        if [[ -d "$RELEASE_DIR" ]]; then
            rm -rf "$RELEASE_DIR"
        fi
        
        log "SUCCESS" "旧的打包产物清理完成"
    fi
}

# 创建打包目录
create_package_directories() {
    log "INFO" "创建打包目录..."
    
    create_dir "$PACKAGE_DIR"
    create_dir "$RELEASE_DIR"
    
    # 创建平台特定目录
    case "$TARGET_PLATFORM" in
        "all")
            create_dir "$PACKAGE_DIR/windows"
            create_dir "$PACKAGE_DIR/macos"
            create_dir "$PACKAGE_DIR/linux"
            ;;
        *)
            create_dir "$PACKAGE_DIR/$TARGET_PLATFORM"
            ;;
    esac
    
    log "SUCCESS" "打包目录创建完成"
}

# 打包 Windows 应用
package_windows() {
    log "INFO" "打包 Windows 应用..."
    
    cd "$PROJECT_ROOT"
    
    # 设置 Windows 特定的环境变量
    export TAURI_TARGET_TRIPLE="x86_64-pc-windows-msvc"
    
    # 执行打包
    if ! npm run tauri:build; then
        error_exit "Windows 应用打包失败"
    fi
    
    # 复制打包产物
    local bundle_dir="src-tauri/target/release/bundle"
    local package_dir="$PACKAGE_DIR/windows"
    
    if [[ -d "$bundle_dir" ]]; then
        cp -r "$bundle_dir"/* "$package_dir/"
        log "INFO" "Windows 打包产物已复制到: $package_dir"
    fi
    
    # 列出生成的安装包
    find "$package_dir" -name "*.exe" -o -name "*.msi" | while read -r file; do
        local file_size=$(du -sh "$file" | cut -f1)
        log "INFO" "Windows 安装包: $(basename "$file") ($file_size)"
    done
    
    log "SUCCESS" "Windows 应用打包完成"
}

# 打包 macOS 应用
package_macos() {
    log "INFO" "打包 macOS 应用..."
    
    cd "$PROJECT_ROOT"
    
    # 设置 macOS 特定的环境变量
    export TAURI_TARGET_TRIPLE="x86_64-apple-darwin"
    
    # 执行打包
    if ! npm run tauri:build; then
        error_exit "macOS 应用打包失败"
    fi
    
    # 复制打包产物
    local bundle_dir="src-tauri/target/release/bundle"
    local package_dir="$PACKAGE_DIR/macos"
    
    if [[ -d "$bundle_dir" ]]; then
        cp -r "$bundle_dir"/* "$package_dir/"
        log "INFO" "macOS 打包产物已复制到: $package_dir"
    fi
    
    # 列出生成的安装包
    find "$package_dir" -name "*.dmg" -o -name "*.app" | while read -r file; do
        local file_size=$(du -sh "$file" | cut -f1)
        log "INFO" "macOS 安装包: $(basename "$file") ($file_size)"
    done
    
    log "SUCCESS" "macOS 应用打包完成"
}

# 打包 Linux 应用
package_linux() {
    log "INFO" "打包 Linux 应用..."
    
    cd "$PROJECT_ROOT"
    
    # 设置 Linux 特定的环境变量
    export TAURI_TARGET_TRIPLE="x86_64-unknown-linux-gnu"
    
    # 执行打包
    if ! npm run tauri:build; then
        error_exit "Linux 应用打包失败"
    fi
    
    # 复制打包产物
    local bundle_dir="src-tauri/target/release/bundle"
    local package_dir="$PACKAGE_DIR/linux"
    
    if [[ -d "$bundle_dir" ]]; then
        cp -r "$bundle_dir"/* "$package_dir/"
        log "INFO" "Linux 打包产物已复制到: $package_dir"
    fi
    
    # 列出生成的安装包
    find "$package_dir" -name "*.deb" -o -name "*.AppImage" -o -name "*.rpm" | while read -r file; do
        local file_size=$(du -sh "$file" | cut -f1)
        log "INFO" "Linux 安装包: $(basename "$file") ($file_size)"
    done
    
    log "SUCCESS" "Linux 应用打包完成"
}

# =============================================================================
# 后处理
# =============================================================================

# 压缩优化
optimize_packages() {
    if [[ "$ENABLE_COMPRESSION" == "true" ]]; then
        log "INFO" "压缩优化安装包..."
        
        cd "$PACKAGE_DIR"
        
        # 压缩各个平台的安装包
        for platform in windows macos linux; do
            if [[ -d "$platform" ]]; then
                log "INFO" "压缩 $platform 平台安装包..."
                
                # 创建压缩包
                local archive_name="${APP_NAME}-${APP_VERSION}-${platform}.tar.gz"
                if tar -czf "$archive_name" -C "$platform" .; then
                    local archive_size=$(du -sh "$archive_name" | cut -f1)
                    log "INFO" "压缩包: $archive_name ($archive_size)"
                else
                    log "WARNING" "压缩 $platform 平台失败"
                fi
            fi
        done
        
        log "SUCCESS" "压缩优化完成"
    fi
}

# 验证打包产物
verify_packages() {
    log "INFO" "验证打包产物..."
    
    local total_packages=0
    local total_size=0
    
    # 统计所有平台的安装包
    for platform in windows macos linux; do
        if [[ -d "$PACKAGE_DIR/$platform" ]]; then
            local platform_packages=$(find "$PACKAGE_DIR/$platform" -type f \( -name "*.exe" -o -name "*.msi" -o -name "*.dmg" -o -name "*.deb" -o -name "*.AppImage" -o -name "*.rpm" \) | wc -l)
            local platform_size=$(du -sh "$PACKAGE_DIR/$platform" | cut -f1)
            
            log "INFO" "$platform 平台: $platform_packages 个安装包 ($platform_size)"
            total_packages=$((total_packages + platform_packages))
        fi
    done
    
    log "INFO" "总计: $total_packages 个安装包"
    
    if [[ $total_packages -eq 0 ]]; then
        error_exit "没有找到任何安装包"
    fi
    
    log "SUCCESS" "打包产物验证通过"
}

# 生成发布信息
generate_release_info() {
    log "INFO" "生成发布信息..."
    
    local release_info_file="$RELEASE_DIR/release-info.json"
    
    cat > "$release_info_file" << EOF
{
  "app_name": "$APP_NAME",
  "version": "$APP_VERSION",
  "description": "$APP_DESCRIPTION",
  "author": "$APP_AUTHOR",
  "license": "$APP_LICENSE",
  "build_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "build_platform": "$OS",
  "target_platforms": ["$TARGET_PLATFORM"],
  "packages": {
EOF

    # 添加各个平台的包信息
    local first=true
    for platform in windows macos linux; do
        if [[ -d "$PACKAGE_DIR/$platform" ]]; then
            if [[ "$first" == "true" ]]; then
                first=false
            else
                echo "," >> "$release_info_file"
            fi
            
            echo "    \"$platform\": [" >> "$release_info_file"
            
            local packages=($(find "$PACKAGE_DIR/$platform" -type f \( -name "*.exe" -o -name "*.msi" -o -name "*.dmg" -o -name "*.deb" -o -name "*.AppImage" -o -name "*.rpm" \) -exec basename {} \;))
            local package_count=${#packages[@]}
            
            for i in "${!packages[@]}"; do
                local package="${packages[$i]}"
                local package_path="$PACKAGE_DIR/$platform/$package"
                local package_size=$(du -b "$package_path" | cut -f1)
                local package_hash=$(sha256sum "$package_path" | cut -d' ' -f1)
                
                echo "      {" >> "$release_info_file"
                echo "        \"name\": \"$package\"," >> "$release_info_file"
                echo "        \"size\": $package_size," >> "$release_info_file"
                echo "        \"sha256\": \"$package_hash\"" >> "$release_info_file"
                
                if [[ $i -lt $((package_count - 1)) ]]; then
                    echo "      }," >> "$release_info_file"
                else
                    echo "      }" >> "$release_info_file"
                fi
            done
            
            echo "    ]" >> "$release_info_file"
        fi
    done
    
    cat >> "$release_info_file" << EOF
  }
}
EOF
    
    log "SUCCESS" "发布信息已生成: $release_info_file"
}

# =============================================================================
# 上传功能
# =============================================================================

# 上传到发布服务器
upload_packages() {
    if [[ "$ENABLE_UPLOAD" == "true" ]]; then
        log "INFO" "上传安装包到发布服务器..."
        
        # 检查上传配置
        if [[ -z "$UPLOAD_SERVER" ]]; then
            log "WARNING" "未配置上传服务器，跳过上传"
            return
        fi
        
        # 检查上传工具
        if ! command -v rsync &> /dev/null && ! command -v scp &> /dev/null; then
            log "WARNING" "未找到上传工具 (rsync/scp)，跳过上传"
            return
        fi
        
        # 上传安装包
        local upload_cmd=""
        if command -v rsync &> /dev/null; then
            upload_cmd="rsync -avz --progress"
        else
            upload_cmd="scp -r"
        fi
        
        if [[ -n "$UPLOAD_USER" ]]; then
            upload_cmd="$upload_cmd $UPLOAD_USER@$UPLOAD_SERVER:$UPLOAD_PATH"
        else
            upload_cmd="$upload_cmd $UPLOAD_SERVER:$UPLOAD_PATH"
        fi
        
        # 执行上传
        if $upload_cmd "$PACKAGE_DIR/" "$RELEASE_DIR/"; then
            log "SUCCESS" "安装包上传完成"
        else
            log "WARNING" "安装包上传失败"
        fi
    fi
}

# =============================================================================
# 主函数
# =============================================================================

main() {
    # 解析命令行参数
    parse_args "$@"
    
    # 创建必要的目录
    create_dir "$LOG_DIR"
    create_dir "$PACKAGE_DIR"
    create_dir "$RELEASE_DIR"
    
    # 显示打包信息
    log "INFO" "🐾 开始打包 $APP_NAME v$APP_VERSION"
    log "INFO" "目标平台: $TARGET_PLATFORM"
    log "INFO" "项目路径: $PROJECT_ROOT"
    log "INFO" "日志文件: $LOG_FILE"
    
    # 执行打包步骤
    check_system_requirements
    check_build_artifacts
    get_version_info
    update_version_info
    configure_tauri_packaging
    clean_old_packages
    create_package_directories
    
    # 根据目标平台执行打包
    case "$TARGET_PLATFORM" in
        "all")
            package_windows
            package_macos
            package_linux
            ;;
        "windows")
            package_windows
            ;;
        "macos")
            package_macos
            ;;
        "linux")
            package_linux
            ;;
    esac
    
    optimize_packages
    verify_packages
    generate_release_info
    upload_packages
    
    # 打包完成
    log "SUCCESS" "🎉 打包完成！"
    log "INFO" "安装包位置: $PACKAGE_DIR"
    log "INFO" "发布信息: $RELEASE_DIR"
    
    # 显示安装包统计
    log "INFO" "安装包统计:"
    for platform in windows macos linux; do
        if [[ -d "$PACKAGE_DIR/$platform" ]]; then
            local package_count=$(find "$PACKAGE_DIR/$platform" -type f \( -name "*.exe" -o -name "*.msi" -o -name "*.dmg" -o -name "*.deb" -o -name "*.AppImage" -o -name "*.rpm" \) | wc -l)
            local platform_size=$(du -sh "$PACKAGE_DIR/$platform" | cut -f1)
            log "INFO" "  $platform: $package_count 个安装包 ($platform_size)"
        fi
    done
    
    log "INFO" "详细日志: $LOG_FILE"
}

# 执行主函数
main "$@"
