# 下一步计划

## 现状

目前的架构，需要宿主应用将插件作为依赖安装，然后在启动时动态生成虚拟清单。

## 目标

我希望能更近一步，实现加载任意与构建插件的能力。

## 计划

1. 调整pluginManager.ts中`loadPlugin`机制，修改`private async importPluginModule(packageName: string): Promise<Plugin>`，将参数从packageName: string修改为minifest: PluginManifest，PluginManifest中增加URL参数。最终使用 await import(url)加载插件。

2. 宿主应用的`PluginManager.vue`通过URL请求插件清单列表，在demo中，直接在public下放一个json文件。

3. vite-plugin负责将plugins目录下的插件追加到public下的json中（拦截请求，动态追加，同名覆盖）,url格式为`/@fs/absolute-path`
