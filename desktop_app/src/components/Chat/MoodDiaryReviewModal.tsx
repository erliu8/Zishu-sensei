/**
 * 情绪日记回顾模态框
 */

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { skillsApi } from '@/api/skillsApi'

interface MoodDiaryEntry {
  entry_id?: string
  ts: string
  content?: string
  raw?: {
    user_text?: string
    assistant_text?: string
  }
  mood?: string
  topics?: string[]
}

interface MoodDiarySummary {
  count: number
  mood_counts: Record<string, number>
  topic_counts: Record<string, number>
}

interface MoodDiaryReviewModalProps {
  isOpen: boolean
  onClose: () => void
}

export const MoodDiaryReviewModal: React.FC<MoodDiaryReviewModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(false)
  const [entries, setEntries] = useState<MoodDiaryEntry[]>([])
  const [summary, setSummary] = useState<MoodDiarySummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 加载情绪日记数据
  useEffect(() => {
    if (isOpen) {
      loadMoodDiary()
    }
  }, [isOpen])

  const loadMoodDiary = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const response = await skillsApi.reviewMoodDiary({ limit: 20 })

      const result: any = response.data?.result
      if (result?.items) {
        setEntries(Array.isArray(result.items) ? result.items : [])
        setSummary(result.summary || null)
      } else {
        setError('暂无情绪日记数据')
      }
    } catch (err) {
      console.error('加载情绪日记失败:', err)
      setError('加载情绪日记失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setIsLoading(false)
    }
  }

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return timestamp
    }
  }

  const getMoodEmoji = (mood?: string) => {
    const moodEmojis: Record<string, string> = {
      happy: '😊',
      sad: '😢',
      angry: '😠',
      anxious: '😰',
      neutral: '😐',
      excited: '🤗',
      tired: '😴',
      confused: '😕',
    }
    return moodEmojis[mood || ''] || '😐'
  }

  const getUserText = (entry: MoodDiaryEntry) => entry.raw?.user_text || entry.content || ''
  const getAssistantText = (entry: MoodDiaryEntry) => entry.raw?.assistant_text || ''

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          backgroundColor: 'hsl(var(--color-background))',
          borderRadius: '12px',
          width: '90%',
          maxWidth: '800px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px',
            borderBottom: '1px solid hsl(var(--color-border))',
          }}
        >
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              margin: 0,
              color: 'hsl(var(--color-foreground))',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            📚 情绪日记回顾
          </h2>
          <button
            onClick={onClose}
            style={{
              padding: '6px',
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              color: 'hsl(var(--color-muted-foreground))',
              fontSize: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'hsl(var(--color-muted) / 0.5)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            ×
          </button>
        </div>

        {/* 内容区域 */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            padding: '24px',
          }}
        >
          {isLoading ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                padding: '40px',
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid hsl(var(--color-muted))',
                  borderTop: '3px solid hsl(var(--color-primary))',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                }}
              />
              <span
                style={{
                  color: 'hsl(var(--color-muted-foreground))',
                  fontSize: '14px',
                }}
              >
                加载情绪日记中...
              </span>
            </div>
          ) : error ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '16px',
                padding: '40px',
              }}
            >
              <div
                style={{
                  fontSize: '48px',
                }}
              >
                😔
              </div>
              <div
                style={{
                  textAlign: 'center',
                  color: 'hsl(var(--color-muted-foreground))',
                  fontSize: '14px',
                  lineHeight: '1.5',
                }}
              >
                {error}
              </div>
              <button
                onClick={loadMoodDiary}
                style={{
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 500,
                  border: '1px solid hsl(var(--color-border))',
                  borderRadius: '6px',
                  backgroundColor: 'transparent',
                  color: 'hsl(var(--color-foreground))',
                  cursor: 'pointer',
                }}
              >
                重试
              </button>
            </div>
          ) : (
            <>
              {/* 统计摘要 */}
              {summary && (
                <div
                  style={{
                    marginBottom: '24px',
                    padding: '16px',
                    backgroundColor: 'hsl(var(--color-muted) / 0.3)',
                    borderRadius: '8px',
                  }}
                >
                  <h3
                    style={{
                      fontSize: '16px',
                      fontWeight: 600,
                      margin: '0 0 12px 0',
                      color: 'hsl(var(--color-foreground))',
                    }}
                  >
                    📊 统计摘要
                  </h3>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '16px',
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'hsl(var(--color-muted-foreground))',
                          marginBottom: '4px',
                        }}
                      >
                        总记录数
                      </div>
                      <div
                        style={{
                          fontSize: '20px',
                          fontWeight: 600,
                          color: 'hsl(var(--color-foreground))',
                        }}
                      >
                        {summary.count}
                      </div>
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'hsl(var(--color-muted-foreground))',
                          marginBottom: '4px',
                        }}
                      >
                        主题分布
                      </div>
                      <div
                        style={{
                          fontSize: '20px',
                          fontWeight: 600,
                          color: 'hsl(var(--color-foreground))',
                        }}
                      >
                        {Object.entries(summary.topic_counts).slice(0, 5).map(([topic, count]) => (
                          <div key={topic} style={{ fontSize: '14px', fontWeight: 400, marginBottom: '4px' }}>
                            {topic}: {count}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 日记列表 */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                <h3
                  style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    margin: 0,
                    color: 'hsl(var(--color-foreground))',
                  }}
                >
                  📝 最近记录
                </h3>
                {entries.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '40px',
                      color: 'hsl(var(--color-muted-foreground))',
                      fontSize: '14px',
                    }}
                  >
                    暂无情绪日记记录
                  </div>
                ) : (
                  entries.map((entry, index) => (
                    <div
                      key={entry.entry_id || index}
                      style={{
                        padding: '16px',
                        backgroundColor: 'hsl(var(--color-card))',
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--color-border))',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '12px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            color: 'hsl(var(--color-muted-foreground))',
                          }}
                        >
                          {formatTimestamp(entry.ts)}
                        </span>
                        <span
                          style={{
                            fontSize: '20px',
                          }}
                        >
                          {getMoodEmoji(entry.mood)}
                        </span>
                      </div>
                      <div
                        style={{
                          marginBottom: '8px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: 'hsl(var(--color-foreground))',
                            marginRight: '8px',
                          }}
                        >
                          用户:
                        </span>
                        <span
                          style={{
                            fontSize: '14px',
                            color: 'hsl(var(--color-foreground))',
                          }}
                        >
                          {getUserText(entry)}
                        </span>
                      </div>
                      <div>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 500,
                            color: 'hsl(var(--color-foreground))',
                            marginRight: '8px',
                          }}
                        >
                          助手:
                        </span>
                        <span
                          style={{
                            fontSize: '14px',
                            color: 'hsl(var(--color-muted-foreground))',
                          }}
                        >
                          {getAssistantText(entry)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// 添加动画样式
const style = document.createElement('style')
style.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`
document.head.appendChild(style)
