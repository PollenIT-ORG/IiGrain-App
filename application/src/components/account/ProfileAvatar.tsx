import React from 'react';
import {
  Image,
  View,
  type ImageStyle,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import AppText from '../AppText/AppText';
import { AppShimmerAvatar } from '../Shimmer';
import { useAppSelector } from '../../redux/hooks';
import { selectProfileIdentity } from '../../redux/selectors/profileSelectors';

export interface ProfileAvatarProps {
  size: number;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * The signed-in user's avatar, resolved from the single profile identity
 * selector. Every placement reads the same state, so an upload or removal is
 * reflected everywhere in the same render — and no placement can silently lose
 * its loading state the way hand-rolled copies did.
 */
const ProfileAvatar: React.FC<ProfileAvatarProps> = ({
  size,
  style,
  imageStyle,
  textStyle,
}) => {
  const identity = useAppSelector(selectProfileIdentity);

  if (identity.isHydrating) {
    return <AppShimmerAvatar size={size} />;
  }

  return (
    <View style={style}>
      {identity.avatarUrl ? (
        <Image source={{ uri: identity.avatarUrl }} style={imageStyle} />
      ) : (
        <AppText style={textStyle}>{identity.initials}</AppText>
      )}
    </View>
  );
};

export default ProfileAvatar;
