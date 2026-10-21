'use client';

import React, { useSyncExternalStore } from 'react';
import { Pause, Play } from 'lucide-react';
import type { MusicTrack, MusicTracksResponse } from '@/lib/widgetData/contracts';
import { useI18n } from '@/i18n/I18nProvider';
import { useAuth } from '@/providers/AuthProvider';
import { demoFetch } from '@/lib/demoTransport';

/**
 * One music player for the whole page, in this browser: the music widgets
 * start an album, a playlist or a track, any of them shows and steers it.
 * Audio comes through NasDash (`/api/widgets/music/stream`), for signed-in
 * users only; nothing plays for anonymous visitors.
 */
export interface PlayerState {
  /** The widget whose server the queue comes from (its id authorises the stream). */
  widgetId?: string;
  queue: MusicTrack[];
  index: number;
  playing: boolean;
  /** Waiting for the server: a track or a collection is loading. */
  loading: boolean;
  positionMs: number;
  durationMs?: number;
  /** An i18n key when the last action failed. */
  error?: string;
  /** What was asked last, so its button can show it is being started. */
  pending?: string;
  /** What the queue was started from (an album, a playlist, a track), so its button can pause it. */
  source?: string;
}

/** Shown when a track cannot be played (i18n key). */
const STREAM_FAILED = 'widgets.music.error.stream';
let state: PlayerState = { queue: [], index: 0, playing: false, loading: false, positionMs: 0 };
const listeners = new Set<() => void>();
const emit = (patch: Partial<PlayerState>) => { state = { ...state, ...patch }; listeners.forEach(listener => listener()); };
let audio: HTMLAudioElement | null = null;

function element(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'auto';
  audio.addEventListener('timeupdate', () => emit({ positionMs: (audio?.currentTime ?? 0) * 1000, durationMs: Number.isFinite(audio?.duration) ? audio!.duration * 1000 : state.durationMs }));
  audio.addEventListener('playing', () => emit({ playing: true, loading: false, pending: undefined }));
  audio.addEventListener('pause', () => emit({ playing: false }));
  audio.addEventListener('waiting', () => emit({ loading: true }));
  audio.addEventListener('ended', () => { if (state.index < state.queue.length - 1) start(state.index + 1); else emit({ playing: false }); });
  audio.addEventListener('error', () => emit({ playing: false, loading: false, pending: undefined, error: STREAM_FAILED }));
  return audio;
}

function start(index: number) {
  const track = state.queue[index];
  if (!track || !state.widgetId) return;
  const player = element();
  emit({ index, positionMs: 0, durationMs: track.durationMs, loading: true, error: undefined });
  player.src = `/api/widgets/music/stream?${new URLSearchParams({ widgetId: state.widgetId, id: track.id })}`;
  void player.play().catch(() => emit({ playing: false, loading: false, pending: undefined, error: STREAM_FAILED }));
}

export const musicPlayer = {
  /** Plays these tracks from `index`. */
  playTracks(widgetId: string, tracks: MusicTrack[], index = 0, pending?: string) {
    if (!tracks.length) return;
    emit({ widgetId, queue: tracks, pending, source: pending });
    start(Math.max(0, Math.min(index, tracks.length - 1)));
  },
  /** Asks the server for an album's or a playlist's tracks, then plays them. */
  async playCollection(widgetId: string, kind: 'album' | 'playlist', id: string) {
    const key = `${kind}:${id}`;
    emit({ pending: key, loading: true, error: undefined });
    try {
      const response = await demoFetch(`/api/widgets/music/tracks?${new URLSearchParams({ widgetId, kind, id })}`);
      const answer = await response.json().catch(() => null) as (MusicTracksResponse & { error?: string }) | null;
      if (!response.ok || !answer?.tracks?.length) throw new Error(answer?.error ?? 'widgets.music.error.empty');
      musicPlayer.playTracks(widgetId, answer.tracks, 0, key);
    } catch (cause) {
      emit({ loading: false, pending: undefined, error: cause instanceof Error && cause.message.startsWith('widgets.') ? cause.message : 'widgets.error.network' });
    }
  },
  toggle() {
    const player = element();
    if (!state.queue.length) return;
    if (player.paused) void player.play().catch(() => undefined); else player.pause();
  },
  next() { if (state.index < state.queue.length - 1) start(state.index + 1); },
  previous() {
    // Past the first seconds, "previous" restarts the track, as players do.
    if (state.positionMs > 4000 || state.index === 0) { element().currentTime = 0; return; }
    start(state.index - 1);
  },
  seek(share: number) {
    const player = element();
    if (Number.isFinite(player.duration)) player.currentTime = Math.max(0, Math.min(1, share)) * player.duration;
  },
  stop() { element().pause(); emit({ queue: [], index: 0, playing: false, loading: false, positionMs: 0, pending: undefined }); },
};

export function useMusicPlayer(): PlayerState {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => state,
    () => state,
  );
}

/** Playback is for signed-in users: anonymous visitors of a public dashboard see no play buttons. */
export function useCanPlay(): boolean {
  const { user } = useAuth();
  return !!user;
}

/** A round play button over a cover or at the end of a row; spins while its music starts. */
export function PlayButton({ label, onPlay, playingKey, size = 'small' }: { label: string; onPlay: () => void; playingKey?: string; size?: 'small' | 'large' }) {
  const player = useMusicPlayer();
  const { t } = useI18n();
  const active = !!playingKey && player.pending === playingKey;
  const current = !!playingKey && !player.pending && player.queue.length > 0 && player.source === playingKey;
  return (
    <button type="button" className={`ndw-music-play is-${size} ${current && player.playing ? 'is-on' : ''}`}
      onClick={event => { event.preventDefault(); event.stopPropagation(); if (current) musicPlayer.toggle(); else onPlay(); }}
      aria-label={current && player.playing ? t('widgets.music.pause') : label} title={current && player.playing ? t('widgets.music.pause') : label}>
      {active ? <span className="nd-spinner" aria-hidden="true" /> : current && player.playing ? <Pause size={size === 'large' ? 16 : 13} /> : <Play size={size === 'large' ? 16 : 13} />}
    </button>
  );
}
