import React from "react";
import "../App.css" ; // Make sure to import your CSS file

const CategoryBar = ({ categories, selectedCategory, onCategorySelect }) => {
  return (
    <div className="bg-white border-b border-gray-200">
      <div className="max-w-container mx-auto px-4 md:px-8">
        <div
          className="flex items-center space-x-4 overflow-x-auto py-4 no-scrollbar"
        >
          {categories.map((category, index) => {
            const isActive = category === selectedCategory;
            return (
              <button
                key={index}
                className={`whitespace-nowrap px-4 py-2 font-medium rounded focus:outline-none focus:ring focus:ring-brand/40 ${
                  isActive
                    ? "bg-brand/10 text-brand-dark"
                    : "text-gray-700 hover:text-brand-dark"
                }`}
                aria-current={isActive ? "true" : undefined}
                onClick={() => onCategorySelect(category)}
              >
                {category}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CategoryBar;
