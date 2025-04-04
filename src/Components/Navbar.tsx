import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../Utils/SupabaseClient';
import { useNavigate } from 'react-router-dom';

const Navbar: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Get current user and setup auth listener
        const getCurrentUser = async () => {
            const { data } = await supabase.auth.getSession();
            setUser(data?.session?.user || null);
        };
        
        getCurrentUser();
        
        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange(
            (event, session) => {
                setUser(session?.user || null);
            }
        );
        
        // Cleanup listener
        return () => {
            authListener?.subscription?.unsubscribe();
        };
    }, []);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/signin');
    };

    return (
        <nav className="bg-slate-800 shadow-md border-b border-slate-700 py-3 px-4 sm:px-6 lg:px-8">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-[#F67280] to-[#C06C84] text-transparent bg-clip-text">
                    HabitOverflow
                </Link>

                {/* Mobile menu button */}
                <div className="flex md:hidden">
                    <button 
                        onClick={toggleMenu} 
                        className="text-gray-300 hover:text-white focus:outline-none"
                    >
                        <span className="text-2xl">
                            {isMenuOpen ? '✕' : '☰'}
                        </span>
                    </button>
                </div>

                {/* Navigation links - Desktop */}
                <div className="hidden md:flex items-center space-x-6">
                    <Link to="/" className="text-gray-300 hover:text-white transition-colors">
                        Home
                    </Link>
                    <Link to="/manager" className="text-gray-300 hover:text-white transition-colors">
                        Habit Manager
                    </Link>
                    <Link to="/reports" className="text-gray-300 hover:text-white transition-colors">
                        Reports
                    </Link>
                </div>

                {/* Auth buttons - Desktop */}
                <div className="hidden md:flex items-center space-x-4">
                    {user ? (
                        <button 
                            onClick={handleSignOut}
                            className="bg-[#C06C84] hover:bg-[#F67280] text-white px-4 py-2 rounded transition-colors"
                        >
                            Sign Out
                        </button>
                    ) : (
                        <>
                            <Link to="/signin" className="text-gray-300 hover:text-white transition-colors">
                                Sign In
                            </Link>
                            <Link to="/signup" className="bg-[#C06C84] hover:bg-[#F67280] text-white px-4 py-2 rounded transition-colors">
                                Sign Up
                            </Link>
                        </>
                    )}
                </div>
            </div>

            {/* Mobile menu */}
            <div className={`${isMenuOpen ? 'block' : 'hidden'} md:hidden`}>
                <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 border-t border-slate-700 mt-3">
                    <Link 
                        to="/" 
                        className="block py-2 px-3 text-gray-300 hover:bg-slate-700 hover:text-white rounded-md"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        Home
                    </Link>
                    <Link 
                        to="/manager" 
                        className="block py-2 px-3 text-gray-300 hover:bg-slate-700 hover:text-white rounded-md"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        Habit Manager
                    </Link>
                    <Link 
                        to="/reports" 
                        className="block py-2 px-3 text-gray-300 hover:bg-slate-700 hover:text-white rounded-md"
                        onClick={() => setIsMenuOpen(false)}
                    >
                        Reports
                    </Link>
                    {/* Mobile auth buttons */}
                    {user ? (
                        <div className="py-2 px-3">
                            <button 
                                onClick={() => {
                                    handleSignOut();
                                    setIsMenuOpen(false);
                                }}
                                className="bg-[#C06C84] hover:bg-[#F67280] text-white px-3 py-1 rounded transition-colors w-full text-center"
                            >
                                Sign Out
                            </button>
                        </div>
                    ) : (
                        <div className="flex space-x-2 py-2 px-3">
                            <Link 
                                to="/signin" 
                                className="text-gray-300 hover:text-white px-3 py-1 rounded border border-gray-600 transition-colors flex-1 text-center"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Sign In
                            </Link>
                            <Link 
                                to="/signup" 
                                className="bg-[#C06C84] hover:bg-[#F67280] text-white px-3 py-1 rounded transition-colors flex-1 text-center"
                                onClick={() => setIsMenuOpen(false)}
                            >
                                Sign Up
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
