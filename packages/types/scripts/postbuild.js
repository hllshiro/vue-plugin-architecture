// scripts/postbuild.js
// Node >= 12 推荐。跨平台：不依赖 sed/copy cli。
// 功能：把 src/global.d.ts 复制到 types 入口目录，并确保 types 入口文件顶部包含 triple-slash reference。

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

async function main() {
  const cwd = process.cwd()
  // types entry: package.json.types 优先，否则默认 dist/index.d.ts
  const typesEntry = 'dist/index.d.ts'
  const typesAbs = path.resolve(cwd, typesEntry)
  const typesDir = path.dirname(typesAbs)

  const srcGlobal = path.resolve(cwd, 'src', 'global.d.ts')

  // 1) 目标 global 路径
  const outGlobal = path.join(typesDir, path.basename(srcGlobal))

  // 2) 复制 src/global.d.ts -> dist/...
  try {
    await fs.mkdir(typesDir, { recursive: true })
    await fs.copyFile(srcGlobal, outGlobal)
    console.log(`Copied ${srcGlobal} -> ${outGlobal}`)
  } catch (err) {
    console.error('Copy global.d.ts failed:', err)
    process.exit(1)
  }

  // 3) 计算相对引用路径（使用 POSIX 风格）
  let rel = path.relative(typesDir, outGlobal).replace(/\\/g, '/')
  if (!rel.startsWith('.')) rel = './' + rel

  const refLine = `/// <reference path="${rel}" />`

  // 4) 读取 types 文件并插入 reference（如果尚不存在）
  try {
    let content = await fs.readFile(typesAbs, 'utf8')

    if (content.includes(refLine)) {
      console.log(`Reference already present in ${typesAbs}`)
    } else {
      // 保持 BOM（如果存在）
      let bom = ''
      if (content.charCodeAt(0) === 0xfeff) {
        bom = '\uFEFF'
        content = content.slice(1)
      }

      // 插入 reference 在文件顶部（在任何现有的 triple-slash 之前或之后都行；这里 prepend）
      const newContent = bom + refLine + '\n' + content
      await fs.writeFile(typesAbs, newContent, 'utf8')
      console.log(`Inserted reference into ${typesAbs}: ${refLine}`)
    }
  } catch (err) {
    console.error('Updating types entry failed:', err)
    process.exit(1)
  }

  console.log('postbuild: done')
}

main()
