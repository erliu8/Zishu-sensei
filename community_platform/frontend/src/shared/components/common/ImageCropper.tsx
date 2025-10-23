/**
 * ImageCropper 图片裁剪组件
 * 支持自由裁剪、固定比例裁剪等功能
 */

'use client'

import { cn } from '@/shared/utils'
import React, { useCallback, useRef, useState } from 'react'

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageCropperProps {
  /** 图片源（File 或 URL） */
  image: File | string
  /** 裁剪宽高比 (如 1 为正方形, 16/9 为宽屏) */
  aspectRatio?: number
  /** 最小裁剪宽度 */
  minWidth?: number
  /** 最小裁剪高度 */
  minHeight?: number
  /** 是否显示网格 */
  showGrid?: boolean
  /** 裁剪完成回调 */
  onCropComplete?: (croppedImage: Blob, cropArea: CropArea) => void
  /** 取消回调 */
  onCancel?: () => void
  /** 类名 */
  className?: string
}

interface Point {
  x: number
  y: number
}

export function ImageCropper({
  image,
  aspectRatio,
  minWidth = 50,
  minHeight = 50,
  showGrid = true,
  onCropComplete,
  onCancel,
  className,
}: ImageCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [imageSrc, setImageSrc] = useState<string>('')
  const [imageLoaded, setImageLoaded] = useState(false)
  const [cropArea, setCropArea] = useState<CropArea>({ x: 0, y: 0, width: 200, height: 200 })
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState<string | null>(null)
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)

  // 加载图片
  React.useEffect(() => {
    if (typeof image === 'string') {
      setImageSrc(image)
    } else {
      const url = URL.createObjectURL(image)
      setImageSrc(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [image])

  // 图片加载完成
  const handleImageLoad = useCallback(() => {
    if (!imageRef.current || !containerRef.current) return

    const img = imageRef.current
    const container = containerRef.current

    // 计算缩放比例以适应容器
    const containerWidth = container.clientWidth
    const containerHeight = container.clientHeight
    const imgAspectRatio = img.naturalWidth / img.naturalHeight

    let displayWidth = containerWidth
    let displayHeight = containerWidth / imgAspectRatio

    if (displayHeight > containerHeight) {
      displayHeight = containerHeight
      displayWidth = containerHeight * imgAspectRatio
    }

    setScale(displayWidth / img.naturalWidth)

    // 初始化裁剪区域（居中，80% 大小）
    const initialSize = Math.min(displayWidth, displayHeight) * 0.8
    let width = initialSize
    let height = initialSize

    if (aspectRatio) {
      if (aspectRatio > 1) {
        height = width / aspectRatio
      } else {
        width = height * aspectRatio
      }
    }

    setCropArea({
      x: (displayWidth - width) / 2,
      y: (displayHeight - height) / 2,
      width,
      height,
    })

    setImageLoaded(true)
  }, [aspectRatio])

  // 开始拖拽
  const handleMouseDown = useCallback(
    (e: React.MouseEvent, action: 'move' | 'resize', corner?: string) => {
      e.preventDefault()
      e.stopPropagation()

      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      setDragStart({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })

      if (action === 'move') {
        setIsDragging(true)
      } else if (action === 'resize' && corner) {
        setIsResizing(corner)
      }
    },
    []
  )

  // 拖拽移动
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging && !isResizing) return
      if (!containerRef.current || !imageRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const currentX = e.clientX - rect.left
      const currentY = e.clientY - rect.top

      const deltaX = currentX - dragStart.x
      const deltaY = currentY - dragStart.y

      if (isDragging) {
        // 移动裁剪区域
        const maxX = imageRef.current.width - cropArea.width
        const maxY = imageRef.current.height - cropArea.height

        setCropArea((prev) => ({
          ...prev,
          x: Math.max(0, Math.min(maxX, prev.x + deltaX)),
          y: Math.max(0, Math.min(maxY, prev.y + deltaY)),
        }))

        setDragStart({ x: currentX, y: currentY })
      } else if (isResizing) {
        // 调整裁剪区域大小
        setCropArea((prev) => {
          let newX = prev.x
          let newY = prev.y
          let newWidth = prev.width
          let newHeight = prev.height

          switch (isResizing) {
            case 'nw': // 左上
              newX = prev.x + deltaX
              newY = prev.y + deltaY
              newWidth = prev.width - deltaX
              newHeight = prev.height - deltaY
              break
            case 'ne': // 右上
              newY = prev.y + deltaY
              newWidth = prev.width + deltaX
              newHeight = prev.height - deltaY
              break
            case 'sw': // 左下
              newX = prev.x + deltaX
              newWidth = prev.width - deltaX
              newHeight = prev.height + deltaY
              break
            case 'se': // 右下
              newWidth = prev.width + deltaX
              newHeight = prev.height + deltaY
              break
          }

          // 保持宽高比
          if (aspectRatio) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) {
              newHeight = newWidth / aspectRatio
              if (isResizing === 'nw' || isResizing === 'ne') {
                newY = prev.y + prev.height - newHeight
              }
            } else {
              newWidth = newHeight * aspectRatio
              if (isResizing === 'nw' || isResizing === 'sw') {
                newX = prev.x + prev.width - newWidth
              }
            }
          }

          // 限制最小尺寸
          newWidth = Math.max(minWidth, newWidth)
          newHeight = Math.max(minHeight, newHeight)

          // 限制在图片范围内
          if (imageRef.current) {
            newX = Math.max(0, Math.min(newX, imageRef.current.width - newWidth))
            newY = Math.max(0, Math.min(newY, imageRef.current.height - newHeight))
            newWidth = Math.min(newWidth, imageRef.current.width - newX)
            newHeight = Math.min(newHeight, imageRef.current.height - newY)
          }

          setDragStart({ x: currentX, y: currentY })

          return { x: newX, y: newY, width: newWidth, height: newHeight }
        })
      }
    },
    [isDragging, isResizing, dragStart, cropArea, aspectRatio, minWidth, minHeight]
  )

  // 结束拖拽
  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsResizing(null)
  }, [])

  // 执行裁剪
  const handleCrop = useCallback(async () => {
    if (!imageRef.current || !canvasRef.current) return

    const canvas = canvasRef.current
    const img = imageRef.current

    // 计算实际裁剪区域（考虑缩放）
    const actualCropArea = {
      x: cropArea.x / scale,
      y: cropArea.y / scale,
      width: cropArea.width / scale,
      height: cropArea.height / scale,
    }

    canvas.width = actualCropArea.width
    canvas.height = actualCropArea.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 绘制裁剪后的图片
    ctx.drawImage(
      img,
      actualCropArea.x,
      actualCropArea.y,
      actualCropArea.width,
      actualCropArea.height,
      0,
      0,
      actualCropArea.width,
      actualCropArea.height
    )

    // 转换为 Blob
    canvas.toBlob((blob) => {
      if (blob) {
        onCropComplete?.(blob, actualCropArea)
      }
    }, 'image/jpeg', 0.9)
  }, [cropArea, scale, onCropComplete])

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* 裁剪区域 */}
      <div
        ref={containerRef}
        className="relative bg-black rounded-lg overflow-hidden"
        style={{ height: '500px' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {imageSrc && (
          <>
            {/* 图片 */}
            <img
              ref={imageRef}
              src={imageSrc}
              alt="待裁剪图片"
              className="absolute inset-0 m-auto max-w-full max-h-full select-none"
              onLoad={handleImageLoad}
              draggable={false}
            />

            {/* 遮罩和裁剪框 */}
            {imageLoaded && imageRef.current && (
              <>
                {/* 暗色遮罩 */}
                <svg
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    width: imageRef.current.width,
                    height: imageRef.current.height,
                    left: '50%',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  <defs>
                    <mask id="crop-mask">
                      <rect width="100%" height="100%" fill="white" />
                      <rect
                        x={cropArea.x}
                        y={cropArea.y}
                        width={cropArea.width}
                        height={cropArea.height}
                        fill="black"
                      />
                    </mask>
                  </defs>
                  <rect width="100%" height="100%" fill="rgba(0, 0, 0, 0.5)" mask="url(#crop-mask)" />
                </svg>

                {/* 裁剪框 */}
                <div
                  className="absolute border-2 border-white cursor-move"
                  style={{
                    left: cropArea.x,
                    top: cropArea.y,
                    width: cropArea.width,
                    height: cropArea.height,
                    transform: imageRef.current
                      ? `translate(calc(50vw - ${imageRef.current.width / 2}px), calc(250px - ${imageRef.current.height / 2}px))`
                      : undefined,
                  }}
                  onMouseDown={(e) => handleMouseDown(e, 'move')}
                >
                  {/* 网格线 */}
                  {showGrid && (
                    <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
                      {Array.from({ length: 9 }).map((_, i) => (
                        <div key={i} className="border border-white/30" />
                      ))}
                    </div>
                  )}

                  {/* 调整手柄 */}
                  {['nw', 'ne', 'sw', 'se'].map((corner) => (
                    <div
                      key={corner}
                      className={cn(
                        'absolute w-3 h-3 bg-white border-2 border-blue-500 rounded-full cursor-pointer',
                        corner === 'nw' && '-top-1.5 -left-1.5 cursor-nw-resize',
                        corner === 'ne' && '-top-1.5 -right-1.5 cursor-ne-resize',
                        corner === 'sw' && '-bottom-1.5 -left-1.5 cursor-sw-resize',
                        corner === 'se' && '-bottom-1.5 -right-1.5 cursor-se-resize'
                      )}
                      onMouseDown={(e) => handleMouseDown(e, 'resize', corner)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* 隐藏的 canvas 用于裁剪 */}
      <canvas ref={canvasRef} className="hidden" />

      {/* 操作按钮 */}
      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            取消
          </button>
        )}
        <button
          type="button"
          onClick={handleCrop}
          disabled={!imageLoaded}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          确认裁剪
        </button>
      </div>
    </div>
  )
}

