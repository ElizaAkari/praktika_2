export default function Footer() {
  return (
    <footer className="bg-header text-white py-6">
      <div className="container mx-auto px-4 text-center">
        <p>© 2025 CardRegion. Все права защитены.</p>
        <div className="mt-4 flex justify-center space-x-4">
          <a href="#" className="hover:text-primary"><i className="fab fa-telegram"></i></a>
          <a href="#" className="hover:text-primary"><i className="fab fa-whatsapp"></i></a>
        </div>
      </div>
    </footer>
  );
}