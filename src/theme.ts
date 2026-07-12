import type { TextStyle, ViewStyle } from 'react-native';

export const colors = {
  ink: '#26262E',
  body: '#3D3C36',
  muted: '#8A8776',
  faint: '#A8A491',
  line: '#DFD8C2',
  lineStrong: '#C9C2AC',
  paper: '#FFFDF6',
  paperDeep: '#F4EFE1',
  paperWarm: '#EFE9D6',
  magenta: '#BE3F6E',
  magentaDark: '#963056',
  magentaPale: '#F9E9F0',
  blue: '#2F7BA6',
  bluePale: '#E8F2F7',
  green: '#3A8A5F',
  greenPale: '#E9F2E9',
  red: '#C74F3D',
  redPale: '#F9E9E4',
  white: '#FFFFFF',
  navy: '#111620',
} as const;

export const fonts = {
  display: 'BarlowSemiCondensed_700Bold',
  strong: 'BarlowSemiCondensed_600SemiBold',
  body: 'BarlowSemiCondensed_500Medium',
  regular: 'BarlowSemiCondensed_400Regular',
  mono: 'monospace',
} as const;

export const shadows = {
  card: {
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  } satisfies ViewStyle,
  button: {
    shadowColor: colors.magentaDark,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  } satisfies ViewStyle,
} as const;

export const type = {
  eyebrow: {
    fontFamily: fonts.strong,
    fontSize: 11,
    letterSpacing: 2.1,
    color: colors.muted,
  } satisfies TextStyle,
  title: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 36,
    color: colors.ink,
  } satisfies TextStyle,
  heading: {
    fontFamily: fonts.display,
    fontSize: 23,
    lineHeight: 27,
    color: colors.ink,
  } satisfies TextStyle,
  body: {
    fontFamily: fonts.regular,
    fontSize: 17,
    lineHeight: 24,
    color: colors.body,
  } satisfies TextStyle,
  small: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: colors.muted,
  } satisfies TextStyle,
} as const;

