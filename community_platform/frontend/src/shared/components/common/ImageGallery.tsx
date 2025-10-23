/**
 * ImageGallery 图片画廊组件
 * 显示图片网格，支持点击放大预览
 */

import { cn } from '@/shared/utils'
import React from 'react'

export interface ImageGalleryProps extends React.HTMLAttributes<HTMLDivElement> {
  images: Array<{
    src: string
    alt?: string
    title?: string
  }>
  columns?: 2 | 3 | 4 | 6
  aspectRatio?: 'square' | 'video' | 'auto'
  gap?: 'sm' | 'md' | 'lg'
  lightbox?: boolean
}

const columnClasses = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
}

const aspectRatioClasses = {
  square: 'aspect-square',
  video: 'aspect-video',
  auto: '',
}

const gapClasses = {
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
}

export const ImageGallery = React.forwardRef<HTMLDivElement, ImageGalleryProps>(
  (
    {
      className,
      images,
      columns = 3,
      aspectRatio = 'auto',
      gap = 'md',
      lightbox = true,
      ...props
    },
    ref
  ) => {
    const [selectedImage, setSelectedImage] = React.useState<number | null>(null)

    const handleImageClick = (index: number): void => {
      if (lightbox) {
        setSelectedImage(index)
      }
    }

    const handleCloseLightbox = (): void => {
      setSelectedImage(null)
    }

    const handlePrevImage = (): void => {
      setSelectedImage((prev) => (prev !== null && prev > 0 ? prev - 1 : prev))
    }

    const handleNextImage = (): void => {
      setSelectedImage((prev) =>
        prev !== null && prev < images.length - 1 ? prev + 1 : prev
      )
    }

    React.useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent): void => {
        if (selectedImage === null) return

        switch (e.key) {
          case 'Escape':
            handleCloseLightbox()
            break
          case 'ArrowLeft':
            handlePrevImage()
            break
          case 'ArrowRight':
            handleNextImage()
            break
          default:
            break
        }
      }

      if (selectedImage !== null) {
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
      }
      return undefined
    }, [selectedImage])

    return (
      <>
        <div
          ref={ref}
          className={cn('grid', columnClasses[columns], gapClasses[gap], className)}
          {...props}
        >
          {images.map((image, index) => (
            <div
              key={index}
              className={cn(
                'relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800',
                aspectRatioClasses[aspectRatio],
                lightbox && 'cursor-pointer group'
              )}
              onClick={() => handleImageClick(index)}
            >
              <img
                src={image.src}
                alt={image.alt || `图片 ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {lightbox && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                    />
                  </svg>
                </div>
              )}
              {image.title && (
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-sm text-white font-medium">{image.title}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Lightbox 模态框 */}
        {lightbox && selectedImage !== null && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={handleCloseLightbox}
          >
            <button
              type="button"
              onClick={handleCloseLightbox}
              className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
              aria-label="关闭"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>

            {selectedImage > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handlePrevImage()
                }}
                className="absolute left-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                aria-label="上一张"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
            )}

            {selectedImage < images.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  handleNextImage()
                }}
                className="absolute right-4 p-2 text-white hover:bg-white/10 rounded-full transition-colors"
                aria-label="下一张"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            )}

            <div
              className="max-w-7xl max-h-full"
              onClick={(e) => e.stopPropagation()}
            >
              {images[selectedImage] && (
                <>
                  <img
                    src={images[selectedImage].src}
                    alt={images[selectedImage].alt || `图片 ${selectedImage + 1}`}
                    className="max-w-full max-h-[90vh] object-contain"
                  />
                  {images[selectedImage].title && (
                    <p className="mt-4 text-center text-white text-lg">
                      {images[selectedImage].title}
                    </p>
                  )}
                  <p className="mt-2 text-center text-white/60 text-sm">
                    {selectedImage + 1} / {images.length}
                  </p>
                </>
              )}
            </div>
          </div>
        )}
      </>
    )
  }
)

ImageGallery.displayName = 'ImageGallery'

