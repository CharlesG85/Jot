import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { File } from 'expo-file-system';
import { useState } from 'react';
import { Alert, Linking } from 'react-native';

import type { RecordingPhase } from '@/services/audio-service';
import { storageService } from '@/services/sqlite-storage-service';
import type { Layer } from '@/models/layer';

interface UseLayerRecorderResult {
  phase: RecordingPhase;
  durationMillis: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

/** Records a new Layer for an Idea. See docs/03_ROADMAP.md Stage 4 and src/services/audio-service.ts. */
export function useLayerRecorder(
  ideaId: string,
  onLayerRecorded: (layer: Layer) => void,
): UseLayerRecorderResult {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [phase, setPhase] = useState<RecordingPhase>('idle');

  async function start() {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Microphone Access Needed',
        'Jot needs microphone access to record. Enable it in Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    setPhase('recording');
  }

  async function stop() {
    setPhase('processing');
    try {
      await recorder.stop();
      const uri = recorder.uri;
      if (!uri) {
        throw new Error('Recording produced no file');
      }

      const existingLayers = await storageService.listLayers(ideaId);
      const layer = await storageService.createLayer(ideaId, {
        name: `Layer ${existingLayers.length + 1}`,
      });

      const bytes = await new File(uri).bytes();
      const savedPath = await storageService.saveRecording(layer.id, bytes);
      const updatedLayer = await storageService.updateLayer(layer.id, { audioPath: savedPath });
      await storageService.touchIdea(ideaId);

      onLayerRecorded(updatedLayer);
    } catch (error) {
      console.error('Failed to save recording', error);
      Alert.alert(
        'Recording Failed',
        'Something went wrong saving your recording. Please try again.',
      );
    } finally {
      setPhase('idle');
    }
  }

  return { phase, durationMillis: recorderState.durationMillis, start, stop };
}
