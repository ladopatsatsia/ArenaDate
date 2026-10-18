export interface ChatReplyInfo {
  replyToId: string;
  sender: string;
  snippet: string;
}

export interface ParsedChatMessage {
  type: 'text' | 'photo' | 'voice' | 'emoji_only';
  text: string;
  mediaId?: string;
  mediaUrl?: string;
  caption?: string;
  duration?: number;
  reply?: ChatReplyInfo;
}

// Regex to test if a string consists entirely of 1 to 4 emoji characters (including compound emojis)
const EMOJI_ONLY_REGEX = /^(?:\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\s){1,4}$/u;

export function parseChatMessage(text: string, apiUrl: string, token?: string): ParsedChatMessage {
  let clean = (text || '').trim();
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
  const cleanApiUrl = apiUrl.replace(/\/$/, '');

  let reply: ChatReplyInfo | undefined = undefined;

  // Check for reply prefix: [reply:ID|SENDER|SNIPPET]\n
  if (clean.startsWith('[reply:')) {
    const endBracketIdx = clean.indexOf(']\n');
    const fallbackEnd = clean.indexOf(']');
    const endIdx = endBracketIdx >= 0 ? endBracketIdx : fallbackEnd;
    if (endIdx > 7) {
      const meta = clean.substring(7, endIdx);
      const parts = meta.split('|');
      if (parts.length >= 3 && parts[0] && parts[1]) {
        reply = {
          replyToId: parts[0],
          sender: parts[1],
          snippet: parts.slice(2).join('|'),
        };
      }
      clean = (endBracketIdx >= 0 ? clean.substring(endBracketIdx + 2) : clean.substring(endIdx + 1)).trim();
    }
  }

  // Photo format: [photo:MEDIA_ID] or [photo:MEDIA_ID|CAPTION]
  if (clean.startsWith('[photo:') && clean.endsWith(']')) {
    const inner = clean.slice(7, -1);
    const pipeIdx = inner.indexOf('|');
    const mediaId = pipeIdx >= 0 ? inner.substring(0, pipeIdx) : inner;
    const caption = pipeIdx >= 0 ? inner.substring(pipeIdx + 1) : undefined;
    return {
      type: 'photo',
      text: caption || '',
      mediaId,
      mediaUrl: `${cleanApiUrl}/api/chat/media/${mediaId}${tokenQuery}`,
      caption,
      reply,
    };
  }

  // Voice format: [voice:MEDIA_ID|DURATION] or [voice:MEDIA_ID]
  if (clean.startsWith('[voice:') && clean.endsWith(']')) {
    const inner = clean.slice(7, -1);
    const pipeIdx = inner.indexOf('|');
    const mediaId = pipeIdx >= 0 ? inner.substring(0, pipeIdx) : inner;
    const durStr = pipeIdx >= 0 ? inner.substring(pipeIdx + 1) : '';
    const duration = parseFloat(durStr) || 0;
    return {
      type: 'voice',
      text: '',
      mediaId,
      mediaUrl: `${cleanApiUrl}/api/chat/media/${mediaId}${tokenQuery}`,
      duration,
      reply,
    };
  }

  // Check if pure emojis
  if (clean.length > 0 && clean.length <= 16 && EMOJI_ONLY_REGEX.test(clean)) {
    return {
      type: 'emoji_only',
      text: clean,
      reply,
    };
  }

  return {
    type: 'text',
    text: clean,
    reply,
  };
}

export function formatReplyMessage(
  replyToId: string,
  senderName: string,
  snippet: string,
  bodyText: string
): string {
  const cleanSnippet = (snippet || '').replace(/[\r\n|]/g, ' ').trim().slice(0, 100);
  const cleanSender = (senderName || '').replace(/[\r\n|]/g, ' ').trim().slice(0, 50);
  return `[reply:${replyToId}|${cleanSender}|${cleanSnippet}]\n${bodyText.trim()}`;
}

export function formatPhotoMessage(mediaId: string, caption?: string): string {
  const cleanCaption = (caption || '').trim();
  return cleanCaption ? `[photo:${mediaId}|${cleanCaption}]` : `[photo:${mediaId}]`;
}

export function formatVoiceMessage(mediaId: string, duration: number): string {
  const dur = Math.max(1, Math.round(duration * 10) / 10);
  return `[voice:${mediaId}|${dur}]`;
}

export function formatMessageSnippet(
  text: string | null | undefined,
  t: (key: string, defaultValue?: string) => string
): string {
  if (!text) return '';
  let clean = text.trim();
  if (clean.startsWith('[reply:')) {
    const endBracketIdx = clean.indexOf(']\n');
    const fallbackEnd = clean.indexOf(']');
    const endIdx = endBracketIdx >= 0 ? endBracketIdx : fallbackEnd;
    if (endIdx > 7) {
      clean = (endBracketIdx >= 0 ? clean.substring(endBracketIdx + 2) : clean.substring(endIdx + 1)).trim();
    }
  }
  if (clean.startsWith('[photo:')) {
    const pipeIdx = clean.indexOf('|');
    const caption = pipeIdx >= 0 ? clean.slice(pipeIdx + 1, -1).trim() : '';
    return caption ? `📷 ${caption}` : `📷 ${t('chat_photo_preview', 'ფოტო')}`;
  }
  if (clean.startsWith('[voice:')) {
    return `🎤 ${t('chat_voice_preview', 'ხმოვანი შეტყობინება')}`;
  }
  return clean;
}

