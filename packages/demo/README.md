# Vue Plugin Architecture Demo

这是一个展示Vue插件架构系统的演示应用，现已支持国际化功能。

## 国际化功能

### 支持的语言

- 中文 (zh-CN)
- English (en-US)

### 语言切换

应用会自动检测浏览器语言设置：

- 如果浏览器语言以 `zh` 开头，默认使用中文
- 否则使用英文作为默认语言

用户可以通过首页的语言选择器手动切换语言。

### 添加新语言

1. 在 `src/locales/` 目录下创建新的语言文件，如 `ja-JP.json`
2. 在 `src/i18n/index.ts` 中导入并添加到 messages 对象
3. 在 Home.vue 的语言选择器中添加新选项

### 文件结构

```
src/
├── i18n/
│   └── index.ts          # i18n 配置
├── locales/
│   ├── zh-CN.json        # 中文翻译
│   └── en-US.json        # 英文翻译
└── views/
    ├── Home.vue          # 首页组件（支持国际化）
    └── PluginManager.vue # 插件管理组件（支持国际化）
```

## 开发

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 类型检查
pnpm type-check

# 构建
pnpm build
```

## 主要功能

- 动态插件加载和卸载
- Dockview 面板集成
- 插件间双向通信
- 完整的开发工具链支持
- TypeScript 类型安全
- 多语言支持
