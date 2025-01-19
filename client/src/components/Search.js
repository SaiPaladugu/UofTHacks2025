import React, { useState } from "react";

function MySearch({ onSearch }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [query, setQuery] = useState("");

    const handleSearchClick = () => {
        setIsExpanded((prev) => !prev);
    };
    
    const handleInputChange = (e) => {
        setQuery(e.target.value);
    };
    
    const handleSubmit = () => {
        if (query.trim()) {
            console.log(query);
            onSearch(query);
            setQuery("");
            setIsExpanded(false);
        }
    };
    
    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            handleSubmit();
        }
    };

    return (
        <div className="relative flex justify-end">
            <div className="relative flex items-center">
                <input 
                    type="text" 
                    value={query}
                    placeholder="Search..." 
                    onChange={handleInputChange} 
                    className={`
                        peer
                        font-inter
                        pl-4 pr-20 py-2.5
                        rounded-full
                        border border-gray-200
                        focus:outline-none
                        focus:border-blue-500
                        focus:ring-2
                        focus:ring-blue-100
                        transition-all duration-300 ease-in-out
                        bg-white
                        shadow-md
                        hover:shadow-lg
                        absolute
                        right-0
                        origin-right
                        ${isExpanded 
                            ? 'w-[300px] opacity-100 pointer-events-auto translate-x-0' 
                            : 'w-[40px] opacity-0 pointer-events-none translate-x-full'
                        }
                    `}
                    onKeyDown={handleKeyDown}
                    autoFocus={isExpanded}
                />
                
                {/* Search and Submit Buttons Container */}
                <div className="relative flex gap-1 z-10">
                    {/* Submit Button - Only visible when there's text */}
                    {query.trim() && isExpanded && (
                        <button 
                            onClick={handleSubmit}
                            className="p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <svg 
                                xmlns="http://www.w3.org/2000/svg" 
                                fill="none" 
                                viewBox="0 0 24 24" 
                                strokeWidth={2} 
                                stroke="currentColor" 
                                className="w-4 h-4 text-blue-500"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6.75-6.75M19.5 12l-6.75 6.75" />
                            </svg>
                        </button>
                    )}
                    
                    {/* Search Button */}
                    <button 
                        onClick={handleSearchClick}
                        className="p-1.5 rounded-full hover:bg-gray-100 transition-colors bg-white shadow-md"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            className="w-4 h-4 text-gray-500"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    )
}

export default MySearch;