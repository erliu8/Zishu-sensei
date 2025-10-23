/**
 * 认证组件导出
 *
 * 包含所有认证相关的 UI 组件
 */

export { LoginForm, type LoginFormProps } from './LoginForm';
export { RegisterForm, type RegisterFormProps } from './RegisterForm';
export {
  ForgotPasswordForm,
  type ForgotPasswordFormProps,
} from './ForgotPasswordForm';
export {
  ResetPasswordForm,
  type ResetPasswordFormProps,
} from './ResetPasswordForm';
export {
  VerifyEmailForm,
  type VerifyEmailFormProps,
  type VerifyEmailStatus,
} from './VerifyEmailForm';
export {
  SocialLogin,
  SocialLoginDivider,
  type SocialLoginProps,
  type SocialProvider,
} from './SocialLogin';

