import { z } from 'zod';

/**
 * 登录表单验证 Schema
 */
export const loginSchema = z.object({
  email: z
    .string()
    .min(1, { message: '请输入邮箱地址' })
    .email({ message: '请输入有效的邮箱地址' }),
  password: z
    .string()
    .min(1, { message: '请输入密码' })
    .min(6, { message: '密码至少需要 6 个字符' }),
  rememberMe: z.boolean().optional().default(false),
});

export type LoginFormData = z.infer<typeof loginSchema>;

/**
 * 注册表单验证 Schema
 */
export const registerSchema = z
  .object({
    username: z
      .string()
      .min(1, { message: '请输入用户名' })
      .min(3, { message: '用户名至少需要 3 个字符' })
      .max(20, { message: '用户名最多 20 个字符' })
      .regex(/^[a-zA-Z0-9_-]+$/, {
        message: '用户名只能包含字母、数字、下划线和连字符',
      }),
    email: z
      .string()
      .min(1, { message: '请输入邮箱地址' })
      .email({ message: '请输入有效的邮箱地址' }),
    password: z
      .string()
      .min(1, { message: '请输入密码' })
      .min(8, { message: '密码至少需要 8 个字符' })
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: '密码必须包含大小写字母和数字',
      }),
    confirmPassword: z.string().min(1, { message: '请确认密码' }),
    agreeToTerms: z
      .boolean()
      .refine((val) => val === true, {
        message: '您必须同意服务条款和隐私政策',
      }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

export type RegisterFormData = z.infer<typeof registerSchema>;

/**
 * 忘记密码表单验证 Schema
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .min(1, { message: '请输入邮箱地址' })
    .email({ message: '请输入有效的邮箱地址' }),
});

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;

/**
 * 重置密码表单验证 Schema
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, { message: '重置令牌无效' }),
    password: z
      .string()
      .min(1, { message: '请输入新密码' })
      .min(8, { message: '密码至少需要 8 个字符' })
      .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
        message: '密码必须包含大小写字母和数字',
      }),
    confirmPassword: z.string().min(1, { message: '请确认新密码' }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: '两次输入的密码不一致',
    path: ['confirmPassword'],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

