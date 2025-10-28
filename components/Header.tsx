import React from 'react';

const NBALogo: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" {...props}>
    <defs>
      <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor="#fb923c" />
        <stop offset="100%" stopColor="#facc15" />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="28" fill="url(#g1)" />
    <circle cx="32" cy="32" r="27" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" />
    {/* Basketball seams */}
    <path d="M5 32h54" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
    <path d="M32 5v54" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
    <path d="M12 12c8 5 12 12 12 20s-4 15-12 20" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
    <path d="M52 12c-8 5-12 12-12 20s4 15 12 20" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="2" />
  </svg>
);

interface HeaderProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
}

const TABS = ['Team Rankings', 'Player Rankings', 'Games Today'];

const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab }) => {
  const logoSrc = (import.meta as any).env?.VITE_LOGO_SRC as string | undefined;
  return (
    <header className="bg-black/30 backdrop-blur-xl sticky top-0 w-full z-40 border-b border-white/10 shadow-lg">
      <div className="w-full px-4">
        <div className="flex items-center py-3">
            {logoSrc ? (
              <img src={logoSrc} alt="CourtIQ" className="h-12 w-12 rounded-full object-cover border border-white/20 shadow" />
            ) : (
              <NBALogo className="h-12 w-12" />
            )}
            <div className="ml-3 leading-tight flex flex-col justify-center">
                <h1 className="text-3xl font-black tracking-tighter">
                  <span className="text-white">NBA</span>
                  <span className="text-orange-400">Brain</span>
                </h1>
                <p className="text-gray-300 text-sm">ELO Engine & AI-Powered Analytics</p>
            </div>
        </div>
         <nav className="mt-4">
            <div className="-mx-4 px-4 flex space-x-2 border-b border-white/10 bg-black/20">
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
