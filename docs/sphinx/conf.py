# =============================================================================
# Zishu-Sensei 项目文档配置
# Sphinx configuration file
# =============================================================================

import os
import sys
from datetime import datetime

# -- 路径设置 -----------------------------------------------------------------

# 添加项目根目录到 Python 路径
sys.path.insert(0, os.path.abspath('../../'))
sys.path.insert(0, os.path.abspath('../../zishu'))

# -- 项目信息 -----------------------------------------------------------------

project = 'Zishu-Sensei'
copyright = f'{datetime.now().year}, Zishu-Sensei Team'
author = 'Zishu-Sensei Team'

# 版本信息
version = '1.0'
release = '1.0.0'

# -- 通用配置 -----------------------------------------------------------------

# 扩展列表
extensions = [
    # Sphinx 核心扩展
    'sphinx.ext.autodoc',           # 自动从文档字符串生成文档
    'sphinx.ext.autosummary',       # 生成摘要表
    'sphinx.ext.napoleon',          # 支持 Google/NumPy 风格文档字符串
    'sphinx.ext.viewcode',          # 添加源代码链接
    'sphinx.ext.intersphinx',       # 链接到其他项目的文档
    'sphinx.ext.todo',              # TODO 支持
    'sphinx.ext.coverage',          # 文档覆盖率检查
    'sphinx.ext.mathjax',           # 数学公式支持
    'sphinx.ext.ifconfig',          # 条件包含内容
    'sphinx.ext.githubpages',       # GitHub Pages 支持
    
    # 第三方扩展
    'sphinx_autodoc_typehints',     # 类型注解支持
    'sphinx_copybutton',            # 代码块复制按钮
    'sphinx_tabs.tabs',             # 标签页支持
    'myst_parser',                  # Markdown 支持
]

# 自动生成摘要
autosummary_generate = True
autosummary_imported_members = True

# Napoleon 配置 (支持 Google/NumPy 风格文档字符串)
napoleon_google_docstring = True
napoleon_numpy_docstring = True
napoleon_include_init_with_doc = True
napoleon_include_private_with_doc = False
napoleon_include_special_with_doc = True
napoleon_use_admonition_for_examples = True
napoleon_use_admonition_for_notes = True
napoleon_use_admonition_for_references = True
napoleon_use_ivar = False
napoleon_use_param = True
napoleon_use_rtype = True
napoleon_preprocess_types = True
napoleon_type_aliases = None
napoleon_attr_annotations = True

# Autodoc 配置
autodoc_default_options = {
    'members': True,
    'member-order': 'bysource',
    'special-members': '__init__',
    'undoc-members': True,
    'exclude-members': '__weakref__',
    'show-inheritance': True,
    'inherited-members': True,
}
autodoc_typehints = 'description'
autodoc_typehints_description_target = 'documented'

# 类型提示配置
typehints_fully_qualified = False
always_document_param_types = True
typehints_document_rtype = True

# 文档源文件后缀
source_suffix = {
    '.rst': 'restructuredtext',
    '.md': 'markdown',
}

# 主文档
master_doc = 'index'

# 排除的文件模式
exclude_patterns = [
    '_build', 
    'Thumbs.db', 
    '.DS_Store',
    '**.ipynb_checkpoints',
    '**/node_modules',
    '**/__pycache__',
    '**/venv',
    '**/env',
]

# 模板路径
templates_path = ['_templates']

# 语言设置
language = 'zh_CN'

# -- HTML 输出选项 ------------------------------------------------------------

# HTML 主题
html_theme = 'sphinx_rtd_theme'

# 主题选项
html_theme_options = {
    'analytics_id': '',
    'logo_only': False,
    'display_version': True,
    'prev_next_buttons_location': 'bottom',
    'style_external_links': False,
    'vcs_pageview_mode': '',
    'style_nav_header_background': '#2980B9',
    # Toc options
    'collapse_navigation': False,
    'sticky_navigation': True,
    'navigation_depth': 4,
    'includehidden': True,
    'titles_only': False
}

# 添加自定义 CSS
html_static_path = ['_static']
html_css_files = [
    'custom.css',
]

# HTML 页面侧边栏
html_sidebars = {
    '**': [
        'globaltoc.html',
        'relations.html',
        'sourcelink.html',
        'searchbox.html',
    ]
}

# 网站标题和短标题
html_title = 'Zishu-Sensei Documentation'
html_short_title = 'Zishu-Sensei'

# Logo 和 Favicon
# html_logo = '_static/logo.png'
# html_favicon = '_static/favicon.ico'

# 显示最后更新时间
html_last_updated_fmt = '%Y-%m-%d %H:%M:%S'

# 显示 Sphinx 版权
html_show_sphinx = True

# 显示源文件链接
html_show_sourcelink = True

# 使用索引
html_use_index = True

# 分割索引
html_split_index = False

# 复制源文件到输出
html_copy_source = True

# -- MyST 配置 (Markdown 支持) -----------------------------------------------

myst_enable_extensions = [
    "amsmath",
    "colon_fence",
    "deflist",
    "dollarmath",
    "fieldlist",
    "html_admonition",
    "html_image",
    "linkify",
    "replacements",
    "smartquotes",
    "strikethrough",
    "substitution",
    "tasklist",
]

# -- Intersphinx 配置 --------------------------------------------------------

intersphinx_mapping = {
    'python': ('https://docs.python.org/3', None),
    'numpy': ('https://numpy.org/doc/stable/', None),
    'pandas': ('https://pandas.pydata.org/docs/', None),
    'torch': ('https://pytorch.org/docs/stable/', None),
    'transformers': ('https://huggingface.co/docs/transformers/main/en/', None),
    'fastapi': ('https://fastapi.tiangolo.com/', None),
    'sqlalchemy': ('https://docs.sqlalchemy.org/en/20/', None),
}

# -- Todo 配置 ---------------------------------------------------------------

todo_include_todos = True

# -- 复制按钮配置 ------------------------------------------------------------

copybutton_prompt_text = r">>> |\.\.\. |\$ |In \[\d*\]: | {2,5}\.\.\.: | {5,8}: "
copybutton_prompt_is_regexp = True
copybutton_only_copy_prompt_lines = True
copybutton_remove_prompts = True

# =============================================================================
# 自定义配置
# =============================================================================

def setup(app):
    """Sphinx 应用程序设置钩子"""
    # 可以在这里添加自定义的 CSS、JS 或其他配置
    pass

