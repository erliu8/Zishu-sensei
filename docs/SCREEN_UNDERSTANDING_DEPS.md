# 屏幕理解和识别功能依赖规划

## 功能需求分析

### 1. 屏幕截图捕获
- **跨平台截图** - Linux/Windows/macOS
- **区域选择** - 全屏/窗口/自定义区域
- **实时捕获** - 支持视频流

### 2. 图像预处理
- **缩放和裁剪** - 优化模型输入
- **格式转换** - 统一图像格式
- **增强处理** - 提高识别率

### 3. OCR 文字识别
- **多语言支持** - 中英日韩等
- **布局分析** - 保持文本结构
- **手写识别** - 可选功能

### 4. 视觉理解
- **目标检测** - UI 元素识别
- **场景理解** - 上下文分析
- **多模态模型** - 图文结合理解

## 推荐依赖方案

### 方案 A：轻量级（推荐用于生产环境）

```python
# OCR 文字识别
easyocr==1.7.1                      # 简单易用的 OCR，支持 80+ 语言
pytesseract==0.3.10                 # Tesseract OCR 的 Python 封装（备选）

# 屏幕截图
mss==9.0.1                          # 跨平台高性能截图
pyautogui==0.9.54                   # 自动化操作（包含截图功能）

# 图像处理（已有 Pillow==10.1.0）
opencv-python-headless==4.8.1.78    # 无 GUI 的 OpenCV，体积小

# 视觉模型（可选）
timm==0.9.12                        # 预训练视觉模型库
```

**优点**：
- 轻量级（约 500MB）
- 安装快速
- CPU 友好

**缺点**：
- OCR 精度中等
- 视觉理解能力有限

### 方案 B：高性能（推荐用于开发/高级功能）

```python
# OCR 文字识别
paddleocr==2.7.3                    # 百度 PaddleOCR，高精度中文识别
easyocr==1.7.1                      # 备选方案

# 计算机视觉
opencv-python==4.8.1.78             # 完整 OpenCV
opencv-contrib-python==4.8.1.78     # OpenCV 扩展模块

# 屏幕截图
mss==9.0.1                          # 跨平台高性能截图
pillow-screenshot==1.2.2            # PIL 截图扩展

# 多模态视觉模型
transformers>=4.36.2                # 已有，支持 CLIP/BLIP 等
torch>=2.2.0                        # 已有，深度学习框架

# 视觉 Transformer 模型
timm==0.9.12                        # 图像分类和特征提取
torchvision>=0.17.0                 # 已有，视觉工具

# 目标检测（可选）
ultralytics==8.0.232                # YOLOv8，实时目标检测

# 视觉语言模型（高级功能）
# 注意：这些模型很大（数 GB），按需安装
# open-flamingo                     # 多模态对话模型
# llava                             # 视觉语言助手
```

**优点**：
- OCR 精度高
- 视觉理解强大
- 功能完整

**缺点**：
- 体积大（5-10GB+）
- 需要较好的硬件
- 构建时间长

### 方案 C：混合方案（平衡性能和体积）✅ **推荐**

```python
# =============================================================================
# 屏幕理解和识别
# =============================================================================

# OCR 文字识别
easyocr==1.7.1                      # 多语言 OCR（轻量）
# paddleocr==2.7.3                  # 高精度中文 OCR（可选）

# 计算机视觉
opencv-python-headless==4.8.1.78    # 无 GUI 的 OpenCV（节省空间）

# 屏幕截图
mss==9.0.1                          # 跨平台高性能截图
pyscreenshot==3.1                   # 跨平台截图工具

# 视觉模型
timm==0.9.12                        # 预训练视觉模型

# 图像增强
scikit-image==0.22.0                # 图像处理算法

# 布局分析
layoutparser==0.3.4                 # 文档布局分析（可选）
```

**优点**：
- 体积适中（约 1-2GB）
- 功能够用
- 性能良好

## 系统依赖

### Linux (Debian/Ubuntu)
```bash
# Tesseract OCR 引擎（如果使用 pytesseract）
apt-get install tesseract-ocr tesseract-ocr-chi-sim tesseract-ocr-eng

# OpenCV 系统依赖
apt-get install libgl1-mesa-glx libglib2.0-0

# 其他工具
apt-get install scrot xvfb  # 截图工具
```

### Docker 构建
需要在 `Dockerfile.api` 中添加：
```dockerfile
RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0 \
    tesseract-ocr \
    tesseract-ocr-chi-sim \
    && rm -rf /var/lib/apt/lists/*
```

## 模型下载和缓存

### EasyOCR 模型
```python
# 首次使用会自动下载模型到：
~/.EasyOCR/model/
# 中英文模型约 200MB
```

### PaddleOCR 模型
```python
# 模型会下载到：
~/.paddleocr/
# 中文模型约 10MB（超轻量）
```

### 视觉模型（CLIP/BLIP）
```python
# HuggingFace 模型缓存：
~/.cache/huggingface/
# 建议挂载到云硬盘
```

## 空间需求估算

| 方案 | Python 包 | 模型文件 | 总计 | 推荐环境 |
|------|----------|---------|------|---------|
| 轻量级 | ~500MB | ~200MB | ~700MB | 生产环境 |
| 混合 | ~1.5GB | ~500MB | ~2GB | **推荐** |
| 高性能 | ~3GB | ~5GB | ~8GB | 开发环境 |

## 性能对比

| 功能 | EasyOCR | PaddleOCR | Tesseract |
|------|---------|-----------|-----------|
| 中文识别 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| 英文识别 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 速度 | 中等 | 快 | 最快 |
| 安装难度 | 简单 | 中等 | 复杂 |
| GPU 支持 | ✅ | ✅ | ❌ |

## 使用示例

### 屏幕截图
```python
import mss
import numpy as np
from PIL import Image

# 截取全屏
with mss.mss() as sct:
    screenshot = sct.grab(sct.monitors[1])
    img = Image.frombytes('RGB', screenshot.size, screenshot.rgb)
```

### OCR 识别
```python
import easyocr

# 初始化（支持中英文）
reader = easyocr.Reader(['ch_sim', 'en'], gpu=False)

# 识别图片
result = reader.readtext('screenshot.png')
for (bbox, text, prob) in result:
    print(f'文本: {text}, 置信度: {prob:.2f}')
```

### 视觉理解（使用 CLIP）
```python
from transformers import CLIPProcessor, CLIPModel
from PIL import Image

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

image = Image.open("screenshot.png")
text_queries = ["这是一个登录界面", "这是一个设置页面", "这是一个对话框"]

inputs = processor(text=text_queries, images=image, return_tensors="pt", padding=True)
outputs = model(**inputs)
probs = outputs.logits_per_image.softmax(dim=1)
```

## API 设计建议

### 截图 API
```python
POST /api/v1/screen/capture
{
    "mode": "fullscreen" | "window" | "region",
    "region": {"x": 0, "y": 0, "width": 1920, "height": 1080}
}
```

### OCR API
```python
POST /api/v1/screen/ocr
{
    "image": "base64_encoded_image",
    "language": ["zh", "en"],
    "return_layout": true
}
```

### 视觉理解 API
```python
POST /api/v1/screen/understand
{
    "image": "base64_encoded_image",
    "query": "描述这个界面的主要功能",
    "model": "clip" | "blip" | "llava"
}
```

## 注意事项

### 1. 权限问题
- Linux 桌面环境需要 X11/Wayland 权限
- Tauri 应用需要屏幕录制权限

### 2. 性能优化
- 使用图像压缩减少传输
- 缓存常用模型
- 异步处理截图

### 3. 隐私安全
- 敏感信息脱敏
- 截图数据加密
- 用户授权机制

## 下一步

1. ✅ 确定使用哪个方案
2. 更新 `requirements.txt`
3. 更新 `Dockerfile.api`
4. 重新构建容器
5. 实现 API 接口
6. 前端集成
