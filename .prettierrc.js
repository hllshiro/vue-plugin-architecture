export default {
  // 禁用分号，与 ESLint 规则保持一致
  semi: false,

  // 使用单引号
  singleQuote: true,

  // 行宽限制
  printWidth: 80,

  // 缩进使用 2 个空格
  tabWidth: 2,
  useTabs: false,

  // 尾随逗号：在多行时添加
  trailingComma: 'es5',

  // 对象字面量的大括号间添加空格
  bracketSpacing: true,

  // JSX 标签的反尖括号需要换行
  bracketSameLine: false,

  // 箭头函数参数括号：避免时省略
  arrowParens: 'avoid',

  // 换行符使用 lf
  endOfLine: 'lf',

  // Vue 文件中的 script 和 style 标签缩进
  vueIndentScriptAndStyle: false,

  // HTML 空白敏感性
  htmlWhitespaceSensitivity: 'css',

  // 嵌入式语言格式化
  embeddedLanguageFormatting: 'auto',
}
