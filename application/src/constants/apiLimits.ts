export const API_LIMITS = {
  farm: {
    name: 150,
    location: 500,
    businessEntity: 200,
  },
  field: {
    name: 150,
    crop: 100,
    season: 100,
    irrigation: 100,
  },
  soil: {
    texture: 50,
    notes: 2000,
  },
} as const;
