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
