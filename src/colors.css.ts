import { createTheme } from '@vanilla-extract/css';
import { color } from 'folds';

export const silverTheme = createTheme(color, {
  Background: {
    Container: '#DEDEDE',
    ContainerHover: '#D3D3D3',
    ContainerActive: '#C7C7C7',
    ContainerLine: '#BBBBBB',
    OnContainer: '#000000',
  },

  Surface: {
    Container: '#EAEAEA',
    ContainerHover: '#DEDEDE',
    ContainerActive: '#D3D3D3',
    ContainerLine: '#C7C7C7',
    OnContainer: '#000000',
  },

  SurfaceVariant: {
    Container: '#DEDEDE',
    ContainerHover: '#D3D3D3',
    ContainerActive: '#C7C7C7',
    ContainerLine: '#BBBBBB',
    OnContainer: '#000000',
  },

  Primary: {
    Main: '#1245A8',
    MainHover: '#103E97',
    MainActive: '#0F3B8F',
    MainLine: '#0E3786',
    OnMain: '#FFFFFF',
    Container: '#C4D0E9',
    ContainerHover: '#B8C7E5',
    ContainerActive: '#ACBEE1',
    ContainerLine: '#A0B5DC',
    OnContainer: '#0D3076',
  },

  Secondary: {
    Main: '#000000',
    MainHover: '#171717',
    MainActive: '#232323',
    MainLine: '#2F2F2F',
    OnMain: '#EAEAEA',
    Container: '#C7C7C7',
    ContainerHover: '#BBBBBB',
    ContainerActive: '#AFAFAF',
    ContainerLine: '#A4A4A4',
    OnContainer: '#0C0C0C',
  },

  Success: {
    Main: '#017343',
    MainHover: '#01683C',
    MainActive: '#016239',
    MainLine: '#015C36',
    OnMain: '#FFFFFF',
    Container: '#BFDCD0',
    ContainerHover: '#B3D5C7',
    ContainerActive: '#A6CEBD',
    ContainerLine: '#99C7B4',
    OnContainer: '#01512F',
  },

  Warning: {
    Main: '#864300',
    MainHover: '#793C00',
    MainActive: '#723900',
    MainLine: '#6B3600',
    OnMain: '#FFFFFF',
    Container: '#E1D0BF',
    ContainerHover: '#DBC7B2',
    ContainerActive: '#D5BDA6',
    ContainerLine: '#CFB499',
    OnContainer: '#5E2F00',
  },

  Critical: {
    Main: '#9D0F0F',
    MainHover: '#8D0E0E',
    MainActive: '#850D0D',
    MainLine: '#7E0C0C',
    OnMain: '#FFFFFF',
    Container: '#E7C3C3',
    ContainerHover: '#E2B7B7',
    ContainerActive: '#DDABAB',
    ContainerLine: '#D89F9F',
    OnContainer: '#6E0B0B',
  },

  Other: {
    FocusRing: 'rgba(0 0 0 / 50%)',
    Shadow: 'rgba(0 0 0 / 20%)',
    Overlay: 'rgba(0 0 0 / 50%)',
  },
});

const darkThemeData = {
  Background: {
    Container: '#1A1A1A',
    ContainerHover: '#262626',
    ContainerActive: '#333333',
    ContainerLine: '#404040',
    OnContainer: '#F2F2F2',
  },

  Surface: {
    Container: '#262626',
    ContainerHover: '#333333',
    ContainerActive: '#404040',
    ContainerLine: '#4D4D4D',
    OnContainer: '#F2F2F2',
  },

  SurfaceVariant: {
    Container: '#333333',
    ContainerHover: '#404040',
    ContainerActive: '#4D4D4D',
    ContainerLine: '#595959',
    OnContainer: '#F2F2F2',
  },

  Primary: {
    Main: '#BDB6EC',
    MainHover: '#B2AAE9',
    MainActive: '#ADA3E8',
    MainLine: '#A79DE6',
    OnMain: '#2C2843',
    Container: '#413C65',
    ContainerHover: '#494370',
    ContainerActive: '#50497B',
    ContainerLine: '#575086',
    OnContainer: '#E3E1F7',
  },

  Secondary: {
    Main: '#FFFFFF',
    MainHover: '#E5E5E5',
    MainActive: '#D9D9D9',
    MainLine: '#CCCCCC',
    OnMain: '#1A1A1A',
    Container: '#404040',
    ContainerHover: '#4D4D4D',
    ContainerActive: '#595959',
    ContainerLine: '#666666',
    OnContainer: '#F2F2F2',
  },

  Success: {
    Main: '#85E0BA',
    MainHover: '#70DBAF',
    MainActive: '#66D9A9',
    MainLine: '#5CD6A3',
    OnMain: '#0F3D2A',
    Container: '#175C3F',
    ContainerHover: '#1A6646',
    ContainerActive: '#1C704D',
    ContainerLine: '#1F7A54',
    OnContainer: '#CCF2E2',
  },

  Warning: {
    Main: '#E3BA91',
    MainHover: '#DFAF7E',
    MainActive: '#DDA975',
    MainLine: '#DAA36C',
    OnMain: '#3F2A15',
    Container: '#5E3F20',
    ContainerHover: '#694624',
    ContainerActive: '#734D27',
    ContainerLine: '#7D542B',
    OnContainer: '#F3E2D1',
  },

  Critical: {
    Main: '#E69D9D',
    MainHover: '#E28D8D',
    MainActive: '#E08585',
    MainLine: '#DE7D7D',
    OnMain: '#401C1C',
    Container: '#602929',
    ContainerHover: '#6B2E2E',
    ContainerActive: '#763333',
    ContainerLine: '#803737',
    OnContainer: '#F5D6D6',
  },

  Other: {
    FocusRing: 'rgba(255, 255, 255, 0.5)',
    Shadow: 'rgba(0, 0, 0, 1)',
    Overlay: 'rgba(0, 0, 0, 0.8)',
  },
};

export const emberTheme = createTheme(color, {
  ...darkThemeData,
  Background: {
    Container: '#0E0E10',
    ContainerHover: '#161618',
    ContainerActive: '#1F1F22',
    ContainerLine: '#29292D',
    OnContainer: '#EDEDED',
  },

  Surface: {
    Container: '#151517',
    ContainerHover: '#1E1E21',
    ContainerActive: '#27272B',
    ContainerLine: '#323237',
    OnContainer: '#EDEDED',
  },

  SurfaceVariant: {
    Container: '#1C1C1F',
    ContainerHover: '#252529',
    ContainerActive: '#2F2F34',
    ContainerLine: '#39393F',
    OnContainer: '#EDEDED',
  },

  Primary: {
    Main: '#FF6B3D',
    MainHover: '#FF7A51',
    MainActive: '#FF8660',
    MainLine: '#FF916E',
    OnMain: '#1A0D07',
    Container: '#29292D',
    ContainerHover: '#323237',
    ContainerActive: '#3C3C42',
    ContainerLine: '#46464D',
    OnContainer: '#EDEDED',
  },

  Secondary: {
    Main: '#EDEDED',
    MainHover: '#D6D6D6',
    MainActive: '#C8C8C8',
    MainLine: '#BABABA',
    OnMain: '#151517',
    Container: '#323237',
    ContainerHover: '#3C3C42',
    ContainerActive: '#46464D',
    ContainerLine: '#505058',
    OnContainer: '#EDEDED',
  },

  Warning: {
    Main: '#FFBA49',
    MainHover: '#FFB133',
    MainActive: '#FFAA24',
    MainLine: '#FFA314',
    OnMain: '#3A2500',
    Container: '#5A3E10',
    ContainerHover: '#664612',
    ContainerActive: '#724E14',
    ContainerLine: '#7E5616',
    OnContainer: '#FFE9C7',
  },

  Success: {
    Main: '#22C55E',
    MainHover: '#2BD467',
    MainActive: '#16A34A',
    MainLine: '#15803D',
    OnMain: '#03220F',
    Container: '#0F3D22',
    ContainerHover: '#134A2A',
    ContainerActive: '#175732',
    ContainerLine: '#1B643A',
    OnContainer: '#BBF7D0',
  },

  Critical: {
    Main: '#EF4444',
    MainHover: '#F25757',
    MainActive: '#DC2626',
    MainLine: '#B91C1C',
    OnMain: '#FFFFFF',
    Container: '#4C1414',
    ContainerHover: '#5A1818',
    ContainerActive: '#681C1C',
    ContainerLine: '#762020',
    OnContainer: '#FECACA',
  },

  Other: {
    FocusRing: 'rgba(255, 107, 61, 0.6)',
    Shadow: 'rgba(0, 0, 0, 1)',
    Overlay: 'rgba(6, 6, 8, 0.8)',
  },
});
