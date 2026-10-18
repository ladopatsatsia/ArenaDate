import React from 'react';
import { useTranslation } from 'react-i18next';
import { Screen } from '../../src/components/Screen';
import { TodayPlansScreen } from '../../src/today-plans/TodayPlansScreen';

export default function TodayPlansTabRoute() {
  const { t } = useTranslation();
  return (
    <Screen title={t('today_plans_title')} scroll={false}>
      <TodayPlansScreen />
    </Screen>
  );
}
