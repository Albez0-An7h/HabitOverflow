import { useState, useEffect } from 'react';
import { supabase } from '../Utils/SupabaseClient';
import { getCurrentUser } from '../Utils/auth';
import { useNavigate } from 'react-router-dom';

// Define types for our leaderboard data
interface LeaderboardEntry {
    userId: string;
    username: string;
    name: string;
    totalPoints: number;
    currentStreak: number;
    avatarUrl: string | null;
    isCurrentUser: boolean;
    rank: number;
}

const Leaderboard = () => {
    const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchLeaderboardData = async () => {
            try {
                // Check if user is authenticated
                const { user, error: authError } = await getCurrentUser();

                if (authError) {
                    throw authError;
                }

                if (!user) {
                    navigate('/signin');
                    return;
                }

                // Store current user ID to highlight their entry
                setCurrentUserId(user.id);

                // Modified query: First get all user points
                const { data: pointsData, error: pointsError } = await supabase
                    .from('user_points')
                    .select(`
                        user_id,
                        total_points,
                        current_streak
                    `)
                    .order('total_points', { ascending: false });

                if (pointsError) {
                    throw pointsError;
                }

                // Then get all user profiles
                const { data: profilesData, error: profilesError } = await supabase
                    .from('profiles')
                    .select(`
                        id,
                        username,
                        name,
                        avatar_url
                    `);

                if (profilesError) {
                    throw profilesError;
                }

                // Now join the data manually
                const formattedData: LeaderboardEntry[] = pointsData.map((pointEntry, index) => {
                    // Find matching profile
                    const userProfile = profilesData.find(profile => profile.id === pointEntry.user_id);
                    
                    return {
                        userId: pointEntry.user_id,
                        username: userProfile?.username || 'Unknown User',
                        name: userProfile?.name || 'Unknown',
                        totalPoints: pointEntry.total_points,
                        currentStreak: pointEntry.current_streak,
                        avatarUrl: userProfile?.avatar_url || null,
                        isCurrentUser: pointEntry.user_id === user.id,
                        rank: index + 1 // Add rank based on order
                    };
                });

                setLeaderboardData(formattedData);
            } catch (err: any) {
                console.error('Error fetching leaderboard data:', err);
                setError(err.message || 'Failed to load leaderboard data');
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboardData();
    }, [navigate]);

    // Render a medal icon based on rank
    const renderMedal = (rank: number) => {
        switch (rank) {
            case 1:
                return <span className="text-2xl" title="Gold Medal">🥇</span>;
            case 2:
                return <span className="text-2xl" title="Silver Medal">🥈</span>;
            case 3:
                return <span className="text-2xl" title="Bronze Medal">🥉</span>;
            default:
                return <span className="text-gray-400 font-bold">{rank}</span>;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading leaderboard data...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="max-w-md w-full bg-slate-800 p-8 rounded-lg shadow-md border border-slate-700">
                    <div className="text-red-400 text-center mb-4">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h3 className="text-lg font-medium mt-2">Error Loading Leaderboard</h3>
                    </div>
                    <p className="text-gray-300 text-center">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-6 w-full bg-[#C06C84] hover:bg-[#F67280] text-white py-2 px-4 rounded transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-900 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
                {/* Header section */}
                <div className="flex justify-between items-center mb-8 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
                        <p className="text-gray-400">See how you rank among other users</p>
                    </div>
                    <div className="bg-gradient-to-r from-[#355C7D] to-[#6C5B7B] p-2 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                </div>

                {/* Leaderboard table */}
                <div className="bg-slate-800 rounded-lg shadow-md overflow-hidden border border-slate-700">
                    {leaderboardData.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-slate-700">
                                <thead className="bg-slate-700">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Rank
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            User
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Points
                                        </th>
                                        <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                                            Streak
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-700">
                                    {leaderboardData.map((entry) => (
                                        <tr key={entry.userId} className={entry.isCurrentUser ? 'bg-slate-600' : ''}>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <div className="flex items-center justify-center">
                                                    {renderMedal(entry.rank)}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="flex-shrink-0 h-10 w-10">
                                                        {entry.avatarUrl ? (
                                                            <img
                                                                className="h-10 w-10 rounded-full object-cover"
                                                                src={entry.avatarUrl}
                                                                alt={`${entry.username}'s avatar`}
                                                            />
                                                        ) : (
                                                            <div className="h-10 w-10 rounded-full bg-slate-600 flex items-center justify-center">
                                                                <span className="text-lg text-white">{entry.name.charAt(0)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-white">{entry.name}</div>
                                                        <div className="text-sm text-gray-400">@{entry.username}</div>
                                                    </div>
                                                    {entry.isCurrentUser && (
                                                        <span className="ml-2 px-2 py-1 text-xs font-medium rounded-full bg-[#C06C84] text-white">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="text-sm font-bold text-[#F67280]">{entry.totalPoints}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right">
                                                <div className="text-sm text-white">{entry.currentStreak} days</div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="text-center py-12 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="mb-2">No leaderboard data available</p>
                            <p className="text-sm">Start tracking your habits to see how you rank!</p>
                        </div>
                    )}
                </div>

                {/* Stats or explanations */}
                <div className="mt-8 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                    <h2 className="text-lg font-semibold text-white mb-3">How to Earn Points</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        <div className="bg-slate-700 p-4 rounded-lg text-center">
                            <div className="text-2xl mb-2">🎯</div>
                            <p className="text-white font-medium">Complete Habits</p>
                            <p className="text-sm text-gray-400 mt-1">+5 points per habit</p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg text-center">
                            <div className="text-2xl mb-2">📚</div>
                            <p className="text-white font-medium">Complete Stacks</p>
                            <p className="text-sm text-gray-400 mt-1">+10 points per stack</p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg text-center">
                            <div className="text-2xl mb-2">🔥</div>
                            <p className="text-white font-medium">Maintain Streaks</p>
                            <p className="text-sm text-gray-400 mt-1">Bonus points for consistency</p>
                        </div>
                    </div>
                </div>

                {/* Navigation buttons */}
                <div className="mt-8 flex justify-between">
                    <button
                        onClick={() => navigate('/')}
                        className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-slate-700 hover:bg-slate-600 transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        Back to Dashboard
                    </button>
                    <button
                        onClick={() => window.location.reload()}
                        className="flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#C06C84] hover:bg-[#F67280] transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                        </svg>
                        Refresh Leaderboard
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Leaderboard;
