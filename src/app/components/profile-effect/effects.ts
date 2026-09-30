// Preset effects only, so nobody can put flashing or unreadable art over a profile.
export const PROFILE_EFFECTS = [{ id: 'embers', label: 'Embers' }] as const;

export type ProfileEffectId = typeof PROFILE_EFFECTS[number]['id'];

export const PROFILE_EFFECT_KEY = 'io.angaara.profile_effect';

export const parseProfileEffect = (value: string | undefined): ProfileEffectId | undefined =>
  PROFILE_EFFECTS.find((effect) => effect.id === value?.trim())?.id;
