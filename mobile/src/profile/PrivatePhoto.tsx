import { Text } from '../components/UI';
import { Image } from 'react-native';
import { useState, useEffect } from 'react';
import { Button } from '../components/UI';
import { theme } from '../components/theme';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { ProfileApi, type Photo } from './api';
export function PrivatePhoto({ photo }: { photo: Photo }) {
  const { state, api, manager } = useAuth(); const { t } = useTranslation();
  const [decodeFailed,setDecodeFailed]=useState(false);
  useEffect(()=>setDecodeFailed(false),[photo.id,photo.state]);
  const image = useQuery({ queryKey: ['account', state.account?.id, 'photo', photo.id, photo.state],
    queryFn: () => new ProfileApi(api, manager).image(photo.id), enabled: photo.state !== 'uploading', staleTime: 30000, gcTime:0,retry: false });
  if (photo.state === 'uploading') return <Text>{t('photo_uploading')}</Text>;
  if(image.isError||decodeFailed)return <><Text accessibilityRole="alert">{t('photo_unavailable')}</Text><Button title={t('retry')} disabled={image.isFetching} onPress={()=>{setDecodeFailed(false);void image.refetch();}}/></>;
  if (!image.data) return <Text accessibilityLiveRegion="polite">{t('working')}</Text>;
  const ratio=Math.max(0.7,Math.min(1.6,Number(photo.width)/Math.max(1,Number(photo.height))));
  return <Image accessible accessibilityRole="image" accessibilityLabel={t('profile_photo')} source={{ uri: image.data }} onError={()=>setDecodeFailed(true)}
    style={{ width: '100%', aspectRatio:ratio,maxHeight:420,borderRadius:theme.radius.card,backgroundColor:theme.colors.soft }} resizeMode="contain" />;
}
