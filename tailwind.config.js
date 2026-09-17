/** @type {import('tailwindcss').Config} */
export default {
  // Solo la pantalla de acceso usa Tailwind; el Studio trae su propio CSS.
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
};
