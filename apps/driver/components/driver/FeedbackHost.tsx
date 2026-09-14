import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlertCircle, CheckCircle2, Info } from 'lucide-react-native';
import { useColors } from '../../constants/colors';
import {
  type DialogAction,
  type Toast,
  type ToastKind,
  useFeedbackStore,
} from '../../store/useFeedbackStore';

const TOAST_DURATION = 3200;

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------

function ToastRow({ toast, onDismiss }: { toast: Toast; onDismiss: (id: string) => void }) {
  const colors = useColors();
  const styles = createStyles(colors);
  const progress = useRef(new Animated.Value(0)).current;
  const done = useRef(false);

  const hide = () => {
    if (done.current) return;
    done.current = true;
    Animated.timing(progress, {
      toValue: 0,
      duration: 180,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    }).start(() => onDismiss(toast.id));
  };

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const id = setTimeout(hide, TOAST_DURATION);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accent: Record<ToastKind, string> = {
    info: colors.info,
    success: colors.success,
    error: colors.danger,
  };
  const IconCmp = toast.kind === 'success' ? CheckCircle2 : toast.kind === 'error' ? AlertCircle : Info;

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
      }}
    >
      <Pressable onPress={hide} accessibilityRole="alert" style={styles.toast}>
        <IconCmp size={20} color={accent[toast.kind]} strokeWidth={2} />
        <Text style={styles.toastText} numberOfLines={3}>
          {toast.message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

function Dialog() {
  const colors = useColors();
  const styles = createStyles(colors);
  const dialog = useFeedbackStore((s) => s.dialog);
  const dismiss = useFeedbackStore((s) => s.dismissDialog);

  const list: DialogAction[] =
    dialog?.actions && dialog.actions.length > 0 ? dialog.actions : [{ label: 'OK', style: 'cancel' }];
  const primary = list.filter((a) => a.style !== 'cancel');
  const cancel = list.filter((a) => a.style === 'cancel');
  const dismissable = dialog?.dismissable ?? true;

  const run = (a: DialogAction) => {
    dismiss();
    // Let the modal start closing before any navigation the handler triggers.
    if (a.onPress) setTimeout(() => void a.onPress?.(), 0);
  };

  const requestClose = () => {
    if (!dismissable) return;
    const c = cancel[0];
    if (c) run(c);
    else dismiss();
  };

  return (
    <Modal
      visible={dialog !== null}
      transparent
      animationType="fade"
      onRequestClose={requestClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Dismiss" />
        <View style={styles.card} accessibilityViewIsModal>
          <Text style={styles.title}>{dialog?.title}</Text>
          {dialog?.message ? <Text style={styles.message}>{dialog.message}</Text> : null}
          <View style={styles.actions}>
            {primary.map((a, i) => (
              <TouchableOpacity
                key={`p${i}`}
                style={[styles.btn, a.style === 'destructive' ? styles.btnDestructive : styles.btnPrimary]}
                onPress={() => run(a)}
                activeOpacity={0.85}
              >
                <Text style={styles.btnPrimaryText}>{a.label}</Text>
              </TouchableOpacity>
            ))}
            {cancel.map((a, i) => (
              <TouchableOpacity
                key={`c${i}`}
                style={[styles.btn, primary.length === 0 ? styles.btnPrimary : styles.btnGhost]}
                onPress={() => run(a)}
                activeOpacity={0.85}
              >
                <Text style={primary.length === 0 ? styles.btnPrimaryText : styles.btnGhostText}>
                  {a.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------------

/**
 * Renders the toast stack and alert dialog for the driver app. Mount once in
 * the root layout; drive it with `toast.*()` / `showDialog()` from the store.
 */
export default function FeedbackHost() {
  const colors = useColors();
  const styles = createStyles(colors);
  const insets = useSafeAreaInsets();
  const toasts = useFeedbackStore((s) => s.toasts);
  const dismissToast = useFeedbackStore((s) => s.dismissToast);

  return (
    <>
      {toasts.length > 0 && (
        <View pointerEvents="box-none" style={[styles.toastStack, { top: insets.top + 8 }]}>
          {toasts.map((t) => (
            <ToastRow key={t.id} toast={t} onDismiss={dismissToast} />
          ))}
        </View>
      )}
      <Dialog />
    </>
  );
}

const createStyles = (colors: any) =>
  StyleSheet.create({
    toastStack: {
      position: 'absolute',
      left: 0,
      right: 0,
      zIndex: 50,
      paddingHorizontal: 16,
      gap: 8,
    },
    toast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor: colors.surfaceTop,
      borderWidth: 1,
      borderColor: colors.borderHigh,
      shadowColor: '#000',
      shadowOpacity: 0.25,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    toastText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '600', lineHeight: 19 },

    backdrop: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.55)',
      paddingHorizontal: 24,
    },
    card: {
      width: '100%',
      maxWidth: 360,
      borderRadius: 20,
      backgroundColor: colors.surfaceHigh,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 20,
    },
    title: { color: colors.text, fontSize: 18, fontWeight: '800', textAlign: 'center' },
    message: { color: colors.textSec, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
    actions: { marginTop: 20, gap: 8 },
    btn: {
      height: 48,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnPrimary: { backgroundColor: colors.accent },
    btnDestructive: { backgroundColor: colors.danger },
    btnGhost: { backgroundColor: colors.surfaceTop, borderWidth: 1, borderColor: colors.border },
    btnPrimaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
    btnGhostText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  });
