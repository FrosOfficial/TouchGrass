import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

interface WheelPickerProps {
  items: string[];
  selectedValue: string;
  onChange: (value: string) => void;
  itemHeight?: number;
  visibleItems?: number;
  accentColor?: string;
  style?: ViewStyle;
  width?: number;
}

const DEFAULT_ITEM_HEIGHT = 44;
const DEFAULT_VISIBLE = 5;

export default function WheelPicker({
  items,
  selectedValue,
  onChange,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  visibleItems = DEFAULT_VISIBLE,
  accentColor = '#00C7FC',
  style,
  width = 60,
}: WheelPickerProps) {
  const listRef = useRef<FlatList>(null);
  const containerHeight = itemHeight * visibleItems;
  const padCount = Math.floor(visibleItems / 2);

  // Pad top/bottom with empty strings so the first/last items can be centered
  const paddedItems = [
    ...Array(padCount).fill(''),
    ...items,
    ...Array(padCount).fill(''),
  ];

  const selectedIndex = items.indexOf(selectedValue);

  // Scroll to selected item on mount and when selectedValue changes externally
  useEffect(() => {
    const idx = items.indexOf(selectedValue);
    if (idx !== -1 && listRef.current) {
      setTimeout(() => {
        listRef.current?.scrollToOffset({
          offset: idx * itemHeight,
          animated: false,
        });
      }, 50);
    }
  }, [selectedValue]);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const idx = Math.round(offsetY / itemHeight);
      const clamped = Math.max(0, Math.min(idx, items.length - 1));
      if (items[clamped] !== selectedValue) {
        onChange(items[clamped]);
      }
    },
    [items, itemHeight, selectedValue, onChange]
  );

  const renderItem = ({ item, index }: { item: string; index: number }) => {
    const realIndex = index - padCount;
    const isSelected = realIndex === selectedIndex;
    const distance = Math.abs(realIndex - selectedIndex);

    // Calculate opacity and scale based on distance from center
    let opacity = 1;
    let scale = 1;
    let color = '#FFFFFF';
    if (distance === 0) {
      opacity = 1;
      scale = 1.05;
      color = accentColor;
    } else if (distance === 1) {
      opacity = 0.55;
      scale = 0.92;
      color = '#AAAAAA';
    } else {
      opacity = 0.2;
      scale = 0.82;
      color = '#666666';
    }

    if (item === '') {
      return <View style={{ height: itemHeight, width }} />;
    }

    return (
      <View
        style={[
          styles.item,
          { height: itemHeight, width },
        ]}
      >
        <Text
          style={[
            styles.itemText,
            {
              opacity,
              transform: [{ scale }],
              color,
              fontWeight: isSelected ? '900' : '700',
              fontSize: isSelected ? 22 : 18,
            },
          ]}
        >
          {item}
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { height: containerHeight, width }, style]}>
      {/* Center highlight band */}
      <View
        pointerEvents="none"
        style={[
          styles.highlight,
          {
            top: itemHeight * padCount,
            height: itemHeight,
            borderColor: accentColor + '66',
          },
        ]}
      />

      <FlatList
        ref={listRef}
        data={paddedItems}
        keyExtractor={(_, i) => i.toString()}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        getItemLayout={(_, index) => ({
          length: itemHeight,
          offset: itemHeight * index,
          index,
        })}
        contentContainerStyle={{ paddingVertical: 0 }}
        scrollEventThrottle={16}
        bounces={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    position: 'relative',
  },
  highlight: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: 1,
    pointerEvents: 'none',
  },
  item: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontFamily: 'System',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
});
