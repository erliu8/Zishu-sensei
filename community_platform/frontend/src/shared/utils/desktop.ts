/**
 * 桌面应用检测和交互工具
 */

/**
 * 检测是否在桌面应用中运行
 */
export function isDesktopApp(): boolean {
  // 检查 User Agent
  const userAgent = navigator.userAgent;
  if (userAgent.includes('Zishu-Sensei')) {
    return true;
  }
  
  // 检查是否有 __TAURI__ 对象（Tauri 应用特征）
  if (typeof window !== 'undefined' && '__TAURI__' in window) {
    return true;
  }
  
  // 检查 localStorage 中的标记
  try {
    const desktopFlag = localStorage.getItem('is_desktop_app');
    if (desktopFlag === 'true') {
      return true;
    }
  } catch {
    // localStorage 可能不可用
  }
  
  return false;
}

/**
 * 检测桌面应用版本
 */
export function getDesktopAppVersion(): string | null {
  const userAgent = navigator.userAgent;
  const match = userAgent.match(/Zishu-Sensei\/([\d.]+)/);
  return match?.[1] ?? null;
}

/**
 * 使用深度链接调用桌面应用
 * @param action 操作类型（如 download-character, import-character）
 * @param params 参数对象
 */
export function invokeDesktopApp(
  action: string,
  params: Record<string, string>
): void {
  const queryParams = new URLSearchParams(params).toString();
  const deepLink = `zishu://${action}?${queryParams}`;
  
  console.log('[Desktop] 调用深度链接:', deepLink);
  
  // 尝试使用 location 跳转（对于已安装的桌面应用）
  window.location.href = deepLink;
}

/**
 * 下载角色到桌面应用
 * @param taskId 打包任务ID
 * @param characterName 角色名称
 * @param downloadUrl 下载URL
 */
export function downloadCharacterToDesktop(
  taskId: string,
  characterName: string,
  downloadUrl: string
): void {
  if (!isDesktopApp()) {
    console.warn('[Desktop] 非桌面应用环境，无法使用深度链接');
    // 降级到浏览器下载
    window.open(downloadUrl, '_blank');
    return;
  }
  
  invokeDesktopApp('download-character', {
    task_id: taskId,
    url: encodeURIComponent(downloadUrl),
    name: encodeURIComponent(characterName),
  });
}

/**
 * 导入角色到桌面应用
 * @param characterData 角色配置数据（JSON）
 */
export function importCharacterToDesktop(characterData: object): void {
  if (!isDesktopApp()) {
    console.warn('[Desktop] 非桌面应用环境，无法使用深度链接');
    return;
  }
  
  // 将数据编码为 base64
  const jsonStr = JSON.stringify(characterData);
  const base64Data = btoa(unescape(encodeURIComponent(jsonStr)));
  
  invokeDesktopApp('import-character', {
    data: base64Data,
  });
}

/**
 * 打开桌面应用设置
 */
export function openDesktopSettings(): void {
  if (!isDesktopApp()) {
    console.warn('[Desktop] 非桌面应用环境');
    return;
  }
  
  invokeDesktopApp('open-settings', {});
}

/**
 * 检测桌面应用支持的协议版本
 */
export interface DesktopProtocolInfo {
  isAvailable: boolean;
  version: string | null;
  supportedActions: string[];
}

export function getDesktopProtocolInfo(): DesktopProtocolInfo {
  const isAvailable = isDesktopApp();
  const version = getDesktopAppVersion();
  
  // 根据版本返回支持的操作列表
  const supportedActions: string[] = [];
  
  if (isAvailable) {
    // 基础操作（所有版本都支持）
    supportedActions.push(
      'download-character',
      'import-character',
      'open-settings'
    );
    
    // 根据版本添加更多操作
    if (version && compareVersion(version, '1.1.0') >= 0) {
      supportedActions.push('download-adapter', 'import-adapter');
    }
  }
  
  return {
    isAvailable,
    version,
    supportedActions,
  };
}

/**
 * 比较版本号
 * @returns 0 = 相等, 1 = v1 > v2, -1 = v1 < v2
 */
function compareVersion(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  
  return 0;
}

/**
 * 标记当前环境为桌面应用
 * （由桌面应用在加载时调用）
 */
export function markAsDesktopApp(version?: string): void {
  try {
    localStorage.setItem('is_desktop_app', 'true');
    if (version) {
      localStorage.setItem('desktop_app_version', version);
    }
  } catch {
    // localStorage 可能不可用
  }
}

/**
 * 监听来自桌面应用的消息
 */
export interface DesktopMessage {
  type: string;
  payload?: any;
}

export function listenToDesktopMessages(
  callback: (message: DesktopMessage) => void
): () => void {
  const handler = (event: MessageEvent) => {
    // 验证消息来源
    if (event.source !== window) {
      return;
    }
    
    // 检查消息格式
    if (
      event.data &&
      typeof event.data === 'object' &&
      'type' in event.data &&
      event.data.source === 'zishu-desktop'
    ) {
      callback(event.data);
    }
  };
  
  window.addEventListener('message', handler);
  
  // 返回清理函数
  return () => {
    window.removeEventListener('message', handler);
  };
}

/**
 * 向桌面应用发送消息
 */
export function sendMessageToDesktop(type: string, payload?: any): void {
  if (!isDesktopApp()) {
    console.warn('[Desktop] 非桌面应用环境，无法发送消息');
    return;
  }
  
  window.postMessage(
    {
      source: 'zishu-web',
      type,
      payload,
    },
    '*'
  );
}

