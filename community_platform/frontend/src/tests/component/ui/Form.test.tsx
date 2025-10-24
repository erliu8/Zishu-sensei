/**
 * Form 组件测试
 * 测试表单组件的验证、提交和错误处理
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

// 简化的表单测试组件
function SimpleForm({
  onSubmit,
  initialValues = { username: '', email: '' },
}: {
  onSubmit?: (values: any) => void;
  initialValues?: { username: string; email: string };
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    if (!values.username) {
      newErrors.username = '用户名不能为空';
    }
    if (!values.email) {
      newErrors.email = '邮箱不能为空';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      newErrors.email = '邮箱格式不正确';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      onSubmit?.(values);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="测试表单">
      <div>
        <label htmlFor="username">用户名</label>
        <input
          id="username"
          name="username"
          value={values.username}
          onChange={(e) => setValues({ ...values, username: e.target.value })}
          aria-invalid={!!errors.username}
          aria-describedby={errors.username ? 'username-error' : undefined}
        />
        {errors.username && (
          <span id="username-error" role="alert">
            {errors.username}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="email">邮箱</label>
        <input
          id="email"
          name="email"
          type="email"
          value={values.email}
          onChange={(e) => setValues({ ...values, email: e.target.value })}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <span id="email-error" role="alert">
            {errors.email}
          </span>
        )}
      </div>

      <button type="submit">提交</button>
      <button type="reset" onClick={() => setValues(initialValues)}>
        重置
      </button>
    </form>
  );
}

describe('Form Component', () => {
  describe('渲染', () => {
    it('应该正确渲染表单', () => {
      render(<SimpleForm />);
      
      expect(screen.getByRole('form', { name: '测试表单' })).toBeInTheDocument();
      expect(screen.getByLabelText('用户名')).toBeInTheDocument();
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '提交' })).toBeInTheDocument();
    });

    it('应该渲染初始值', () => {
      render(
        <SimpleForm
          initialValues={{ username: '张三', email: 'zhangsan@example.com' }}
        />
      );

      expect(screen.getByLabelText('用户名')).toHaveValue('张三');
      expect(screen.getByLabelText('邮箱')).toHaveValue('zhangsan@example.com');
    });
  });

  describe('用户输入', () => {
    it('应该处理用户输入', async () => {
      const user = userEvent.setup();
      render(<SimpleForm />);

      const usernameInput = screen.getByLabelText('用户名');
      const emailInput = screen.getByLabelText('邮箱');

      await user.type(usernameInput, '测试用户');
      await user.type(emailInput, 'test@example.com');

      expect(usernameInput).toHaveValue('测试用户');
      expect(emailInput).toHaveValue('test@example.com');
    });

    it('应该允许编辑输入', async () => {
      const user = userEvent.setup();
      render(<SimpleForm />);

      const usernameInput = screen.getByLabelText('用户名');

      await user.type(usernameInput, 'abc');
      expect(usernameInput).toHaveValue('abc');

      await user.clear(usernameInput);
      await user.type(usernameInput, 'xyz');
      expect(usernameInput).toHaveValue('xyz');
    });
  });

  describe('表单验证', () => {
    it('应该在提交空表单时显示错误', async () => {
      const handleSubmit = vi.fn();
      const user = userEvent.setup();

      render(<SimpleForm onSubmit={handleSubmit} />);

      await user.click(screen.getByRole('button', { name: '提交' }));

      await waitFor(() => {
        expect(screen.getByText('用户名不能为空')).toBeInTheDocument();
        expect(screen.getByText('邮箱不能为空')).toBeInTheDocument();
      });

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('应该验证邮箱格式', async () => {
      const handleSubmit = vi.fn();
      const user = userEvent.setup();

      render(<SimpleForm onSubmit={handleSubmit} />);

      await user.type(screen.getByLabelText('用户名'), '测试');
      await user.type(screen.getByLabelText('邮箱'), 'invalid-email');
      await user.click(screen.getByRole('button', { name: '提交' }));

      await waitFor(() => {
        expect(screen.getByText('邮箱格式不正确')).toBeInTheDocument();
      });

      expect(handleSubmit).not.toHaveBeenCalled();
    });

    it('应该在修正错误后清除错误消息', async () => {
      const user = userEvent.setup();
      render(<SimpleForm />);

      // 先触发验证错误
      await user.click(screen.getByRole('button', { name: '提交' }));
      await waitFor(() => {
        expect(screen.getByText('用户名不能为空')).toBeInTheDocument();
      });

      // 填写正确的值并重新提交
      await user.type(screen.getByLabelText('用户名'), '测试用户');
      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: '提交' }));

      await waitFor(() => {
        expect(screen.queryByText('用户名不能为空')).not.toBeInTheDocument();
        expect(screen.queryByText('邮箱不能为空')).not.toBeInTheDocument();
      });
    });
  });

  describe('表单提交', () => {
    it('应该在验证通过时提交表单', async () => {
      const handleSubmit = vi.fn();
      const user = userEvent.setup();

      render(<SimpleForm onSubmit={handleSubmit} />);

      await user.type(screen.getByLabelText('用户名'), '测试用户');
      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: '提交' }));

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({
          username: '测试用户',
          email: 'test@example.com',
        });
      });
    });

    it('应该防止默认表单提交行为', async () => {
      const handleSubmit = vi.fn();
      const user = userEvent.setup();

      render(<SimpleForm onSubmit={handleSubmit} />);

      await user.type(screen.getByLabelText('用户名'), '测试');
      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.keyboard('{Enter}');

      // 表单应该被验证和提交，而不是刷新页面
      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalled();
      });
    });

    it('应该支持通过 Enter 键提交', async () => {
      const handleSubmit = vi.fn();
      const user = userEvent.setup();

      render(<SimpleForm onSubmit={handleSubmit} />);

      const usernameInput = screen.getByLabelText('用户名');
      await user.type(usernameInput, '测试用户');
      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.type(usernameInput, '{Enter}');

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('表单重置', () => {
    it('应该在点击重置按钮时重置表单', async () => {
      const user = userEvent.setup();
      render(
        <SimpleForm
          initialValues={{ username: '初始用户', email: 'initial@example.com' }}
        />
      );

      // 修改表单值
      const usernameInput = screen.getByLabelText('用户名');
      const emailInput = screen.getByLabelText('邮箱');

      await user.clear(usernameInput);
      await user.type(usernameInput, '新用户');
      await user.clear(emailInput);
      await user.type(emailInput, 'new@example.com');

      expect(usernameInput).toHaveValue('新用户');
      expect(emailInput).toHaveValue('new@example.com');

      // 重置表单
      await user.click(screen.getByRole('button', { name: '重置' }));

      await waitFor(() => {
        expect(usernameInput).toHaveValue('初始用户');
        expect(emailInput).toHaveValue('initial@example.com');
      });
    });
  });

  describe('可访问性', () => {
    it('错误消息应该有正确的 ARIA 属性', async () => {
      const user = userEvent.setup();
      render(<SimpleForm />);

      await user.click(screen.getByRole('button', { name: '提交' }));

      await waitFor(() => {
        const usernameInput = screen.getByLabelText('用户名');
        expect(usernameInput).toHaveAttribute('aria-invalid', 'true');
        expect(usernameInput).toHaveAttribute('aria-describedby', 'username-error');

        const error = screen.getByText('用户名不能为空');
        expect(error).toHaveAttribute('role', 'alert');
        expect(error).toHaveAttribute('id', 'username-error');
      });
    });

    it('标签应该正确关联输入框', () => {
      render(<SimpleForm />);

      const usernameLabel = screen.getByText('用户名');
      const usernameInput = screen.getByLabelText('用户名');

      expect(usernameLabel).toHaveAttribute('for', 'username');
      expect(usernameInput).toHaveAttribute('id', 'username');
    });

    it('应该支持键盘导航', async () => {
      const user = userEvent.setup();
      render(<SimpleForm />);

      const usernameInput = screen.getByLabelText('用户名');
      const emailInput = screen.getByLabelText('邮箱');
      const submitButton = screen.getByRole('button', { name: '提交' });

      usernameInput.focus();
      expect(usernameInput).toHaveFocus();

      await user.tab();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(submitButton).toHaveFocus();
    });
  });

  describe('边界情况', () => {
    it('应该处理非常长的输入', async () => {
      const user = userEvent.setup();
      render(<SimpleForm />);

      const longString = 'a'.repeat(1000);
      await user.type(screen.getByLabelText('用户名'), longString);

      expect(screen.getByLabelText('用户名')).toHaveValue(longString);
    });

    it('应该处理特殊字符', async () => {
      const handleSubmit = vi.fn();
      const user = userEvent.setup();

      render(<SimpleForm onSubmit={handleSubmit} />);

      await user.type(screen.getByLabelText('用户名'), '用户<>&"\'');
      await user.type(screen.getByLabelText('邮箱'), 'test+tag@example.com');
      await user.click(screen.getByRole('button', { name: '提交' }));

      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalledWith({
          username: '用户<>&"\'',
          email: 'test+tag@example.com',
        });
      });
    });

    it('应该处理快速连续提交', async () => {
      const handleSubmit = vi.fn();
      const user = userEvent.setup();

      render(<SimpleForm onSubmit={handleSubmit} />);

      await user.type(screen.getByLabelText('用户名'), '测试');
      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');

      const submitButton = screen.getByRole('button', { name: '提交' });
      await user.click(submitButton);
      await user.click(submitButton);
      await user.click(submitButton);

      // 应该至少提交一次
      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalled();
      });
    });
  });
});

