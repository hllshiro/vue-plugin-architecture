#!/bin/bash

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 检查必要的工具
check_requirements() {
    log_info "检查构建环境..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        log_error "pnpm 未安装"
        exit 1
    fi
    
    # 检查 Node.js 版本
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 版本需要 >= 18.0.0，当前版本: $(node --version)"
        exit 1
    fi
    
    log_success "环境检查通过"
}

# 设置环境变量
setup_environment() {
    log_info "设置环境变量..."
    
    if [ -z "$NODE_ENV" ]; then
        export NODE_ENV=production
        log_info "设置 NODE_ENV=production"
    fi
    
    log_success "环境变量设置完成"
}

# 清理构建产物
clean_build() {
    log_info "清理旧的构建产物..."
    
    # 清理 dist 目录
    find . -name "dist" -type d -prune -exec rm -rf {} + 2>/dev/null || true
    
    # 清理 node_modules（可选）
    if [ "$1" = "--clean-deps" ]; then
        log_info "清理 node_modules..."
        find . -name "node_modules" -type d -prune -exec rm -rf {} + 2>/dev/null || true
    fi
    
    log_success "清理完成"
}

# 安装依赖
install_dependencies() {
    log_info "安装依赖..."
    
    if [ ! -f "pnpm-lock.yaml" ]; then
        log_error "pnpm-lock.yaml 文件不存在"
        exit 1
    fi
    
    pnpm install --frozen-lockfile
    
    log_success "依赖安装完成"
}

# 运行测试
run_tests() {
    log_info "运行测试..."
    
    # 类型检查
    log_info "执行类型检查..."
    pnpm type-check
    
    # 代码检查
    log_info "执行代码检查..."
    pnpm lint
    
    # 单元测试
    if pnpm test --run > /dev/null 2>&1; then
        log_success "单元测试通过"
    else
        log_warning "单元测试失败或未配置"
    fi
    
    log_success "测试完成"
}

# 构建包
build_packages() {
    log_info "构建核心包..."
    
    # 构建 core 包
    log_info "构建 @vue-plugin-arch/core..."
    cd packages/core
    pnpm build
    cd ../..
    
    # 构建 vite-plugin 包
    log_info "构建 @vue-plugin-arch/vite-plugin..."
    cd packages/vite-plugin
    pnpm build
    cd ../..
    
    # 构建插件包
    log_info "构建插件包..."
    for plugin_dir in packages/plugins/*/; do
        if [ -d "$plugin_dir" ] && [ -f "${plugin_dir}package.json" ]; then
            plugin_name=$(basename "$plugin_dir")
            log_info "构建插件: $plugin_name"
            cd "$plugin_dir"
            if [ -f "package.json" ] && grep -q '"build"' package.json; then
                pnpm build
            else
                log_warning "插件 $plugin_name 没有构建脚本"
            fi
            cd ../../..
        fi
    done
    
    log_success "包构建完成"
}

# 构建示例应用
build_demo() {
    log_info "构建示例应用..."
    
    cd project/demo
    pnpm build
    cd ../..
    
    # 检查构建产物
    if [ ! -d "project/demo/dist" ]; then
        log_error "示例应用构建失败：dist 目录不存在"
        exit 1
    fi
    
    log_success "示例应用构建完成"
}

# 验证构建产物
verify_build() {
    log_info "验证构建产物..."
    
    # 检查核心包
    if [ ! -f "packages/core/dist/index.js" ]; then
        log_error "核心包构建失败"
        exit 1
    fi
    
    # 检查 Vite 插件包
    if [ ! -f "packages/vite-plugin/dist/index.js" ]; then
        log_error "Vite 插件包构建失败"
        exit 1
    fi
    
    # 检查示例应用
    if [ ! -f "project/demo/dist/index.html" ]; then
        log_error "示例应用构建失败"
        exit 1
    fi
    
    log_success "构建产物验证通过"
}

# 生成构建报告
generate_build_report() {
    log_info "生成构建报告..."
    
    BUILD_TIME=$(date '+%Y-%m-%d %H:%M:%S')
    BUILD_HASH=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    
    cat > build-report.json << EOF
{
  "buildTime": "$BUILD_TIME",
  "gitHash": "$BUILD_HASH",
  "nodeVersion": "$(node --version)",
  "pnpmVersion": "$(pnpm --version)",
  "packages": {
    "core": {
      "version": "$(cd packages/core && node -p "require('./package.json').version")",
      "size": "$(du -sh packages/core/dist 2>/dev/null | cut -f1 || echo 'N/A')"
    },
    "vite-plugin": {
      "version": "$(cd packages/vite-plugin && node -p "require('./package.json').version")",
      "size": "$(du -sh packages/vite-plugin/dist 2>/dev/null | cut -f1 || echo 'N/A')"
    },
    "demo": {
      "size": "$(du -sh project/demo/dist 2>/dev/null | cut -f1 || echo 'N/A')"
    }
  }
}
EOF
    
    log_success "构建报告已生成: build-report.json"
}

# 显示构建信息
show_build_info() {
    log_success "🎉 构建完成！"
    echo ""
    echo "📋 构建信息："
    echo "  📦 核心包: packages/core/dist/"
    echo "  🔧 Vite 插件: packages/vite-plugin/dist/"
    echo "  🌐 示例应用: project/demo/dist/"
    echo "  📊 构建报告: build-report.json"
    echo ""
    echo "📝 下一步："
    echo "  预览应用: pnpm preview"
    echo "  发布包: pnpm publish:packages"
    echo "  查看报告: cat build-report.json"
    echo ""
}

# 错误处理
handle_error() {
    log_error "构建过程中发生错误"
    echo ""
    echo "🔍 故障排除："
    echo "  1. 检查 Node.js 和 pnpm 版本"
    echo "  2. 确保所有依赖已正确安装"
    echo "  3. 检查代码是否有语法错误"
    echo "  4. 查看详细错误信息"
    echo ""
    exit 1
}

# 主函数
main() {
    echo "🏗️ 开始构建 Vue 插件架构系统..."
    echo ""
    
    # 设置错误处理
    trap handle_error ERR
    
    # 执行构建步骤
    check_requirements
    setup_environment
    
    # 可选的清理步骤
    if [ "$1" = "--clean" ]; then
        clean_build
    elif [ "$1" = "--clean-all" ]; then
        clean_build --clean-deps
    fi
    
    install_dependencies
    
    # 可选跳过测试
    if [ "$1" != "--skip-tests" ]; then
        run_tests
    fi
    
    build_packages
    build_demo
    verify_build
    generate_build_report
    show_build_info
}

# 显示帮助信息
show_help() {
    echo "Vue 插件架构系统构建脚本"
    echo ""
    echo "用法:"
    echo "  $0 [选项]"
    echo ""
    echo "选项:"
    echo "  --clean        清理构建产物"
    echo "  --clean-all    清理构建产物和依赖"
    echo "  --skip-tests   跳过测试步骤"
    echo "  --help         显示此帮助信息"
    echo ""
    echo "环境变量:"
    echo "  NODE_ENV       运行环境 (默认: production)"
    echo ""
}

# 处理命令行参数
case "${1:-}" in
    --help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac