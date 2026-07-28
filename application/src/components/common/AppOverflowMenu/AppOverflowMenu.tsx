import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  I18nManager,
  Keyboard,
  Modal,
  Pressable,
  View,
  useWindowDimensions,
} from 'react-native';
import { AppIcon, ICONS } from '../../AppIcon';
import AppText from '../../AppText/AppText';
import { COLORS } from '../../../constants';
import { moderateScale } from '../../../utils';
import { styles, MENU_METRICS } from './AppOverflowMenuStyle';
import type { AppOverflowMenuProps, OverflowMenuItem } from './types';

/** Where the popup should appear, in window coordinates. */
interface Anchor {
  top: number;
  /** Distance from whichever screen edge the menu is pinned to. */
  edge: number;
}

interface MenuRowProps {
  item: OverflowMenuItem;
  onSelect: (item: OverflowMenuItem) => void;
  isLast: boolean;
}

const MenuRow: React.FC<MenuRowProps> = ({ item, onSelect, isLast }) => {
  const blocked = Boolean(item.disabled || item.loading);
  const tint = item.destructive ? COLORS.danger : COLORS.gray900;
  const handlePress = useCallback(() => onSelect(item), [onSelect, item]);

  return (
    <Pressable
      onPress={handlePress}
      disabled={blocked}
      android_ripple={MENU_METRICS.ripple}
      accessibilityRole="menuitem"
      accessibilityState={{ disabled: blocked, busy: item.loading }}
      accessibilityLabel={item.title}
      accessibilityHint={item.description}
      style={({ pressed }) => [
        styles.row,
        !isLast && styles.rowDivider,
        pressed && !blocked && styles.rowPressed,
        blocked && styles.rowDisabled,
      ]}>
      <View style={styles.rowIcon}>
        {item.loading ? (
          <ActivityIndicator size="small" color={tint} />
        ) : (
          <AppIcon name={item.icon} size={MENU_METRICS.iconSize} color={tint} />
        )}
      </View>
      <View style={styles.rowTexts}>
        <AppText style={[styles.rowTitle, { color: tint }]} numberOfLines={1}>
          {item.title}
        </AppText>
        {item.description ? (
          <AppText style={styles.rowDescription} numberOfLines={2}>
            {item.description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
};

const MemoMenuRow = React.memo(MenuRow);

/**
 * Three-dot overflow menu with an anchored, animated popup.
 *
 * Rendered in a `Modal` so it escapes any parent `overflow: hidden` and sits
 * above the rest of the screen, which also gives free outside-tap dismissal.
 * The popup is measured against the trigger at open time, so it stays attached
 * to the button on any screen size and flips to the left edge under RTL.
 */
const AppOverflowMenu: React.FC<AppOverflowMenuProps> = ({
  items,
  color = COLORS.white,
  accessibilityLabel = 'More options',
  disabled = false,
}) => {
  const triggerRef = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const { width: windowWidth } = useWindowDimensions();

  // One driver for both fade and scale keeps them perfectly in step.
  const progress = useRef(new Animated.Value(0)).current;

  const animateTo = useCallback(
    (toValue: number, onDone?: () => void) => {
      Animated.timing(progress, {
        toValue,
        duration: toValue === 1 ? MENU_METRICS.openMs : MENU_METRICS.closeMs,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          onDone?.();
        }
      });
    },
    [progress],
  );

  const close = useCallback(() => {
    animateTo(0, () => setAnchor(null));
  }, [animateTo]);

  const open = useCallback(() => {
    // A menu opening over a focused input would otherwise sit under the keyboard.
    Keyboard.dismiss();
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const distanceFromRight = windowWidth - (x + width);
      setAnchor({
        top: y + height + MENU_METRICS.gap,
        // Pin to the same screen edge the trigger sits nearest, so the popup
        // hangs off the button rather than floating mid-screen.
        edge: Math.max(MENU_METRICS.screenMargin, I18nManager.isRTL ? x : distanceFromRight),
      });
      progress.setValue(0);
      animateTo(1);
    });
  }, [animateTo, progress, windowWidth]);

  const handleSelect = useCallback(
    (item: OverflowMenuItem) => {
      // Close first: running the action behind a dismissing popup avoids the
      // menu lingering over whatever the action opens next.
      animateTo(0, () => {
        setAnchor(null);
        item.onPress();
      });
    },
    [animateTo],
  );

  if (disabled) {
    return null;
  }

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [MENU_METRICS.scaleFrom, 1],
  });

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={open}
        android_ripple={MENU_METRICS.triggerRipple}
        hitSlop={MENU_METRICS.hitSlop}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Opens the actions menu"
        style={styles.trigger}>
        <AppIcon name={ICONS.MORE_VERTICAL} size={moderateScale(24)} color={color} />
      </Pressable>

      <Modal
        visible={anchor !== null}
        transparent
        // Animation is driven here, not by the Modal, so fade and scale can
        // share one curve.
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={close} accessibilityLabel="Dismiss menu" />
        {anchor ? (
          <Animated.View
            accessibilityViewIsModal
            accessibilityRole="menu"
            style={[
              styles.menu,
              {
                top: anchor.top,
                [I18nManager.isRTL ? 'left' : 'right']: anchor.edge,
                opacity: progress,
                transform: [{ scale }],
              },
            ]}>
            {items.map((item, index) => (
              <MemoMenuRow
                key={item.key}
                item={item}
                onSelect={handleSelect}
                isLast={index === items.length - 1}
              />
            ))}
          </Animated.View>
        ) : null}
      </Modal>
    </>
  );
};

export default React.memo(AppOverflowMenu);
