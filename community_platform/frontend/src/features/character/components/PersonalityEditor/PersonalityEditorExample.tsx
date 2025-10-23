'use client';

import React, { useState } from 'react';
import { PersonalityEditor } from './PersonalityEditor';
import { type Personality, DEFAULT_PERSONALITY } from '../../types/personality';

/**
 * PersonalityEditor 使用示例
 * 
 * 这个组件展示了如何在实际应用中使用 PersonalityEditor
 */
export function PersonalityEditorExample() {
  const [personality, setPersonality] = useState<Personality>(DEFAULT_PERSONALITY);

  // 处理保存
  const handleSave = async (value: Personality) => {
    console.log('保存人格配置:', value);
    
    // 这里应该调用 API 保存数据
    // await characterApi.updatePersonality(characterId, value);
    
    // 模拟 API 调用
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        console.log('保存成功!');
        resolve();
      }, 1000);
    });
  };

  // 处理重置
  const handleReset = () => {
    if (confirm('确定要重置所有人格设置吗？')) {
      setPersonality(DEFAULT_PERSONALITY);
    }
  };

  return (
    <div className="container max-w-6xl mx-auto py-8">
      <PersonalityEditor
        value={personality}
        onChange={setPersonality}
        onSave={handleSave}
        onReset={handleReset}
        showActions={true}
      />

      {/* 调试信息 (可选) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-8 p-4 bg-muted rounded-lg">
          <h3 className="font-semibold mb-2">当前配置 (开发模式)</h3>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(personality, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

