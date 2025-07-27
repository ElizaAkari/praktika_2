import { Routes, Route } from 'react-router-dom';
     import Header from './components/Header';
     import Hero from './components/Hero';
     import Categories from './components/Categories';
     import Contact from './components/Contact';
     import Footer from './components/Footer';
     import Editor from './components/Editor';

     export default function App() {
       return (
         <div>
           <Header />
           <Routes>
             <Route
               path="/"
               element={
                 <>
                   <Hero />
                   <Categories />
                   <Contact />
                 </>
               }
             />
             <Route path="/editor" element={<Editor />} />
           </Routes>
           <Footer />
         </div>
       );
     }