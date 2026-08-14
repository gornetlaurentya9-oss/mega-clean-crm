/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Real Mega Clean brand colors (from van signage / website).
        // Use these for all new/redesigned UI going forward.
        "brand-accent": "#3EB8FF", // light blue — buttons, icons, highlights, interactive accents
        "brand-primary": "#0030B5", // core brand blue — headers, primary buttons, active/selected states
        "brand-secondary": "#254CB0", // secondary blue — dividers, section backgrounds, subtler elements
        "brand-navy": "#10385B", // dark navy — footer/dark sections, high-contrast text on light bg
      },
      borderRadius: {
        control: "0.5rem", // buttons, inputs, selects
        panel: "1rem", // cards, modals
      },
      boxShadow: {
        soft: "0 2px 8px -2px rgba(16, 56, 91, 0.12), 0 1px 2px -1px rgba(16, 56, 91, 0.08)",
        "soft-lg": "0 12px 32px -8px rgba(16, 56, 91, 0.18), 0 4px 12px -4px rgba(16, 56, 91, 0.1)",
      },
      keyframes: {
        "fade-slide-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "toast-in": {
          "0%": { opacity: "0", transform: "translateY(-8px) scale(0.97)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
      },
      animation: {
        "fade-slide-in": "fade-slide-in 220ms ease-out",
        "toast-in": "toast-in 180ms ease-out",
      },
    },
  },
  plugins: [],
};
