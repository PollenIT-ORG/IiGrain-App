import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

export const SHEET_SPRING: WithSpringConfig = {
  damping: 24,
  stiffness: 260,
  mass: 0.9,
  overshootClamping: false,
};

export const SHEET_CLOSE_TIMING: WithTimingConfig = { duration: 240 };

export const BACKDROP_IN_TIMING: WithTimingConfig = { duration: 220 };
export const BACKDROP_OUT_TIMING: WithTimingConfig = { duration: 200 };

export const CHECKBOX_TIMING: WithTimingConfig = { duration: 170 };

export const ENTRANCE_TIMING: WithTimingConfig = { duration: 380 };

export const PRESS_SCALE = 0.97;
export const PRESS_TIMING: WithTimingConfig = { duration: 110 };

export const SHEET_DISMISS_DISTANCE = 120;
export const SHEET_DISMISS_VELOCITY = 800;
