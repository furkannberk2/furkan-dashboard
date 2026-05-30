export const themes = {
  dark: {
    '--bg': '#0f0f0f',
    '--bg-card': '#161616',
    '--bg-item': '#1a1a1a',
    '--bg-soft': '#1e1e2e',
    '--border': '#222',
    '--border-strong': '#2a2a2a',
    '--text': '#fff',
    '--text-secondary': '#ccc',
    '--text-muted': '#888',
    '--text-dim': '#666',
    '--text-faint': '#555',
    '--text-faded': '#444',
    '--accent': '#6366f1',
    '--accent-soft': '#1a1a2e',
    '--success': '#6ee7b7',
    '--warning': '#fbbf24',
    '--danger': '#f87171',
    '--info': '#60a5fa',
    '--pink': '#f472b6',
    '--purple': '#a78bfa',
  },
  light: {
    '--bg': '#f5f5f7',
    '--bg-card': '#ffffff',
    '--bg-item': '#fafafa',
    '--bg-soft': '#eef2ff',
    '--border': '#e5e5e7',
    '--border-strong': '#d4d4d8',
    '--text': '#111',
    '--text-secondary': '#333',
    '--text-muted': '#555',
    '--text-dim': '#777',
    '--text-faint': '#999',
    '--text-faded': '#bbb',
    '--accent': '#6366f1',
    '--accent-soft': '#eef2ff',
    '--success': '#10b981',
    '--warning': '#f59e0b',
    '--danger': '#ef4444',
    '--info': '#3b82f6',
    '--pink': '#ec4899',
    '--purple': '#8b5cf6',
  }
}

export function applyTheme(name) {
  const theme = themes[name] || themes.dark
  Object.entries(theme).forEach(([k, v]) => {
    document.documentElement.style.setProperty(k, v)
  })
  document.documentElement.setAttribute('data-theme', name)
  localStorage.setItem('theme', name)
}

export function getInitialTheme() {
  return localStorage.getItem('theme') || 'dark'
}