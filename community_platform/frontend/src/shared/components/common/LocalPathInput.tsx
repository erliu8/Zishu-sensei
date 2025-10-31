/**
 * LocalPathInput - 本地路径输入组件
 * 用于所有需要本地部署的选项（插件、Lora适配器、Live2D模型等）
 */

import React, { useState } from 'react';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Alert, AlertDescription } from '@/shared/components/ui/alert';
import { Folder, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/shared/utils';

export interface LocalPathInputProps {
  /** 当前路径值 */
  value?: string;
  /** 路径变化回调 */
  onChange: (path: string) => void;
  /** 标签文本 */
  label?: string;
  /** 占位符 */
  placeholder?: string;
  /** 描述文本 */
  description?: string;
  /** 是否必填 */
  required?: boolean;
  /** 是否禁用 */
  disabled?: boolean;
  /** 是否显示验证状态 */
  showValidation?: boolean;
  /** 自定义验证函数 */
  validate?: (path: string) => { valid: boolean; message?: string };
  /** 自定义样式 */
  className?: string;
  /** 路径类型提示（文件/文件夹） */
  pathType?: 'file' | 'directory' | 'any';
}

/**
 * LocalPathInput 组件
 */
export const LocalPathInput: React.FC<LocalPathInputProps> = ({
  value = '',
  onChange,
  label = '本地路径',
  placeholder = '例如：/home/user/models/my-model.bin',
  description,
  required = false,
  disabled = false,
  showValidation = false,
  validate,
  className,
  pathType = 'any',
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message?: string;
  } | null>(null);

  // 默认的基本验证
  const defaultValidate = (path: string) => {
    if (!path.trim()) {
      if (required) {
        return { valid: false, message: '路径不能为空' };
      }
      return { valid: true };
    }

    // 基本路径格式验证
    const hasInvalidChars = /[<>"|?*]/.test(path);
    if (hasInvalidChars) {
      return { valid: false, message: '路径包含非法字符' };
    }

    // Windows路径格式
    const isWindowsPath = /^[a-zA-Z]:\\/.test(path);
    // Unix路径格式
    const isUnixPath = /^\//.test(path) || /^~\//.test(path);
    // 相对路径
    const isRelativePath = /^\.\.?\//.test(path);

    if (!isWindowsPath && !isUnixPath && !isRelativePath) {
      return { 
        valid: false, 
        message: '请输入有效的路径格式（如 /path/to/file 或 C:\\path\\to\\file）' 
      };
    }

    return { valid: true, message: '路径格式正确' };
  };

  // 处理路径变化
  const handlePathChange = (newPath: string) => {
    onChange(newPath);

    // 如果启用验证，执行验证
    if (showValidation && newPath.trim()) {
      const validator = validate || defaultValidate;
      const result = validator(newPath);
      setValidationResult(result);
    } else {
      setValidationResult(null);
    }
  };

  // 获取路径类型的提示文本
  const getPathTypeHint = () => {
    switch (pathType) {
      case 'file':
        return '请输入文件的完整路径';
      case 'directory':
        return '请输入文件夹的完整路径';
      default:
        return '请输入完整的本地路径';
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      {/* 标签 */}
      {label && (
        <Label htmlFor="local-path-input">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {/* 输入框 */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          <Folder className="h-4 w-4" />
        </div>
        
        <Input
          id="local-path-input"
          type="text"
          value={value}
          onChange={(e) => handlePathChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            'pl-10 pr-10',
            validationResult && !validationResult.valid && 'border-destructive',
            validationResult && validationResult.valid && 'border-green-500'
          )}
        />

        {/* 验证状态图标 */}
        {showValidation && validationResult && value.trim() && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {validationResult.valid ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-destructive" />
            )}
          </div>
        )}
      </div>

      {/* 描述文本 */}
      {description && (
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      )}

      {/* 路径类型提示 */}
      {!description && isFocused && (
        <p className="text-sm text-muted-foreground">
          {getPathTypeHint()}
        </p>
      )}

      {/* 验证消息 */}
      {showValidation && validationResult && validationResult.message && (
        <Alert 
          variant={validationResult.valid ? 'default' : 'destructive'}
          className="py-2"
        >
          <AlertDescription className="text-sm">
            {validationResult.message}
          </AlertDescription>
        </Alert>
      )}

      {/* 示例路径 */}
      {isFocused && !value && (
        <div className="text-xs text-muted-foreground space-y-1">
          <p className="font-medium">示例路径：</p>
          <ul className="list-disc list-inside space-y-0.5 pl-2">
            <li>Linux/Mac: /home/user/models/model.bin</li>
            <li>Windows: C:\Users\user\models\model.bin</li>
            <li>相对路径: ./models/model.bin</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default LocalPathInput;

