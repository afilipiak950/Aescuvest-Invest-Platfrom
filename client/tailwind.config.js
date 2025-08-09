/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  safelist: [
    // Core theme colors
    'bg-dark',
    'bg-navy', 
    'bg-dark-light',
    'bg-dark-lighter',
    'bg-primary',
    'bg-primary-custom',
    'text-primary',
    'text-white',
    'text-gray-300',
    'text-gray-400',
    'text-gray-500',
    'text-gray-600',
    'text-gray-700',
    'text-gray-800',
    'text-gray-900',
    // Borders
    'border-primary',
    'border-gray-800',
    'border-gray-600',
    'border-dark-border',
    // Interactive states
    'hover:bg-primary/90',
    'hover:bg-primary',
    'focus:border-primary',
    'focus:ring-primary',
    'focus:ring-2',
    // Backgrounds with opacity
    'bg-gray-900/50',
    'bg-black/50',
    // Layout classes
    'flex',
    'grid',
    'hidden',
    'block',
    'inline-block',
    'absolute',
    'relative',
    'fixed',
    // Spacing
    'p-4',
    'p-6',
    'px-4',
    'py-2',
    'py-4',
    'py-6',
    'mx-auto',
    'mb-4',
    'mb-6',
    'mb-8',
    // Typography
    'font-bold',
    'font-semibold',
    'text-lg',
    'text-xl',
    'text-2xl',
    'text-3xl',
    // Container and max-width
    'container',
    'max-w-7xl',
    'w-full',
    'h-full',
    'h-screen'
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          "1": "hsl(var(--chart-1))",
          "2": "hsl(var(--chart-2))",
          "3": "hsl(var(--chart-3))",
          "4": "hsl(var(--chart-4))",
          "5": "hsl(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
        // Custom dark theme colors - ensure these are included
        dark: "#090921",
        "dark-light": "#10102d", 
        "dark-lighter": "#161638",
        "dark-border": "#1e1e40",
        "primary-custom": "#00CC00",
        navy: "#050533",
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
    },
  },
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
}