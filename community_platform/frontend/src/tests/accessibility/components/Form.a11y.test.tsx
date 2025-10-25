/**
 * Form 组件可访问性测试
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { checkA11y } from '../helpers/a11y-utils';
import { componentAxeOptions } from '../setup-a11y';
import { checkFormLabels } from '../helpers/a11y-utils';

// 临时的 Form 组件用于测试
const Form = ({ children, onSubmit, ...props }: any) => (
  <form onSubmit={onSubmit} {...props}>
    {children}
  </form>
);

const FormField = ({ 
  label, 
  name, 
  type = 'text',
  required = false,
  error,
  ...props 
}: any) => {
  const id = `field-${name}`;
  const errorId = `${id}-error`;
  
  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {required && <span aria-label="required"> *</span>}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        aria-required={required}
        aria-invalid={!!error}
        aria-describedby={error ? errorId : undefined}
        {...props}
      />
      {error && (
        <div id={errorId} role="alert" className="error-message">
          {error}
        </div>
      )}
    </div>
  );
};

const Checkbox = ({ label, name, ...props }: any) => {
  const id = `checkbox-${name}`;
  
  return (
    <div className="checkbox-field">
      <input
        id={id}
        name={name}
        type="checkbox"
        {...props}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
};

const Radio = ({ label, name, value, ...props }: any) => {
  const id = `radio-${name}-${value}`;
  
  return (
    <div className="radio-field">
      <input
        id={id}
        name={name}
        type="radio"
        value={value}
        {...props}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
};

const RadioGroup = ({ legend, children, ...props }: any) => (
  <fieldset {...props}>
    <legend>{legend}</legend>
    {children}
  </fieldset>
);

describe('Form Accessibility', () => {
  describe('基本可访问性', () => {
    it('简单表单应该没有可访问性违规', async () => {
      const { container } = render(
        <Form>
          <FormField label="Name" name="name" />
          <FormField label="Email" name="email" type="email" />
          <button type="submit">Submit</button>
        </Form>
      );
      
      await checkA11y(container, componentAxeOptions);
    });

    it('所有输入字段都应该有标签', () => {
      const { container } = render(
        <Form>
          <FormField label="Username" name="username" />
          <FormField label="Password" name="password" type="password" />
        </Form>
      );
      
      const result = checkFormLabels(container);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('必填字段', () => {
    it('必填字段应该有 aria-required', () => {
      render(<FormField label="Name" name="name" required />);
      
      const input = screen.getByLabelText(/name/i);
      expect(input).toHaveAttribute('aria-required', 'true');
    });

    it('必填标记应该可以被屏幕阅读器识别', () => {
      render(<FormField label="Email" name="email" required />);
      
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/required/i)).toBeInTheDocument();
    });

    it('必填字段应该没有可访问性违规', async () => {
      const { container } = render(
        <Form>
          <FormField label="Name" name="name" required />
          <FormField label="Email" name="email" type="email" required />
        </Form>
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('表单验证', () => {
    it('错误消息应该与输入框关联', () => {
      render(
        <FormField
          label="Email"
          name="email"
          error="Please enter a valid email"
        />
      );
      
      const input = screen.getByLabelText(/email/i);
      const error = screen.getByRole('alert');
      
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
      expect(error).toHaveTextContent(/please enter a valid email/i);
    });

    it('错误消息应该有 role="alert"', () => {
      render(
        <FormField
          label="Password"
          name="password"
          error="Password is required"
        />
      );
      
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/password is required/i);
    });

    it('表单验证错误应该没有可访问性违规', async () => {
      const { container } = render(
        <Form>
          <FormField
            label="Email"
            name="email"
            error="Invalid email"
          />
          <FormField
            label="Password"
            name="password"
            error="Password too short"
          />
        </Form>
      );
      
      await checkA11y(container, componentAxeOptions);
    });

    it('表单级别的错误应该通过 live region 通知', () => {
      const FormError = ({ message }: any) => (
        <div role="alert" aria-live="assertive" className="form-error">
          {message}
        </div>
      );
      
      render(
        <Form>
          <FormError message="Please fix the errors below" />
          <FormField label="Email" name="email" error="Invalid email" />
        </Form>
      );
      
      const alerts = screen.getAllByRole('alert');
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('Fieldset 和 Legend', () => {
    it('相关字段应该使用 fieldset 分组', async () => {
      const { container } = render(
        <Form>
          <RadioGroup legend="Select your plan">
            <Radio label="Basic" name="plan" value="basic" />
            <Radio label="Pro" name="plan" value="pro" />
            <Radio label="Enterprise" name="plan" value="enterprise" />
          </RadioGroup>
        </Form>
      );
      
      const fieldset = container.querySelector('fieldset');
      expect(fieldset).toBeInTheDocument();
      
      const legend = container.querySelector('legend');
      expect(legend).toHaveTextContent(/select your plan/i);
      
      await checkA11y(container, componentAxeOptions);
    });

    it('复选框组应该使用 fieldset', async () => {
      const { container } = render(
        <Form>
          <fieldset>
            <legend>Select your interests</legend>
            <Checkbox label="Sports" name="interests" value="sports" />
            <Checkbox label="Music" name="interests" value="music" />
            <Checkbox label="Art" name="interests" value="art" />
          </fieldset>
        </Form>
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('复选框', () => {
    it('复选框应该有关联的标签', () => {
      render(<Checkbox label="I agree to terms" name="terms" />);
      
      const checkbox = screen.getByRole('checkbox', { name: /i agree to terms/i });
      expect(checkbox).toBeInTheDocument();
    });

    it('复选框应该没有可访问性违规', async () => {
      const { container } = render(
        <Form>
          <Checkbox label="Subscribe to newsletter" name="subscribe" />
          <Checkbox label="Remember me" name="remember" />
        </Form>
      );
      
      await checkA11y(container, componentAxeOptions);
    });

    it('复选框应该支持键盘操作', async () => {
      const user = userEvent.setup();
      render(<Checkbox label="Accept terms" name="terms" />);
      
      const checkbox = screen.getByRole('checkbox') as HTMLInputElement;
      
      await user.tab();
      expect(document.activeElement).toBe(checkbox);
      
      await user.keyboard(' '); // Space to toggle
      expect(checkbox.checked).toBe(true);
      
      await user.keyboard(' ');
      expect(checkbox.checked).toBe(false);
    });
  });

  describe('单选按钮', () => {
    it('单选按钮应该有关联的标签', () => {
      render(
        <RadioGroup legend="Choose size">
          <Radio label="Small" name="size" value="s" />
          <Radio label="Medium" name="size" value="m" />
          <Radio label="Large" name="size" value="l" />
        </RadioGroup>
      );
      
      expect(screen.getByRole('radio', { name: /small/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /medium/i })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /large/i })).toBeInTheDocument();
    });

    it('单选按钮组应该没有可访问性违规', async () => {
      const { container } = render(
        <Form>
          <RadioGroup legend="Payment method">
            <Radio label="Credit Card" name="payment" value="card" />
            <Radio label="PayPal" name="payment" value="paypal" />
            <Radio label="Bank Transfer" name="payment" value="bank" />
          </RadioGroup>
        </Form>
      );
      
      await checkA11y(container, componentAxeOptions);
    });

    it('单选按钮应该支持箭头键导航', async () => {
      const user = userEvent.setup();
      render(
        <RadioGroup legend="Size">
          <Radio label="Small" name="size" value="s" />
          <Radio label="Medium" name="size" value="m" />
          <Radio label="Large" name="size" value="l" />
        </RadioGroup>
      );
      
      const radios = screen.getAllByRole('radio') as HTMLInputElement[];
      
      radios[0].focus();
      expect(document.activeElement).toBe(radios[0]);
      
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(radios[1]);
      
      await user.keyboard('{ArrowDown}');
      expect(document.activeElement).toBe(radios[2]);
    });
  });

  describe('Select 下拉框', () => {
    const Select = ({ label, name, options, ...props }: any) => {
      const id = `select-${name}`;
      return (
        <>
          <label htmlFor={id}>{label}</label>
          <select id={id} name={name} {...props}>
            {options.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </>
      );
    };

    it('Select 应该有关联的标签', () => {
      render(
        <Select
          label="Country"
          name="country"
          options={[
            { value: 'us', label: 'United States' },
            { value: 'uk', label: 'United Kingdom' },
            { value: 'ca', label: 'Canada' },
          ]}
        />
      );
      
      const select = screen.getByLabelText(/country/i);
      expect(select).toBeInTheDocument();
    });

    it('Select 应该没有可访问性违规', async () => {
      const { container } = render(
        <Form>
          <Select
            label="Language"
            name="language"
            options={[
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Spanish' },
              { value: 'fr', label: 'French' },
            ]}
          />
        </Form>
      );
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('表单提交', () => {
    it('提交按钮应该有可访问的名称', () => {
      render(
        <Form>
          <button type="submit">Submit Form</button>
        </Form>
      );
      
      const button = screen.getByRole('button', { name: /submit form/i });
      expect(button).toBeInTheDocument();
    });

    it('应该可以通过 Enter 键提交', async () => {
      const user = userEvent.setup();
      let submitted = false;
      const handleSubmit = (e: any) => {
        e.preventDefault();
        submitted = true;
      };
      
      render(
        <Form onSubmit={handleSubmit}>
          <FormField label="Name" name="name" />
          <button type="submit">Submit</button>
        </Form>
      );
      
      const input = screen.getByLabelText(/name/i);
      await user.click(input);
      await user.keyboard('{Enter}');
      
      expect(submitted).toBe(true);
    });
  });

  describe('禁用状态', () => {
    it('禁用的表单字段应该有 disabled 属性', () => {
      render(<FormField label="Name" name="name" disabled />);
      
      const input = screen.getByLabelText(/name/i);
      expect(input).toBeDisabled();
    });

    it('禁用的字段不应该可以通过 Tab 键聚焦', async () => {
      const user = userEvent.setup();
      render(
        <Form>
          <FormField label="First" name="first" />
          <FormField label="Disabled" name="disabled" disabled />
          <FormField label="Last" name="last" />
        </Form>
      );
      
      await user.tab();
      expect(document.activeElement).toBe(screen.getByLabelText(/first/i));
      
      await user.tab();
      expect(document.activeElement).toBe(screen.getByLabelText(/last/i));
    });
  });

  describe('自动完成', () => {
    it('应该使用适当的 autocomplete 属性', async () => {
      const { container } = render(
        <Form>
          <FormField label="Name" name="name" autoComplete="name" />
          <FormField label="Email" name="email" type="email" autoComplete="email" />
          <FormField label="Phone" name="phone" type="tel" autoComplete="tel" />
        </Form>
      );
      
      expect(screen.getByLabelText(/name/i)).toHaveAttribute('autocomplete', 'name');
      expect(screen.getByLabelText(/email/i)).toHaveAttribute('autocomplete', 'email');
      expect(screen.getByLabelText(/phone/i)).toHaveAttribute('autocomplete', 'tel');
      
      await checkA11y(container, componentAxeOptions);
    });
  });

  describe('多步骤表单', () => {
    const MultiStepForm = ({ currentStep }: any) => (
      <Form aria-label={`Step ${currentStep} of 3`}>
        <div role="status" aria-live="polite" aria-atomic="true">
          Step {currentStep} of 3
        </div>
        {currentStep === 1 && <FormField label="Name" name="name" />}
        {currentStep === 2 && <FormField label="Email" name="email" />}
        {currentStep === 3 && <FormField label="Phone" name="phone" />}
      </Form>
    );

    it('应该通过 live region 通知步骤变化', () => {
      render(<MultiStepForm currentStep={1} />);
      
      const status = screen.getByRole('status');
      expect(status).toHaveTextContent(/step 1 of 3/i);
    });

    it('多步骤表单应该没有可访问性违规', async () => {
      const { container } = render(<MultiStepForm currentStep={2} />);
      await checkA11y(container, componentAxeOptions);
    });
  });
});

