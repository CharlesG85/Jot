import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import type { Layer } from '@/models/layer';
import { logAudioLifecycle } from '@/utils/audio-lifecycle-logger';

/**
 * Gap between each Layer's native player create/remove during play()/stop(),
 * rather than bursting them all at once. Creating or releasing many native
 * AudioPlayers simultaneously can overwhelm the OS audio daemon as an Idea
 * accumulates Layers — observed directly as "Server was dead when
 * activation request was made" thrown from player.play(). The actual
 * synchronized start (play()) and immediate stop (pause()) are not
 * staggered — only the heavier create/release steps are.
 */
const PLAYER_SETUP_STAGGER_MS = 20;

interface UseIdeaPlaybackResult {
  isPlaying: boolean;
  play: () => Promise<void>;
  stop: () => Promise<void>;
  /**
   * A synchronous snapshot of real playback position within the Idea's
   * loop — 0..1, or null while not playing. Reads a designated reference
   * Layer's actual native player position each call; not React state and
   * not a subscription, so calling it doesn't trigger a re-render. Meant to
   * be polled by useTransportProgress, which is the audio engine's only
   * consumer — see docs/07_AUDIO_ARCHITECTURE.md §15-16.
   */
  getLoopProgress: () => number | null;
}

/**
 * Plays every Layer of an Idea together, looping and synchronized.
 *
 * Looping is scheduled off each Layer's own `loopLengthBars`, not the
 * native player's own end-of-file loop — a recording is saved exactly as
 * performed (docs/03_ROADMAP.md Stage 6.5), so its raw file length is
 * usually shorter or longer than the musically-appropriate loop length.
 * Each player is manually rewound and restarted on a per-Layer timer
 * instead, which also correctly produces silence for the remainder of a
 * short recording's loop, and restarts early (without ever trimming the
 * file) for a recording longer than its loop length.
 *
 * See docs/07_AUDIO_ARCHITECTURE.md §6-7.
 */
export function useIdeaPlayback(
  layers: Layer[],
  barDurationSeconds: number,
  loopLengthBars: number,
): UseIdeaPlaybackResult {
  const playersRef = useRef<Map<string, AudioPlayer>>(new Map());
  const loopTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);
  // Incremented by stop() (and by each new play()) to invalidate any play()
  // call still in its async setup — see the comment inside play() for why
  // this is needed.
  const sessionRef = useRef(0);
  // How many full loop repeats each Layer's player has completed so far —
  // updated the instant a repeat actually restarts the player (inside
  // scheduleLoop's timer, not when the timer is merely scheduled), so it's
  // always accurate the moment getLoopProgress() reads it. Used, together
  // with one designated reference Layer, to reconstruct real elapsed
  // playback time from native data instead of Date.now().
  const repeatCountRef = useRef<Map<string, number>>(new Map());
  const referenceLayerIdRef = useRef<string | null>(null);

  function clearLoopTimer(layerId: string) {
    const timer = loopTimersRef.current.get(layerId);
    if (timer) {
      clearTimeout(timer);
      loopTimersRef.current.delete(layerId);
    }
  }

  // Every repeat is scheduled against this Layer's own fixed start time, not
  // relative to when the previous repeat's callback happened to fire — so
  // per-repeat overhead and setTimeout's own imprecision can't accumulate
  // into drift across a long playback session. `repeatIndex` is this Layer's
  // own repeat count; different Layers can have different loop lengths, but
  // all are anchored to the same `startTime` from when Play was pressed, so
  // they stay correctly phase-locked to each other and to the Timeline.
  function scheduleLoop(
    layerId: string,
    player: AudioPlayer,
    startTime: number,
    loopLengthSeconds: number,
    repeatIndex: number,
  ) {
    // A non-finite or non-positive value would make setTimeout fire almost
    // immediately (an invalid delay clamps to ~0), restarting the player in
    // a tight loop instead of waiting out a real bar length. Fail safe
    // instead: leave this Layer playing through once, unlooped, and surface
    // exactly what was wrong so the real source (a corrupted tempo/loop
    // length somewhere) can be tracked down.
    if (!Number.isFinite(loopLengthSeconds) || loopLengthSeconds <= 0) {
      console.warn('[idea-playback] refusing to schedule an invalid loop length', {
        layerId,
        loopLengthSeconds,
      });
      return;
    }

    const targetTime = startTime + repeatIndex * loopLengthSeconds * 1000;
    const delay = Math.max(0, targetTime - Date.now());
    const timer = setTimeout(() => {
      player.seekTo(0);
      player.play();
      // `repeatIndex` full cycles have just completed for this Layer.
      repeatCountRef.current.set(layerId, repeatIndex);
      scheduleLoop(layerId, player, startTime, loopLengthSeconds, repeatIndex + 1);
    }, delay);
    loopTimersRef.current.set(layerId, timer);
  }

  // A synchronous snapshot of real playback position, reconstructed from
  // the reference Layer's actual native player — see the interface comment
  // on getLoopProgress and docs/07_AUDIO_ARCHITECTURE.md §15-16.
  function getLoopProgress(): number | null {
    const refId = referenceLayerIdRef.current;
    if (!refId) {
      return null;
    }
    const refPlayer = playersRef.current.get(refId);
    const refLayer = layers.find((layer) => layer.id === refId);
    if (!refPlayer || !refLayer) {
      return null;
    }
    const ideaLoopDurationSeconds = loopLengthBars * barDurationSeconds;
    if (!Number.isFinite(ideaLoopDurationSeconds) || ideaLoopDurationSeconds <= 0) {
      return null;
    }
    const repeats = repeatCountRef.current.get(refId) ?? 0;
    const refLoopLengthSeconds = refLayer.loopLengthBars * barDurationSeconds;
    const elapsedSeconds = repeats * refLoopLengthSeconds + refPlayer.currentTime;
    return (elapsedSeconds % ideaLoopDurationSeconds) / ideaLoopDurationSeconds;
  }

  // Players are created lazily in play(), not here — this effect only ever
  // removes a player (and its scheduled loop) whose Layer was deleted,
  // including mid-playback; it never creates one just because a Layer
  // exists.
  useEffect(() => {
    const players = playersRef.current;
    const currentIds = new Set(layers.map((layer) => layer.id));

    for (const [id, player] of players) {
      if (!currentIds.has(id)) {
        clearLoopTimer(id);
        logAudioLifecycle('player', 'destroy', player.id, `idea-playback:${id}`);
        player.remove();
        players.delete(id);
      }
    }
  }, [layers]);

  // Mute/Solo/volume are applied here, not by pausing players, so every
  // layer keeps looping in place — toggling mute/solo mid-playback just
  // changes volume and never desyncs anything.
  useEffect(() => {
    const anySolo = layers.some((layer) => layer.solo);
    for (const layer of layers) {
      const player = playersRef.current.get(layer.id);
      if (!player) {
        continue;
      }
      const shouldBeAudible = anySolo ? layer.solo : !layer.muted;
      player.volume = shouldBeAudible ? layer.volume : 0;
    }
  }, [layers]);

  useEffect(() => {
    const players = playersRef.current;
    const timers = loopTimersRef.current;
    return () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
      for (const [id, player] of players) {
        logAudioLifecycle('player', 'destroy', player.id, `idea-playback:${id}`);
        player.remove();
      }
      players.clear();
    };
  }, []);

  async function play() {
    const session = ++sessionRef.current;
    const anySolo = layers.some((layer) => layer.solo);
    const createdThisCall: { layerId: string; player: AudioPlayer }[] = [];

    for (const layer of layers) {
      if (sessionRef.current !== session) {
        break;
      }
      if (!layer.audioPath || playersRef.current.has(layer.id)) {
        continue;
      }
      const player = createAudioPlayer(layer.audioPath);
      logAudioLifecycle('player', 'create', player.id, `idea-playback:${layer.id}`);
      const shouldBeAudible = anySolo ? layer.solo : !layer.muted;
      player.volume = shouldBeAudible ? layer.volume : 0;
      playersRef.current.set(layer.id, player);
      createdThisCall.push({ layerId: layer.id, player });
      await new Promise((resolve) => setTimeout(resolve, PLAYER_SETUP_STAGGER_MS));
    }

    if (sessionRef.current !== session) {
      // stop() (or a newer play()) ran during the staggered loop above —
      // release only what this call created. A newer call may already be
      // relying on playersRef for its own Layers, so this must not touch
      // anything it didn't itself add.
      for (const { layerId, player } of createdThisCall) {
        if (playersRef.current.get(layerId) === player) {
          playersRef.current.delete(layerId);
        }
        player.remove();
      }
      return;
    }

    const entries = layers
      .filter((layer) => playersRef.current.has(layer.id))
      .map((layer) => ({ layer, player: playersRef.current.get(layer.id) as AudioPlayer }));

    // Playback must always begin on beat one — rewind every layer before
    // starting any of them, then start them all in one pass.
    await Promise.all(entries.map(({ player }) => player.seekTo(0)));

    // stop() (or a newer play()) can run while the await above is pending —
    // it has no way to know this call is in flight, so it can't cancel it.
    // Without this check, a stop() that lands in that window would clear
    // everything, then this call would resume anyway and start players and
    // loop timers that nothing is tracking anymore — invisible to any future
    // stop(), left running and looping on their own schedule indefinitely.
    if (sessionRef.current !== session) {
      for (const { layer, player } of entries) {
        if (playersRef.current.get(layer.id) === player) {
          playersRef.current.delete(layer.id);
        }
        player.remove();
      }
      return;
    }

    const startTime = Date.now();
    referenceLayerIdRef.current = entries[0]?.layer.id ?? null;
    for (const { layer, player } of entries) {
      repeatCountRef.current.set(layer.id, 0);
      logAudioLifecycle('player', 'play', player.id, 'idea-playback');
      player.play();
      scheduleLoop(layer.id, player, startTime, layer.loopLengthBars * barDurationSeconds, 1);
    }
    setIsPlaying(true);
  }

  async function stop() {
    sessionRef.current += 1;

    for (const timer of loopTimersRef.current.values()) {
      clearTimeout(timer);
    }
    loopTimersRef.current.clear();
    referenceLayerIdRef.current = null;
    repeatCountRef.current.clear();

    // Pause every layer immediately and synchronously — silence should be
    // instant. Releasing the native players (the heavier operation, and the
    // one implicated in audio-daemon overload at higher Layer counts)
    // happens after, staggered, since nothing is audible anymore by then.
    const entries = Array.from(playersRef.current.entries());
    for (const [, player] of entries) {
      logAudioLifecycle('player', 'pause', player.id, 'idea-playback');
      player.pause();
      player.seekTo(0);
    }
    playersRef.current.clear();
    setIsPlaying(false);

    for (const [id, player] of entries) {
      logAudioLifecycle('player', 'destroy', player.id, `idea-playback:${id}`);
      player.remove();
      await new Promise((resolve) => setTimeout(resolve, PLAYER_SETUP_STAGGER_MS));
    }
  }

  return { isPlaying, play, stop, getLoopProgress };
}
