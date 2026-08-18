import { View } from 'react-native';

import { useT } from '@teeko/i18n';
import type { SupportStatus } from '@teeko/shared';
import { Text } from '@teeko/ui';

import { SUPPORT_STATUS_I18N, supportStatusTone } from '../lib/support';

/** Small rounded status label for a support ticket — colour-coded by outcome. */
export function SupportStatusPill({ status }: { status: SupportStatus }) {
  const t = useT();
  const tone = supportStatusTone(status);
  return (
    <View className={`rounded-full px-3 py-1 ${tone.bg}`}>
      <Text weight="medium" className={`text-xs ${tone.text}`}>
        {t(SUPPORT_STATUS_I18N[status])}
      </Text>
    </View>
  );
}
