'use client';

import * as React from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';

const cache = createCache({ key: 'mui', prepend: true });
const PRIMARY_COLOR = '#0054FF';
const WARNING_COLOR = '#F3A531';
const BACKGROUND_COLOR = '#f6f2ea';
const FOREGROUND_COLOR = '#1f2937';
const DARK_BACKGROUND_COLOR = '#111827';
const DARK_PAPER_COLOR = '#1f2937';
const DARK_FOREGROUND_COLOR = '#e5e7eb';
const DIALOG_RADIUS = 12;
const FONT_FAMILY = 'var(--font-montserrat), sans-serif';
const THEME_STORAGE_KEY = 'fur-dentity-theme';

type ThemeMode = 'light' | 'dark';

const createAppTheme = (mode: ThemeMode) =>
  createTheme({
  palette: {
    mode,
    primary: {
      main: PRIMARY_COLOR,
    },
    warning: {
      main: WARNING_COLOR,
    },
    background: {
      default: mode === 'dark' ? DARK_BACKGROUND_COLOR : BACKGROUND_COLOR,
      paper: mode === 'dark' ? DARK_PAPER_COLOR : '#ffffff',
    },
    text: {
      primary: mode === 'dark' ? DARK_FOREGROUND_COLOR : FOREGROUND_COLOR,
    },
  },
  typography: {
    fontFamily: FONT_FAMILY,
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          fontFamily: FONT_FAMILY,
          backgroundColor: mode === 'dark' ? DARK_BACKGROUND_COLOR : BACKGROUND_COLOR,
          color: mode === 'dark' ? DARK_FOREGROUND_COLOR : FOREGROUND_COLOR,
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: {
          fontFamily: FONT_FAMILY,
        },
      },
    },
    MuiInputBase: {
      styleOverrides: {
        root: {
          fontFamily: FONT_FAMILY,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: DIALOG_RADIUS,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 14,
        },
        input: {
          paddingTop: 8,
          paddingBottom: 8,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          paddingTop: 5,
          paddingBottom: 5,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        sizeSmall: {
          paddingTop: 7,
          paddingBottom: 7,
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          minHeight: 36,
          paddingTop: 6,
          paddingBottom: 6,
        },
      },
    },
  },
});

const getStoredThemeMode = (): ThemeMode => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark' ? 'dark' : 'light';
};

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mode, setMode] = React.useState<ThemeMode>('light');

  React.useEffect(() => {
    const syncTheme = () => setMode(getStoredThemeMode());

    syncTheme();
    window.addEventListener('fur-dentity-theme-change', syncTheme);

    return () => window.removeEventListener('fur-dentity-theme-change', syncTheme);
  }, []);

  const theme = React.useMemo(() => createAppTheme(mode), [mode]);

  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
