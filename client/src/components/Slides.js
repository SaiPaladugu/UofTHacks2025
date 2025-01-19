import React from 'react';
import Carousel from './Carousel';

const Slides = ({ slides }) => {

  const formattedSlides = slides.map(slide => {
    console.log("Formatting slide:", slide);
    return {
      description: slide.text,
      image: slide.image,
      createdAt: slide.createdAt,
      coordinates: slide.coordinates
    };
  });

  console.log("Formatted slides:", formattedSlides);

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <h1 className="text-3xl font-bold text-center mb-8">Nearby Scribbles</h1>
      <Carousel slides={formattedSlides} />
    </div>
  );
};

export default Slides;
