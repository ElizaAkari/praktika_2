/** @type {import('tailwindcss').Config} */
     export default {
       content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
       theme: {
         extend: {
           colors: {
             primary: '#6ab8ee',
             header: '#12222D',
           },
         },
       },
       plugins: [],
     }