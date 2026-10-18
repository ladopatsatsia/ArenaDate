import { Text } from '../components/UI';
import { Image, ImageStyle, Pressable, StyleProp, View } from 'react-native';
import { useState, useEffect } from 'react';
import { theme } from '../components/theme';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/AuthProvider';
import { ProfileApi, type Photo } from './api';

export function PrivatePhoto({
  photo,
  avatar = false,
  fullscreen = false,
  blurRadius,
  style,
  resizeMode,
}: {
  photo: Photo;
  avatar?: boolean;
  fullscreen?: boolean;
  blurRadius?: number;
  style?: StyleProp<ImageStyle>;
  resizeMode?: 'cover' | 'contain';
}) {
  const { state, api, manager } = useAuth();
  const { t } = useTranslation();
  const [decodeFailed, setDecodeFailed] = useState(false);
  useEffect(() => setDecodeFailed(false), [photo.id, photo.state]);

  const image = useQuery({
    queryKey: ['account', state.account?.id, 'photo', photo.id, photo.state],
    queryFn: () => new ProfileApi(api, manager).image(photo.id),
    enabled: photo.state !== 'uploading',
    staleTime: 60000,
    gcTime: avatar ? 300000 : 0,
    retry: false,
  });

  const ratio = Math.max(0.7, Math.min(1.6, Number(photo.width) / Math.max(1, Number(photo.height))));
  const containerStyle = style ?? (fullscreen
    ? { width: '100%', height: '100%' }
    : { width: '100%', aspectRatio: ratio, maxHeight: 420, borderRadius: theme.radius.card });

  if (avatar) {
    if (photo.state === 'uploading' || (!image.data && !image.isError)) {
      return (
        <View style={[{ width: '100%', height: '100%', backgroundColor: theme.colors.soft, alignItems: 'center', justifyContent: 'center' }, style]}>
          <Text style={{ fontSize: 14, color: theme.colors.muted }}>⏳</Text>
        </View>
      );
    }
    if (image.isError || decodeFailed) {
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('retry')}
          onPress={() => { setDecodeFailed(false); void image.refetch(); }}
          style={[
            {
              backgroundColor: '#1E293B',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.4)',
              borderRadius: 999,
            },
            style ?? { width: '100%', height: '100%' },
          ]}
          testID="photo-crossed-placeholder"
        >
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 18, opacity: 0.7 }}>📷</Text>
            <View
              style={{
                position: 'absolute',
                width: 26,
                height: 2.5,
                backgroundColor: '#EF4444',
                transform: [{ rotate: '-45deg' }],
                borderRadius: 2,
              }}
            />
          </View>
        </Pressable>
      );
    }
    return (
      <Image
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('profile_photo')}
        source={{ uri: image.data }}
        onError={() => setDecodeFailed(true)}
        style={style ?? { width: '100%', height: '100%' }}
        resizeMode="cover"
        blurRadius={blurRadius}
      />
    );
  }

  if (photo.state === 'uploading' || (!image.data && !image.isError)) {
    return (
      <View style={[containerStyle, { backgroundColor: theme.colors.soft, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ fontSize: 20, color: theme.colors.muted }}>⏳</Text>
      </View>
    );
  }

  if (image.isError || decodeFailed) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('retry')}
        onPress={() => { setDecodeFailed(false); void image.refetch(); }}
        style={[
          {
            backgroundColor: '#1E293B',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            borderWidth: 1.5,
            borderColor: 'rgba(239, 68, 68, 0.4)',
            borderRadius: theme.radius.card,
          },
          containerStyle,
        ]}
        testID="photo-crossed-placeholder"
      >
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 36, opacity: 0.7 }}>📷</Text>
          <View
            style={{
              position: 'absolute',
              width: 50,
              height: 3.5,
              backgroundColor: '#EF4444',
              transform: [{ rotate: '-45deg' }],
              borderRadius: 2,
            }}
          />
        </View>
      </Pressable>
    );
  }

  return (
    <Image
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('profile_photo')}
      source={{ uri: image.data }}
      onError={() => setDecodeFailed(true)}
      style={containerStyle}
      blurRadius={blurRadius}
      resizeMode={resizeMode ?? (fullscreen ? 'contain' : 'contain')}
    />
  );
}

