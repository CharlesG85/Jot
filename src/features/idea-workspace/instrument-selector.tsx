import { SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  runOnJS,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ALL_INSTRUMENTS, INSTRUMENT_DEFINITIONS, type InstrumentId } from '@/models/instrument';

// Shown for any instrument whose definition doesn't set its own `icon` —
// see InstrumentDefinition.icon in models/instrument.ts.
const FALLBACK_ICON = 'music.note';

interface InstrumentSelectorProps {
  value: InstrumentId;
  onChange: (instrument: InstrumentId) => void;
}

/**
 * A tap-to-open panel listing every instrument, rather than a segmented
 * control — a row of fixed-width segments stops scaling once there are more
 * than a handful of options, where a scrollable list in a sheet has no
 * practical ceiling as more instruments are added to
 * models/instrument.ts's INSTRUMENT_DEFINITIONS.
 */
export function InstrumentSelector({ value, onChange }: InstrumentSelectorProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Split into two: `isMounted` controls the Modal itself (so it stays
  // rendered long enough for the exit animations below to actually play —
  // Modal unmounts its content the instant `visible` goes false, which
  // would otherwise cut the close animation off completely), `isOpen`
  // drives which animation direction (entering/exiting) is active.
  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const selected = INSTRUMENT_DEFINITIONS[value];

  function open() {
    setIsMounted(true);
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
  }

  return (
    <>
      <Pressable
        accessibilityLabel="Choose instrument"
        onPress={open}
        style={[styles.trigger, { backgroundColor: theme.backgroundElement }]}
      >
        <View style={styles.triggerLeft}>
          <SymbolView name={selected.icon ?? FALLBACK_ICON} tintColor={theme.text} size={18} />
          <ThemedText style={Typography.body}>{selected.name}</ThemedText>
        </View>
        <SymbolView name="chevron.up.chevron.down" tintColor={theme.textSecondary} size={14} />
      </Pressable>

      {/* animationType="none": RN's own "slide"/"fade" animate the Modal's
          entire content as a single block, which is exactly why the backdrop
          used to visibly drag upward with the sheet — they were both caught
          in one shared transform. The backdrop and sheet below each get
          their own independent Animated.View instead. */}
      <Modal visible={isMounted} transparent animationType="none" onRequestClose={close}>
        <View style={styles.modalRoot} pointerEvents={isOpen ? 'auto' : 'none'}>
          {isOpen && (
            <Animated.View
              entering={FadeIn.duration(200)}
              exiting={FadeOut.duration(200)}
              style={styles.backdrop}
            >
              <Pressable
                accessibilityLabel="Close instrument picker"
                style={styles.backdropTouchable}
                onPress={close}
              />
            </Animated.View>
          )}
          {isOpen && (
            <Animated.View
              entering={SlideInDown.duration(250)}
              exiting={SlideOutDown.duration(250).withCallback((finished) => {
                'worklet';
                if (finished) {
                  runOnJS(setIsMounted)(false);
                }
              })}
              style={styles.sheetWrapper}
            >
              <ThemedView
                type="backgroundElement"
                style={[styles.sheet, { paddingBottom: insets.bottom + Spacing.three }]}
              >
                <View style={styles.sheetHeader}>
                  <ThemedText style={styles.sheetTitle}>Instrument</ThemedText>
                  <Pressable accessibilityLabel="Done" onPress={close}>
                    <ThemedText style={styles.doneLabel} themeColor="accent">
                      Done
                    </ThemedText>
                  </Pressable>
                </View>
                <ScrollView
                  style={styles.optionList}
                  contentContainerStyle={styles.optionListContent}
                >
                  {ALL_INSTRUMENTS.map((instrumentId) => {
                    const definition = INSTRUMENT_DEFINITIONS[instrumentId];
                    const isSelected = instrumentId === value;
                    return (
                      <Pressable
                        key={instrumentId}
                        accessibilityLabel={definition.name}
                        onPress={() => {
                          onChange(instrumentId);
                          close();
                        }}
                        style={[
                          styles.option,
                          isSelected && { backgroundColor: theme.backgroundSelected },
                        ]}
                      >
                        <SymbolView
                          name={definition.icon ?? FALLBACK_ICON}
                          tintColor={theme.text}
                          size={20}
                        />
                        <ThemedText style={[Typography.body, styles.optionLabel]}>
                          {definition.name}
                        </ThemedText>
                        {isSelected && (
                          <SymbolView name="checkmark" tintColor={theme.accent} size={18} />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </ThemedView>
            </Animated.View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
  },
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Radius.medium,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  triggerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  backdropTouchable: {
    flex: 1,
  },
  // Absolute + bottom: 0, not flex layout — guarantees the sheet's bottom
  // edge always lands exactly at the screen's true bottom edge, regardless
  // of how the surrounding flex layout resolves. The sheet's own content
  // is what gets inset from the true edge (see paddingBottom below, using
  // the device's actual safe-area inset), not this wrapper's position.
  sheetWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  sheet: {
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    maxHeight: '70%',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.3)',
  },
  sheetTitle: {
    ...Typography.headline,
  },
  doneLabel: {
    ...Typography.body,
    fontWeight: '600',
  },
  optionList: {
    flexGrow: 0,
  },
  optionListContent: {
    padding: Spacing.two,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  optionLabel: {
    flex: 1,
  },
});
