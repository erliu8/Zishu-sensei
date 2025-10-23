module.exports = {
  // TypeScript/JavaScript 文件
  '*.{ts,tsx,js,jsx}': [
    'eslint --fix --max-warnings=0',
    'prettier --write',
    // 可选：只检查暂存文件的类型
    // () => 'npm run type-check',
  ],

  // JSON, CSS, SCSS, Markdown 等文件
  '*.{json,css,scss,md,mdx,yml,yaml}': ['prettier --write'],

  // 包管理文件
  'package.json': ['prettier --write'],

  // Tailwind CSS 类名排序（如果有的话）
  '*.{ts,tsx,js,jsx,html}': ['prettier --write'],
}
