import { z } from 'zod'

import { resolveDriverPhone } from '../utils/phone'

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

/**
 * The driver web portal's phone field: a national number behind a static '+60'.
 *
 * Validated with the same `resolveDriverPhone` the API uses, so the inline
 * message and the server's verdict can never disagree. Malaysian mobiles only —
 * a landline cannot take the call a rider places mid-trip.
 */
export const driverPhoneSchema = z
  .string()
  .min(1, 'Enter your phone number')
  .max(24)
  .superRefine((value, ctx) => {
    const resolved = resolveDriverPhone({ nationalNumber: value })
    if (resolved.ok) return
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        resolved.error === 'phone_country_not_allowed'
          ? 'Drivers must register a Malaysian (+60) number'
          : 'Enter a Malaysian mobile number',
    })
  })

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: emailSchema,
  phone: driverPhoneSchema,
  password: passwordSchema,
  pdpaConsent: z.boolean().refine((v) => v === true, 'You must consent to data collection'),
})

export type RegisterFormData = z.infer<typeof registerSchema>
