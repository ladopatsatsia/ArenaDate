import { Link } from '../src/components/UI';
import { Text } from '../src/components/UI';


import { useTranslation } from 'react-i18next';
import { Screen } from '../src/components/Screen';
import { Card } from '../src/components/UI';
export default function Welcome() {
  const { t } = useTranslation();
  return <Screen title={t('welcome')}><Card><Text accessibilityRole="header">{t('welcome_note')}</Text><Text>{t('intro')}</Text><Link href="/auth">{t('continue')}</Link></Card><Text>{t('welcome_privacy')}</Text>{__DEV__ && <Link href="/health">{t('health')}</Link>}</Screen>;
}
