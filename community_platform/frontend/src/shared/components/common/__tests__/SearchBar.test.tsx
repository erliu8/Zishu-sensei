/**
 * SearchBar 组件单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../SearchBar';

describe('SearchBar', () => {
  it('should render search input', () => {
    render(<SearchBar placeholder="Search..." />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('should handle input changes', async () => {
    const handleChange = vi.fn();
    const user = userEvent.setup();
    
    render(<SearchBar onChange={handleChange} />);
    
    const input = screen.getByRole('searchbox');
    await user.type(input, 'test query');
    
    expect(handleChange).toHaveBeenCalled();
    expect(input).toHaveValue('test query');
  });

  it('should call onSearch when form is submitted', async () => {
    const handleSearch = vi.fn();
    const user = userEvent.setup();
    
    render(<SearchBar onSearch={handleSearch} />);
    
    const input = screen.getByRole('searchbox');
    await user.type(input, 'test query');
    await user.keyboard('{Enter}');
    
    expect(handleSearch).toHaveBeenCalledWith('test query');
  });

  it('should show clear button when input has value', async () => {
    const user = userEvent.setup();
    
    render(<SearchBar />);
    
    const input = screen.getByRole('searchbox');
    
    // No clear button initially
    expect(screen.queryByLabelText('清除搜索')).not.toBeInTheDocument();
    
    // Type something
    await user.type(input, 'test');
    
    // Clear button should appear
    expect(screen.getByLabelText('清除搜索')).toBeInTheDocument();
  });

  it('should clear input when clear button is clicked', async () => {
    const handleClear = vi.fn();
    const user = userEvent.setup();
    
    render(<SearchBar onClear={handleClear} />);
    
    const input = screen.getByRole('searchbox');
    await user.type(input, 'test query');
    
    const clearButton = screen.getByLabelText('清除搜索');
    await user.click(clearButton);
    
    expect(input).toHaveValue('');
    expect(handleClear).toHaveBeenCalled();
  });

  it('should show loading spinner when loading', () => {
    render(<SearchBar loading />);
    
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('should not show clear button when loading', async () => {
    const user = userEvent.setup();
    
    render(<SearchBar loading value="test" />);
    
    expect(screen.queryByLabelText('清除搜索')).not.toBeInTheDocument();
  });

  it('should display suggestions when input is focused', async () => {
    const suggestions = ['React', 'React Native', 'React Router'];
    const user = userEvent.setup();
    
    render(<SearchBar suggestions={suggestions} />);
    
    const input = screen.getByRole('searchbox');
    await user.type(input, 'Rea');
    
    await waitFor(() => {
      suggestions.forEach((suggestion) => {
        expect(screen.getByText(suggestion)).toBeInTheDocument();
      });
    });
  });

  it('should call onSuggestionClick when suggestion is clicked', async () => {
    const handleSuggestionClick = vi.fn();
    const suggestions = ['React', 'Vue', 'Angular'];
    const user = userEvent.setup();
    
    render(
      <SearchBar
        suggestions={suggestions}
        onSuggestionClick={handleSuggestionClick}
      />
    );
    
    const input = screen.getByRole('searchbox');
    await user.type(input, 'R');
    
    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument();
    });
    
    await user.click(screen.getByText('React'));
    
    expect(handleSuggestionClick).toHaveBeenCalledWith('React');
    expect(input).toHaveValue('React');
  });

  it('should hide suggestions when clicking outside', async () => {
    const suggestions = ['React', 'Vue'];
    const user = userEvent.setup();
    
    render(
      <div>
        <SearchBar suggestions={suggestions} />
        <button>Outside</button>
      </div>
    );
    
    const input = screen.getByRole('searchbox');
    await user.type(input, 'R');
    
    await waitFor(() => {
      expect(screen.getByText('React')).toBeInTheDocument();
    });
    
    // Click outside
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    
    await waitFor(() => {
      expect(screen.queryByText('React')).not.toBeInTheDocument();
    });
  });

  it('should not show suggestions when input is empty', async () => {
    const suggestions = ['React', 'Vue'];
    
    render(<SearchBar suggestions={suggestions} />);
    
    const input = screen.getByRole('searchbox');
    input.focus();
    
    expect(screen.queryByText('React')).not.toBeInTheDocument();
  });

  it('should support different sizes', () => {
    const { rerender } = render(<SearchBar size="sm" />);
    expect(screen.getByRole('searchbox')).toHaveClass('h-8');

    rerender(<SearchBar size="md" />);
    expect(screen.getByRole('searchbox')).toHaveClass('h-10');

    rerender(<SearchBar size="lg" />);
    expect(screen.getByRole('searchbox')).toHaveClass('h-12');
  });

  it('should work as controlled component', async () => {
    const handleChange = vi.fn((e) => e.target.value);
    const user = userEvent.setup();
    
    const { rerender } = render(
      <SearchBar value="" onChange={handleChange} />
    );
    
    const input = screen.getByRole('searchbox');
    await user.type(input, 'test');
    
    expect(handleChange).toHaveBeenCalled();
    
    // Update with controlled value
    rerender(<SearchBar value="controlled" onChange={handleChange} />);
    expect(input).toHaveValue('controlled');
  });

  it('should forward ref to input element', () => {
    const ref = vi.fn();
    render(<SearchBar ref={ref} />);
    expect(ref).toHaveBeenCalled();
  });

  it('should have search icon', () => {
    render(<SearchBar />);
    
    // Check for search icon SVG with the path
    const searchIcon = document.querySelector('path[d*="M21 21l-6-6"]');
    expect(searchIcon).toBeInTheDocument();
  });

  it('should accept custom className', () => {
    render(<SearchBar className="custom-search" />);
    
    const wrapper = document.querySelector('.custom-search');
    expect(wrapper).toBeInTheDocument();
  });

  it('should pass through additional input attributes', () => {
    render(
      <SearchBar
        data-testid="search-input"
        autoComplete="off"
        maxLength={50}
      />
    );
    
    const input = screen.getByTestId('search-input');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('maxlength', '50');
  });
});

