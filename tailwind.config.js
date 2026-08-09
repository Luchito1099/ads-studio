/** @type {import('tailwindcss').Config} */
export default {
  // nova-ads-studio.jsx vive en la raíz: hay que escanearlo explícitamente
  // o Tailwind purga todas sus clases y la UI sale sin estilos.
  content: ["./index.html", "./src/**/*.{js,jsx}", "./nova-ads-studio.jsx"],
  theme: { extend: {} },
  plugins: [],
};
