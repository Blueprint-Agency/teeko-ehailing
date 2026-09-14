import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Zod schemas in @teeko/shared emit i18n keys ('validation.emailInvalid') as
 * messages, not copy. This turns a react-hook-form `errors.x?.message` into
 * the translated string, with optional interpolation params.
 */
export function useFieldError() {
  const { t } = useTranslation()
  return useCallback(
    (message: string | undefined, params?: Record<string, unknown>): string | undefined =>
      message ? t(message, params) : undefined,
    [t],
  )
}
