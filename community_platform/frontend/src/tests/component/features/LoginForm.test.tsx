/**
 * LoginForm 功能组件测试
 * 测试登录表单的完整功能流程
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/tests/test-utils';
import { useState } from 'react';

// 简化的登录表单组件用于测试
interface LoginFormProps {
  onSubmit?: (credentials: { email: string; password: string }) => Promise<void>;
  onForgotPassword?: () => void;
  isLoading?: boolean;
}

function LoginForm({ onSubmit, onForgotPassword, isLoading = false }: LoginFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const validate = () => {
    const newErrors: typeof errors = {};

    if (!email) {
      newErrors.email = '邮箱不能为空';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = '邮箱格式不正确';
    }

    if (!password) {
      newErrors.password = '密码不能为空';
    } else if (password.length < 6) {
      newErrors.password = '密码至少需要6个字符';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setSubmitting(true);
    try {
      await onSubmit?.({ email, password });
    } catch (error) {
      setErrors({ email: '登录失败，请检查您的凭据' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} aria-label="登录表单">
      <h1>用户登录</h1>

      <div>
        <label htmlFor="email">邮箱</label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="请输入邮箱"
          disabled={isLoading || submitting}
          aria-invalid={!!errors.email}
          aria-describedby={errors.email ? 'email-error' : undefined}
        />
        {errors.email && (
          <span id="email-error" role="alert" className="error">
            {errors.email}
          </span>
        )}
      </div>

      <div>
        <label htmlFor="password">密码</label>
        <div>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="请输入密码"
            disabled={isLoading || submitting}
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? '隐藏密码' : '显示密码'}
          >
            {showPassword ? '隐藏' : '显示'}
          </button>
        </div>
        {errors.password && (
          <span id="password-error" role="alert" className="error">
            {errors.password}
          </span>
        )}
      </div>

      <div>
        <label>
          <input
            type="checkbox"
            checked={rememberMe}
            onChange={(e) => setRememberMe(e.target.checked)}
            disabled={isLoading || submitting}
          />
          记住我
        </label>
      </div>

      <button
        type="button"
        onClick={onForgotPassword}
        disabled={isLoading || submitting}
      >
        忘记密码？
      </button>

      <button type="submit" disabled={isLoading || submitting}>
        {submitting ? '登录中...' : '登录'}
      </button>
    </form>
  );
}

describe('LoginForm Component', () => {
  const mockOnSubmit = vi.fn();
  const mockOnForgotPassword = vi.fn();

  beforeEach(() => {
    mockOnSubmit.mockClear();
    mockOnForgotPassword.mockClear();
  });

  describe('渲染', () => {
    it('应该正确渲染登录表单', () => {
      render(<LoginForm />);

      expect(screen.getByRole('heading', { name: '用户登录' })).toBeInTheDocument();
      expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
      expect(screen.getByLabelText('密码')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '忘记密码？' })).toBeInTheDocument();
    });

    it('应该显示记住我选项', () => {
      render(<LoginForm />);

      const checkbox = screen.getByRole('checkbox', { name: '记住我' });
      expect(checkbox).toBeInTheDocument();
      expect(checkbox).not.toBeChecked();
    });

    it('应该有正确的占位符', () => {
      render(<LoginForm />);

      expect(screen.getByPlaceholderText('请输入邮箱')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('请输入密码')).toBeInTheDocument();
    });
  });

  describe('用户交互', () => {
    it('应该处理邮箱输入', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const emailInput = screen.getByLabelText('邮箱');
      await user.type(emailInput, 'test@example.com');

      expect(emailInput).toHaveValue('test@example.com');
    });

    it('应该处理密码输入', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const passwordInput = screen.getByLabelText('密码');
      await user.type(passwordInput, 'password123');

      expect(passwordInput).toHaveValue('password123');
    });

    it('应该切换密码可见性', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const passwordInput = screen.getByLabelText('密码');
      const toggleButton = screen.getByRole('button', { name: '显示密码' });

      expect(passwordInput).toHaveAttribute('type', 'password');

      await user.click(toggleButton);
      expect(passwordInput).toHaveAttribute('type', 'text');
      expect(screen.getByRole('button', { name: '隐藏密码' })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: '隐藏密码' }));
      expect(passwordInput).toHaveAttribute('type', 'password');
    });

    it('应该处理记住我复选框', async () => {
      const user = userEvent.setup();
      render(<LoginForm />);

      const checkbox = screen.getByRole('checkbox', { name: '记住我' });

      await user.click(checkbox);
      expect(checkbox).toBeChecked();

      await user.click(checkbox);
      expect(checkbox).not.toBeChecked();
    });

    it('应该处理忘记密码点击', async () => {
      const user = userEvent.setup();
      render(<LoginForm onForgotPassword={mockOnForgotPassword} />);

      await user.click(screen.getByRole('button', { name: '忘记密码？' }));
      expect(mockOnForgotPassword).toHaveBeenCalledTimes(1);
    });
  });

  describe('表单验证', () => {
    it('应该验证空邮箱', async () => {
      const user = userEvent.setup();
      render(<LoginForm onSubmit={mockOnSubmit} />);

      await user.click(screen.getByRole('button', { name: '登录' }));

      await waitFor(() => {
        expect(screen.getByText('邮箱不能为空')).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('应该验证邮箱格式', async () => {
      const user = userEvent.setup();
      render(<LoginForm onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText('邮箱'), 'invalid-email');
      await user.click(screen.getByRole('button', { name: '登录' }));

      await waitFor(() => {
        expect(screen.getByText('邮箱格式不正确')).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('应该验证空密码', async () => {
      const user = userEvent.setup();
      render(<LoginForm onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.click(screen.getByRole('button', { name: '登录' }));

      await waitFor(() => {
        expect(screen.getByText('密码不能为空')).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('应该验证密码长度', async () => {
      const user = userEvent.setup();
      render(<LoginForm onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.type(screen.getByLabelText('密码'), '12345');
      await user.click(screen.getByRole('button', { name: '登录' }));

      await waitFor(() => {
        expect(screen.getByText('密码至少需要6个字符')).toBeInTheDocument();
      });

      expect(mockOnSubmit).not.toHaveBeenCalled();
    });

    it('应该在输入有效时清除错误', async () => {
      const user = userEvent.setup();
      render(<LoginForm onSubmit={mockOnSubmit} />);

      // 先触发验证错误
      await user.click(screen.getByRole('button', { name: '登录' }));
      await waitFor(() => {
        expect(screen.getByText('邮箱不能为空')).toBeInTheDocument();
      });

      // 输入有效邮箱和密码
      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.type(screen.getByLabelText('密码'), 'password123');
      await user.click(screen.getByRole('button', { name: '登录' }));

      await waitFor(() => {
        expect(screen.queryByText('邮箱不能为空')).not.toBeInTheDocument();
      });
    });
  });

  describe('表单提交', () => {
    it('应该成功提交有效的表单', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValueOnce(undefined);

      render(<LoginForm onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.type(screen.getByLabelText('密码'), 'password123');
      await user.click(screen.getByRole('button', { name: '登录' }));

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalledWith({
          email: 'test@example.com',
          password: 'password123',
        });
      });
    });

    it('应该在提交时显示加载状态', async () => {
      const user = userEvent.setup();
      const delayedSubmit = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<LoginForm onSubmit={delayedSubmit} />);

      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.type(screen.getByLabelText('密码'), 'password123');
      await user.click(screen.getByRole('button', { name: '登录' }));

      expect(screen.getByRole('button', { name: '登录中...' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '登录中...' })).toBeDisabled();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '登录' })).toBeInTheDocument();
      });
    });

    it('应该处理提交错误', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockRejectedValueOnce(new Error('登录失败'));

      render(<LoginForm onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.type(screen.getByLabelText('密码'), 'wrongpassword');
      await user.click(screen.getByRole('button', { name: '登录' }));

      await waitFor(() => {
        expect(screen.getByText('登录失败，请检查您的凭据')).toBeInTheDocument();
      });
    });

    it('提交中应该禁用所有输入', async () => {
      const user = userEvent.setup();
      const delayedSubmit = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<LoginForm onSubmit={delayedSubmit} />);

      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.type(screen.getByLabelText('密码'), 'password123');
      await user.click(screen.getByRole('button', { name: '登录' }));

      expect(screen.getByLabelText('邮箱')).toBeDisabled();
      expect(screen.getByLabelText('密码')).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: '记住我' })).toBeDisabled();
    });
  });

  describe('加载状态', () => {
    it('应该在加载时禁用表单', () => {
      render(<LoginForm isLoading={true} />);

      expect(screen.getByLabelText('邮箱')).toBeDisabled();
      expect(screen.getByLabelText('密码')).toBeDisabled();
      expect(screen.getByRole('button', { name: '登录' })).toBeDisabled();
      expect(screen.getByRole('button', { name: '忘记密码？' })).toBeDisabled();
    });
  });

  describe('可访问性', () => {
    it('应该有正确的表单标签', () => {
      render(<LoginForm />);

      expect(screen.getByRole('form', { name: '登录表单' })).toBeInTheDocument();
    });

    it('错误消息应该正确关联', async () => {
      const user = userEvent.setup();
      render(<LoginForm onSubmit={mockOnSubmit} />);

      await user.click(screen.getByRole('button', { name: '登录' }));

      await waitFor(() => {
        const emailInput = screen.getByLabelText('邮箱');
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
        expect(emailInput).toHaveAttribute('aria-describedby', 'email-error');

        const error = screen.getByText('邮箱不能为空');
        expect(error).toHaveAttribute('role', 'alert');
        expect(error).toHaveAttribute('id', 'email-error');
      });
    });

    it('应该支持键盘导航', async () => {
      const user = userEvent.setup();
      render(<LoginForm onSubmit={mockOnSubmit} />);

      const emailInput = screen.getByLabelText('邮箱');
      const passwordInput = screen.getByLabelText('密码');

      emailInput.focus();
      expect(emailInput).toHaveFocus();

      await user.tab();
      expect(passwordInput).toHaveFocus();
    });
  });

  describe('键盘快捷键', () => {
    it('应该支持 Enter 键提交', async () => {
      const user = userEvent.setup();
      mockOnSubmit.mockResolvedValueOnce(undefined);

      render(<LoginForm onSubmit={mockOnSubmit} />);

      await user.type(screen.getByLabelText('邮箱'), 'test@example.com');
      await user.type(screen.getByLabelText('密码'), 'password123{Enter}');

      await waitFor(() => {
        expect(mockOnSubmit).toHaveBeenCalled();
      });
    });
  });
});

