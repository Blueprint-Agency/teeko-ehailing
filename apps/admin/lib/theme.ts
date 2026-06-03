'use client';
import { createTheme, type PaletteMode } from '@mui/material/styles';

export function buildTheme(mode: PaletteMode) {
  return createTheme({
    palette: {
      mode,
      primary:   { main: '#1A56DB' },
      secondary: { main: '#7E3AF2' },
      error:     { main: '#E02424' },
      warning:   { main: '#FF5A1F' },
      success:   { main: '#057A55' },
      ...(mode === 'dark' && {
        background: { default: '#0F1117', paper: '#1A1D27' },
      }),
    },
    typography: {
      fontFamily: '"Inter", "Roboto", sans-serif',
      fontSize: 13,
    },
    components: {
      MuiChip:        { defaultProps: { size: 'small' } },
      MuiButton:      { defaultProps: { disableElevation: true } },
      MuiTableCell:   { styleOverrides: { root: { fontSize: 13 } } },
    },
  });
}
