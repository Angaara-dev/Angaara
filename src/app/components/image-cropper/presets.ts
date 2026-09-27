import type { CropPreset } from './ImageCropper';

// Each shape matches where the image is shown; sizes are 3x that for sharp screens.
export const AVATAR_CROP: CropPreset = {
  title: 'Crop Avatar',
  aspect: 1,
  width: 512,
  height: 512,
  round: true,
};
export const ROOM_AVATAR_CROP: CropPreset = {
  title: 'Crop Icon',
  aspect: 1,
  width: 512,
  height: 512,
};
// Profile card banner: 340 x 120.
export const PROFILE_BANNER_CROP: CropPreset = {
  title: 'Crop Banner',
  aspect: 340 / 120,
  width: 1020,
  height: 360,
};
// Sidebar panel behind your name: 240 x 56.
export const PANEL_BG_CROP: CropPreset = {
  title: 'Crop Panel Background',
  aspect: 240 / 56,
  width: 720,
  height: 168,
};
// Space room list header: 256 x 112.
export const SPACE_BANNER_CROP: CropPreset = {
  title: 'Crop Banner',
  aspect: 256 / 112,
  width: 960,
  height: 420,
};

// On-screen sizes, so settings previews show the same crop people will see.
export const SPACE_BANNER_PREVIEW = { width: 256, height: 112 };
export const PROFILE_BANNER_PREVIEW = { width: 340, height: 120 };
export const PANEL_BG_PREVIEW = { width: 240, height: 56 };
