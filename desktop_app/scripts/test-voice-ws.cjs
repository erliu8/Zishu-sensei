#!/usr/bin/env node

/**
 * WebSocket 语音聊天测试客户端
 * 测试与后端 WebSocket 服务的连接和通信
 */

const WebSocket = require('ws');
const crypto = require('crypto');

// 配置
const WS_URL = 'ws://127.0.0.1:8000/api/voice/ws';
const SESSION_ID = crypto.randomUUID();

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
};

function log(color, prefix, message) {
    console.log(`${color}${prefix}${colors.reset} ${message}`);
}

function success(message) {
    log(colors.green, '✓', message);
}

function error(message) {
    log(colors.red, '✗', message);
}

function info(message) {
    log(colors.blue, 'ℹ', message);
}

function warning(message) {
    log(colors.yellow, '⚠', message);
}

// WebSocket 消息类型
const MessageType = {
    CONFIG: 'config',
    AUDIO: 'audio',
    TEXT: 'text',
    INTERRUPT: 'interrupt',
    CLOSE: 'close',
    READY: 'ready',
    CONFIGURED: 'configured',
    TRANSCRIPTION: 'transcription',
    RESPONSE: 'response',
    SPEECH_END: 'speech_end',
    INTERRUPTED: 'interrupted',
    ERROR: 'error',
};

/**
 * 主测试函数
 */
async function testVoiceWebSocket() {
    console.log(`${colors.cyan}╔═══════════════════════════════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.cyan}║            WebSocket 语音聊天连接测试                          ║${colors.reset}`);
    console.log(`${colors.cyan}╚═══════════════════════════════════════════════════════════════╝${colors.reset}\n`);

    const wsUrl = `${WS_URL}/${SESSION_ID}`;
    info(`连接到: ${wsUrl}`);
    info(`会话 ID: ${SESSION_ID}`);

    return new Promise((resolve, reject) => {
        let ws;
        let testsPassed = 0;
        let testsFailed = 0;
        let isConnected = false;
        let isConfigured = false;

        // 超时保护
        const timeout = setTimeout(() => {
            if (!isConnected) {
                error('连接超时 (10秒)');
                cleanup();
                reject(new Error('Connection timeout'));
            }
        }, 10000);

        function cleanup() {
            clearTimeout(timeout);
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.close();
            }
        }

        try {
            ws = new WebSocket(wsUrl);

            // 连接打开
            ws.on('open', () => {
                success('WebSocket 连接已建立');
                isConnected = true;
                testsPassed++;
            });

            // 接收消息
            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data.toString());
                    handleMessage(message);
                } catch (err) {
                    error(`解析消息失败: ${err.message}`);
                    testsFailed++;
                }
            });

            // 错误处理
            ws.on('error', (err) => {
                error(`WebSocket 错误: ${err.message}`);
                testsFailed++;
                cleanup();
                reject(err);
            });

            // 连接关闭
            ws.on('close', (code, reason) => {
                info(`WebSocket 连接已关闭 (代码: ${code}, 原因: ${reason || '无'})`);
                
                console.log(`\n${colors.cyan}═══════════════════════════════════════${colors.reset}`);
                console.log(`${colors.cyan}测试摘要${colors.reset}`);
                console.log(`${colors.cyan}═══════════════════════════════════════${colors.reset}`);
                console.log(`${colors.green}通过: ${testsPassed}${colors.reset}`);
                console.log(`${colors.red}失败: ${testsFailed}${colors.reset}`);
                
                if (testsFailed === 0 && testsPassed > 0) {
                    success('\n🎉 所有测试通过！');
                    resolve();
                } else {
                    error(`\n❌ 有 ${testsFailed} 个测试失败`);
                    reject(new Error('Tests failed'));
                }
            });

            // 处理消息
            function handleMessage(message) {
                switch (message.type) {
                    case MessageType.READY:
                        success(`收到 READY 消息: 会话 ${message.session_id}`);
                        testsPassed++;
                        
                        // 发送配置
                        info('发送配置消息...');
                        sendConfig();
                        break;

                    case MessageType.CONFIGURED:
                        success('收到 CONFIGURED 消息: 配置已应用');
                        isConfigured = true;
                        testsPassed++;
                        
                        // 发送测试文本
                        info('发送测试文本消息...');
                        sendText('这是一个测试消息');
                        
                        // 等待一下后关闭
                        setTimeout(() => {
                            info('发送关闭消息...');
                            sendClose();
                        }, 2000);
                        break;

                    case MessageType.TRANSCRIPTION:
                        success(`收到语音识别: ${message.data} (final: ${message.isFinal})`);
                        testsPassed++;
                        break;

                    case MessageType.RESPONSE:
                        success(`收到 AI 响应: ${message.data}`);
                        testsPassed++;
                        break;

                    case MessageType.AUDIO:
                        success(`收到音频数据: ${message.data ? message.data.length : 0} 字节`);
                        testsPassed++;
                        break;

                    case MessageType.SPEECH_END:
                        success('收到 SPEECH_END 消息');
                        testsPassed++;
                        break;

                    case MessageType.ERROR:
                        error(`收到错误消息: ${message.message}`);
                        testsFailed++;
                        break;

                    default:
                        warning(`收到未知消息类型: ${message.type}`);
                }
            }

            // 发送配置
            function sendConfig() {
                const config = {
                    type: MessageType.CONFIG,
                    data: {
                        stt: {
                            model: 'base',
                            language: 'zh',
                        },
                        tts: {
                            voice: 'zh-CN-XiaoxiaoNeural',
                            rate: '+0%',
                            volume: '+0%',
                            pitch: '+0Hz',
                        },
                        model: 'default',
                    },
                };
                ws.send(JSON.stringify(config));
            }

            // 发送文本
            function sendText(text) {
                const message = {
                    type: MessageType.TEXT,
                    data: text,
                };
                ws.send(JSON.stringify(message));
            }

            // 发送关闭
            function sendClose() {
                const message = {
                    type: MessageType.CLOSE,
                };
                ws.send(JSON.stringify(message));
            }

        } catch (err) {
            error(`连接失败: ${err.message}`);
            cleanup();
            reject(err);
        }
    });
}

/**
 * 运行测试
 */
async function main() {
    try {
        await testVoiceWebSocket();
        process.exit(0);
    } catch (err) {
        error(`测试失败: ${err.message}`);
        process.exit(1);
    }
}

// 运行
if (require.main === module) {
    main();
}

module.exports = { testVoiceWebSocket };
