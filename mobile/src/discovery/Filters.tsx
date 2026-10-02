import { Button, Text, TextInput } from '../components/UI';
import { useState } from 'react';
import { View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import { ApiError } from '../auth/api';
import type { DiscoveryApi, Settings } from './api';
const schema = z.object({ minAge: z.number().int().min(18).max(120), maxAge: z.number().int().min(18).max(120),
  desiredGenders: z.array(z.string()).min(1).max(3), radiusKm: z.number().refine(n => [10,25,50,100].includes(n)),
  mode: z.enum(['city', 'distance']), city: z.string().trim().min(2).max(80) }).refine(v => v.minAge <= v.maxAge);
export function Filters({ settings, api, saved }: { settings: Settings; api: DiscoveryApi; saved: (s: Settings) => void }) {
  const { t } = useTranslation(); const [message, setMessage] = useState('');
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema),
    defaultValues: { minAge: Number(settings.minAge), maxAge: Number(settings.maxAge), desiredGenders: settings.desiredGenders,
      radiusKm: Number(settings.radiusKm), mode: settings.mode === 'distance' ? 'distance' : 'city', city: settings.city } });
  const submit = handleSubmit(async values => { setMessage('');
    try { saved(await api.save({ ...values, revision: settings.revision })); }
    catch (error) { setMessage(error instanceof ApiError && error.status === 429 ? 'discovery_rate_limited' : 'discovery_save_failed'); } });
  return <View style={{ gap: 10 }}>
    <Text>{t('discovery_filters')}</Text>
    {(['minAge', 'maxAge'] as const).map(name => <Controller key={name} control={control} name={name} render={({ field }) => <View>
      <Text>{t('discovery_' + name)}</Text><TextInput accessibilityLabel={t('discovery_' + name)} keyboardType="number-pad"
        value={String(field.value)} onChangeText={v => field.onChange(Number(v))} maxLength={3} style={{ borderWidth: 1, padding: 10 }} />
    </View>} />)}
    <Controller control={control} name="desiredGenders" render={({ field }) => <View><Text>{t('profile_desiredGenders')}</Text>
      {['woman','man','nonbinary'].map(value => <Button key={value} title={(field.value.includes(value) ? '✓ ' : '') + t('choice_' + value)}
        onPress={() => field.onChange(field.value.includes(value) ? field.value.filter(v => v !== value) : [...field.value, value])} />)}
    </View>} />
    <Controller control={control} name="city" render={({ field }) => <View><Text>{t('discovery_city')}</Text>
      <TextInput accessibilityLabel={t('discovery_city')} value={field.value} onChangeText={field.onChange} maxLength={80} style={{ borderWidth: 1, padding: 10 }} />
    </View>} />
    <Controller control={control} name="mode" render={({ field }) => <View>
      <Button title={(field.value === 'city' ? '✓ ' : '') + t('discovery_city_mode')} onPress={() => field.onChange('city')} />
      <Button disabled={!settings.hasLocation} title={(field.value === 'distance' ? '✓ ' : '') + t('discovery_distance_mode')} onPress={() => field.onChange('distance')} />
    </View>} />
    <Controller control={control} name="radiusKm" render={({ field }) => <View><Text>{t('discovery_radius')}</Text>
      {[10,25,50,100].map(value => <Button key={value} selected={field.value===value} title={t('distance_km',{count:value})} onPress={() => field.onChange(value)} />)}
    </View>} />
    {Object.keys(errors).length > 0 && <Text accessibilityRole="alert">{t('profile_invalid')}</Text>}
    {message && <Text accessibilityRole="alert">{t(message)}</Text>}
    <Button disabled={isSubmitting} title={t(isSubmitting ? 'working' : 'discovery_apply')} onPress={() => { void submit(); }} />
  </View>;
}
