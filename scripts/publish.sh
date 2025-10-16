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

# 检查发布环境
check_publish_requirements() {
    log_info "检查发布环境..."
    
    # 检查 npm 登录状态
    if ! npm whoami > /dev/null 2>&1; then
        log_error "请先登录 npm: npm login"
        exit 1
    fi
    
    # 检查 Git 状态
    if ! git diff-index --quiet HEAD --; then
        log_error "存在未提交的更改，请先提交所有更改"
        exit 1
    fi
    
    # 检查当前分支
    CURRENT_BRANCH=$(git branch --show-current)
    if [ "$CURRENT_BRANCH" != "main" ] && [ "$CURRENT_BRANCH" != "master" ]; then
        log_warning "当前不在主分支 ($CURRENT_BRANCH)，确认要继续发布吗？"
        read -p "继续? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "发布已取消"
            exit 0
        fi
    fi
    
    log_success "发布环境检查通过"
}

# 版本管理
manage_version() {
    local version_type=${1:-patch}
    
    log_info "更新版本 ($version_type)..."
    
    # 更新根目录版本
    npm version $version_type --no-git-tag-version
    
    # 获取新版本号
    NEW_VERSION=$(node -p "require('./package.json').version")
    log_info "新版本: $NEW_VERSION"
    
    # 更新所有包的版本
    update_package_versions "$NEW_VERSION"
    
    # 提交版本更改
    git add .
    git commit -m "chore: bump version to $NEW_VERSION"
    git tag "v$NEW_VERSION"
    
    log_success "版本更新完成: $NEW_VERSION"
}

# 更新包版本
update_package_versions() {
    local new_version=$1
    
    log_info "更新包版本到 $new_version..."
    
    # 更新核心包版本
    cd packages/core
    npm version $new_version --no-git-tag-version
    cd ../..
    
    # 更新 Vite 插件包版本
    cd packages/vite-plugin
    npm version $new_version --no-git-tag-version
    cd ../..
    
    # 更新插件包版本
    for plugin_dir in packages/plugins/*/; do
        if [ -d "$plugin_dir" ] && [ -f "${plugin_dir}package.json" ]; then
            plugin_name=$(basename "$plugin_dir")
            log_info "更新插件版本: $plugin_name"
            cd "$plugin_dir"
            npm version $new_version --no-git-tag-version
            cd ../../..
        fi
    done
    
    # 更新示例应用版本
    cd project/demo
    npm version $new_version --no-git-tag-version
    cd ../..
    
    log_success "所有包版本已更新"
}

# 构建包
build_for_publish() {
    log_info "构建用于发布的包..."
    
    # 运行构建脚本
    if [ -f "scripts/build.sh" ]; then
        chmod +x scripts/build.sh
        ./scripts/build.sh --skip-tests
    else
        # 备用构建方法
        pnpm build
    fi
    
    log_success "构建完成"
}

# 发布包
publish_packages() {
    local publish_tag=${1:-latest}
    
    log_info "发布包到 npm (tag: $publish_tag)..."
    
    # 发布核心包
    log_info "发布 @vue-plugin-arch/core..."
    cd packages/core
    npm publish --tag $publish_tag --access public
    cd ../..
    
    # 发布 Vite 插件包
    log_info "发布 @vue-plugin-arch/vite-plugin..."
    cd packages/vite-plugin
    npm publish --tag $publish_tag --access public
    cd ../..
    
    # 发布插件包（可选）
    for plugin_dir in packages/plugins/*/; do
        if [ -d "$plugin_dir" ] && [ -f "${plugin_dir}package.json" ]; then
            plugin_name=$(basename "$plugin_dir")
            
            # 检查是否应该发布此插件
            cd "$plugin_dir"
            if grep -q '"private".*true' package.json; then
                log_info "跳过私有插件: $plugin_name"
            else
                log_info "发布插件: $plugin_name"
                npm publish --tag $publish_tag --access public
            fi
            cd ../../..
        fi
    done
    
    log_success "所有包发布完成"
}

# 推送到 Git 仓库
push_to_git() {
    log_info "推送到 Git 仓库..."
    
    # 推送代码和标签
    git push origin HEAD
    git push origin --tags
    
    log_success "Git 推送完成"
}

# 生成发布说明
generate_release_notes() {
    local version=$1
    
    log_info "生成发布说明..."
    
    # 获取上一个标签
    LAST_TAG=$(git describe --tags --abbrev=0 HEAD^ 2>/dev/null || echo "")
    
    # 生成变更日志
    if [ -n "$LAST_TAG" ]; then
        CHANGES=$(git log --pretty=format:"- %s" $LAST_TAG..HEAD)
    else
        CHANGES=$(git log --pretty=format:"- %s")
    fi
    
    # 创建发布说明文件
    cat > RELEASE_NOTES.md << EOF
# Release v$version

## 🚀 新功能和改进

$CHANGES

## 📦 包信息

- **@vue-plugin-arch/core**: Vue 插件架构核心包
- **@vue-plugin-arch/vite-plugin**: Vite 插件支持
- **示例插件**: Hello World 和模板插件

## 🔧 安装

\`\`\`bash
npm install @vue-plugin-arch/core @vue-plugin-arch/vite-plugin
\`\`\`

## 📚 文档

详细文档请查看项目 README 和 docs 目录。

---

发布时间: $(date '+%Y-%m-%d %H:%M:%S')
Git 提交: $(git rev-parse HEAD)
EOF
    
    log_success "发布说明已生成: RELEASE_NOTES.md"
}

# 验证发布
verify_publish() {
    local version=$1
    
    log_info "验证发布..."
    
    # 等待 npm 同步
    sleep 10
    
    # 检查核心包
    if npm view @vue-plugin-arch/core@$version version > /dev/null 2>&1; then
        log_success "核心包发布成功"
    else
        log_error "核心包发布失败"
        return 1
    fi
    
    # 检查 Vite 插件包
    if npm view @vue-plugin-arch/vite-plugin@$version version > /dev/null 2>&1; then
        log_success "Vite 插件包发布成功"
    else
        log_error "Vite 插件包发布失败"
        return 1
    fi
    
    log_success "发布验证通过"
}

# 发布后清理
post_publish_cleanup() {
    log_info "发布后清理..."
    
    # 清理临时文件
    rm -f RELEASE_NOTES.md 2>/dev/null || true
    
    log_success "清理完成"
}

# 显示发布信息
show_publish_info() {
    local version=$1
    
    log_success "🎉 发布完成！"
    echo ""
    echo "📋 发布信息："
    echo "  🏷️  版本: v$version"
    echo "  📦 核心包: @vue-plugin-arch/core@$version"
    echo "  🔧 Vite 插件: @vue-plugin-arch/vite-plugin@$version"
    echo "  🌐 npm 地址: https://www.npmjs.com/package/@vue-plugin-arch/core"
    echo ""
    echo "📝 下一步："
    echo "  查看包信息: npm view @vue-plugin-arch/core"
    echo "  安装测试: npm install @vue-plugin-arch/core@$version"
    echo "  创建 GitHub Release (如果需要)"
    echo ""
}

# 错误处理
handle_error() {
    log_error "发布过程中发生错误"
    echo ""
    echo "🔍 故障排除："
    echo "  1. 检查 npm 登录状态: npm whoami"
    echo "  2. 检查包名是否已存在"
    echo "  3. 检查网络连接"
    echo "  4. 查看详细错误信息"
    echo ""
    
    # 回滚版本更改（如果需要）
    if [ -n "$NEW_VERSION" ]; then
        log_warning "考虑回滚版本更改"
    fi
    
    exit 1
}

# 主函数
main() {
    local version_type=${1:-patch}
    local publish_tag=${2:-latest}
    
    echo "📦 开始发布 Vue 插件架构系统..."
    echo ""
    
    # 设置错误处理
    trap handle_error ERR
    
    # 执行发布步骤
    check_publish_requirements
    manage_version $version_type
    build_for_publish
    publish_packages $publish_tag
    push_to_git
    generate_release_notes $NEW_VERSION
    verify_publish $NEW_VERSION
    post_publish_cleanup
    show_publish_info $NEW_VERSION
}

# 显示帮助信息
show_help() {
    echo "Vue 插件架构系统发布脚本"
    echo ""
    echo "用法:"
    echo "  $0 [版本类型] [发布标签]"
    echo ""
    echo "版本类型:"
    echo "  patch      补丁版本 (默认)"
    echo "  minor      次要版本"
    echo "  major      主要版本"
    echo "  prerelease 预发布版本"
    echo ""
    echo "发布标签:"
    echo "  latest     正式版本 (默认)"
    echo "  beta       测试版本"
    echo "  alpha      内测版本"
    echo ""
    echo "示例:"
    echo "  $0                    # 发布补丁版本到 latest"
    echo "  $0 minor              # 发布次要版本到 latest"
    echo "  $0 prerelease beta    # 发布预发布版本到 beta"
    echo ""
    echo "注意:"
    echo "  - 确保已登录 npm: npm login"
    echo "  - 确保在正确的分支上"
    echo "  - 确保所有更改已提交"
    echo ""
}

# 处理命令行参数
case "${1:-}" in
    --help|-h)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac