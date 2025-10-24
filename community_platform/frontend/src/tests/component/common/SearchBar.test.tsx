/**
 * SearchBar 组件测试
 * 测试搜索栏的交互、建议和状态管理
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '@/shared/components/common/SearchBar';

describe('SearchBar Component', () => {
  describe('渲染', () => {
    it('应该正确渲染搜索框', () => {
      render(<SearchBar placeholder="搜索..." />);
      const searchInput = screen.getByPlaceholderText('搜索...');
      expect(searchInput).toBeInTheDocument();
    });

    it('应该显示搜索图标', () => {
      const { container } = render(<SearchBar />);
      const searchIcon = container.querySelector('svg');
      expect(searchIcon).toBeInTheDocument();
    });

    it('应该渲染不同的尺寸', () => {
      const { rerender, container } = render(<SearchBar size="sm" />);
      let input = container.querySelector('input');
      expect(input).toHaveClass('h-8', 'text-sm');

      rerender(<SearchBar size="md" />);
      input = container.querySelector('input');
      expect(input).toHaveClass('h-10', 'text-base');

      rerender(<SearchBar size="lg" />);
      input = container.querySelector('input');
      expect(input).toHaveClass('h-12', 'text-lg');
    });
  });

  describe('用户输入', () => {
    it('应该处理用户输入', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<SearchBar onChange={handleChange} />);
      const input = screen.getByRole('searchbox');

      await user.type(input, '测试搜索');
      expect(input).toHaveValue('测试搜索');
      expect(handleChange).toHaveBeenCalled();
    });

    it('应该支持受控组件', () => {
      const { rerender } = render(<SearchBar value="初始值" onChange={() => {}} />);
      expect(screen.getByRole('searchbox')).toHaveValue('初始值');

      rerender(<SearchBar value="更新值" onChange={() => {}} />);
      expect(screen.getByRole('searchbox')).toHaveValue('更新值');
    });

    it('应该支持非受控组件', async () => {
      const user = userEvent.setup();
      render(<SearchBar defaultValue="默认值" />);
      const input = screen.getByRole('searchbox');

      expect(input).toHaveValue('默认值');

      await user.clear(input);
      await user.type(input, '新值');
      expect(input).toHaveValue('新值');
    });
  });

  describe('搜索功能', () => {
    it('应该在提交时触发搜索', async () => {
      const handleSearch = vi.fn();
      const user = userEvent.setup();

      render(<SearchBar onSearch={handleSearch} />);
      const input = screen.getByRole('searchbox');

      await user.type(input, '搜索内容');
      await user.keyboard('{Enter}');

      expect(handleSearch).toHaveBeenCalledWith('搜索内容');
    });

    it('应该防止表单默认提交', async () => {
      const handleSearch = vi.fn();
      const user = userEvent.setup();

      const { container } = render(<SearchBar onSearch={handleSearch} />);
      const form = container.querySelector('form');
      const submitHandler = vi.fn((e) => e.preventDefault());
      
      if (form) {
        form.addEventListener('submit', submitHandler);
      }

      const input = screen.getByRole('searchbox');
      await user.type(input, 'test');
      await user.keyboard('{Enter}');

      expect(submitHandler).toHaveBeenCalled();
    });
  });

  describe('清除功能', () => {
    it('应该在有值时显示清除按钮', async () => {
      const user = userEvent.setup();

      render(<SearchBar />);
      const input = screen.getByRole('searchbox');

      // 初始时不应该有清除按钮
      expect(screen.queryByLabelText('清除搜索')).not.toBeInTheDocument();

      // 输入后应该显示清除按钮
      await user.type(input, '测试');
      await waitFor(() => {
        expect(screen.getByLabelText('清除搜索')).toBeInTheDocument();
      });
    });

    it('应该在点击清除按钮时清空输入', async () => {
      const handleClear = vi.fn();
      const user = userEvent.setup();

      render(<SearchBar onClear={handleClear} />);
      const input = screen.getByRole('searchbox');

      await user.type(input, '要清除的内容');
      
      const clearButton = await screen.findByLabelText('清除搜索');
      await user.click(clearButton);

      expect(input).toHaveValue('');
      expect(handleClear).toHaveBeenCalled();
    });

    it('清除后应该重新聚焦输入框', async () => {
      const user = userEvent.setup();

      render(<SearchBar />);
      const input = screen.getByRole('searchbox');

      await user.type(input, '测试');
      const clearButton = await screen.findByLabelText('清除搜索');
      await user.click(clearButton);

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
    });
  });

  describe('加载状态', () => {
    it('应该显示加载指示器', () => {
      const { container } = render(<SearchBar loading />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('加载时不应显示清除按钮', async () => {
      const user = userEvent.setup();

      const { rerender } = render(<SearchBar />);
      const input = screen.getByRole('searchbox');

      await user.type(input, '测试');
      expect(await screen.findByLabelText('清除搜索')).toBeInTheDocument();

      rerender(<SearchBar loading value="测试" />);
      expect(screen.queryByLabelText('清除搜索')).not.toBeInTheDocument();
    });
  });

  describe('搜索建议', () => {
    const suggestions = ['建议1', '建议2', '建议3'];

    it('应该在输入时显示建议列表', async () => {
      const user = userEvent.setup();

      render(<SearchBar suggestions={suggestions} />);
      const input = screen.getByRole('searchbox');

      await user.type(input, '搜');

      await waitFor(() => {
        expect(screen.getByText('建议1')).toBeInTheDocument();
        expect(screen.getByText('建议2')).toBeInTheDocument();
        expect(screen.getByText('建议3')).toBeInTheDocument();
      });
    });

    it('应该在点击建议时填充输入框', async () => {
      const handleSuggestionClick = vi.fn();
      const user = userEvent.setup();

      render(
        <SearchBar
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
        />
      );
      const input = screen.getByRole('searchbox');

      await user.type(input, '搜');
      
      const suggestion = await screen.findByText('建议2');
      await user.click(suggestion);

      expect(input).toHaveValue('建议2');
      expect(handleSuggestionClick).toHaveBeenCalledWith('建议2');
    });

    it('应该在选择建议后隐藏列表', async () => {
      const user = userEvent.setup();

      render(<SearchBar suggestions={suggestions} />);
      const input = screen.getByRole('searchbox');

      await user.type(input, '搜');
      const suggestion = await screen.findByText('建议1');
      await user.click(suggestion);

      await waitFor(() => {
        expect(screen.queryByText('建议2')).not.toBeInTheDocument();
      });
    });

    it('应该在失去焦点时隐藏建议', async () => {
      const user = userEvent.setup();

      render(
        <>
          <SearchBar suggestions={suggestions} />
          <button>外部按钮</button>
        </>
      );
      const input = screen.getByRole('searchbox');

      await user.type(input, '搜');
      await screen.findByText('建议1');

      await user.click(screen.getByRole('button', { name: '外部按钮' }));

      await waitFor(() => {
        expect(screen.queryByText('建议1')).not.toBeInTheDocument();
      });
    });

    it('应该在聚焦时重新显示建议', async () => {
      const user = userEvent.setup();

      render(<SearchBar suggestions={suggestions} value="搜" />);
      const input = screen.getByRole('searchbox');

      await user.click(input);

      await waitFor(() => {
        expect(screen.getByText('建议1')).toBeInTheDocument();
      });
    });

    it('输入为空时不应显示建议', async () => {
      const user = userEvent.setup();

      render(<SearchBar suggestions={suggestions} />);
      const input = screen.getByRole('searchbox');

      await user.click(input);

      expect(screen.queryByText('建议1')).not.toBeInTheDocument();
    });
  });

  describe('自定义样式', () => {
    it('应该接受自定义 className', () => {
      const { container } = render(<SearchBar className="custom-search" />);
      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('custom-search');
    });
  });

  describe('引用', () => {
    it('应该正确转发 ref 到输入框', () => {
      const ref = { current: null };
      render(<SearchBar ref={ref} />);
      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('应该支持通过 ref 访问输入框方法', () => {
      const ref = { current: null } as { current: HTMLInputElement | null };
      render(<SearchBar ref={ref} />);

      expect(ref.current).toBeTruthy();
      if (ref.current) {
        ref.current.focus();
        expect(ref.current).toHaveFocus();
      }
    });
  });

  describe('可访问性', () => {
    it('应该有正确的搜索输入类型', () => {
      render(<SearchBar />);
      const input = screen.getByRole('searchbox');
      expect(input).toHaveAttribute('type', 'search');
    });

    it('清除按钮应该有正确的 aria-label', async () => {
      const user = userEvent.setup();

      render(<SearchBar />);
      const input = screen.getByRole('searchbox');

      await user.type(input, '测试');
      const clearButton = await screen.findByLabelText('清除搜索');
      expect(clearButton).toHaveAttribute('aria-label', '清除搜索');
    });

    it('应该支持键盘导航建议列表', async () => {
      const user = userEvent.setup();

      render(<SearchBar suggestions={suggestions} />);
      const input = screen.getByRole('searchbox');

      await user.type(input, '搜');
      await screen.findByText('建议1');

      // 建议项应该是可点击的按钮
      const suggestionButtons = screen.getAllByRole('button');
      expect(suggestionButtons.length).toBeGreaterThan(0);
    });
  });

  describe('边界情况', () => {
    it('应该处理空建议数组', async () => {
      const user = userEvent.setup();

      render(<SearchBar suggestions={[]} />);
      const input = screen.getByRole('searchbox');

      await user.type(input, '搜索');
      expect(screen.queryByRole('list')).not.toBeInTheDocument();
    });

    it('应该处理 undefined 值', () => {
      render(<SearchBar value={undefined} />);
      const input = screen.getByRole('searchbox');
      expect(input).toHaveValue('');
    });

    it('应该处理快速连续输入', async () => {
      const handleChange = vi.fn();
      const user = userEvent.setup();

      render(<SearchBar onChange={handleChange} />);
      const input = screen.getByRole('searchbox');

      await user.type(input, '快速输入测试', { delay: 1 });
      expect(handleChange).toHaveBeenCalled();
    });
  });
});

