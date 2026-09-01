import { useT } from '@teeko/i18n';
import { Icon, Pressable } from '@teeko/ui';

/**
 * Show/hide toggle for a password field. Drop into an Input's
 * `trailingAdornment` and drive `secureTextEntry={!visible}` from the same
 * state.
 */
export function PasswordToggle({
  visible,
  onToggle,
}: {
  visible: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  return (
    <Pressable
      onPress={onToggle}
      haptic="selection"
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={visible ? t('auth.hidePassword') : t('auth.showPassword')}
    >
      <Icon name={visible ? 'visibility-off' : 'visibility'} size={20} color="#4B5563" />
    </Pressable>
  );
}
