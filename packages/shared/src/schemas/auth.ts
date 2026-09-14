import { z } from 'zod'

import { resolveDriverPhone } from '../utils/phone'

// Every message here is an i18n key under `validation.*`, not copy: the form
// renders `t(errors.field.message)`, so the same schema serves all four
// portal languages. Keep the keys in sync with locales/*.json.

export const emailSchema = z
  .string()
  .min(1, 'validation.emailRequired')
  .email('validation.emailInvalid')

export const passwordSchema = z
  .string()
  .min(8, 'validation.passwordMin')
  .max(72, 'validation.passwordMax')

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'validation.passwordRequired'),
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
  .min(1, 'validation.phoneRequired')
  .max(24, 'validation.phoneInvalid')
  .superRefine((value, ctx) => {
    const resolved = resolveDriverPhone({ nationalNumber: value })
    if (resolved.ok) return
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        resolved.error === 'phone_country_not_allowed'
          ? 'validation.phoneCountry'
          : 'validation.phoneInvalid',
    })
  })

export const registerSchema = z.object({
  fullName: z.string().min(2, 'validation.fullNameMin').max(100, 'validation.fullNameMax'),
  email: emailSchema,
  phone: driverPhoneSchema,
  password: passwordSchema,
  pdpaConsent: z.boolean().refine((v) => v === true, 'validation.pdpaRequired'),
})

export type RegisterFormData = z.infer<typeof registerSchema>
