import React, { useState, useRef, useEffect } from 'react';

const Carousel = ({ slides }) => {
  console.log("Carousel received slides:", slides);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [startX, setStartX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const containerRef = useRef(null);

  useEffect(() => {
    console.log("Carousel mounted/updated with slides:", slides);
  }, [slides]);

  const handleDragStart = (e) => {
    setIsDragging(true);
    setStartX(e.type === 'touchstart' ? e.touches[0].clientX : e.clientX);
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    
    const currentX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
    const diff = currentX - startX;
    setDragOffset(diff);
  };

  const handleDragEnd = () => {
    if (!isDragging) return;

    const threshold = 100; // minimum drag distance to trigger slide change
    if (Math.abs(dragOffset) > threshold) {
      if (dragOffset > 0 && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
      } else if (dragOffset < 0 && currentIndex < slides.length - 1) {
        setCurrentIndex(currentIndex + 1);
      }
    }

    setIsDragging(false);
    setDragOffset(0);
  };

  const goToSlide = (index) => {
    setCurrentIndex(index);
  };

  const goToPrevious = () => {
    const isFirstSlide = currentIndex === 0;
    const newIndex = isFirstSlide ? slides.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = () => {
    const isLastSlide = currentIndex === slides.length - 1;
    const newIndex = isLastSlide ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  useEffect(() => {
    const container = containerRef.current;
    
    container.addEventListener('touchstart', handleDragStart);
    container.addEventListener('touchmove', handleDragMove);
    container.addEventListener('touchend', handleDragEnd);

    return () => {
      container.removeEventListener('touchstart', handleDragStart);
      container.removeEventListener('touchmove', handleDragMove);
      container.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging]);

  useEffect(() => {
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
    };
  }, [handleDragMove, handleDragEnd]);

  const getSlideStyle = (index) => {
    const offset = (index - currentIndex) * 100 + (isDragging ? dragOffset / containerRef.current?.offsetWidth * 100 : 0);
    return {
      transform: `translateX(${offset}%)`,
      transition: isDragging ? 'none' : 'transform 0.5s ease-out'
    };
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto overflow-hidden">
      <div
        ref={containerRef}
        className="relative h-full cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
      >
        <div className="relative h-[400px] overflow-hidden">
          {slides.map((slide, index) => {
            console.log("Rendering slide:", index, slide);
            return (
              <div
                key={index}
                className="absolute top-0 left-0 w-full h-full"
                style={getSlideStyle(index)}
              >
                <div className="mx-4 h-full">
                  <div className="bg-white rounded-lg shadow-lg p-6 h-full flex flex-col">
                    {slide.image && (
                      <img
                        src={slide.image}
                        alt="Scribble"
                        className="w-full h-48 object-cover rounded-lg mb-4"
                      />
                    )}
                    <div className="flex-grow">
                      <p className="text-gray-800 text-lg mb-2">{slide.description}</p>
                      <p className="text-gray-500 text-sm mb-2">📍 {slide.coordinates}</p>
                    </div>
                    <p className="text-gray-400 text-sm">{slide.createdAt}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Buttons */}
      <button
        onClick={goToPrevious}
        className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <button
        onClick={goToNext}
        className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 p-2 rounded-full shadow-lg transition-all"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Dots navigation */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentIndex ? 'bg-blue-600' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
};

export default Carousel;
