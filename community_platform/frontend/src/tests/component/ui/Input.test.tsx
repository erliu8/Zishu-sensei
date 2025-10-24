/**
 * Input 组件测试
 * 测试输入框组件的各种状态和行为
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/shared/components/ui/input';

describe('Input Component', () => {
  describe('渲染', () => {
    it('应该正确渲染输入框', () => {
      render(<Input placeholder="请输入内容" />);
      const input = screen.getByPlaceholderText('请输入内容');
      expect(input).toBeInTheDocument();
    });

    it('应该渲染带默认值的输入框', () => {
      render(<Input defaultValue="测试内容" />);
      const input = screen.getByDisplayValue('测试内容');
      expect(input).toBeInTheDocument();
    });

    it('应该支持受控组件', () => {
      const { rerender } = render(<Input value="初始值" onChange={() => {}} />);
      expect(screen.getByDisplayValue('初始值')).toBeInTheDocument();

      rerender(<Input value="更新值" onChange={() => {}} />);
      expect(screen.getByDisplayValue('更新值')).toBeInTheDocument();
    });
  });

  describe('交互行为', () => {
    it('应该处理用户输入', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Input onChange={handleChange} />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'Hello World');
      expect(handleChange).toHaveBeenCalled();
      expect(input).toHaveValue('Hello World');
    });

    it('应该处理清空操作', async () => {
      const user = userEvent.setup();
      
      render(<Input defaultValue="要清空的内容" />);
      const input = screen.getByRole('textbox');

      await user.clear(input);
      expect(input).toHaveValue('');
    });

    it('应该处理粘贴操作', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Input onChange={handleChange} />);
      const input = screen.getByRole('textbox');

      await user.click(input);
      await user.paste('粘贴的内容');
      expect(input).toHaveValue('粘贴的内容');
    });
  });

  describe('状态', () => {
    it('应该显示禁用状态', () => {
      render(<Input disabled />);
      const input = screen.getByRole('textbox');
      expect(input).toBeDisabled();
    });

    it('禁用时不应触发 onChange', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<Input disabled onChange={handleChange} />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'test');
      expect(handleChange).not.toHaveBeenCalled();
    });

    it('应该显示错误状态', () => {
      render(<Input error />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('border-error');
    });

    it('应该显示只读状态', () => {
      render(<Input readOnly value="只读内容" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('readonly');
    });
  });

  describe('类型变体', () => {
    it('应该支持不同的输入类型', () => {
      const { rerender } = render(<Input type="text" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'text');

      rerender(<Input type="email" />);
      expect(screen.getByRole('textbox')).toHaveAttribute('type', 'email');

      rerender(<Input type="password" />);
      const passwordInput = document.querySelector('input[type="password"]');
      expect(passwordInput).toBeInTheDocument();

      rerender(<Input type="number" />);
      expect(screen.getByRole('spinbutton')).toHaveAttribute('type', 'number');
    });
  });

  describe('验证', () => {
    it('应该支持必填验证', () => {
      render(<Input required />);
      const input = screen.getByRole('textbox');
      expect(input).toBeRequired();
    });

    it('应该支持最小长度验证', () => {
      render(<Input minLength={5} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('minLength', '5');
    });

    it('应该支持最大长度验证', () => {
      render(<Input maxLength={10} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('maxLength', '10');
    });

    it('应该支持正则表达式验证', () => {
      render(<Input pattern="[0-9]*" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('pattern', '[0-9]*');
    });
  });

  describe('焦点管理', () => {
    it('应该支持自动获取焦点', () => {
      render(<Input autoFocus />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveFocus();
    });

    it('应该处理焦点事件', async () => {
      const handleFocus = vi.fn();
      const handleBlur = vi.fn();
      const user = userEvent.setup();

      render(<Input onFocus={handleFocus} onBlur={handleBlur} />);
      const input = screen.getByRole('textbox');

      await user.click(input);
      expect(handleFocus).toHaveBeenCalledTimes(1);

      await user.tab();
      expect(handleBlur).toHaveBeenCalledTimes(1);
    });
  });

  describe('自定义样式', () => {
    it('应该接受自定义 className', () => {
      render(<Input className="custom-input" />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('custom-input');
    });

    it('应该保留默认样式类', () => {
      render(<Input />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveClass('rounded-md', 'border', 'px-3');
    });
  });

  describe('引用和 DOM 属性', () => {
    it('应该正确转发 ref', () => {
      const ref = vi.fn();
      render(<Input ref={ref} />);
      expect(ref).toHaveBeenCalled();
    });

    it('应该传递 HTML 属性', () => {
      render(
        <Input
          name="username"
          id="user-input"
          data-testid="test-input"
          aria-label="用户名输入"
        />
      );

      const input = screen.getByTestId('test-input');
      expect(input).toHaveAttribute('name', 'username');
      expect(input).toHaveAttribute('id', 'user-input');
      expect(input).toHaveAttribute('aria-label', '用户名输入');
    });
  });

  describe('键盘交互', () => {
    it('应该支持 Enter 键提交', async () => {
      const handleKeyDown = vi.fn();
      const user = userEvent.setup();

      render(<Input onKeyDown={handleKeyDown} />);
      const input = screen.getByRole('textbox');

      await user.type(input, 'test{Enter}');
      expect(handleKeyDown).toHaveBeenCalled();
    });

    it('应该支持 Escape 键', async () => {
      const handleKeyDown = vi.fn();
      const user = userEvent.setup();

      render(<Input onKeyDown={handleKeyDown} />);
      const input = screen.getByRole('textbox');

      input.focus();
      await user.keyboard('{Escape}');
      expect(handleKeyDown).toHaveBeenCalled();
    });
  });

  describe('可访问性', () => {
    it('应该有正确的 ARIA 属性', () => {
      render(
        <Input
          aria-label="搜索"
          aria-describedby="search-help"
          aria-invalid={true}
        />
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', '搜索');
      expect(input).toHaveAttribute('aria-describedby', 'search-help');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('应该支持键盘导航', async () => {
      const user = userEvent.setup();

      render(
        <>
          <Input data-testid="input1" />
          <Input data-testid="input2" />
        </>
      );

      const input1 = screen.getByTestId('input1');
      const input2 = screen.getByTestId('input2');

      input1.focus();
      expect(input1).toHaveFocus();

      await user.tab();
      expect(input2).toHaveFocus();
    });
  });
});

