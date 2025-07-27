export default function Contact() {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8">Контакты</h2>
        <div className="flex flex-col md:flex-row justify-center space-y-4 md:space-y-0 md:space-x-8">
          <div className="text-center">
            <i className="fas fa-phone text-primary text-2xl mb-2"></i>
            <p>8 (495) 760-23-60</p>
          </div>
          <div className="text-center">
            <i className="fas fa-envelope text-primary text-2xl mb-2"></i>
            <p>info@cardregion.ru</p>
          </div>
          <div className="text-center">
            <i className="fab fa-telegram text-primary text-2xl mb-2"></i>
            <p>@CardRegionBot</p>
          </div>
        </div>
        <div className="mt-8 text-center">
          <button className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-blue-700">
            Написать нам
          </button>
        </div>
      </div>
    </section>
  );
}