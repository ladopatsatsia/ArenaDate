import { Button, Text } from './UI';
import { useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { Screen } from './Screen';
import { getReadiness } from '../api/client';

export function HealthScreen() {
  const { t } = useTranslation();
  const [state, setState] = useState<'idle' | 'checking' | 'healthy' | 'unavailable'>('idle');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function check() {
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setState('checking');
    try {
      await getReadiness(process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:5180', controller.signal);
      if (!controller.signal.aborted) setState('healthy');
    } catch {
      if (!controller.signal.aborted) setState('unavailable');
    }
  }
  return <Screen title={t('health')}>
    {state !== 'idle' && <Text accessibilityLiveRegion="polite">{t(state)}</Text>}
    <Button title={t('check')} disabled={state === 'checking'} onPress={() => { void check(); }} />
  </Screen>;
}
