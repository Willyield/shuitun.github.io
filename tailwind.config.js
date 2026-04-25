/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        shell: "#FFF8ED",
        paper: "#FFFDF8",
        card: "#F9EBDD",
        ink: "#4B2F1A",
        muted: "#876C58",
        line: "rgba(75, 47, 26, 0.14)",
        accent: "#D97736",
        accentDark: "#A94E1C",
        leaf: "#6C8B57",
        sky: "#D9EEF2"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(75, 47, 26, 0.12)",
        float: "0 20px 55px rgba(217, 119, 54, 0.2)"
      },
      fontFamily: {
        sans: ['"Nunito"', '"SF Pro Rounded"', '"PingFang SC"', '"Microsoft YaHei"', "sans-serif"]
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-in": "fade-in 420ms ease-out both"
      }
    }
  },
  plugins: []
};
