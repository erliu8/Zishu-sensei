/**
 * 兼容性信息组件
 * @module features/adapter/components/detail
 */

'use client';

import { 
  Monitor, 
  HardDrive, 
  Cpu, 
  Code, 
  Globe, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Info,
  FileCode,
  Network,
  Zap,
} from 'lucide-react';
import {
  Card,
  Badge,
  Separator,
  Alert,
  AlertDescription,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/shared/components';
import type { SystemRequirements, PermissionRequirements, CompatibilityLevel } from '../../domain';
import { cn } from '@/shared/utils';

/**
 * 兼容性信息组件属性
 */
export interface CompatibilityInfoProps {
  /** 系统要求 */
  systemRequirements: SystemRequirements;
  /** 权限需求 */
  permissions: PermissionRequirements;
  /** 兼容性信息 */
  compatibility?: {
    minPlatformVersion: string;
    maxPlatformVersion?: string;
    compatibilityLevel: CompatibilityLevel;
  };
  /** 类名 */
  className?: string;
}

/**
 * 系统要求项组件
 */
interface RequirementItemProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  status?: 'ok' | 'warning' | 'error';
  tooltip?: string;
}

function RequirementItem({ icon, label, value, status, tooltip }: RequirementItemProps) {
  const statusIcon = status === 'ok' ? (
    <CheckCircle className="h-4 w-4 text-green-500" />
  ) : status === 'error' ? (
    <XCircle className="h-4 w-4 text-destructive" />
  ) : status === 'warning' ? (
    <AlertTriangle className="h-4 w-4 text-yellow-500" />
  ) : null;

  const content = (
    <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex-shrink-0 mt-0.5 text-muted-foreground">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium mb-1">{label}</div>
        <div className="text-sm text-muted-foreground">{value}</div>
      </div>
      {statusIcon && <div className="flex-shrink-0 mt-0.5">{statusIcon}</div>}
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

/**
 * 权限项组件
 */
interface PermissionItemProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  level: 'none' | 'low' | 'medium' | 'high';
  enabled: boolean;
}

function PermissionItem({ icon, label, description, level, enabled }: PermissionItemProps) {
  const levelColors = {
    none: 'text-muted-foreground',
    low: 'text-green-500',
    medium: 'text-yellow-500',
    high: 'text-destructive',
  };

  const levelLabels = {
    none: '无需',
    low: '低',
    medium: '中',
    high: '高',
  };

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
      <div className={cn('flex-shrink-0 mt-0.5', levelColors[level])}>{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-sm">{label}</span>
          <Badge 
            variant={level === 'high' ? 'destructive' : level === 'medium' ? 'secondary' : 'outline'}
            className="text-xs"
          >
            {levelLabels[level]}风险
          </Badge>
          {enabled ? (
            <Badge variant="default" className="text-xs gap-1">
              <CheckCircle className="h-3 w-3" />
              需要
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              未启用
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

/**
 * 兼容性级别徽章
 */
function CompatibilityLevelBadge({ level }: { level: CompatibilityLevel }) {
  const config = {
    full: {
      label: '完全兼容',
      variant: 'default' as const,
      icon: <CheckCircle className="h-3 w-3" />,
    },
    partial: {
      label: '部分兼容',
      variant: 'secondary' as const,
      icon: <AlertTriangle className="h-3 w-3" />,
    },
    incompatible: {
      label: '不兼容',
      variant: 'destructive' as const,
      icon: <XCircle className="h-3 w-3" />,
    },
  };

  const { label, variant, icon } = config[level];

  return (
    <Badge variant={variant} className="gap-1">
      {icon}
      {label}
    </Badge>
  );
}

/**
 * 兼容性信息组件
 */
export function CompatibilityInfo({
  systemRequirements,
  permissions,
  compatibility,
  className,
}: CompatibilityInfoProps) {
  // 检测用户当前系统（实际应从系统API获取）
  const userSystem = {
    os: 'Windows 11',
    memory: 16384, // MB
    diskSpace: 512000, // MB
    pythonVersion: '3.11.0',
    nodeVersion: '18.16.0',
    hasGpu: true,
  };

  // 检查系统要求是否满足
  const checkRequirement = (required: number | undefined, available: number) => {
    if (!required) return 'ok';
    if (available >= required) return 'ok';
    if (available >= required * 0.8) return 'warning';
    return 'error';
  };

  // 计算权限风险等级
  const getPermissionLevel = (permission: string): 'none' | 'low' | 'medium' | 'high' => {
    switch (permission) {
      case 'fileSystemAccess':
        return permissions.fileSystemAccess === 'full' ? 'high' : 
               permissions.fileSystemAccess === 'write' ? 'medium' : 
               permissions.fileSystemAccess === 'read' ? 'low' : 'none';
      case 'networkAccess':
        return permissions.networkAccess ? 'medium' : 'none';
      case 'systemApiAccess':
        return permissions.systemApiAccess ? 'high' : 'none';
      case 'desktopControl':
        return permissions.desktopControl ? 'high' : 'none';
      case 'codeExecution':
        return permissions.codeExecution ? 'high' : 'none';
      default:
        return 'none';
    }
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* 兼容性状态 */}
      {compatibility && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">兼容性状态</h3>
            <CompatibilityLevelBadge level={compatibility.compatibilityLevel} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <span className="text-sm font-medium">最低平台版本</span>
              <Badge variant="outline" className="font-mono">
                {compatibility.minPlatformVersion}
              </Badge>
            </div>
            {compatibility.maxPlatformVersion && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <span className="text-sm font-medium">最高平台版本</span>
                <Badge variant="outline" className="font-mono">
                  {compatibility.maxPlatformVersion}
                </Badge>
              </div>
            )}
          </div>

          {compatibility.compatibilityLevel === 'partial' && (
            <Alert className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                此适配器仅部分兼容您的系统。某些功能可能无法正常使用，请查看下方详细的系统要求。
              </AlertDescription>
            </Alert>
          )}

          {compatibility.compatibilityLevel === 'incompatible' && (
            <Alert variant="destructive" className="mt-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                此适配器与您当前的系统不兼容。请升级平台版本或联系开发者了解更多信息。
              </AlertDescription>
            </Alert>
          )}
        </Card>
      )}

      {/* 系统要求 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">系统要求</h3>
          <Badge variant="outline" className="gap-1">
            <Info className="h-3 w-3" />
            与您的系统对比
          </Badge>
        </div>

        <div className="space-y-2">
          {/* 操作系统 */}
          {systemRequirements.supportedOS && systemRequirements.supportedOS.length > 0 && (
            <RequirementItem
              icon={<Monitor className="h-5 w-5" />}
              label="支持的操作系统"
              value={
                <div className="flex flex-wrap gap-1">
                  {systemRequirements.supportedOS.map((os) => (
                    <Badge key={os} variant="outline" className="text-xs">
                      {os}
                    </Badge>
                  ))}
                </div>
              }
              status={systemRequirements.supportedOS.some(os => userSystem.os.includes(os)) ? 'ok' : 'warning'}
              tooltip={`您的系统: ${userSystem.os}`}
            />
          )}

          {/* 内存要求 */}
          {systemRequirements.minMemory && (
            <RequirementItem
              icon={<Cpu className="h-5 w-5" />}
              label="最小内存要求"
              value={`${systemRequirements.minMemory} MB`}
              status={checkRequirement(systemRequirements.minMemory, userSystem.memory)}
              tooltip={`您的内存: ${userSystem.memory} MB`}
            />
          )}

          {/* 磁盘空间 */}
          {systemRequirements.minDiskSpace && (
            <RequirementItem
              icon={<HardDrive className="h-5 w-5" />}
              label="最小磁盘空间"
              value={`${systemRequirements.minDiskSpace} MB`}
              status={checkRequirement(systemRequirements.minDiskSpace, userSystem.diskSpace)}
              tooltip={`您的可用空间: ${userSystem.diskSpace} MB`}
            />
          )}

          {/* Python版本 */}
          {systemRequirements.pythonVersion && (
            <RequirementItem
              icon={<FileCode className="h-5 w-5" />}
              label="Python版本"
              value={<Badge variant="outline" className="font-mono">{systemRequirements.pythonVersion}</Badge>}
              status={userSystem.pythonVersion >= systemRequirements.pythonVersion ? 'ok' : 'warning'}
              tooltip={`您的版本: ${userSystem.pythonVersion}`}
            />
          )}

          {/* Node.js版本 */}
          {systemRequirements.nodeVersion && (
            <RequirementItem
              icon={<Code className="h-5 w-5" />}
              label="Node.js版本"
              value={<Badge variant="outline" className="font-mono">{systemRequirements.nodeVersion}</Badge>}
              status={userSystem.nodeVersion >= systemRequirements.nodeVersion ? 'ok' : 'warning'}
              tooltip={`您的版本: ${userSystem.nodeVersion}`}
            />
          )}

          {/* GPU要求 */}
          {systemRequirements.gpuRequired !== undefined && (
            <RequirementItem
              icon={<Zap className="h-5 w-5" />}
              label="GPU要求"
              value={systemRequirements.gpuRequired ? '需要GPU' : '不需要GPU'}
              status={
                systemRequirements.gpuRequired 
                  ? (userSystem.hasGpu ? 'ok' : 'error')
                  : 'ok'
              }
              tooltip={userSystem.hasGpu ? '已检测到GPU' : '未检测到GPU'}
            />
          )}

          {/* 其他要求 */}
          {systemRequirements.other && Object.keys(systemRequirements.other).length > 0 && (
            <RequirementItem
              icon={<Globe className="h-5 w-5" />}
              label="其他要求"
              value={
                <div className="space-y-1">
                  {Object.entries(systemRequirements.other).map(([key, value]) => (
                    <div key={key} className="text-xs">
                      <span className="font-medium">{key}:</span> {String(value)}
                    </div>
                  ))}
                </div>
              }
            />
          )}
        </div>
      </Card>

      {/* 权限需求 */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">权限需求</h3>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="gap-1">
                  <Shield className="h-3 w-3" />
                  安全提示
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>此适配器需要以下系统权限才能正常工作</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="space-y-3">
          {/* 文件系统访问 */}
          <PermissionItem
            icon={<HardDrive className="h-5 w-5" />}
            label="文件系统访问"
            description={
              permissions.fileSystemAccess === 'full'
                ? '完全访问文件系统，可以读取、写入和删除文件'
                : permissions.fileSystemAccess === 'write'
                ? '可以写入和修改文件，但不能删除'
                : permissions.fileSystemAccess === 'read'
                ? '只能读取文件，不能修改或删除'
                : '不需要访问文件系统'
            }
            level={getPermissionLevel('fileSystemAccess')}
            enabled={!!permissions.fileSystemAccess && permissions.fileSystemAccess !== 'none'}
          />

          {/* 网络访问 */}
          <PermissionItem
            icon={<Network className="h-5 w-5" />}
            label="网络访问"
            description={
              permissions.networkAccess
                ? '可以访问互联网，用于数据同步、API调用等功能'
                : '不需要访问网络，完全离线运行'
            }
            level={getPermissionLevel('networkAccess')}
            enabled={!!permissions.networkAccess}
          />

          {/* 系统API访问 */}
          <PermissionItem
            icon={<Cpu className="h-5 w-5" />}
            label="系统API访问"
            description={
              permissions.systemApiAccess
                ? '可以调用系统级API，访问底层系统功能'
                : '不需要系统API访问权限'
            }
            level={getPermissionLevel('systemApiAccess')}
            enabled={!!permissions.systemApiAccess}
          />

          {/* 桌面操作 */}
          <PermissionItem
            icon={<Monitor className="h-5 w-5" />}
            label="桌面操作"
            description={
              permissions.desktopControl
                ? '可以控制鼠标、键盘和窗口，执行自动化操作'
                : '不需要桌面操作权限'
            }
            level={getPermissionLevel('desktopControl')}
            enabled={!!permissions.desktopControl}
          />

          {/* 代码执行 */}
          <PermissionItem
            icon={<Code className="h-5 w-5" />}
            label="代码执行"
            description={
              permissions.codeExecution
                ? '可以动态生成和执行代码，用于智能处理复杂任务'
                : '不需要代码执行权限'
            }
            level={getPermissionLevel('codeExecution')}
            enabled={!!permissions.codeExecution}
          />

          {/* 自定义权限 */}
          {permissions.customPermissions && permissions.customPermissions.length > 0 && (
            <div className="pt-3 border-t">
              <div className="text-sm font-medium mb-2">其他权限</div>
              <div className="space-y-2">
                {permissions.customPermissions.map((permission, index) => (
                  <div key={index} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">{permission}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator className="my-6" />

        {/* 安全提示 */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            <p className="font-semibold mb-2">安全提示</p>
            <p className="text-sm">
              安装适配器前，请仔细审查所需的权限。我们建议只安装来自可信来源的适配器，
              并定期检查适配器的权限使用情况。如果发现可疑行为，请立即卸载并向我们报告。
            </p>
          </AlertDescription>
        </Alert>
      </Card>

      {/* 兼容性说明 */}
      <Card className="p-6 bg-muted/50">
        <h4 className="font-semibold mb-3 flex items-center gap-2">
          <Info className="h-4 w-4" />
          兼容性说明
        </h4>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>• 系统要求会根据适配器类型有所不同：</p>
          <ul className="list-disc list-inside ml-4 space-y-1">
            <li><strong>软适配器</strong>：主要依赖RAG引擎和向量数据库，对系统要求较低</li>
            <li><strong>硬适配器</strong>：需要原生代码执行环境，可能需要特定的运行时</li>
            <li><strong>智能硬适配器</strong>：需要AI模型推理能力，建议配置GPU以获得最佳性能</li>
          </ul>
          <p>• 如果您的系统不满足最低要求，适配器可能无法正常工作或性能下降</p>
          <p>• 权限需求基于适配器的功能设计，我们会在沙箱环境中严格控制权限使用</p>
        </div>
      </Card>
    </div>
  );
}

