/**
 * 头像上传组件
 * 支持裁剪和预览
 */

'use client';

import { useState, useRef, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar';
import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Slider } from '@/shared/components/ui/slider';
import { toast } from '@/shared/components/ui/use-toast';
import { Camera, Upload, X, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface AvatarUploadProps {
  currentAvatar?: string;
  username?: string;
  onUpload: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
  isUploading?: boolean;
  className?: string;
}

export function AvatarUpload({
  currentAvatar,
  username,
  onUpload,
  onDelete,
  isUploading = false,
  className,
}: AvatarUploadProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // 文件选择处理
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith('image/')) {
      toast({
        title: '错误',
        description: '请选择图片文件',
        variant: 'destructive',
      });
      return;
    }

    // 验证文件大小（最大 5MB）
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: '错误',
        description: '图片大小不能超过 5MB',
        variant: 'destructive',
      });
      return;
    }

    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
    setIsOpen(true);
  }, []);

  // 拖拽处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }, [position]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 裁剪并上传
  const handleCropAndUpload = useCallback(async () => {
    if (!selectedFile || !canvasRef.current || !imageRef.current) return;

    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 设置画布大小（输出 300x300 的头像）
      const outputSize = 300;
      canvas.width = outputSize;
      canvas.height = outputSize;

      // 计算裁剪区域
      const image = imageRef.current;
      const containerSize = 200; // 预览容器大小
      const scale = image.naturalWidth / (containerSize / zoom);
      const sourceSize = outputSize * scale;
      const sourceX = (image.naturalWidth - sourceSize) / 2 - (position.x * scale);
      const sourceY = (image.naturalHeight - sourceSize) / 2 - (position.y * scale);

      // 绘制裁剪后的图像
      ctx.drawImage(
        image,
        sourceX,
        sourceY,
        sourceSize,
        sourceSize,
        0,
        0,
        outputSize,
        outputSize
      );

      // 转换为 Blob
      canvas.toBlob(async (blob) => {
        if (!blob) return;

        // 创建新文件
        const croppedFile = new File([blob], selectedFile.name, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        });

        await onUpload(croppedFile);
        setIsOpen(false);
        setSelectedFile(null);
        setPreviewUrl('');
        
        // 清理 URL
        URL.revokeObjectURL(previewUrl);
      }, 'image/jpeg', 0.9);
    } catch (error) {
      console.error('裁剪失败:', error);
      toast({
        title: '错误',
        description: '图片裁剪失败',
        variant: 'destructive',
      });
    }
  }, [selectedFile, zoom, position, previewUrl, onUpload]);

  // 取消裁剪
  const handleCancel = useCallback(() => {
    setIsOpen(false);
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl('');
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [previewUrl]);

  return (
    <div className={cn('flex flex-col items-center gap-4', className)}>
      {/* 当前头像 */}
      <div className="relative group">
        <Avatar className="h-24 w-24">
          <AvatarImage src={currentAvatar} alt={username} />
          <AvatarFallback className="text-2xl">
            {username?.substring(0, 2).toUpperCase() || 'U'}
          </AvatarFallback>
        </Avatar>
        
        {/* 悬浮遮罩 */}
        <div className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <Camera className="h-8 w-8 text-white" />
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <Upload className="h-4 w-4 mr-2" />
          {currentAvatar ? '更换头像' : '上传头像'}
        </Button>
        
        {currentAvatar && onDelete && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDelete}
            disabled={isUploading}
          >
            <X className="h-4 w-4 mr-2" />
            删除头像
          </Button>
        )}
      </div>

      {/* 隐藏的文件输入 */}
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* 裁剪对话框 */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>裁剪头像</DialogTitle>
            <DialogDescription>
              拖动图片调整位置，使用滑块缩放大小
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 预览区域 */}
            <div className="relative w-[200px] h-[200px] mx-auto rounded-full overflow-hidden bg-muted border-2 border-border">
              <div
                className="absolute inset-0 cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{
                  transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                  transition: isDragging ? 'none' : 'transform 0.1s',
                }}
              >
                {previewUrl && (
                  <img
                    ref={imageRef}
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-contain"
                    draggable={false}
                  />
                )}
              </div>
            </div>

            {/* 缩放控制 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <ZoomOut className="h-4 w-4" />
                  缩放
                </Label>
                <Label className="flex items-center gap-2">
                  <ZoomIn className="h-4 w-4" />
                </Label>
              </div>
              <Slider
                value={[zoom]}
                onValueChange={(values) => setZoom(values[0])}
                min={0.5}
                max={3}
                step={0.1}
                className="w-full"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCancel}>
              取消
            </Button>
            <Button onClick={handleCropAndUpload} disabled={isUploading}>
              {isUploading ? '上传中...' : '确认上传'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 隐藏的画布（用于裁剪） */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

