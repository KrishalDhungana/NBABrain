
import React from 'react';

const LoadingSpinner: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500"></div>
      <p className="mt-4 text-lg font-semibold text-gray-300">{message}</p>
    </div>
  );
};

export default LoadingSpinner;