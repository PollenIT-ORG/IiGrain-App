import type { BoundaryRejectionCode } from '../types';
import { MIN_VERTICES } from './boundaryConfig';

export const BOUNDARY_REJECTION_MESSAGES: Record<BoundaryRejectionCode, string> = {
  crossing: 'That would make the boundary cross itself, so the point stayed put.',
  'min-vertices': `A field needs at least ${MIN_VERTICES} points.`,
  'too-close': 'That point sits on top of its neighbour. Move it a little further.',
  'not-closed': 'Add one more point before you finish the shape.',
};

export const BOUNDARY_HINTS = {
  drawEmpty: 'Tap each corner of your field on the map.',
  drawOne: 'Good. Tap the next corner.',
  drawTwo: 'One more corner and the field takes shape.',
  drawReady: 'Keep tapping corners, or tap point 1 to finish.',
  editIdle: 'Tap a point to select it, or drag an orange dot to stretch an edge.',
  editSelected: 'Nudge it with the arrows, or press and hold the point to drag it.',
  editBlocked: 'Edges would cross here — the point is held at the last valid spot.',
} as const;
