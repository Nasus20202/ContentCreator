import React, { createContext, useContext } from 'react';
import { theme } from './theme';

/** Series accent (hex + "r,g,b"), supplied once per render from the plan's series. */
export type Accent = { hex: string; rgb: string };

export const DEFAULT_ACCENT: Accent = { hex: theme.accent, rgb: theme.accentRgb };

const AccentContext = createContext<Accent>(DEFAULT_ACCENT);

export const AccentProvider: React.FC<{ accent: Accent; children: React.ReactNode }> = ({ accent, children }) => (
  <AccentContext.Provider value={accent}>{children}</AccentContext.Provider>
);

export const useAccent = (): Accent => useContext(AccentContext);
