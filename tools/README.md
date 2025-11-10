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

### `download_models_*.py` - 模型下载工具

从 ModelScope 下载各种大语言模型到本地。

#### 可用脚本

- `download_models_index.py` - 下载 Index-1.9B Character 模型
- `download_models_qwen.py` - 下载 Qwen2.5-7B-Instruct 模型
- `download_models_mistral.py` - 下载 Chinese-Mistral-7B-v0.1 模型

#### 使用方法

**重要**: 请先激活虚拟环境（依赖安装在 `/data/disk/zishu-sensei/venv`）：

```bash
# 激活虚拟环境
source /data/disk/zishu-sensei/venv/bin/activate

# 下载 Index-1.9B Character 模型到 /data/models
python tools/download_models_index.py

# 下载 Qwen2.5-7B-Instruct 模型
python tools/download_models_qwen.py

# 下载 Chinese-Mistral-7B-v0.1 模型
python tools/download_models_mistral.py
```

或者直接使用虚拟环境的 Python 解释器：

```bash
# 下载 Index-1.9B Character 模型
/data/disk/zishu-sensei/venv/bin/python tools/download_models_index.py

# 下载 Qwen2.5-7B-Instruct 模型
/data/disk/zishu-sensei/venv/bin/python tools/download_models_qwen.py

# 下载 Chinese-Mistral-7B-v0.1 模型
/data/disk/zishu-sensei/venv/bin/python tools/download_models_mistral.py
```

#### Index-1.9B Character 模型说明

- **模型大小**: ~3.8GB (原始), ~500MB (4-bit量化后)
- **下载路径**: `/data/models/Index-1.9B-character`
- **模型ID**: `bilibili/Index-1.9B-character`
- **特点**: 专为角色扮演设计，中文能力优秀
- **硬件要求**: 
  - CPU推理: 4核心+ CPU, 8GB+ RAM
  - GPU推理: 4GB+ VRAM (推荐)

#### 功能特性

- ✅ 自动创建目录
- ✅ 显示下载进度
- ✅ 自动测试模型加载
- ✅ 支持4-bit量化（节省内存）
- ✅ 错误处理和提示

## 📦 依赖要求

确保安装了必要的Python包：

```bash
# 激活虚拟环境
source /data/disk/zishu-sensei/venv/bin/activate

# 配置文件转换工具
pip install pyyaml

# 模型下载工具（如果尚未安装）
pip install modelscope transformers torch bitsandbytes accelerate
```

**注意**: 项目的依赖已安装在 `/data/disk/zishu-sensei/venv` 虚拟环境中，使用前请先激活该环境。

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