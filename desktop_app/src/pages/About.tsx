/**
 * 关于页面
 */
import React from 'react';

const About: React.FC = () => {
  return (
    <div className="about-page">
      <h1>关于紫舒</h1>
      <div>
        <h2>版本信息</h2>
        <p>版本: 1.0.0</p>
        <p>构建时间: {new Date().toLocaleDateString()}</p>
      </div>
      
      <div>
        <h2>开发团队</h2>
        <p>紫舒开发团队</p>
      </div>
      
      <div>
        <h2>许可证</h2>
        <p>apache 2.0 License</p>
      </div>
    </div>
  );
};

export default About;
