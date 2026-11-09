/** Mesma paleta e tipografia do site (src/app/globals.css). */
/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: v("background"),
        surface: v("surface"),
        foreground: v("foreground"),
        muted: v("muted"),
        border: v("border"),
        bandeira: { 50: "#e6f6ec", 100: "#c2ead1", 500: "#009c3b", 600: "#008633", 700: "#006b29" },
        ipe: { 100: "#fff3cc", 400: "#ffd45c", 500: "#ffc72c", 600: "#e6a800" },
        anil: { 500: "#1a3f99", 700: "#002776", 900: "#001647" },
        pitanga: { 100: "#ffe1d9", 500: "#ff5a36", 600: "#e5441f" },
      },
    },
  },
  plugins: [],
};
