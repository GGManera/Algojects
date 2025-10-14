import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground)",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground)",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // HODL custom colors - now directly referencing CSS variables
        hodl: {
          dark: "hsl(var(--hodl-dark))",
          darker: "hsl(var(--hodl-darker))",
          blue: "hsl(var(--hodl-blue))",
          purple: "hsl(var(--hodl-purple))",
          accent: "hsl(var(--hodl-accent))",
        },
        // Existing blue-400 and gray-900, keep for compatibility if used elsewhere
        "blue-400": "hsl(var(--blue-400))",
        "gray-900": "hsl(var(--gray-900))",
        // New gradient colors - reference CSS variables
        "gradient-start": "hsl(var(--gradient-start))",
        "gradient-end": "hsl(var(--gradient-end))",
        // New comment gradient colors
        "comment-gradient-start": "hsl(var(--comment-gradient-start))",
        "comment-gradient-end": "hsl(var(--comment-gradient-end))",
        // New notes gradient colors
        "notes-gradient-start": "hsl(var(--notes-gradient-start))",
        "notes-gradient-end": "hsl(var(--notes-gradient-end))",
        // NEW: Bright green accent border
        "border-accent-green": "hsl(var(--border-accent-green))",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      fontFamily: {
        sans: ["Raleway", "sans-serif"],
        heading: ["Raleway", "sans-serif"],
        numeric: ["Inter", "sans-serif"],
      },
      boxShadow: {
        'glass-group': 'inset 1px 1px 4px rgba(255, 255, 255, 0.2), inset -1px -1px 6px rgba(0, 0, 0, 0.3), 0 4px 12px rgba(0, 0, 0, 0.15)',
        'shadow-glow': '0 0 8px 2px hsl(var(--primary) / 0.3)',
        // Novas sombras para profundidade
        'deep-sm': '0 4px 8px rgba(0, 0, 0, 0.3), 0 2px 4px rgba(0, 0, 0, 0.2)',
        'deep-md': '0 8px 16px rgba(0, 0, 0, 0.4), 0 4px 8px rgba(0, 0, 0, 0.3)',
        'deep-lg': '0 12px 24px rgba(0, 0, 0, 0.5), 0 6px 12px rgba(0, 0, 0, 0.4)',
        // Nova sombra para efeito de profundidade (recessed)
        'recessed': 'inset 3px 3px 6px hsl(var(--hodl-darker) / 0.8), inset -3px -3px 6px hsl(var(--foreground) / 0.1)',
      },
      transitionTimingFunction: {
        'custom-glider': 'cubic-bezier(0.37, 1.95, 0.66, 0.56)',
      },
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;