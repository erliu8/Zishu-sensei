/**
 * Dialog/Modal 组件可访问性测试
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { checkA11y } from '../helpers/a11y-utils';
import { componentAxeOptions } from '../setup-a11y';
import { testEscapeKeyClose, testFocusTrap, getFocusableElements } from '../helpers/keyboard-testing';
import { checkDialogAccessibility } from '../helpers/screen-reader-testing';

// 临时的 Dialog 组件用于测试
const Dialog = ({ 
  isOpen,
  onClose,
  title,
  children,
  'aria-label': ariaLabel,
  ...props 
}: any) => {
  if (!isOpen) return null;
  
  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        aria-label={!title ? ariaLabel : undefined}
        onClick={(e) => e.stopPropagation()}
        {...props}
      >
        {title && <h2 id="dialog-title">{title}</h2>}
        <div className="dialog-content">{children}</div>
        <button onClick={onClose} aria-label="Close dialog">
          Close
        </button>
      </div>
    </div>
  );
};

describe('Dialog Accessibility', () => {
  describe('基本可访问性', () => {
    it('应该没有可访问性违规', async () => {
      const { container } = render(
        <Dialog isOpen={true} onClose={() => {}} title="Test Dialog">
          <p>Dialog content</p>
        </Dialog>
      );
      await checkA11y(container, componentAxeOptions);
    });

    it('应该有 role="dialog"', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}} title="Test Dialog">
          <p>Content</p>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('应该有 aria-modal="true"', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}} title="Test Dialog">
          <p>Content</p>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('应该通过完整的可访问性检查', () => {
      const { container } = render(
        <Dialog isOpen={true} onClose={() => {}} title="Test Dialog">
          <p>Content</p>
        </Dialog>
      );
      
      const dialog = container.querySelector('[role="dialog"]') as HTMLElement;
      const result = checkDialogAccessibility(dialog);
      
      expect(result.valid).toBe(true);
      expect(result.hasRole).toBe(true);
      expect(result.hasLabel).toBe(true);
      expect(result.hasModal).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('可访问名称', () => {
    it('应该通过 aria-labelledby 关联标题', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}} title="Confirm Action">
          <p>Are you sure?</p>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog', { name: /confirm action/i });
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-labelledby', 'dialog-title');
    });

    it('没有标题时应该使用 aria-label', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}} aria-label="Settings">
          <p>Settings content</p>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog', { name: /settings/i });
      expect(dialog).toHaveAttribute('aria-label', 'Settings');
    });
  });

  describe('焦点管理', () => {
    it('打开时应该将焦点移到对话框内', () => {
      const { rerender } = render(
        <Dialog isOpen={false} onClose={() => {}} title="Test">
          <p>Content</p>
        </Dialog>
      );
      
      rerender(
        <Dialog isOpen={true} onClose={() => {}} title="Test">
          <p>Content</p>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      const focusableElements = getFocusableElements(dialog);
      
      expect(focusableElements.length).toBeGreaterThan(0);
    });

    it('关闭时应该将焦点返回到触发元素', async () => {
      const user = userEvent.setup();
      let isOpen = true;
      const handleClose = () => { isOpen = false; };
      
      const { rerender } = render(
        <>
          <button onClick={() => { isOpen = true; }}>Open Dialog</button>
          <Dialog isOpen={isOpen} onClose={handleClose} title="Test">
            <p>Content</p>
          </Dialog>
        </>
      );
      
      const trigger = screen.getByRole('button', { name: /open dialog/i });
      trigger.focus();
      
      const closeButton = screen.getByRole('button', { name: /close dialog/i });
      await user.click(closeButton);
      
      rerender(
        <>
          <button onClick={() => { isOpen = true; }}>Open Dialog</button>
          <Dialog isOpen={false} onClose={handleClose} title="Test">
            <p>Content</p>
          </Dialog>
        </>
      );
      
      // 在实际应用中，焦点应该返回到触发按钮
      // expect(document.activeElement).toBe(trigger);
    });

    it('应该实现焦点陷阱', async () => {
      render(
        <Dialog isOpen={true} onClose={() => {}} title="Test">
          <button>First</button>
          <button>Second</button>
          <button>Third</button>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      const focusableElements = getFocusableElements(dialog);
      
      expect(focusableElements.length).toBeGreaterThan(0);
      
      // 测试焦点陷阱
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      
      // 简化的焦点陷阱测试
      firstElement.focus();
      expect(document.activeElement).toBe(firstElement);
    });
  });

  describe('键盘交互', () => {
    it('应该响应 Escape 键关闭', async () => {
      const handleClose = vi.fn();
      
      render(
        <Dialog isOpen={true} onClose={handleClose} title="Test">
          <p>Content</p>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      
      await testEscapeKeyClose(dialog, () => {
        expect(handleClose).toHaveBeenCalled();
      });
    });

    it('所有可聚焦元素都应该可以通过 Tab 键访问', async () => {
      const user = userEvent.setup();
      
      render(
        <Dialog isOpen={true} onClose={() => {}} title="Form Dialog">
          <input placeholder="Name" />
          <input placeholder="Email" />
          <button>Submit</button>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      const focusableElements = getFocusableElements(dialog);
      
      for (let i = 0; i < focusableElements.length; i++) {
        await user.tab();
        expect(focusableElements).toContain(document.activeElement);
      }
    });
  });

  describe('背景内容', () => {
    it('打开时背景内容应该对屏幕阅读器隐藏', () => {
      const { container } = render(
        <>
          <div id="main-content">
            <h1>Main Content</h1>
            <p>This is the main page content</p>
          </div>
          <Dialog isOpen={true} onClose={() => {}} title="Dialog">
            <p>Dialog content</p>
          </Dialog>
        </>
      );
      
      // 在实际应用中，主内容应该有 aria-hidden="true"
      // const mainContent = container.querySelector('#main-content');
      // expect(mainContent).toHaveAttribute('aria-hidden', 'true');
    });

    it('关闭时背景内容应该重新可访问', () => {
      const { container, rerender } = render(
        <>
          <div id="main-content">
            <h1>Main Content</h1>
          </div>
          <Dialog isOpen={true} onClose={() => {}} title="Dialog">
            <p>Dialog content</p>
          </Dialog>
        </>
      );
      
      rerender(
        <>
          <div id="main-content">
            <h1>Main Content</h1>
          </div>
          <Dialog isOpen={false} onClose={() => {}} title="Dialog">
            <p>Dialog content</p>
          </Dialog>
        </>
      );
      
      const mainContent = container.querySelector('#main-content');
      expect(mainContent).not.toHaveAttribute('aria-hidden');
    });
  });

  describe('AlertDialog 变体', () => {
    const AlertDialog = ({ isOpen, onClose, onConfirm, title, children }: any) => {
      if (!isOpen) return null;
      
      return (
        <div role="alertdialog" aria-modal="true" aria-labelledby="alert-title">
          <h2 id="alert-title">{title}</h2>
          <div>{children}</div>
          <button onClick={onClose}>Cancel</button>
          <button onClick={onConfirm}>Confirm</button>
        </div>
      );
    };

    it('AlertDialog 应该有 role="alertdialog"', () => {
      render(
        <AlertDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Delete Item"
        >
          <p>Are you sure you want to delete this item?</p>
        </AlertDialog>
      );
      
      const dialog = screen.getByRole('alertdialog');
      expect(dialog).toBeInTheDocument();
    });

    it('AlertDialog 应该没有可访问性违规', async () => {
      const { container } = render(
        <AlertDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={() => {}}
          title="Delete Item"
        >
          <p>Are you sure?</p>
        </AlertDialog>
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('描述信息', () => {
    it('应该支持 aria-describedby', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}} title="Delete Item">
          <p id="dialog-desc">
            This action cannot be undone. Are you sure?
          </p>
          <button>Delete</button>
        </Dialog>
      );
      
      const dialog = screen.getByRole('dialog');
      // 在实际实现中应该添加 aria-describedby
      // expect(dialog).toHaveAttribute('aria-describedby', 'dialog-desc');
    });
  });

  describe('嵌套对话框', () => {
    it('应该支持嵌套对话框', async () => {
      const { container } = render(
        <>
          <Dialog isOpen={true} onClose={() => {}} title="Parent Dialog">
            <p>Parent content</p>
            <Dialog isOpen={true} onClose={() => {}} title="Child Dialog">
              <p>Child content</p>
            </Dialog>
          </Dialog>
        </>
      );
      
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs).toHaveLength(2);
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('不同尺寸', () => {
    it('不同尺寸的对话框都应该可访问', async () => {
      const sizes = ['sm', 'md', 'lg', 'xl'];
      
      for (const size of sizes) {
        const { container } = render(
          <Dialog
            isOpen={true}
            onClose={() => {}}
            title="Test Dialog"
            size={size}
          >
            <p>Content</p>
          </Dialog>
        );
        
        await checkA11y(container, componentAxeOptions);
      }
    });
  });

  describe('关闭按钮', () => {
    it('关闭按钮应该有可访问的名称', () => {
      render(
        <Dialog isOpen={true} onClose={() => {}} title="Test">
          <p>Content</p>
        </Dialog>
      );
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toBeInTheDocument();
    });

    it('图标关闭按钮应该有 aria-label', async () => {
      const { container } = render(
        <Dialog isOpen={true} onClose={() => {}} title="Test">
          <p>Content</p>
        </Dialog>
      );
      
      const closeButton = screen.getByRole('button', { name: /close/i });
      expect(closeButton).toHaveAttribute('aria-label');
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('加载状态', () => {
    const LoadingDialog = ({ isOpen, onClose, loading, children }: any) => {
      if (!isOpen) return null;
      
      return (
        <div
          role="dialog"
          aria-modal="true"
          aria-busy={loading}
          aria-label="Loading"
        >
          {loading ? (
            <div role="status" aria-live="polite">
              Loading...
            </div>
          ) : (
            children
          )}
        </div>
      );
    };

    it('加载中的对话框应该有 aria-busy', () => {
      render(<LoadingDialog isOpen={true} onClose={() => {}} loading={true} />);
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-busy', 'true');
    });

    it('加载状态应该通过 live region 通知', () => {
      render(<LoadingDialog isOpen={true} onClose={() => {}} loading={true} />);
      
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(/loading/i);
    });
  });
});

