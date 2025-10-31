export default function Loading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="animate-pulse space-y-8">
        {/* 头部区域骨架屏 */}
        <div className="flex items-start gap-6">
          <div className="h-32 w-32 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1 space-y-4">
            <div className="h-8 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="h-4 w-1/2 rounded bg-gray-200 dark:bg-gray-700" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="h-6 w-16 rounded-full bg-gray-200 dark:bg-gray-700" />
            </div>
          </div>
        </div>

        {/* 内容区域骨架屏 */}
        <div className="space-y-4">
          <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-full rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700" />
        </div>

        {/* 操作按钮区域骨架屏 */}
        <div className="flex gap-4">
          <div className="h-10 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-10 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      </div>
    </div>
  );
}

