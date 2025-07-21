import React from 'react';
import stamp from '/src/assets/STAMP2.png';

function Loading() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-75 z-50">
      <div className="loading flex flex-col items-center">
        <img 
          src={stamp} 
          alt="Loading..." 
          className="w-40 h-40 animate-pulse"
        />
        <p className="mt-4 text-gray-600 font-medium">Loading...</p>
      </div>
    </div>
  );
}

export default Loading;
