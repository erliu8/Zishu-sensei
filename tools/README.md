# 🛠️ 开发工具

这个目录包含项目开发过程中使用的各种工具脚本。

## 📋 工具列表

### `config_converter.py` - 配置文件转换工具

将JSON配置文件转换为YAML格式，支持单文件和批量转换。

#### 功能特性
- ✅ 单文件转换
- ✅ 批量目录转换
- ✅ 递归搜索子目录
- ✅ 自动备份原文件
- ✅ 预览模式（dry-run）
- ✅ 错误处理和进度显示

#### 使用方法

```bash
# 转换单个文件
python tools/config_converter.py config/environments/inference.json

# 指定输出文件名
python tools/config_converter.py config/environments/inference.json -o config/environments/inference.yml

# 批量转换整个config目录
python tools/config_converter.py config/ -r

# 预览转换（不实际执行）
python tools/config_converter.py config/ -r --dry-run

# 转换时不备份原文件
python tools/config_converter.py config/environments/inference.json --no-backup
```

#### 命令行参数
- `input`: 输入文件或目录路径
- `-o, --output`: 输出文件路径（仅单文件转换时使用）
- `-r, --recursive`: 递归搜索子目录
- `--no-backup`: 不备份原文件
- `--dry-run`: 预览模式，仅显示会转换的文件

#### 示例输出
```
🔍 找到 3 个JSON文件
📄 已备份: config/environments/inference.json -> config/environments/inference.json.backup
✅ 转换成功: config/environments/inference.json -> config/environments/inference.yml
✅ 转换成功: config/default.json -> config/default.yml
✅ 转换成功: config/services/api_config.json -> config/services/api_config.yml

📊 转换完成: 3/3 个文件成功
```

## 📦 依赖要求

确保安装了必要的Python包：

```bash
pip install pyyaml
```

## 🚀 快速开始

针对当前项目的配置文件转换：

```bash
# 转换推理配置
python tools/config_converter.py config/environments/inference.json

# 转换所有配置文件
python tools/config_converter.py config/ -r

# 预览转换结果
python tools/config_converter.py config/ -r --dry-run
``` 