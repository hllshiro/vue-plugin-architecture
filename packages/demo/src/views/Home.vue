<template>
  <div class="home">
    <h2>欢迎使用 Vue 插件架构系统</h2>

    <div class="intro">
      <p>这是一个基于 Vue 3 + TypeScript + Vite 的插件化架构系统演示应用。</p>
      <p>系统特性：</p>
      <ul>
        <li>动态插件加载和卸载</li>
        <li>Dockview 面板集成</li>
        <li>插件间双向通信</li>
        <li>完整的开发工具链支持</li>
        <li>TypeScript 类型安全</li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 12px;
}

.intro {
  background: #f9f9f9;
  padding: 2rem;
  border-radius: 8px;
  margin: 2rem 0;
}

.intro ul {
  margin: 1rem 0;
  padding-left: 2rem;
}

.intro li {
  margin: 0.5rem 0;
}

.actions {
  text-align: center;
  margin: 2rem 0;
}

.btn {
  display: inline-block;
  padding: 0.75rem 1.5rem;
  text-decoration: none;
  border-radius: 4px;
  font-weight: 500;
  transition: all 0.2s;
}

.btn-primary {
  background: #007acc;
  color: white;
}

.btn-primary:hover {
  background: #005a9e;
  transform: translateY(-1px);
}
</style>
