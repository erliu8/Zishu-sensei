/**
 * Button 组件可访问性测试
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { checkA11y } from '../helpers/a11y-utils';
import { componentAxeOptions } from '../setup-a11y';
import { Keys, testEnterKeyActivation, testSpaceKeyActivation } from '../helpers/keyboard-testing';

// 假设的 Button 组件路径，根据实际情况调整
// import { Button } from '@/components/ui/Button';

// 临时的 Button 组件用于测试
const Button = ({ 
  children, 
  onClick,
  disabled = false,
  variant = 'primary',
  'aria-label': ariaLabel,
  ...props 
}: any) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`btn btn-${variant}`}
    aria-label={ariaLabel}
    {...props}
  >
    {children}
  </button>
);

describe('Button Accessibility', () => {
  describe('基本可访问性', () => {
    it('应该没有可访问性违规', async () => {
      const { container } = render(<Button>Click me</Button>);
      await checkA11y(container, componentAxeOptions);
    });

    it('应该有可访问的名称', () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole('button', { name: /click me/i });
      expect(button).toBeInTheDocument();
    });

    it('应该通过 aria-label 提供可访问名称', () => {
      render(<Button aria-label="Submit form">Submit</Button>);
      const button = screen.getByRole('button', { name: /submit form/i });
      expect(button).toBeInTheDocument();
    });
  });

  describe('键盘交互', () => {
    it('应该可以通过 Tab 键聚焦', async () => {
      const user = userEvent.setup();
      render(<Button>Click me</Button>);
      
      const button = screen.getByRole('button');
      
      await user.tab();
      expect(document.activeElement).toBe(button);
    });

    it('应该响应 Enter 键', async () => {
      let clicked = false;
      const handleClick = () => { clicked = true; };
      
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole('button');
      
      await testEnterKeyActivation(button, () => {
        expect(clicked).toBe(true);
      });
    });

    it('应该响应 Space 键', async () => {
      let clicked = false;
      const handleClick = () => { clicked = true; };
      
      render(<Button onClick={handleClick}>Click me</Button>);
      const button = screen.getByRole('button');
      
      await testSpaceKeyActivation(button, () => {
        expect(clicked).toBe(true);
      });
    });

    it('禁用的按钮不应该可聚焦', async () => {
      const user = userEvent.setup();
      render(
        <>
          <Button>First</Button>
          <Button disabled>Disabled</Button>
          <Button>Last</Button>
        </>
      );
      
      const buttons = screen.getAllByRole('button');
      const [first, disabled, last] = buttons;
      
      // Tab 应该跳过禁用的按钮
      await user.tab();
      expect(document.activeElement).toBe(first);
      
      await user.tab();
      expect(document.activeElement).toBe(last);
    });
  });

  describe('禁用状态', () => {
    it('禁用的按钮应该有 disabled 属性', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('禁用的按钮应该有适当的 ARIA 属性', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('disabled');
    });

    it('禁用的按钮不应该触发点击事件', async () => {
      const user = userEvent.setup();
      let clicked = false;
      const handleClick = () => { clicked = true; };
      
      render(<Button disabled onClick={handleClick}>Disabled</Button>);
      const button = screen.getByRole('button');
      
      await user.click(button);
      expect(clicked).toBe(false);
    });
  });

  describe('图标按钮', () => {
    it('只有图标的按钮应该有 aria-label', async () => {
      render(
        <Button aria-label="Close dialog">
          <span aria-hidden="true">×</span>
        </Button>
      );
      
      const button = screen.getByRole('button', { name: /close dialog/i });
      expect(button).toBeInTheDocument();
      
      const { container } = render(
        <Button aria-label="Close dialog">
          <span aria-hidden="true">×</span>
        </Button>
      );
      await checkA11y(container, componentAxeOptions);
    });

    it('图标应该标记为 aria-hidden', () => {
      render(
        <Button aria-label="Delete item">
          <span aria-hidden="true">🗑️</span>
        </Button>
      );
      
      const icon = screen.getByText('🗑️');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('加载状态', () => {
    const LoadingButton = ({ loading, children, ...props }: any) => (
      <Button {...props} disabled={loading} aria-busy={loading}>
        {loading ? 'Loading...' : children}
      </Button>
    );

    it('加载中的按钮应该有 aria-busy 属性', () => {
      render(<LoadingButton loading>Submit</LoadingButton>);
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('加载中的按钮应该被禁用', () => {
      render(<LoadingButton loading>Submit</LoadingButton>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('加载状态应该对屏幕阅读器可见', () => {
      render(<LoadingButton loading>Submit</LoadingButton>);
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });
  });

  describe('按钮组', () => {
    const ButtonGroup = ({ children, label }: any) => (
      <div role="group" aria-label={label}>
        {children}
      </div>
    );

    it('按钮组应该有 role="group"', () => {
      render(
        <ButtonGroup label="Text formatting">
          <Button>Bold</Button>
          <Button>Italic</Button>
          <Button>Underline</Button>
        </ButtonGroup>
      );
      
      const group = screen.getByRole('group', { name: /text formatting/i });
      expect(group).toBeInTheDocument();
    });

    it('按钮组中的所有按钮都应该可以通过 Tab 键访问', async () => {
      const user = userEvent.setup();
      render(
        <ButtonGroup label="Text formatting">
          <Button>Bold</Button>
          <Button>Italic</Button>
          <Button>Underline</Button>
        </ButtonGroup>
      );
      
      const buttons = screen.getAllByRole('button');
      
      await user.tab();
      expect(document.activeElement).toBe(buttons[0]);
      
      await user.tab();
      expect(document.activeElement).toBe(buttons[1]);
      
      await user.tab();
      expect(document.activeElement).toBe(buttons[2]);
    });
  });

  describe('切换按钮', () => {
    const ToggleButton = ({ pressed, onToggle, children, ...props }: any) => (
      <Button
        {...props}
        onClick={onToggle}
        aria-pressed={pressed}
      >
        {children}
      </Button>
    );

    it('切换按钮应该有 aria-pressed 属性', () => {
      render(<ToggleButton pressed={false}>Mute</ToggleButton>);
      const button = screen.getByRole('button', { pressed: false });
      expect(button).toHaveAttribute('aria-pressed', 'false');
    });

    it('切换按钮状态应该可以改变', async () => {
      const user = userEvent.setup();
      let pressed = false;
      const handleToggle = () => { pressed = !pressed; };
      
      const { rerender } = render(
        <ToggleButton pressed={pressed} onToggle={handleToggle}>
          Mute
        </ToggleButton>
      );
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-pressed', 'false');
      
      await user.click(button);
      
      rerender(
        <ToggleButton pressed={pressed} onToggle={handleToggle}>
          Mute
        </ToggleButton>
      );
      
      expect(button).toHaveAttribute('aria-pressed', 'true');
    });

    it('切换按钮应该没有可访问性违规', async () => {
      const { container } = render(
        <ToggleButton pressed={false}>Mute</ToggleButton>
      );
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('不同变体', () => {
    it('所有按钮变体都应该可访问', async () => {
      const variants = ['primary', 'secondary', 'danger', 'ghost', 'link'];
      
      for (const variant of variants) {
        const { container } = render(
          <Button variant={variant}>Button</Button>
        );
        await checkA11y(container, componentAxeOptions);
      }
    });
  });
});

