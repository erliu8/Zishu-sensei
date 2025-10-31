import { Loader2 } from 'lucide-react';

export default function PostsLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-muted-foreground">加载中...</p>
      </div>
    </div>
  );
}

