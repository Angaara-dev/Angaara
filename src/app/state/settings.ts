import { atom } from 'jotai';

const STORAGE_KEY = 'settings';
export type DateFormat =
  | 'D MMM YYYY'
  | 'DD/MM/YYYY'
  | 'MM/DD/YYYY'
  | 'YYYY/MM/DD'
  | 'YYYY-MM-DD'
  | '';
export type MessageSpacing = '0' | '100' | '200' | '300' | '400' | '500';
export enum MessageLayout {
  Modern = 0,
  Compact = 1,
  Bubble = 2,
}

export interface Settings {
  themeId?: string;
  useSystemTheme: boolean;
  lightThemeId?: string;
  darkThemeId?: string;
  monochromeMode?: boolean;
  // Hex color replacing the theme's primary color; unset keeps the theme's own.
  accentColor?: string;
  isMarkdown: boolean;
  editorToolbar: boolean;
  twitterEmoji: boolean;
  pageZoom: number;
  // Phones only: scales chat text, avatars and the message box, in percent.
  phoneMessageScale: number;
  // Phones only: fling speed limit from 1 (calmest) to 10 (native scrolling).
  phoneScrollSpeed: number;
  hideActivity: boolean;
  privateMode: boolean;

  isPeopleDrawer: boolean;
  memberSortFilterIndex: number;
  enterForNewline: boolean;
  messageLayout: MessageLayout;
  messageSpacing: MessageSpacing;
  hideJoinLeaveEvents: boolean;
  hideNickAvatarEvents: boolean;
  mediaAutoLoad: boolean;
  urlPreview: boolean;
  encUrlPreview: boolean;
  showHiddenEvents: boolean;
  legacyUsernameColor: boolean;

  showNotifications: boolean;
  // Renamed from isNotificationSounds so the new off-by-default reaches existing users too.
  notificationSounds: boolean;
  // Count XP from the IDs and times of messages you send; off stops all reporting.
  earnXp: boolean;
  // How loud other people's soundboard sounds play for you, 0 to 100.
  soundboardVolume: number;
  soundboardMuted: boolean;
  // Call tiles take a colour from each person's avatar; off keeps them grey.
  callTileColors: boolean;
  // Resolution your screen shares go out at (720, 1080 or 1440).
  screenShareQuality: 720 | 1080 | 1440;

  hour24Clock: boolean;
  dateFormatString: string;

  developerTools: boolean;
}

const defaultSettings: Settings = {
  themeId: undefined,
  useSystemTheme: false,
  lightThemeId: undefined,
  darkThemeId: undefined,
  monochromeMode: false,
  accentColor: undefined,
  isMarkdown: true,
  editorToolbar: false,
  twitterEmoji: false,
  pageZoom: 100,
  phoneMessageScale: 100,
  phoneScrollSpeed: 5,
  hideActivity: false,
  privateMode: false,

  isPeopleDrawer: true,
  memberSortFilterIndex: 0,
  enterForNewline: false,
  messageLayout: 0,
  messageSpacing: '400',
  hideJoinLeaveEvents: true,
  hideNickAvatarEvents: true,
  mediaAutoLoad: true,
  urlPreview: true,
  encUrlPreview: false,
  showHiddenEvents: false,
  legacyUsernameColor: false,

  showNotifications: true,
  notificationSounds: false,
  earnXp: true,
  soundboardVolume: 70,
  soundboardMuted: false,
  callTileColors: true,
  screenShareQuality: 1080,

  hour24Clock: false,
  dateFormatString: 'D MMM YYYY',

  developerTools: false,
};

export const getSettings = () => {
  const settings = localStorage.getItem(STORAGE_KEY);
  if (settings === null) return defaultSettings;
  return {
    ...defaultSettings,
    ...(JSON.parse(settings) as Settings),
  };
};

export const setSettings = (settings: Settings) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const baseSettings = atom<Settings>(getSettings());
export const settingsAtom = atom<Settings, [Settings], undefined>(
  (get) => get(baseSettings),
  (get, set, update) => {
    set(baseSettings, update);
    setSettings(update);
  }
);
