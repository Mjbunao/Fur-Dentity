'use client';

import * as React from 'react';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';
import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';

const cache = createCache({ key: 'mui', prepend: true });

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#0054FF',
      
    },
    warning: {
      main: '#F3A531', // gray (matches your UI)
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