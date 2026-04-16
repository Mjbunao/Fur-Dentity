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
const DIALOG_RADIUS = 12;
const FONT_FAMILY = 'var(--font-montserrat), sans-serif';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: PRIMARY_COLOR,
    },
    warning: {
      main: WARNING_COLOR,
    },
    background: {
      default: BACKGROUND_COLOR,
      paper: '#ffffff',
    },
    text: {
      primary: FOREGROUND_COLOR,
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
          backgroundColor: BACKGROUND_COLOR,
          color: FOREGROUND_COLOR,
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

export default function ThemeRegistry({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CacheProvider value={cache}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </CacheProvider>
  );
}
