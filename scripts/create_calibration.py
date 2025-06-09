import json
import random
from pathlib import Path

def create_calibration_dataset():
    # 读取训练数据
    train_data_path = "./data/train/train.json"
    calib_data_path = "./data/train/calibration.json"
    
    # 打开训练数据文件
    with open(train_data_path, 'r', encoding='utf-8') as f:
        train_data = json.load(f)
    
    # 随机采样128个样本
    if len(train_data) > 128:
        calibration_samples = random.sample(train_data, 128)
    else:
        calibration_samples = train_data
    
    # 保存校准数据集
    with open(calib_data_path, 'w', encoding='utf-8') as f:
        json.dump(calibration_samples, f, ensure_ascii=False, indent=2)
    
    print(f"已创建校准数据集: {calib_data_path}")
    print(f"样本数量: {len(calibration_samples)}")

if __name__ == "__main__":
    create_calibration_dataset() 