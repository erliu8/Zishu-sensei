/**
 * Comment Domain Model
 * 评论领域模型
 */

import { Comment, CommentAuthor } from './comment.types';

/**
 * 构建评论树形结构
 */
export function buildCommentTree(comments: Comment[]): Comment[] {
  const commentMap = new Map<string, Comment>();
  const rootComments: Comment[] = [];

  // 第一遍：建立映射并初始化 replies 数组
  comments.forEach((comment) => {
    commentMap.set(comment.id, { ...comment, replies: [] });
  });

  // 第二遍：构建树形结构
  comments.forEach((comment) => {
    const node = commentMap.get(comment.id)!;
    
    if (comment.parentId) {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.replies = parent.replies || [];
        parent.replies.push(node);
      } else {
        // 如果找不到父评论，当作根评论
        rootComments.push(node);
      }
    } else {
      rootComments.push(node);
    }
  });

  return rootComments;
}

/**
 * 扁平化评论树
 */
export function flattenCommentTree(comments: Comment[]): Comment[] {
  const result: Comment[] = [];

  function traverse(comment: Comment, depth: number = 0) {
    result.push({ ...comment, depth } as any);
    if (comment.replies && comment.replies.length > 0) {
      comment.replies.forEach((reply) => traverse(reply, depth + 1));
    }
  }

  comments.forEach((comment) => traverse(comment));
  return result;
}

/**
 * 查找评论
 */
export function findCommentById(
  comments: Comment[],
  commentId: string
): Comment | null {
  for (const comment of comments) {
    if (comment.id === commentId) {
      return comment;
    }
    if (comment.replies && comment.replies.length > 0) {
      const found = findCommentById(comment.replies, commentId);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 获取评论路径（从根到目标评论）
 */
export function getCommentPath(
  comments: Comment[],
  commentId: string
): Comment[] {
  const path: Comment[] = [];

  function traverse(commentList: Comment[]): boolean {
    for (const comment of commentList) {
      path.push(comment);
      if (comment.id === commentId) {
        return true;
      }
      if (comment.replies && comment.replies.length > 0) {
        if (traverse(comment.replies)) {
          return true;
        }
      }
      path.pop();
    }
    return false;
  }

  traverse(comments);
  return path;
}

/**
 * 计算评论总数（包括嵌套）
 */
export function getTotalCommentCount(comments: Comment[]): number {
  let count = 0;

  function traverse(commentList: Comment[]) {
    commentList.forEach((comment) => {
      count++;
      if (comment.replies && comment.replies.length > 0) {
        traverse(comment.replies);
      }
    });
  }

  traverse(comments);
  return count;
}

/**
 * 格式化评论时间
 */
export function formatCommentTime(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return '刚刚';
  } else if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}分钟前`;
  } else if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}小时前`;
  } else if (diffInSeconds < 2592000) {
    return `${Math.floor(diffInSeconds / 86400)}天前`;
  } else if (diffInSeconds < 31536000) {
    return `${Math.floor(diffInSeconds / 2592000)}个月前`;
  } else {
    return `${Math.floor(diffInSeconds / 31536000)}年前`;
  }
}

/**
 * 验证评论内容
 */
export function validateCommentContent(content: string): {
  isValid: boolean;
  error?: string;
} {
  if (!content || content.trim().length === 0) {
    return { isValid: false, error: '评论内容不能为空' };
  }

  if (content.length > 2000) {
    return { isValid: false, error: '评论内容不能超过2000字符' };
  }

  return { isValid: true };
}

/**
 * 检查用户是否是评论作者
 */
export function isCommentAuthor(comment: Comment, userId: string): boolean {
  return comment.authorId === userId;
}

