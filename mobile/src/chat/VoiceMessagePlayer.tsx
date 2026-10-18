import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';

interface VoiceMessagePlayerProps {
  mediaUrl: string;
  durationSeconds?: number;
  isOwn?: boolean;
}

export function VoiceMessagePlayer({
  mediaUrl,
  durationSeconds = 0,
  isOwn = false,
}: VoiceMessagePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef<any>(null);
  const timerRef = useRef<any>(null);

  const displayDuration = durationSeconds > 0 ? durationSeconds : 0;

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (audioRef.current) {
        try {
          if (typeof audioRef.current.pause === 'function') {
            audioRef.current.pause();
          }
          if (typeof audioRef.current.remove === 'function') {
            audioRef.current.remove();
          }
        } catch {
          // ignore
        }
        audioRef.current = null;
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const formatSec = (secs: number) => {
    const s = Math.max(0, Math.floor(secs));
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const handleTogglePlay = async () => {
    if (isPlaying) {
      if (audioRef.current) {
        try {
          audioRef.current.pause();
        } catch {
          // ignore
        }
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setIsPlaying(false);
      return;
    }

    try {
      setLoading(true);

      // Web / Browser / Telegram WebApp
      if (Platform.OS === 'web' || typeof Audio !== 'undefined') {
        if (!audioRef.current) {
          const audio = new Audio(mediaUrl);
          audioRef.current = audio;

          audio.ontimeupdate = () => {
            setCurrentTime(audio.currentTime);
          };

          audio.onended = () => {
            setIsPlaying(false);
            setCurrentTime(0);
          };

          audio.onerror = () => {
            setIsPlaying(false);
            setLoading(false);
          };
        }

        await audioRef.current.play();
        setLoading(false);
        setIsPlaying(true);
        return;
      }

      // Native Mobile (iOS / Android)
      try {
        const ExpoAudio = require('expo-audio');
        if (ExpoAudio && ExpoAudio.createAudioPlayer) {
          if (!audioRef.current) {
            const player = ExpoAudio.createAudioPlayer(mediaUrl);
            audioRef.current = player;
            player.addListener('playbackStatusUpdate', (status: any) => {
              if (status.currentTime !== undefined) {
                setCurrentTime(status.currentTime);
              }
              if (status.playbackState === 'ended' || (status.duration && status.currentTime >= status.duration)) {
                setIsPlaying(false);
                setCurrentTime(0);
              }
            });
          }
          audioRef.current.play();
          setLoading(false);
          setIsPlaying(true);
          return;
        }
      } catch (nativeErr) {
        console.warn('Native expo-audio player failed, falling back:', nativeErr);
      }

      // Mock / fallback
      setLoading(false);
      setIsPlaying(true);
      const start = Date.now();
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - start) / 1000;
        if (elapsed >= (displayDuration || 5)) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          setIsPlaying(false);
          setCurrentTime(0);
        } else {
          setCurrentTime(elapsed);
        }
      }, 200);
    } catch (err) {
      console.warn('Play audio failed:', err);
      setLoading(false);
      setIsPlaying(false);
    }
  };

  const progressPercent = displayDuration > 0
    ? Math.min(100, Math.max(0, (currentTime / displayDuration) * 100))
    : isPlaying ? 50 : 0;

  return (
    <View style={[styles.container, isOwn ? styles.containerOwn : styles.containerPeer]}>
      <TouchableOpacity
        style={[styles.playBtn, isOwn ? styles.playBtnOwn : styles.playBtnPeer]}
        onPress={handleTogglePlay}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Pause voice message' : 'Play voice message'}
        testID="voice-play-toggle"
      >
        {loading ? (
          <ActivityIndicator size="small" color={isOwn ? '#ffffff' : '#8b5cf6'} />
        ) : (
          <Text style={[styles.playIcon, isOwn ? styles.playIconOwn : styles.playIconPeer]}>
            {isPlaying ? '⏸' : '▶'}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.trackCol}>
        <View style={[styles.progressBarBg, isOwn ? styles.progressBarBgOwn : styles.progressBarBgPeer]}>
          <View
            style={[
              styles.progressBarFill,
              isOwn ? styles.progressBarFillOwn : styles.progressBarFillPeer,
              { width: `${progressPercent}%` },
            ]}
          />
        </View>

        <View style={styles.timeRow}>
          <Text style={[styles.timeLabel, isOwn ? styles.timeLabelOwn : styles.timeLabelPeer]}>
            {formatSec(isPlaying ? currentTime : displayDuration)}
          </Text>
          <Text style={[styles.voiceTag, isOwn ? styles.voiceTagOwn : styles.voiceTagPeer]}>
            🎤 Voice
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 16,
    minWidth: 190,
    maxWidth: 260,
  },
  containerOwn: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  containerPeer: {
    backgroundColor: 'rgba(139, 92, 246, 0.1)',
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  playBtnOwn: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  playBtnPeer: {
    backgroundColor: '#8b5cf6',
  },
  playIcon: {
    fontSize: 16,
    lineHeight: 18,
  },
  playIconOwn: {
    color: '#6366f1',
    marginLeft: 2,
  },
  playIconPeer: {
    color: '#ffffff',
    marginLeft: 2,
  },
  trackCol: {
    flex: 1,
    justifyContent: 'center',
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarBgOwn: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  progressBarBgPeer: {
    backgroundColor: 'rgba(139, 92, 246, 0.25)',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressBarFillOwn: {
    backgroundColor: '#ffffff',
  },
  progressBarFillPeer: {
    backgroundColor: '#8b5cf6',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeLabelOwn: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  timeLabelPeer: {
    color: '#64748b',
  },
  voiceTag: {
    fontSize: 10,
    fontWeight: '500',
  },
  voiceTagOwn: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  voiceTagPeer: {
    color: '#94a3b8',
  },
});
