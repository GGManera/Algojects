"use client";

import { useState, useEffect, useCallback } from 'react';

const SETTINGS_KEY = 'algojects_user_settings';

interface AppSettings {
  showTransactionConfirmation: boolean;
}

const defaultSettings: AppSettings = {
  showTransactionConfirmation: true,
};

const getStoredSettings = (): AppSettings => {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with defaults to handle new settings being added later
      return { ...defaultSettings, ...parsed };
    }
  } catch (error) {
    console.error("Failed to load settings from localStorage:", error);
  }
  return defaultSettings;
};

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(getStoredSettings);

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings to localStorage:", error);
    }
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  return { settings, updateSetting };
}