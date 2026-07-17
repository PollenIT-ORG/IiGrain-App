import type { ImageSourcePropType } from 'react-native';

export const FARMER_SCENE: {
  sky?: ImageSourcePropType;
  clouds?: ImageSourcePropType;
  field?: ImageSourcePropType;
  plants?: ImageSourcePropType;
  farmer?: ImageSourcePropType;
  hat?: ImageSourcePropType;
  shovel?: ImageSourcePropType;
  bushes?: ImageSourcePropType;
} = {
};

export const HAS_FARMER_SCENE = Object.keys(FARMER_SCENE).length > 0;
