import { SymbolView } from 'expo-symbols';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, Typography } from '@/constants/theme';
import { LayerCard } from '@/features/idea-workspace/layer-card';
import { useTheme } from '@/hooks/use-theme';
import type { Layer } from '@/models/layer';
import { logRender } from '@/utils/render-logger';

const ROW_HEIGHT = 56;
const ROW_TOTAL_HEIGHT = ROW_HEIGHT + Spacing.two;

interface ReorderableLayerListProps {
  layers: Layer[];
  isEditing: boolean;
  onRename: (layerId: string, name: string) => void;
  onToggleMute: (layerId: string) => void;
  onToggleSolo: (layerId: string) => void;
  onDelete: (layerId: string) => void;
  onReorder: (orderedLayers: Layer[]) => void;
}

/**
 * Renders full LayerCards normally, or simplified drag-handle rows while
 * `isEditing` — mirrors iOS's own list-edit convention so dragging never
 * competes with each card's swipe-to-delete/export gesture.
 */
export function ReorderableLayerList({
  layers,
  isEditing,
  onRename,
  onToggleMute,
  onToggleSolo,
  onDelete,
  onReorder,
}: ReorderableLayerListProps) {
  logRender('ReorderableLayerList');
  // Shared across every row so each one can react to where the dragged row
  // currently hovers and spring out of the way — must stay above any early
  // return so hook order never changes between renders. Identified by the
  // dragged layer's id (not its array index), since the index is exactly
  // what a reorder changes.
  const draggedLayerId = useSharedValue<string | null>(null);
  const draggedOriginIndex = useSharedValue(0);
  const dragTranslateY = useSharedValue(0);
  // Non-null only while settling after a release — freezes the target slot
  // so other rows stop reading the (spring-overshooting) live drag position.
  const settledTargetIndex = useSharedValue<number | null>(null);

  if (!isEditing) {
    return (
      <View style={styles.list}>
        {layers.map((layer) => (
          <LayerCard
            key={layer.id}
            layer={layer}
            onRename={(name) => onRename(layer.id, name)}
            onToggleMute={() => onToggleMute(layer.id)}
            onToggleSolo={() => onToggleSolo(layer.id)}
            onDelete={() => onDelete(layer.id)}
          />
        ))}
      </View>
    );
  }

  function handleDrop(fromIndex: number, toIndex: number) {
    const next = [...layers];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onReorder(next);
    // Reset the shared drag state in the same tick as the actual reorder,
    // not before — resetting earlier (e.g. in the spring's finished
    // callback) snaps every row's transform to 0 while they're still laid
    // out in the *old* order, then the real reorder lands a beat later and
    // snaps them again (unanimated) to the new order. Doing both together
    // means the transform and the layout swap over at the same instant.
    draggedLayerId.value = null;
    dragTranslateY.value = 0;
    settledTargetIndex.value = null;
  }

  return (
    <View style={styles.list}>
      {layers.map((layer, index) => (
        <DraggableRow
          key={layer.id}
          layer={layer}
          index={index}
          count={layers.length}
          draggedLayerId={draggedLayerId}
          draggedOriginIndex={draggedOriginIndex}
          dragTranslateY={dragTranslateY}
          settledTargetIndex={settledTargetIndex}
          onDrop={handleDrop}
        />
      ))}
    </View>
  );
}

function DraggableRow({
  layer,
  index,
  count,
  draggedLayerId,
  draggedOriginIndex,
  dragTranslateY,
  settledTargetIndex,
  onDrop,
}: {
  layer: Layer;
  index: number;
  count: number;
  draggedLayerId: SharedValue<string | null>;
  draggedOriginIndex: SharedValue<number>;
  dragTranslateY: SharedValue<number>;
  settledTargetIndex: SharedValue<number | null>;
  onDrop: (fromIndex: number, toIndex: number) => void;
}) {
  const theme = useTheme();

  /* eslint-disable react-hooks/immutability --
   * Reanimated SharedValues are mutable-by-design UI-thread containers;
   * assigning `.value` (even when the SharedValue is passed down as a
   * prop) is the documented, correct way to use them — it isn't real
   * React prop mutation, which is what this rule is meant to catch. */
  const gesture = Gesture.Pan()
    .onBegin(() => {
      draggedLayerId.value = layer.id;
      draggedOriginIndex.value = index;
      dragTranslateY.value = 0;
      settledTargetIndex.value = null;
    })
    .onUpdate((event) => {
      dragTranslateY.value = event.translationY;
    })
    .onEnd(() => {
      const originIndex = draggedOriginIndex.value;
      const targetIndex = Math.min(
        count - 1,
        Math.max(0, Math.round(originIndex + dragTranslateY.value / ROW_TOTAL_HEIGHT)),
      );
      // Freeze the target now, before the settle spring even starts — other
      // rows key their shift off this fixed value instead of continuing to
      // read the live drag position, which briefly overshoots past the
      // target (default spring physics) and would otherwise flip their
      // shift back and forth for a frame or two as it settles.
      settledTargetIndex.value = targetIndex;
      // Spring all the way to the exact slot the row will land in, so the
      // transform and the eventual reordered flex layout describe the same
      // position. Only once that settle finishes do we reset the transform
      // and hand off to the real reorder — never both at once, so nothing
      // ever visibly jumps between "animated position" and "layout position."
      const settledOffset = (targetIndex - originIndex) * ROW_TOTAL_HEIGHT;
      dragTranslateY.value = withSpring(settledOffset, undefined, (finished) => {
        if (!finished) {
          return;
        }
        if (targetIndex === originIndex) {
          // Nothing will reorder, so there's no "landing" to wait for —
          // safe to reset immediately.
          dragTranslateY.value = 0;
          draggedLayerId.value = null;
          settledTargetIndex.value = null;
        } else {
          // Defer the reset to `onDrop` (see handleDrop), which runs it in
          // the same tick as the actual array reorder.
          runOnJS(onDrop)(originIndex, targetIndex);
        }
      });
    });
  /* eslint-enable react-hooks/immutability */

  const animatedStyle = useAnimatedStyle(() => {
    const isBeingDragged = draggedLayerId.value === layer.id;

    if (isBeingDragged) {
      return {
        transform: [{ translateY: dragTranslateY.value }],
        zIndex: 1,
      };
    }

    if (draggedLayerId.value === null) {
      return { transform: [{ translateY: 0 }], zIndex: 0 };
    }

    const hoveredIndex =
      settledTargetIndex.value !== null
        ? settledTargetIndex.value
        : Math.min(
            count - 1,
            Math.max(
              0,
              Math.round(draggedOriginIndex.value + dragTranslateY.value / ROW_TOTAL_HEIGHT),
            ),
          );

    let shift = 0;
    if (draggedOriginIndex.value < index && hoveredIndex >= index) {
      // The dragged row has moved down past this row — shift up to open its old slot.
      shift = -ROW_TOTAL_HEIGHT;
    } else if (draggedOriginIndex.value > index && hoveredIndex <= index) {
      // The dragged row has moved up past this row — shift down to open its old slot.
      shift = ROW_TOTAL_HEIGHT;
    }

    return {
      transform: [{ translateY: withSpring(shift) }],
      zIndex: 0,
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <ThemedView type="backgroundElement" style={styles.editRow}>
        <GestureDetector gesture={gesture}>
          <View accessibilityLabel="Drag to reorder" hitSlop={8} style={styles.dragHandle}>
            <SymbolView name="line.3.horizontal" tintColor={theme.textSecondary} size={18} />
          </View>
        </GestureDetector>
        <ThemedText style={styles.editRowName} numberOfLines={1}>
          {layer.name}
        </ThemedText>
      </ThemedView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.two,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ROW_HEIGHT,
    borderRadius: Radius.large,
    paddingHorizontal: Spacing.three,
    gap: Spacing.three,
  },
  dragHandle: {
    padding: Spacing.one,
  },
  editRowName: {
    ...Typography.headline,
    flex: 1,
  },
});
