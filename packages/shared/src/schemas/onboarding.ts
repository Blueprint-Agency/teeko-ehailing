import { z } from 'zod'

const currentYear = new Date().getFullYear()

export const vehicleDetailsSchema = z.object({
  make: z.string().min(1, 'Vehicle make is required').max(50),
  model: z.string().min(1, 'Vehicle model is required').max(100),
  year: z
    .number({ invalid_type_error: 'Enter a valid year' })
    .int()
    .min(currentYear - 15, `Vehicle must be manufactured within the last 15 years`)
    .max(currentYear, 'Year cannot be in the future'),
  plateNumber: z
    .string()
    .min(3, 'Enter a valid plate number')
    .max(10)
    .regex(/^[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{0,2}$/, 'Enter a valid Malaysian plate number (e.g. WKK 1234)'),
  colour: z.string().min(1, 'Vehicle colour is required').max(30),
})

export type VehicleDetailsFormData = z.infer<typeof vehicleDetailsSchema>

export const documentUploadSchema = z.object({
  file: z
    .instanceof(File, { message: 'Please upload a file' })
    .refine((f) => f.size <= 10 * 1024 * 1024, 'File must be under 10 MB')
    .refine(
      (f) => ['image/jpeg', 'image/png', 'application/pdf'].includes(f.type),
      'Only JPG, PNG, or PDF files are accepted'
    ),
})
