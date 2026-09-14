import { View } from 'react-native';

import { useT } from '@teeko/i18n';
import type { DisputeStatus } from '@teeko/shared';
import { Text } from '@teeko/ui';

import { DISPUTE_STATUS_I18N, disputeStatusTone } from '../lib/disputes';

/** Small rounded status label for a dispute — colour-coded by outcome. */
export function DisputeStatusPill({ status }: { status: DisputeStatus }) {
  const t = useT();
  const tone = disputeStatusTone(status);
  return (
    <View className={`rounded-full px-3 py-1 ${tone.bg}`}>
      <Text weight="medium" className={`text-xs ${tone.text}`}>
        {t(DISPUTE_STATUS_I18N[status])}
      </Text>
    </View>
  );
}
