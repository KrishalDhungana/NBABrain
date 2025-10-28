import React from 'react';

const BasketballIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071 1.052A9.75 9.75 0 0118.68 12a9.75 9.75 0 01-6.788 8.662.75.75 0 10.536 1.328A11.25 11.25 0 0020.18 12a11.25 11.25 0 00-7.217-10.764z" clipRule="evenodd" />
    <path d="M11.25 4.5A7.5 7.5 0 0118.75 12a7.5 7.5 0 01-7.5 7.5v-15zM12 2.25a.75.75 0 00-.75.75v18a.75.75 0 001.5 0V3a.75.75 0 00-.75-.75z" />
    <path d="M4.193 6.098a.75.75 0 011.052 1.07A6 6 0 003.75 12a6 6 0 001.5 4.839.75.75 0 11-1.06 1.06A7.5 7.5 0 012.25 12a7.5 7.5 0 011.943-5.902z" />
  </svg>
);

interface HeaderProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const TABS = ['Team Rankings', 'Player Rankings', 'Games Today'];

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  return (
    <header className="bg-black/30 backdrop-blur-xl sticky top-4 mx-4 lg:mx-auto lg:max-w-7xl rounded-xl z-50 border border-white/10 shadow-lg">
      <div className="container mx-auto p-4">
        <div className="flex items-center">
            <BasketballIcon className="h-10 w-10 text-orange-500" />
            <div className="ml-3">
                <h1 className="text-3xl font-black tracking-tighter">
                <span className="text-white">NBA</span>
                <span className="text-orange-500">Brain</span>
                </h1>
                <p className="text-gray-300 text-sm">AI-Powered Analytics & Player Ratings</p>
            </div>
        </div>
         <nav className="mt-4">
            <div className="flex space-x-2 border-b border-white/10">
                {TABS.map((tab) => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-semibold transition-colors duration-200 focus:outline-none ${
                    activeTab === tab
                        ? 'border-b-2 border-orange-500 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    aria-current={activeTab === tab ? 'page' : undefined}
                >
                    {tab}
                </button>
                ))}
            </div>
        </nav>
      </div>
    </header>
  );
};

export default Header;