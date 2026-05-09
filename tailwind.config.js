/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        shell: "#FFF8ED",
        paper: "#FFFDF8",
        paperDeep: "#F3DFCA",
        card: "#F9EBDD",
        ink: "#292524",
        muted: "#876C58",
        line: "rgba(75, 47, 26, 0.14)",
        primaryDeep: "#5A321F",
        primaryDeepHover: "#3F2418",
        accent: "#D97736",
        accentDark: "#A94E1C",
        danger: "#E11D48",
        sand: "#E9CDAF",
        leaf: "#6C8B57",
        sky: "#D9EEF2"
      },
      boxShadow: {
        soft: "0 14px 36px rgba(75, 47, 26, 0.1)",
        float: "0 20px 55px rgba(217, 119, 54, 0.2)",
        "capybara-warm": "0 8px 30px rgba(229, 181, 92, 0.1)",
        ledger: "0 16px 34px rgba(90, 50, 31, 0.22)",
        button: "0 12px 24px rgba(90, 50, 31, 0.24)"
      },
      borderRadius: {
        "3xl": "24px",
        "4xl": "32px"
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Helvetica Neue"', "Helvetica", '"Hiragino Sans GB"', '"Microsoft YaHei"', "Arial", "sans-serif"]
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "page-in": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 420ms ease-out both",
        "page-in": "page-in 500ms ease-out both"
      }
    }
  },
  plugins: []
};
