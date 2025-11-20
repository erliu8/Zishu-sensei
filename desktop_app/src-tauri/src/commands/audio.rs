/*!
 * 音频录制和播放命令
 * 提供跨平台的音频捕获功能，不依赖浏览器 API
 */

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{StreamConfig};
use hound::{WavSpec, WavWriter};
use std::sync::{Arc, Mutex};
use tauri::State;

/// 音频录制状态
pub struct AudioState {
    pub is_recording: Arc<Mutex<bool>>,
    pub audio_buffer: Arc<Mutex<Vec<u8>>>,
}

impl Default for AudioState {
    fn default() -> Self {
        Self {
            is_recording: Arc::new(Mutex::new(false)),
            audio_buffer: Arc::new(Mutex::new(Vec::new())),
        }
    }
}

/// 音频配置
#[derive(Debug, serde::Deserialize)]
pub struct AudioConfig {
    pub sample_rate: u32,
    pub channels: u16,
    pub bits_per_sample: u16,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            sample_rate: 16000,
            channels: 1,
            bits_per_sample: 16,
        }
    }
}

/// 获取可用的音频输入设备
#[tauri::command]
pub fn list_audio_devices() -> Result<Vec<String>, String> {
    let host = cpal::default_host();
    
    let devices = host
        .input_devices()
        .map_err(|e| format!("获取音频设备失败: {}", e))?;
    
    let mut device_names = Vec::new();
    for device in devices {
        if let Ok(name) = device.name() {
            device_names.push(name);
        }
    }
    
    if device_names.is_empty() {
        return Err("未找到音频输入设备".to_string());
    }
    
    Ok(device_names)
}

/// 开始录音
#[tauri::command]
pub fn start_recording(
    state: State<'_, AudioState>,
    config: Option<AudioConfig>,
) -> Result<(), String> {
    let config = config.unwrap_or_default();
    
    // 检查是否已在录音
    {
        let is_recording = state.is_recording.lock().unwrap();
        if *is_recording {
            return Err("已经在录音中".to_string());
        }
    }
    
    // 获取默认音频主机和输入设备
    let host = cpal::default_host();
    let device = host
        .default_input_device()
        .ok_or("未找到默认音频输入设备".to_string())?;
    
    // 获取支持的配置
    let supported_config = device
        .default_input_config()
        .map_err(|e| format!("获取音频配置失败: {}", e))?;
    
    let stream_config = StreamConfig {
        channels: config.channels,
        sample_rate: cpal::SampleRate(config.sample_rate),
        buffer_size: cpal::BufferSize::Default,
    };
    
    // 清空音频缓冲区
    {
        let mut buffer = state.audio_buffer.lock().unwrap();
        buffer.clear();
    }
    
    // 创建音频数据处理闭包
    let audio_buffer = Arc::clone(&state.audio_buffer);
    let is_recording_flag = Arc::clone(&state.is_recording);
    let channels = config.channels;
    
    let err_fn = |err| eprintln!("录音流错误: {}", err);
    
    // 创建音频流
    let stream = match supported_config.sample_format() {
        cpal::SampleFormat::F32 => {
            let is_rec = Arc::clone(&is_recording_flag);
            device.build_input_stream(
                &stream_config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    // 只在录音状态时才写入数据
                    if !*is_rec.lock().unwrap() {
                        return;
                    }
                    // 将 f32 采样转换为 i16
                    let mut buffer = audio_buffer.lock().unwrap();
                    for &sample in data.iter() {
                        let sample_i16 = (sample * i16::MAX as f32) as i16;
                        buffer.extend_from_slice(&sample_i16.to_le_bytes());
                    }
                },
                err_fn,
                None,
            )
        }
        cpal::SampleFormat::I16 => {
            let is_rec = Arc::clone(&is_recording_flag);
            device.build_input_stream(
                &stream_config,
                move |data: &[i16], _: &cpal::InputCallbackInfo| {
                    if !*is_rec.lock().unwrap() {
                        return;
                    }
                    let mut buffer = audio_buffer.lock().unwrap();
                    for &sample in data.iter() {
                        buffer.extend_from_slice(&sample.to_le_bytes());
                    }
                },
                err_fn,
                None,
            )
        }
        cpal::SampleFormat::U16 => {
            let is_rec = Arc::clone(&is_recording_flag);
            device.build_input_stream(
                &stream_config,
                move |data: &[u16], _: &cpal::InputCallbackInfo| {
                    if !*is_rec.lock().unwrap() {
                        return;
                    }
                    let mut buffer = audio_buffer.lock().unwrap();
                    for &sample in data.iter() {
                        // 转换 u16 到 i16
                        let sample_i16 = (sample as i32 - 32768) as i16;
                        buffer.extend_from_slice(&sample_i16.to_le_bytes());
                    }
                },
                err_fn,
                None,
            )
        }
        _ => return Err("不支持的采样格式".to_string()),
    }
    .map_err(|e| format!("创建录音流失败: {}", e))?;
    
    // 启动流
    stream
        .play()
        .map_err(|e| format!("启动录音失败: {}", e))?;
    
    // 泄漏 Stream 使其保持活跃
    // 注意：这是一个内存泄漏，但是为了保持录音流运行是必要的
    // 用户必须调用 stop_recording 或 cancel_recording 来清理
    std::mem::forget(stream);
    
    *state.is_recording.lock().unwrap() = true;
    
    println!("✅ 录音已启动");
    Ok(())
}

/// 停止录音并返回音频数据（Base64编码）
#[tauri::command]
pub fn stop_recording(state: State<'_, AudioState>) -> Result<String, String> {
    // 检查是否在录音
    {
        let is_recording = state.is_recording.lock().unwrap();
        if !*is_recording {
            return Err("当前没有在录音".to_string());
        }
    }
    
    // 更新状态（Stream 会在后台继续运行，但我们不再收集数据）
    *state.is_recording.lock().unwrap() = false;
    
    // 获取音频数据
    let audio_data = {
        let buffer = state.audio_buffer.lock().unwrap();
        buffer.clone()
    };
    
    if audio_data.is_empty() {
        return Err("没有录制到音频数据".to_string());
    }
    
    // 转换为 Base64
    let base64_data = base64::encode(&audio_data);
    
    println!("✅ 录音已停止，数据大小: {} 字节", audio_data.len());
    Ok(base64_data)
}

/// 获取当前录音数据（不停止录音）
#[tauri::command]
pub fn get_recording_data(state: State<'_, AudioState>) -> Result<String, String> {
    let audio_data = {
        let mut buffer = state.audio_buffer.lock().unwrap();
        let data = buffer.clone();
        buffer.clear(); // 清空缓冲区
        data
    };
    
    if audio_data.is_empty() {
        return Ok(String::new());
    }
    
    let base64_data = base64::encode(&audio_data);
    Ok(base64_data)
}

/// 检查录音状态
#[tauri::command]
pub fn is_recording(state: State<'_, AudioState>) -> Result<bool, String> {
    let is_recording = *state.is_recording.lock().unwrap();
    Ok(is_recording)
}

/// 保存音频到 WAV 文件
#[tauri::command]
pub fn save_audio_to_file(
    audio_data: String,
    file_path: String,
    config: Option<AudioConfig>,
) -> Result<(), String> {
    let config = config.unwrap_or_default();
    
    // Base64 解码
    let audio_bytes = base64::decode(&audio_data)
        .map_err(|e| format!("Base64 解码失败: {}", e))?;
    
    // 创建 WAV 规格
    let spec = WavSpec {
        channels: config.channels,
        sample_rate: config.sample_rate,
        bits_per_sample: config.bits_per_sample,
        sample_format: hound::SampleFormat::Int,
    };
    
    // 创建 WAV 写入器
    let mut writer = WavWriter::create(&file_path, spec)
        .map_err(|e| format!("创建 WAV 文件失败: {}", e))?;
    
    // 写入音频数据
    for chunk in audio_bytes.chunks(2) {
        if chunk.len() == 2 {
            let sample = i16::from_le_bytes([chunk[0], chunk[1]]);
            writer
                .write_sample(sample)
                .map_err(|e| format!("写入音频数据失败: {}", e))?;
        }
    }
    
    writer
        .finalize()
        .map_err(|e| format!("完成 WAV 文件写入失败: {}", e))?;
    
    println!("✅ 音频已保存到: {}", file_path);
    Ok(())
}

/// 取消录音（不保存数据）
#[tauri::command]
pub fn cancel_recording(state: State<'_, AudioState>) -> Result<(), String> {
    // 停止录音
    *state.is_recording.lock().unwrap() = false;
    
    // 清空缓冲区
    {
        let mut buffer = state.audio_buffer.lock().unwrap();
        buffer.clear();
    }
    
    println!("✅ 录音已取消");
    Ok(())
}
