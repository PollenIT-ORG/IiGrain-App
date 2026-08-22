import React from 'react';
import { Image, Platform, StatusBar, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, DrawerActions, type NavigationProp } from '@react-navigation/native';
import { IMAGES } from '../../assets/images';
import { COLORS } from '../../constants';
import { moderateScale } from '../../utils';
import { AppIcon, ICONS } from '../AppIcon';
import AppText from '../AppText/AppText';
import AppGradient from '../AppGradient/AppGradient';
import AppStatusBar from '../AppStatusBar/AppStatusBar';
import { useAppSelector } from '../../redux/hooks';
import { selectUnreadCount } from '../../redux/slices/notificationSlice';
import { styles } from './AppHeaderStyle';
import type { AppHeaderProps, HeaderAction } from './types';

type NotificationCapableParamList = { Notifications: undefined };

const ACTION_ICON: Record<HeaderAction, string> = {
  notification: 'bell-outline',
  profile:      'account-circle-outline',
  search:       'magnify',
  filter:       'filter-variant',
  add:          'plus',
  edit:         'pencil-outline',
};

const ICON_SIZE = moderateScale(24);
const HIT_SLOP  = { top: 8, bottom: 8, left: 8, right: 8 };

const AppHeader: React.FC<AppHeaderProps> = ({
  variant = 'title',
  title,
  showDrawer = false,
  rightActions = [],
  onActionPress,
  onBack,
  centerComponent,
  leftComponent,
  rightComponent,
  bgColor,
}) => {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(
    insets.top,
    Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0,
  );
  const navigation = useNavigation();
  const unreadCount = useAppSelector(selectUnreadCount);

  const openDrawer = () => navigation.dispatch(DrawerActions.openDrawer());
  const goBack = () => (onBack ? onBack() : navigation.goBack());
  const handleActionPress = (action: HeaderAction) => {
    if (action === 'notification' && !onActionPress) {
      (navigation as unknown as NavigationProp<NotificationCapableParamList>).navigate(
        'Notifications',
      );
      return;
    }
    onActionPress?.(action);
  };

  const isWhite = Boolean(bgColor);
  const iconColor = isWhite ? COLORS.primary : COLORS.white;

  const renderLeft = () => {
    if (variant === 'back') {
      return (
        <TouchableOpacity
          onPress={goBack}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <AppIcon name={ICONS.CHEVRON_LEFT} size={moderateScale(28)} color={iconColor} />
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.leftGroup}>
        {showDrawer && variant !== 'logo' ? (
          <TouchableOpacity
            onPress={openDrawer}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Open menu">
            <AppIcon name={ICONS.MENU} size={ICON_SIZE} color={iconColor} />
          </TouchableOpacity>
        ) : null}

        {variant === 'logo' ? (
          <Image source={IMAGES.logo} style={styles.logo} resizeMode="contain" />
        ) : null}

        {leftComponent}
      </View>
    );
  };

  const renderCenter = () => {
    if (variant === 'custom') {
      return <View style={styles.center}>{centerComponent}</View>;
    }
    if ((variant === 'title' || variant === 'back') && title) {
      return (
        <View style={styles.center}>
          <AppText style={[styles.title, isWhite && styles.titleDark]} numberOfLines={1}>
            {title}
          </AppText>
        </View>
      );
    }
    return <View style={styles.center} />;
  };

  const renderRight = () => (
    <View style={styles.rightGroup}>
      {(rightActions ?? []).map(action => (
        <TouchableOpacity
          key={action}
          onPress={() => handleActionPress(action)}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel={action}>
          <View>
            <AppIcon name={ACTION_ICON[action]} size={ICON_SIZE} color={iconColor} />
            {action === 'notification' && unreadCount > 0 ? (
              <View style={styles.badge}>
                <AppText style={styles.badgeText} numberOfLines={1}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </AppText>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
      {rightComponent}
    </View>
  );

  const barContent = (
    <View style={styles.bar}>
      <View style={styles.side}>{renderLeft()}</View>
      {renderCenter()}
      <View style={[styles.side, styles.sideRight]}>{renderRight()}</View>
    </View>
  );

  if (!isWhite) {
    return (
      <>
        <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        <AppGradient
          variant="header"
          style={[styles.wrapper, { paddingTop: topInset }]}>
          {barContent}
        </AppGradient>
      </>
    );
  }

  return (
    <>
      <AppStatusBar />
      <View style={styles.wrapperWhite}>
        {barContent}
      </View>
    </>
  );
};

export default AppHeader;
