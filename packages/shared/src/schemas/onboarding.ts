import { z } from 'zod'

import { isValidPlate, normalisePlate } from '../utils/plate'

const currentYear = new Date().getFullYear()

/** Oldest model year a vehicle may be to drive e-hailing on Teeko. */
export const VEHICLE_MIN_YEAR = currentYear - 15

// Messages are i18n keys (see schemas/auth.ts); `validation.yearMin` takes a
// `{{year}}` param, which the form supplies as VEHICLE_MIN_YEAR.
export const vehicleDetailsSchema = z.object({
  make: z.string().min(1, 'validation.makeRequired').max(50, 'validation.tooLong'),
  makeOther: z.string().max(50, 'validation.tooLong').optional(),
  model: z.string().min(1, 'validation.modelRequired').max(100, 'validation.tooLong'),
  year: z
    .number({ invalid_type_error: 'validation.yearInvalid' })
    .int('validation.yearInvalid')
    .min(VEHICLE_MIN_YEAR, 'validation.yearMin')
    .max(currentYear, 'validation.yearFuture'),
  // Stored canonical ('WKK1234'); the driver may type it with spaces or in
  // lowercase. Same normaliser the backend applies, so the two can't disagree.
  plateNumber: z
    .string()
    .min(1, 'validation.plateRequired')
    .transform(normalisePlate)
    .refine(isValidPlate, 'validation.plateInvalid'),
  colour: z.string().min(1, 'validation.colourRequired').max(30, 'validation.tooLong'),
})

export type VehicleDetailsFormData = z.infer<typeof vehicleDetailsSchema>

export const documentUploadSchema = z.object({
  file: z
    .instanceof(File, { message: 'validation.fileRequired' })
    .refine((f) => f.size <= 10 * 1024 * 1024, 'documents.sizeError')
    .refine(
      (f) => ['image/jpeg', 'image/png', 'application/pdf'].includes(f.type),
      'documents.typeError'
    ),
})
