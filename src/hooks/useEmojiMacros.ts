"use client";

import { useState, useEffect, useCallback } from 'react';

interface EmojiMacro {
  shortcut: string; // e.g., ":dyad:"
  emoji: string;    // e.g., "🤖"
}

const LOCAL_STORAGE_KEY = 'algojects_emoji_macros';

// Macros padrão para iniciar, se o localStorage estiver vazio
const defaultMacros: EmojiMacro[] = [
  { shortcut: ":heart:", emoji: "❤️" },
  { shortcut: ":thumbsup:", emoji: "👍" },
  { shortcut: ":smile:", emoji: "😊" },
  { shortcut: ":fire:", emoji: "🔥" },
  { shortcut: ":rocket:", emoji: "🚀" },
  { shortcut: ":star:", emoji: "⭐" },
  { shortcut: ":algorand:", emoji: "🅰️" },
  { shortcut: ":algojects:", emoji: "🅰️" },
];

export function useEmojiMacros() {
  const [macros, setMacros] = useState<EmojiMacro[]>([]);
  const [loading, setLoading] = useState(true);

  // Carrega macros do localStorage na montagem
  useEffect(() => {
    try {
      const storedMacros = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (storedMacros) {
        setMacros(JSON.parse(storedMacros));
      } else {
        setMacros(defaultMacros); // Usa macros padrão se não houver nada salvo
      }
    } catch (error) {
      console.error("Failed to load emoji macros from localStorage:", error);
      setMacros(defaultMacros); // Fallback para macros padrão em caso de erro
    } finally {
      setLoading(false);
    }
  }, []);

  // Salva macros no localStorage sempre que elas mudam
  useEffect(() => {
    if (!loading) { // Só salva depois que o carregamento inicial estiver completo
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(macros));
      } catch (error) {
        console.error("Failed to save emoji macros to localStorage:", error);
      }
    }
  }, [macros, loading]);

  const addMacro = useCallback((newMacro: EmojiMacro) => {
    setMacros(prevMacros => {
      // Evita duplicatas de atalhos
      if (prevMacros.some(m => m.shortcut === newMacro.shortcut)) {
        return prevMacros;
      }
      return [...prevMacros, newMacro];
    });
  }, []);

  const updateMacro = useCallback((oldShortcut: string, updatedMacro: EmojiMacro) => {
    setMacros(prevMacros =>
      prevMacros.map(m => (m.shortcut === oldShortcut ? updatedMacro : m))
    );
  }, []);

  const deleteMacro = useCallback((shortcutToDelete: string) => {
    setMacros(prevMacros => prevMacros.filter(m => m.shortcut !== shortcutToDelete));
  }, []);

  // Converte a lista de macros para o formato de objeto { ":shortcut:": "emoji" }
  const macrosObject = useCallback(() => {
    return macros.reduce((acc, macro) => {
      acc[macro.shortcut] = macro.emoji;
      return acc;
    }, {} as { [key: string]: string });
  }, [macros]);

  return { macros, loading, addMacro, updateMacro, deleteMacro, macrosObject };
}