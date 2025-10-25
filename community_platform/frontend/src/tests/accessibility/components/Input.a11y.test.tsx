/**
 * Input 组件可访问性测试
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { checkA11y } from '../helpers/a11y-utils';
import { componentAxeOptions } from '../setup-a11y';
import { checkFormErrorAccessibility } from '../helpers/screen-reader-testing';

// 临时的 Input 组件用于测试
const Input = ({ 
  label,
  error,
  description,
  required = false,
  disabled = false,
  id,
  ...props 
}: any) => {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = `${inputId}-error`;
  const descId = `${inputId}-description`;
  
  return (
    <div className="input-group">
      <label htmlFor={inputId}>
        {label}
        {required && <span aria-label="required"> *</span>}
      </label>
      
      {description && (
        <div id={descId} className="input-description">
          {description}
        </div>
      )}
      
      <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={
          [description && descId, error && errorId]
            .filter(Boolean)
            .join(' ') || undefined
        }
        aria-required={required}
        disabled={disabled}
        {...props}
      />
      
      {error && (
        <div id={errorId} role="alert" className="input-error">
          {error}
        </div>
      )}
    </div>
  );
};

describe('Input Accessibility', () => {
  describe('基本可访问性', () => {
    it('应该没有可访问性违规', async () => {
      const { container } = render(
        <Input label="Username" type="text" />
      );
      await checkA11y(container, componentAxeOptions);
    });

    it('应该有关联的标签', () => {
      render(<Input label="Email" type="email" />);
      const input = screen.getByLabelText(/email/i);
      expect(input).toBeInTheDocument();
    });

    it('标签应该通过 htmlFor 关联到输入框', () => {
      render(<Input label="Password" type="password" id="pwd" />);
      const label = screen.getByText(/password/i);
      const input = screen.getByLabelText(/password/i);
      
      expect(label).toHaveAttribute('for', 'pwd');
      expect(input).toHaveAttribute('id', 'pwd');
    });
  });

  describe('必填字段', () => {
    it('必填字段应该有 aria-required 属性', () => {
      render(<Input label="Name" required />);
      const input = screen.getByLabelText(/name/i);
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('必填标记应该可以被屏幕阅读器读取', () => {
      render(<Input label="Name" required />);
      const requiredIndicator = screen.getByLabelText(/required/i);
      expect(requiredIndicator).toBeInTheDocument();
    });

    it('必填字段应该没有可访问性违规', async () => {
      const { container } = render(<Input label="Name" required />);
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('错误状态', () => {
    it('有错误的输入框应该有 aria-invalid 属性', () => {
      render(<Input label="Email" error="Invalid email address" />);
      const input = screen.getByLabelText(/email/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('错误消息应该通过 aria-describedby 关联', () => {
      render(<Input label="Email" error="Invalid email address" id="email" />);
      const input = screen.getByLabelText(/email/i);
      const errorMessage = screen.getByText(/invalid email address/i);
      
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(errorMessage).toHaveAttribute('id', expect.stringContaining('error'));
    });

    it('错误消息应该有 role="alert"', () => {
      render(<Input label="Email" error="Invalid email address" />);
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent(/invalid email address/i);
    });

    it('错误状态应该可以被屏幕阅读器检测', () => {
      const { container } = render(
        <Input label="Email" error="Invalid email address" id="email" />
      );
      
      const input = container.querySelector('input') as HTMLElement;
      const errorMessage = screen.getByRole('alert');
      
      const result = checkFormErrorAccessibility(input, errorMessage);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('错误状态应该没有可访问性违规', async () => {
      const { container } = render(
        <Input label="Email" error="Invalid email address" />
      );
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('描述文本', () => {
    it('描述文本应该通过 aria-describedby 关联', () => {
      render(
        <Input 
          label="Password" 
          description="Must be at least 8 characters"
          id="pwd"
        />
      );
      
      const input = screen.getByLabelText(/password/i);
      const description = screen.getByText(/must be at least 8 characters/i);
      
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();
      expect(description).toHaveAttribute('id', expect.stringContaining('description'));
    });

    it('应该同时支持描述文本和错误消息', () => {
      render(
        <Input 
          label="Password" 
          description="Must be at least 8 characters"
          error="Password is too short"
          id="pwd"
        />
      );
      
      const input = screen.getByLabelText(/password/i);
      const describedBy = input.getAttribute('aria-describedby');
      
      expect(describedBy).toContain('description');
      expect(describedBy).toContain('error');
    });
  });

  describe('禁用状态', () => {
    it('禁用的输入框应该有 disabled 属性', () => {
      render(<Input label="Name" disabled />);
      const input = screen.getByLabelText(/name/i);
      expect(input).toBeDisabled();
    });

    it('禁用的输入框不应该可聚焦', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Input label="First" />
          <Input label="Disabled" disabled />
          <Input label="Last" />
        </>
      );
      
      const inputs = [
        screen.getByLabelText(/first/i),
        screen.getByLabelText(/disabled/i),
        screen.getByLabelText(/last/i),
      ];
      
      await user.tab();
      expect(document.activeElement).toBe(inputs[0]);
      
      await user.tab();
      expect(document.activeElement).toBe(inputs[2]); // 跳过禁用的
    });

    it('禁用状态应该没有可访问性违规', async () => {
      const { container } = render(<Input label="Name" disabled />);
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('不同输入类型', () => {
    it('文本输入框应该可访问', async () => {
      const { container } = render(<Input label="Name" type="text" />);
      await checkA11y(container, componentAxeOptions);
    });

    it('邮箱输入框应该可访问', async () => {
      const { container } = render(<Input label="Email" type="email" />);
      await checkA11y(container, componentAxeOptions);
    });

    it('密码输入框应该可访问', async () => {
      const { container } = render(<Input label="Password" type="password" />);
      await checkA11y(container, componentAxeOptions);
    });

    it('数字输入框应该可访问', async () => {
      const { container } = render(<Input label="Age" type="number" />);
      await checkA11y(container, componentAxeOptions);
    });

    it('搜索输入框应该可访问', async () => {
      const { container } = render(<Input label="Search" type="search" />);
      await checkA11y(container, componentAxeOptions);
    });

    it('电话输入框应该可访问', async () => {
      const { container } = render(<Input label="Phone" type="tel" />);
      await checkA11y(container, componentAxeOptions);
    });

    it('URL 输入框应该可访问', async () => {
      const { container } = render(<Input label="Website" type="url" />);
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('键盘交互', () => {
    it('应该可以通过 Tab 键聚焦', async () => {
      const user = userEvent.setup();
      render(<Input label="Name" />);
      
      const input = screen.getByLabelText(/name/i);
      
      await user.tab();
      expect(document.activeElement).toBe(input);
    });

    it('应该可以输入文本', async () => {
      const user = userEvent.setup();
      render(<Input label="Name" />);
      
      const input = screen.getByLabelText(/name/i) as HTMLInputElement;
      
      await user.click(input);
      await user.keyboard('John Doe');
      
      expect(input.value).toBe('John Doe');
    });

    it('应该支持键盘选择文本', async () => {
      const user = userEvent.setup();
      render(<Input label="Name" defaultValue="John Doe" />);
      
      const input = screen.getByLabelText(/name/i) as HTMLInputElement;
      
      await user.click(input);
      await user.keyboard('{Control>}a{/Control}'); // Select all
      
      expect(input.selectionStart).toBe(0);
      expect(input.selectionEnd).toBe(input.value.length);
    });
  });

  describe('Textarea 变体', () => {
    const Textarea = ({ label, ...props }: any) => {
      const id = `textarea-${Math.random().toString(36).substr(2, 9)}`;
      return (
        <>
          <label htmlFor={id}>{label}</label>
          <textarea id={id} {...props} />
        </>
      );
    };

    it('Textarea 应该可访问', async () => {
      const { container } = render(<Textarea label="Comments" />);
      await checkA11y(container, componentAxeOptions);
    });

    it('Textarea 应该有关联的标签', () => {
      render(<Textarea label="Description" />);
      const textarea = screen.getByLabelText(/description/i);
      expect(textarea).toBeInTheDocument();
    });
  });

  describe('占位符', () => {
    it('占位符不应该替代标签', async () => {
      const { container } = render(
        <Input label="Search" placeholder="Enter search term" />
      );
      
      // 即使有占位符，仍然需要标签
      const input = screen.getByLabelText(/search/i);
      expect(input).toHaveAttribute('placeholder', 'Enter search term');
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('自动完成', () => {
    it('应该支持 autocomplete 属性', () => {
      render(<Input label="Email" type="email" autoComplete="email" />);
      const input = screen.getByLabelText(/email/i);
      expect(input).toHaveAttribute('autocomplete', 'email');
    });

    it('带 autocomplete 的输入框应该可访问', async () => {
      const { container } = render(
        <Input label="Email" type="email" autoComplete="email" />
      );
      await checkA11y(container, componentAxeOptions);
    });
  });
});

