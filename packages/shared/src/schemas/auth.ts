import { z } from 'zod'

export const emailSchema = z
  .string()
  .min(1, 'Email is required')
  .email('Enter a valid email address')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password is too long')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
})

export type LoginFormData = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: emailSchema,
  password: passwordSchema,
  pdpaConsent: z.boolean().refine((v) => v === true, 'You must consent to data collection'),
})

export type RegisterFormData = z.infer<typeof registerSchema>
