import { Platform } from 'react-native';

export interface ChatMediaUploadResult {
  id: string;
  mediaType: 'photo' | 'voice';
  url: string;
  durationSeconds?: number;
}

export interface ChatMediaFile {
  uri: string;
  name?: string;
  type?: string;
  blob?: Blob;
}

export async function uploadChatMedia(
  baseUrl: string,
  token: string,
  file: ChatMediaFile,
  mediaType: 'photo' | 'voice',
  duration?: number
): Promise<ChatMediaUploadResult> {
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  const durParam = typeof duration === 'number' && duration > 0 ? `&duration=${encodeURIComponent(duration.toString())}` : '';
  const uploadUrl = `${cleanBaseUrl}/api/chat/media/upload?type=${mediaType}${durParam}`;

  const formData = new FormData();

  if (Platform.OS === 'web') {
    let blob = file.blob;
    if (!blob) {
      if (file.uri.startsWith('data:')) {
        const commaIdx = file.uri.indexOf(',');
        const header = file.uri.substring(0, commaIdx);
        const base64Data = file.uri.substring(commaIdx + 1);
        const mimeMatch = header.match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : (mediaType === 'photo' ? 'image/jpeg' : 'audio/webm');
        const binary = atob(base64Data);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: mime });
      } else {
        const res = await fetch(file.uri);
        blob = await res.blob();
      }
    }
    const filename = file.name || (mediaType === 'photo' ? 'photo.jpg' : 'voice.webm');
    formData.append('file', blob, filename);
  } else {
    // Native React Native
    const filename = file.name || (mediaType === 'photo' ? 'photo.jpg' : 'voice.m4a');
    const mime = file.type || (mediaType === 'photo' ? 'image/jpeg' : 'audio/m4a');
    formData.append('file', {
      uri: file.uri,
      name: filename,
      type: mime,
    } as unknown as Blob);
  }

  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    let errCode = 'upload_failed';
    try {
      const errJson = await response.json();
      if (errJson && typeof errJson.code === 'string') errCode = errJson.code;
    } catch {
      // ignore
    }
    throw new Error(errCode);
  }

  return (await response.json()) as ChatMediaUploadResult;
}
