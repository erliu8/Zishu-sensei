import React from 'react';

export interface CodeEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  language?: string;
}

/**
 * 代码编辑器组件
 */
const CodeEditor: React.FC<CodeEditorProps> = ({ value = '', onChange, language = 'javascript' }) => {
  return (
    <div className="code-editor">
      <textarea
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="code-textarea"
        placeholder={`输入 ${language} 代码...`}
      />
    </div>
  );
};

export default CodeEditor;

