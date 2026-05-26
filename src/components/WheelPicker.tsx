import React, { useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  ViewStyle,
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
  const scrollRef = useRef<ScrollView>(null);
  const containerHeight = itemHeight * visibleItems;
  const padCount = Math.floor(visibleItems / 2);

  const selectedIndex = items.indexOf(selectedValue);

  // Scroll to selected item on mount and when selectedValue changes externally
  useEffect(() => {
    const idx = items.indexOf(selectedValue);
    if (idx !== -1 && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: idx * itemHeight,
          animated: false,
        });
      }, 50);
    }
  }, [selectedValue, itemHeight]);

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

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={handleScrollEnd}
        scrollEventThrottle={16}
        bounces={false}
        nestedScrollEnabled={true}
        contentContainerStyle={{ paddingVertical: itemHeight * padCount }}
      >
        {items.map((item, index) => {
          const distance = Math.abs(index - selectedIndex);
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

          return (
            <View
              key={index}
              style={[styles.item, { height: itemHeight, width }]}
            >
              <Text
                style={[
                  styles.itemText,
                  {
                    opacity,
                    transform: [{ scale }],
                    color,
                    fontWeight: distance === 0 ? '900' : '700',
                    fontSize: distance === 0 ? 22 : 18,
                  },
                ]}
              >
                {item}
              </Text>
            </View>
          );
        })}
      </ScrollView>
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
