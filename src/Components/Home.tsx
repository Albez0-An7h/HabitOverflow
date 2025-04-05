import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../Utils/SupabaseClient';
import { getCurrentUser } from '../Utils/auth';
import { getUserPointsData } from '../Utils/pointsystem';

// Define types for our data
interface Profile {
    id: string;
    name: string;
    username: string;
    avatar_url: string | null;
    created_at: string;
}

interface UserStats {
    habitCount: number;
    streak: number;
    completionRate: number;
    goalsAchieved: number;
}

const Home = () => {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [userStats, setUserStats] = useState<UserStats>({
        habitCount: 0,
        streak: 0,
        completionRate: 0,
        goalsAchieved: 0
    });
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Check if user is authenticated
                const { user, error: authError } = await getCurrentUser();

                if (authError || !user) {
                    navigate('/signin');
                    return;
                }

                // Fetch user profile data
                const { data, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profileError) {
                    throw profileError;
                }

                if (!data) {
                    // If no profile exists, redirect to profile creation
                    navigate('/profile');
                    return;
                }

                setProfile(data);

                // Fetch user statistics
                await fetchUserStats(user.id);
            } catch (err: any) {
                console.error('Error fetching user data:', err);
                setError(err.message || 'Failed to load profile data');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [navigate]);

    // Function to fetch user stats
    const fetchUserStats = async (userId: string) => {
        try {
            // Get points and streak data
            const pointsData = await getUserPointsData(userId);
            
            // Get habit stacks first
            const { data: stacks, error: stacksError } = await supabase
                .from('habit_stacks')
                .select('id')
                .eq('user_id', userId);
                
            if (stacksError) throw stacksError;
            const stackIds = stacks?.map(stack => stack.id) || [];
            
            // Count total habits
            const { data: habitsData, error: habitsError } = await supabase
                .from('habits')
                .select('id', { count: 'exact' })
                .in('stack_id', stackIds);
                
            if (habitsError) throw habitsError;
            
            // Count completed habits
            const { data: completedData, error: completedError } = await supabase
                .from('habits')
                .select('id', { count: 'exact' })
                .eq('completed', true)
                .in('stack_id', stackIds);
                
            if (completedError) throw completedError;
            
            // Calculate completion rate
            const habitCount = habitsData?.length || 0;
            const completedCount = completedData?.length || 0;
            const completionRate = habitCount > 0 
                ? Math.round((completedCount / habitCount) * 100) 
                : 0;
            
            setUserStats({
                habitCount: habitCount,
                streak: pointsData?.currentStreak || 0,
                completionRate: completionRate,
                goalsAchieved: completedCount
            });
            
        } catch (err) {
            console.error('Error fetching user stats:', err);
        }
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/signin');
    };

    // Updated handler functions for buttons to use existing routes
    const handleEditProfile = () => {
        navigate('/edit-profile');
    };
    
    const handleTrackNewHabit = () => {
        navigate('/manager');
    };
    
    const handleUpdateProgress = () => {
        navigate('/manager');
    };
    
    const handleViewReports = () => {
        navigate('/reports');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading your dashboard...</div>
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
                        <h3 className="text-lg font-medium mt-2">Error Loading Dashboard</h3>
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
            <div className="max-w-6xl mx-auto">
                {/* Header section */}
                <div className="flex justify-between items-center mb-8 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                    <div className="flex items-center space-x-4">
                        <div className="h-16 w-16 rounded-full overflow-hidden bg-slate-700 flex items-center justify-center">
                            {profile?.avatar_url ? (
                                <img src={profile.avatar_url} alt={`${profile.name}'s avatar`} className="h-full w-full object-cover" />
                            ) : (
                                <span className="text-3xl text-gray-400">{profile?.name.charAt(0)}</span>
                            )}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-white">{profile?.name}</h1>
                            <p className="text-gray-400">@{profile?.username}</p>
                        </div>
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="bg-slate-700 hover:bg-slate-600 text-white py-2 px-4 rounded-md transition-colors"
                    >
                        Sign Out
                    </button>
                </div>

                {/* Main dashboard content */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Profile info card */}
                    <div className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                        <h2 className="text-xl font-semibold text-white mb-4">Profile Information</h2>
                        <div className="space-y-3">
                            <div>
                                <p className="text-gray-400 text-sm">Full Name</p>
                                <p className="text-white">{profile?.name}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Username</p>
                                <p className="text-white">@{profile?.username}</p>
                            </div>
                            <div>
                                <p className="text-gray-400 text-sm">Member Since</p>
                                <p className="text-white">{new Date(profile?.created_at || '').toLocaleDateString()}</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleEditProfile}
                            className="mt-6 w-full bg-[#C06C84] hover:bg-[#F67280] text-white py-2 px-3 rounded-md transition-colors text-sm">
                            Edit Profile
                        </button>
                    </div>

                    {/* Stats card */}
                    <div className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                        <h2 className="text-xl font-semibold text-white mb-4">Your Statistics</h2>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-700 p-4 rounded-lg text-center">
                                <p className="text-3xl font-bold text-[#F67280]">{userStats.habitCount}</p>
                                <p className="text-gray-400 text-sm">Habits Tracked</p>
                            </div>
                            <div className="bg-slate-700 p-4 rounded-lg text-center">
                                <p className="text-3xl font-bold text-[#F67280]">{userStats.streak}</p>
                                <p className="text-gray-400 text-sm">Days Streak</p>
                            </div>
                            <div className="bg-slate-700 p-4 rounded-lg text-center">
                                <p className="text-3xl font-bold text-[#F67280]">{userStats.completionRate}%</p>
                                <p className="text-gray-400 text-sm">Completion Rate</p>
                            </div>
                            <div className="bg-slate-700 p-4 rounded-lg text-center">
                                <p className="text-3xl font-bold text-[#F67280]">{userStats.goalsAchieved}</p>
                                <p className="text-gray-400 text-sm">Goals Achieved</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick actions card */}
                    <div className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                        <h2 className="text-xl font-semibold text-white mb-4">Quick Actions</h2>
                        <div className="space-y-3">
                            <button 
                                onClick={handleTrackNewHabit}
                                className="w-full bg-gradient-to-r from-[#355C7D] to-[#6C5B7B] hover:from-[#6C5B7B] hover:to-[#355C7D] text-white py-3 px-4 rounded-md transition-colors flex items-center justify-between">
                                <span>Manage Your Habits</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                            </button>
                            <button 
                                onClick={handleUpdateProgress}
                                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-md transition-colors flex items-center justify-between">
                                <span>Update Today's Progress</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                                </svg>
                            </button>
                            <button 
                                onClick={handleViewReports}
                                className="w-full bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-md transition-colors flex items-center justify-between">
                                <span>View Reports</span>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M3 3a1 1 0 000 2h14a1 1 0 100-2H3zm0 6a1 1 0 000 2h14a1 1 0 100-2H3zm0 6a1 1 0 100 2h14a1 1 0 100-2H3z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Recent activity section */}
                <div className="mt-8 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                    <h2 className="text-xl font-semibold text-white mb-4">Recent Activity</h2>
                    <div className="text-center py-8 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="mb-2">No recent activity to display</p>
                        <p className="text-sm">Start tracking your habits to see your activity here</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Home;