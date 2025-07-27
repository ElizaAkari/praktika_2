import { Link } from 'react-router-dom';

export default function Categories() {
  const categories = [
    { name: 'Визитки', image: '/images/business-card.png' },
    { name: 'Листовки', image: '/images/flyer.jpg' },
    { name: 'Буклеты', image: '/images/booklet.jpg' },
    { name: 'Плакаты', image: '/images/poster.jpg' },
    { name: 'Календари', image: '/images/calendar.jpg' },
    { name: 'Блокноты', image: '/images/notebook.jpg' },
    { name: 'Открытки', image: '/images/postcard.jpg' },
    { name: 'Пакеты', image: '/images/package.jpg' },
    { name: 'Одежда', image: '/images/clothing.jpg' },
    { name: 'Сувенирная продукция', image: '/images/souvenir.jpg' },
  ];

  return (
    <section className="bg-gray-50 py-16">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">Наши продукты</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {categories.map((category) => (
            <Link
              key={category.name}
              to={`/editor?product=${encodeURIComponent(category.name)}`}
              className="bg-white p-4 rounded-lg shadow text-center hover:shadow-lg hover:bg-primary/80 transition duration-200"
            >
              <img src={category.image} alt={category.name} className="h-24 w-full object-cover rounded mb-2" />
              <p className="text-gray-800">{category.name}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}