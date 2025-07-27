import { Link, useLocation } from 'react-router-dom';

export default function Header() {
  const categories = [
    'Визитки', 'Листовки', 'Буклеты', 'Плакаты', 'Календари',
    'Блокноты', 'Открытки', 'Пакеты', 'Одежда', 'Сувенирная продукция'
  ];
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const currentProduct = params.get('product');

  return (
    <header className="bg-white text-primary">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link to="/">
            <img src="/images/logo.png" alt="Логотип" className="h-12" />
          </Link>
          <div className="text-center">
            <p className="text-lg font-bold">8 (495) 760-23-60</p>
            <p className="text-sm">info@cardregion.ru</p>
          </div>
          <div className="flex items-center">
            <i className="fas fa-shopping-cart text-primary mr-2"></i>
            <p className="text-sm">0 ₽</p>
          </div>
        </div>
      </div>
      <div className="bg-header text-white py-4 shadow-sm">
        <div className="container mx-auto px-4">
          <nav className="flex justify-around items-center">
            {categories.map((category) => (
              <Link
                key={category}
                to={`/editor?product=${encodeURIComponent(category)}`}
                className={`px-2 py-1 rounded text-sm ${
                  currentProduct === category
                    ? 'bg-primary text-white'
                    : 'text-white hover:text-primary-dark'
                }`}
              >
                {category}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </header>
  );
}
