'use client'

import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { useTranslation } from 'react-i18next'
import { Upload, CheckCircle2, XCircle, Clock, Eye, RefreshCcw, Camera } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge, statusVariant, statusLabel } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DocumentState } from '@teeko/shared/types'

interface DocumentSlotProps {
  doc: DocumentState
  onUpload: (docId: string, file: File) => void
  editable?: boolean
}

const ACCEPTED = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
}

export function DocumentSlot({ doc, onUpload, editable = true }: DocumentSlotProps) {
  const { t, i18n } = useTranslation()
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onUpload(doc.id, accepted[0])
    },
    [doc.id, onUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    disabled: !editable || doc.status === 'approved',
    useFsAccessApi: false, // enables native camera on mobile
  })

  const isUploaded = doc.status !== 'empty'
  const isApproved = doc.status === 'approved'
  const isRejected = doc.status === 'rejected'
  const isReviewState = doc.status === 'under_review' || doc.status === 'uploaded'

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-white shadow-[var(--shadow-sm)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <span className="text-sm font-medium text-[var(--color-text)]">{doc.label}</span>
        {isUploaded && (
          <Badge variant={statusVariant(doc.status)}>
            {doc.status === 'approved' && <CheckCircle2 className="h-3 w-3" />}
            {doc.status === 'rejected' && <XCircle className="h-3 w-3" />}
            {isReviewState && <Clock className="h-3 w-3" />}
            {statusLabel(doc.status)}
          </Badge>
        )}
      </div>

      {/* Rejection reason */}
      {isRejected && doc.rejectionReason && (
        <div className="flex gap-2 border-b border-[var(--color-error-light)] bg-[var(--color-error-light)] px-4 py-3">
          <XCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--color-error)]" />
          <div>
            <p className="text-xs font-semibold text-[var(--color-error)]">{t('dashboard.rejectionReason')}</p>
            <p className="text-xs text-[var(--color-error)]/80">{doc.rejectionReason}</p>
          </div>
        </div>
      )}

      {/* Upload area */}
      <div className="p-4">
        {isApproved ? (
          /* Approved state */
          <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-emerald-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-800">{doc.fileName}</p>
              {doc.reviewedAt && (
                <p className="text-xs text-emerald-600">
                  {t('documents.approved')} {new Date(doc.reviewedAt).toLocaleDateString(i18n.language === 'en' ? 'en-MY' : i18n.language)}
                </p>
              )}
            </div>
          </div>
        ) : isReviewState && doc.fileName ? (
          /* Under review state */
          <div className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] bg-blue-50 px-4 py-3">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-800">{doc.fileName}</p>
                <p className="text-xs text-blue-600">{t('documents.underReview')}</p>
              </div>
            </div>
            {editable && (
              <div {...getRootProps()}>
                <input {...getInputProps()} />
                <Button variant="outline" size="sm" className="text-xs">
                  <RefreshCcw className="h-3 w-3" /> {t('documents.replace')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          /* Empty or rejected — show dropzone */
          <div
            {...getRootProps()}
            className={cn(
              'flex cursor-pointer flex-col items-center gap-3 rounded-[var(--radius-md)] border-2 border-dashed px-6 py-8 text-center transition-all duration-200',
              isDragActive
                ? 'border-[var(--color-teal)] bg-[var(--color-teal-light)]'
                : isRejected
                ? 'border-[var(--color-error)]/40 bg-[var(--color-error-light)] hover:border-[var(--color-error)] hover:bg-[var(--color-error-light)]'
                : 'border-[var(--color-border-dark)] bg-[var(--color-surface)] hover:border-[var(--color-teal)] hover:bg-[var(--color-teal-light)]'
            )}
          >
            <input {...getInputProps()} />
            <div
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-xl',
                isRejected ? 'bg-[var(--color-error-light)]' : 'bg-[var(--color-teal-light)]'
              )}
            >
              <Upload
                className={cn(
                  'h-5 w-5',
                  isRejected ? 'text-[var(--color-error)]' : 'text-[var(--color-teal-dark)]'
                )}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--color-text)]">
                {isDragActive ? t('documents.chooseFile') : t('documents.dragDrop')}
              </p>
              <p className="mt-0.5 text-xs text-[var(--color-muted)]">{t('documents.fileTypes')}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" type="button" className="pointer-events-none text-xs">
                <Upload className="h-3 w-3" /> {t('documents.chooseFile')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                type="button"
                className="pointer-events-none text-xs"
                onClick={(e) => e.stopPropagation()}
              >
                <Camera className="h-3 w-3" /> {t('documents.takePhoto')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
