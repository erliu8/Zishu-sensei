# Zishu-Sensei 文档

本目录包含 Zishu-Sensei 项目的完整文档，使用 Sphinx 构建。

## 快速开始

### 构建文档

```bash
# 从项目根目录运行
make docs-build

# 或者直接使用 Sphinx
cd docs/sphinx
bash ../../scripts/run_with_cloud_env.sh -m sphinx.cmd.build -b html . _build/html
```

### 查看文档

构建完成后，打开 `docs/sphinx/_build/html/index.html` 在浏览器中查看。

或者启动本地 HTTP 服务器：

```bash
make docs-serve
# 访问 http://localhost:8080
```

### 实时预览

开发时可以使用自动重建功能：

```bash
make docs-live
# 访问 http://localhost:8080
# 修改 .rst 文件时会自动重新构建
```

## 文档结构

```
docs/sphinx/
├── conf.py                  # Sphinx 配置文件
├── index.rst               # 文档首页
├── api/                    # API 参考文档
│   ├── adapters.rst
│   ├── core.rst
│   ├── models.rst
│   ├── services.rst
│   └── utils.rst
├── user_guide/             # 用户指南
│   ├── introduction.rst
│   ├── installation.rst
│   ├── quickstart.rst
│   ├── configuration.rst
│   └── deployment.rst
├── developer_guide/        # 开发者指南
│   ├── architecture.rst
│   ├── development_setup.rst
│   └── coding_standards.rst
├── _static/               # 静态文件（CSS, JS, 图片等）
│   └── custom.css
├── _templates/            # 自定义模板
└── _build/               # 构建输出（不提交到 Git）
```

## 编写文档

### reStructuredText 基础

文档使用 reStructuredText (rST) 格式编写。

#### 标题

```rst
================
一级标题
================

二级标题
========

三级标题
--------

四级标题
~~~~~~~~
```

#### 代码块

```rst
.. code-block:: python

    def hello():
        print("Hello, World!")
```

#### 链接

```rst
# 外部链接
`Python <https://www.python.org/>`_

# 内部链接
:doc:`quickstart`
:ref:`section-label`
```

#### 警告框

```rst
.. note::
   这是一个提示框

.. warning::
   这是一个警告框

.. danger::
   这是一个危险警告框
```

### API 文档

使用 autodoc 自动从代码中生成 API 文档：

```rst
.. automodule:: zishu.adapters.soft.rag_engine
   :members:
   :undoc-members:
   :show-inheritance:
```

确保代码中有完整的 docstring：

```python
def retrieve_documents(query: str, top_k: int = 5) -> List[Document]:
    """检索相关文档
    
    使用向量相似度检索与查询最相关的文档。
    
    Args:
        query: 查询字符串
        top_k: 返回的文档数量，默认为 5
        
    Returns:
        文档对象列表，按相关性降序排列
        
    Raises:
        ValueError: 当 top_k 小于 1 时
    """
    pass
```

## 文档主题

当前使用 `sphinx_rtd_theme` (Read the Docs) 主题。

自定义样式在 `_static/custom.css` 中定义。

## 扩展插件

已启用的 Sphinx 扩展：

- `sphinx.ext.autodoc` - 自动从代码生成文档
- `sphinx.ext.autosummary` - 生成摘要表
- `sphinx.ext.napoleon` - 支持 Google/NumPy 风格的 docstring
- `sphinx.ext.viewcode` - 添加源代码链接
- `sphinx.ext.intersphinx` - 链接到其他项目的文档
- `sphinx.ext.todo` - TODO 项支持
- `sphinx_copybutton` - 代码块复制按钮
- `myst_parser` - Markdown 支持（可选）

## 国际化

文档默认使用中文（zh_CN）。

要添加其他语言，修改 `conf.py` 中的 `language` 设置。

## 清理构建

```bash
# 清理构建文件
make docs-clean

# 完整重新构建
make docs-full
```

## 常见问题

### 1. 导入错误

如果看到 "Failed to import" 警告：

- 确保所有依赖已安装
- 检查 PYTHONPATH 设置
- 某些模块可能尚未实现（正常情况）

### 2. 主题不正确

```bash
# 重新安装主题
bash scripts/run_with_cloud_env.sh -m pip install sphinx-rtd-theme
```

### 3. 扩展找不到

```bash
# 安装所有文档依赖
bash scripts/run_with_cloud_env.sh -m pip install -r requirements-dev.txt
```

## 贡献文档

1. 创建新的 .rst 文件
2. 在 `index.rst` 或相应的 toctree 中添加引用
3. 运行 `make docs-build` 验证
4. 提交 Pull Request

## 发布文档

文档可以发布到：

- **Read the Docs**: 连接 GitHub 仓库自动构建
- **GitHub Pages**: 使用 `gh-pages` 分支
- **自托管**: 部署 `_build/html` 目录

### 发布到 Read the Docs

1. 在 https://readthedocs.org/ 导入项目
2. 配置构建设置（Python 3.8+）
3. 推送代码自动触发构建

### 发布到 GitHub Pages

```bash
# 使用 ghp-import
pip install ghp-import
make docs-build
ghp-import -n -p -f docs/sphinx/_build/html
```

## 参考资源

- [Sphinx 文档](https://www.sphinx-doc.org/)
- [reStructuredText 入门](https://www.sphinx-doc.org/en/master/usage/restructuredtext/basics.html)
- [Read the Docs 主题](https://sphinx-rtd-theme.readthedocs.io/)
- [Google 风格 Docstring](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)

