/**
 * Live2D演示页面
 * 
 * 展示Live2D组件在实际应用中的使用
 */

import React from 'react'
import { Live2DViewerExample } from '../components/Character/Live2D/Live2DViewerExample'
import './Live2DDemo.css'

/**
 * Live2D演示页面组件
 */
export const Live2DDemo: React.FC = () => {
  return (
    <div className="live2d-demo">
      <header className="live2d-demo__header">
        <h1>Live2D 角色展示</h1>
        <p>体验交互式Live2D角色模型</p>
      </header>

      <main className="live2d-demo__main">
        <Live2DViewerExample />
      </main>

      <footer className="live2d-demo__footer">
        <p>© 2024 Zishu Sensei - Live2D技术演示</p>
      </footer>
    </div>
  )
}

export default Live2DDemo
