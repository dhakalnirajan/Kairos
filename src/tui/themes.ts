export interface Theme {
  name: string;
  primary: string;
  secondary: string;
  accent: string;
  bg: string;
  fg: string;
  surface: string;
  muted: string;
  success: string;
  error: string;
  warning: string;
  border: string;
  highlight: string;
}

export const THEMES: Record<string, Theme> = {
  default: {
    name: 'default',
    primary: '#208AAE',
    secondary: '#A0A0A0',
    accent: '#FF6B6B',
    bg: '#1A1A2E',
    fg: '#E0E0E0',
    surface: '#16213E',
    muted: '#666666',
    success: '#4ECDC4',
    error: '#FF6B6B',
    warning: '#FFE66D',
    border: '#3A3A5C',
    highlight: '#208AAE',
  },
  dark: {
    name: 'dark',
    primary: '#4A90D9',
    secondary: '#7FB3E0',
    accent: '#E74C3C',
    bg: '#0D1117',
    fg: '#C9D1D9',
    surface: '#161B22',
    muted: '#484F58',
    success: '#3FB950',
    error: '#F85149',
    warning: '#D29922',
    border: '#30363D',
    highlight: '#1F6FEB',
  },
  light: {
    name: 'light',
    primary: '#0366D6',
    secondary: '#586069',
    accent: '#D73A49',
    bg: '#FFFFFF',
    fg: '#24292E',
    surface: '#F6F8FA',
    muted: '#6A737D',
    success: '#22863A',
    error: '#CB2431',
    warning: '#B08800',
    border: '#E1E4E8',
    highlight: '#0366D6',
  },
  monokai: {
    name: 'monokai',
    primary: '#A6E22E',
    secondary: '#FD971F',
    accent: '#F92672',
    bg: '#272822',
    fg: '#F8F8F2',
    surface: '#1E1F1C',
    muted: '#75715E',
    success: '#A6E22E',
    error: '#F92672',
    warning: '#E6DB74',
    border: '#49483E',
    highlight: '#66D9EF',
  },
  dracula: {
    name: 'dracula',
    primary: '#BD93F9',
    secondary: '#FFB86C',
    accent: '#FF79C6',
    bg: '#282A36',
    fg: '#F8F8F2',
    surface: '#21222C',
    muted: '#6272A4',
    success: '#50FA7B',
    error: '#FF5555',
    warning: '#F1FA8C',
    border: '#44475A',
    highlight: '#BD93F9',
  },
};

export function getTheme(name: string): Theme {
  return THEMES[name] ?? THEMES['default']!;
}
