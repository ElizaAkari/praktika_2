import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="bg-white py-16">
      <div className="container mx-auto px-4 text-center">
        <h1 className="text-4xl font-bold mb-4 text-gray-800">
          Создавайте уникальные макеты для вашего бизнеса
        </h1>
        <p className="text-lg mb-6 text-gray-800">
          Простой и удобный конструктор для визиток, листовок, плакатов и многого другого.
        </p>
        <Link
          to="/editor"
          className="bg-primary text-white border border-primary px-6 py-3 rounded-lg hover:bg-white hover:text-primary transition duration-200"
        >
          Начать создание
        </Link>
      </div>
    </section>
  );
}