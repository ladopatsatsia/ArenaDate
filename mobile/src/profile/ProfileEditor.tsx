import { Button, Text, TextInput } from '../components/UI';
import { useState } from 'react';
import { Switch, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslation } from 'react-i18next';
import type { Choices, OwnProfile, ProfileApi } from './api';
const schema = z.object({ displayName: z.string().trim().min(2).max(50), bio: z.string().trim().min(10).max(500),
  gender: z.string().min(1), desiredGenders: z.array(z.string()).min(1).max(3), city: z.string().trim().min(2).max(80),
  interests: z.array(z.string()).min(1).max(5), relationshipGoal: z.string().min(1), visible: z.boolean() });
export function ProfileEditor({ profile, choices, api, saved }: { profile: OwnProfile; choices: Choices; api: ProfileApi; saved: (p: OwnProfile) => void }) {
  const { t } = useTranslation(); const [message, setMessage] = useState('');
  const { control, handleSubmit, formState: { isSubmitting, errors } } = useForm({ resolver: zodResolver(schema), defaultValues: {
    displayName: profile.displayName, bio: profile.bio, gender: profile.gender, desiredGenders: profile.desiredGenders,
    city: profile.city, interests: profile.interests, relationshipGoal: profile.relationshipGoal, visible: profile.visible } });
  const submit = handleSubmit(async values => { setMessage(''); try { saved(await api.save({ ...values, revision: profile.revision })); }
    catch { setMessage('profile_save_failed'); } });
  return <View style={{ gap: 12 }}>
    <Text>{t('profile_age')}: {profile.age}</Text>
    {(['displayName', 'bio', 'city'] as const).map(name => <Controller key={name} control={control} name={name} render={({ field }) => <View>
      <Text>{t('profile_' + name)}</Text><TextInput testID={'profile-'+name} accessibilityLabel={t('profile_' + name)} value={field.value}
        onChangeText={field.onChange} onBlur={field.onBlur} multiline={name === 'bio'}
        maxLength={name === 'bio' ? 500 : name === 'city' ? 80 : 50}
        style={{ borderWidth: 1, borderColor: '#826675', padding: 12, color: '#432d37' }} />
    </View>} />)}
    {(['gender', 'relationshipGoal'] as const).map(name => <Controller key={name} control={control} name={name} render={({ field }) => <View>
      <Text>{t('profile_' + name)}</Text>{(name === 'gender' ? choices.genders : choices.relationshipGoals).map(value =>
        <Button key={value} title={(field.value === value ? '✓ ' : '') + t('choice_' + value)} onPress={() => field.onChange(value)} />)}
    </View>} />)}
    {(['desiredGenders', 'interests'] as const).map(name => <Controller key={name} control={control} name={name} render={({ field }) => <View>
      <Text>{t('profile_' + name)}</Text>{(name === 'desiredGenders' ? choices.genders : choices.interests).map(value =>
        <Button key={value} title={(field.value.includes(value) ? '✓ ' : '') + t('choice_' + value)}
          onPress={() => field.onChange(field.value.includes(value) ? field.value.filter(x => x !== value) : [...field.value, value])} />)}
    </View>} />)}
    <Controller control={control} name="visible" render={({ field }) => <View><Text>{t('profile_visible')}</Text>
      <Switch accessibilityLabel={t('profile_visible')} value={field.value} onValueChange={field.onChange} /></View>} />
    {Object.keys(errors).length > 0 && <Text accessibilityRole="alert">{t('profile_invalid')}</Text>}
    {message && <Text accessibilityRole="alert">{t(message)}</Text>}
    <Button variant="primary" title={t(isSubmitting ? 'working' : 'profile_save')} disabled={isSubmitting} onPress={() => { void submit(); }} />
  </View>;
}
