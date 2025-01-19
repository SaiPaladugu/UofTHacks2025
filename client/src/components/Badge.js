import React from 'react';

const Badge = ({ keywords }) => {
  // Color palette for badges
  const colors = [
    'bg-violet-500 hover:bg-violet-600',
    'bg-indigo-500 hover:bg-indigo-600',
    'bg-blue-500 hover:bg-blue-600',
    'bg-teal-500 hover:bg-teal-600',
    'bg-emerald-500 hover:bg-emerald-600',
  ];

  return (
    <div className="relative inline-flex min-w-[200px] h-[200px] w-full">
      {keywords.map((keyword, index) => (
        <div
          key={index}
          className={`
            absolute
            rounded-full
            ${colors[index % colors.length]}
            text-white
            px-4
            py-2
            text-sm
            font-medium
            shadow-lg
            transform
            transition-all
            duration-300
            ease-in-out
            hover:scale-110
            hover:shadow-xl
            cursor-pointer
            whitespace-nowrap
          `}
          style={{
            zIndex: keywords.length - index,
            opacity: 1 - (index * 0.1),
            transform: `translateY(${index * 24}px)`,
            right: 0,
            position: 'absolute'
          }}
        >
          {keyword}
        </div>
      ))}
    </div>
  );
};

export default Badge;
