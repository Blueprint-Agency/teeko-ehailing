import { useUIStore } from '@teeko/api';
import { useT } from '@teeko/i18n';
import { AlertDialog, ToastHost } from '@teeko/ui';

/**
 * Bridges the UI store to the in-app toast stack and alert dialog.
 * Mounted once in the root layout so `toast.*()` / `showDialog()` work from anywhere.
 */
export function FeedbackHost() {
  const t = useT();
  const toasts = useUIStore((s) => s.toasts);
  const dismissToast = useUIStore((s) => s.dismissToast);
  const dialog = useUIStore((s) => s.dialog);
  const dismissDialog = useUIStore((s) => s.dismissDialog);

  return (
    <>
      <ToastHost toasts={toasts} onDismiss={dismissToast} />
      <AlertDialog
        visible={dialog !== null}
        title={dialog?.title ?? ''}
        message={dialog?.message}
        actions={dialog?.actions}
        dismissable={dialog?.dismissable}
        okLabel={t('common.ok')}
        onDismiss={dismissDialog}
      />
    </>
  );
}
