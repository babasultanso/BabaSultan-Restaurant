import { createTheme, ThemeOptions } from '@mui/material/styles';

export const getAppTheme = (mode: 'dark' | 'light', dir: 'ltr' | 'rtl') => {
  const themeOptions: ThemeOptions = {
    direction: dir,
    palette: {
      mode,
      primary: {
        main: '#10b981', // Emerald 500
        light: '#34d399',
        dark: '#059669',
        contrastText: '#020617'
      },
      secondary: {
        main: '#14b8a6', // Teal 500
        light: '#2dd4bf',
        dark: '#0f766e',
        contrastText: '#ffffff'
      },
      background: {
        default: mode === 'dark' ? '#020617' : '#f8fafc',
        paper: mode === 'dark' ? '#0f172a' : '#ffffff'
      },
      text: {
        primary: mode === 'dark' ? '#f8fafc' : '#0f172a',
        secondary: mode === 'dark' ? '#94a3b8' : '#64748b'
      },
      error: {
        main: '#f43f5e'
      },
      warning: {
        main: '#f59e0b'
      },
      info: {
        main: '#3b82f6'
      },
      success: {
        main: '#10b981'
      }
    },
    typography: {
      fontFamily: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif'
      ].join(','),
      button: {
        textTransform: 'none',
        fontWeight: 700
      }
    },
    shape: {
      borderRadius: 16
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: '12px',
            padding: '8px 20px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.2)'
            }
          }
        }
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none'
          }
        }
      }
    }
  };

  return createTheme(themeOptions);
};
