import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef, useState } from 'react';

import type { Layer } from '@/models/layer';

interface UseIdeaPlaybackResult {
  isPlaying: boolean;
  play: () => Promise<void>;
  stop: () => void;
}

/**
 * Plays every Layer of an Idea together, looping and synchronized.
 * See docs/03_ROADMAP.md Stage 6 and docs/07_AUDIO_ARCHITECTURE.md §6-7.
 */
export function useIdeaPlayback(layers: Layer[]): UseIdeaPlaybackResult {
  const playersRef = useRef<Map<string, AudioPlayer>>(new Map());
  const [isPlaying, setIsPlaying] = useState(false);

  // Keep the player pool in sync with the current Layers — one native
  // AudioPlayer per Layer, each looping gaplessly at its own file's end.
  useEffect(() => {
    const players = playersRef.current;
    const currentIds = new Set(layers.map((layer) => layer.id));

    for (const [id, player] of players) {
      if (!currentIds.has(id)) {
        player.remove();
        players.delete(id);
      }
    }

    for (const layer of layers) {
      if (layer.audioPath && !players.has(layer.id)) {
        const player = createAudioPlayer(layer.audioPath);
        player.loop = true;
        players.set(layer.id, player);
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
    return () => {
      for (const player of players.values()) {
        player.remove();
      }
      players.clear();
    };
  }, []);

  async function play() {
    const players = Array.from(playersRef.current.values());
    // Playback must always begin on beat one — rewind every layer before
    // starting any of them, then start them all in one pass.
    await Promise.all(players.map((player) => player.seekTo(0)));
    for (const player of players) {
      player.play();
    }
    setIsPlaying(true);
  }

  function stop() {
    for (const player of playersRef.current.values()) {
      player.pause();
      player.seekTo(0);
    }
    setIsPlaying(false);
  }

  return { isPlaying, play, stop };
}
