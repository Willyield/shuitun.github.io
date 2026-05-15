/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        shell: "#FFF7EA",
        paper: "#FFFAF0",
        paperDeep: "#F5DDBA",
        card: "#F6E0CF",
        warmCard: "#FFF8E8",
        warmCardDeep: "#FFDFA0",
        warmHighlight: "#F4B86A",
        ink: "#332018",
        muted: "#6E5A49",
        line: "rgba(92, 72, 52, 0.24)",
        primaryDeep: "#332018",
        primaryDeepHover: "#241611",
        accent: "#B9783E",
        accentDark: "#8F5427",
        danger: "#E11D48",
        sand: "#E9CDAF",
        leaf: "#6C8B57",
        sky: "#DDEFF2",
        apricot: "#F7D8AE",
        orange: "#D07A36",
        mint: "#DCEBCB",
        ocean: "#C4E2E0"
      },
      boxShadow: {
        soft: "0 14px 36px rgba(75, 47, 26, 0.1)",
        float: "0 20px 55px rgba(217, 119, 54, 0.2)",
        "capybara-warm": "0 8px 30px rgba(229, 181, 92, 0.1)",
        ledger: "0 18px 34px rgba(156, 103, 47, 0.16)",
        button: "0 12px 24px rgba(50, 29, 19, 0.24)",
        airy: "0 22px 44px rgba(91, 57, 32, 0.12)"
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
