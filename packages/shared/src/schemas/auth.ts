import { z } from 'zod'

// Malaysian phone: +60 followed by 9-10 digits (mobile starts with 01)
export const phoneSchema = z
  .string()
  .regex(/^(\+?60|0)(1[0-9])[0-9]{7,8}$/, 'Enter a valid Malaysian mobile number')

export const otpSchema = z
  .string()
  .length(6, 'OTP must be 6 digits')
  .regex(/^\d{6}$/, 'OTP must be numeric')

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().email('Enter a valid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  pdpaConsent: z.boolean().refine((v) => v === true, 'You must consent to data collection'),
})

export type RegisterFormData = z.infer<typeof registerSchema>
