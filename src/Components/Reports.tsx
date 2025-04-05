import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../Utils/SupabaseClient';
import { getCurrentUser } from '../Utils/auth';
import { getUserPointsData } from '../Utils/pointsystem';

// Define types for our data
interface Achievement {
    id: string;
    title: string;
    description: string;
    icon: string;
    earned: boolean;
    date?: string;
}

interface TimeframeStats {
    habitsCompleted: number;
    totalHabits: number;
    completionRate: number;
    pointsEarned: number;
    streakMaintained: boolean;
}

interface UserStats {
    habitCount: number;
    streak: number;
    completionRate: number;
    goalsAchieved: number;
}

type Timeframe = 'day' | 'week' | 'month';

const Reports = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedTimeframe, setSelectedTimeframe] = useState<Timeframe>('day');
    const [userStats, setUserStats] = useState<UserStats>({
        habitCount: 0,
        streak: 0,
        completionRate: 0,
        goalsAchieved: 0
    });
    
    // Stats for different timeframes
    const [dayStats, setDayStats] = useState<TimeframeStats>({
        habitsCompleted: 0,
        totalHabits: 0,
        completionRate: 0,
        pointsEarned: 0,
        streakMaintained: true
    });
    
    const [weekStats, setWeekStats] = useState<TimeframeStats>({
        habitsCompleted: 0,
        totalHabits: 0,
        completionRate: 0,
        pointsEarned: 0,
        streakMaintained: false
    });
    
    const [monthStats, setMonthStats] = useState<TimeframeStats>({
        habitsCompleted: 0,
        totalHabits: 0,
        completionRate: 0,
        pointsEarned: 0,
        streakMaintained: false
    });
    
    // Achievements
    const [achievements, setAchievements] = useState<Achievement[]>([]);
    
    // Current streak
    const [currentStreak, setCurrentStreak] = useState(0);
    
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                // Check if user is authenticated
                const { user, error: authError } = await getCurrentUser();

                if (authError || !user) {
                    navigate('/signin');
                    return;
                }
                
                // Fetch points data
                const pointsData = await getUserPointsData(user.id);
                if (pointsData) {
                    setCurrentStreak(pointsData.currentStreak);
                }
                
                // Fetch stats for different timeframes
                await Promise.all([
                    fetchTimeframeStats(user.id, 'day'),
                    fetchTimeframeStats(user.id, 'week'),
                    fetchTimeframeStats(user.id, 'month')
                ]);
                
                // Generate achievements based on user data
                await generateAchievements(user.id);
                
            } catch (err: any) {
                console.error('Error fetching report data:', err);
                setError(err.message || 'Failed to load report data');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, [navigate]);
    
    // Fetch stats for a specific timeframe
    const fetchTimeframeStats = async (userId: string, timeframe: Timeframe) => {
        try {
            const now = new Date();
            let startDate = new Date();
            
            // Set start date based on timeframe
            if (timeframe === 'day') {
                startDate.setHours(0, 0, 0, 0);
            } else if (timeframe === 'week') {
                // Start of current week (Sunday)
                const day = startDate.getDay();
                startDate.setDate(startDate.getDate() - day);
                startDate.setHours(0, 0, 0, 0);
            } else if (timeframe === 'month') {
                // Start of current month
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
            
            // Format date for Supabase query
            const formattedStartDate = startDate.toISOString();
            
            // First, get the stack IDs for this user
            const { data: stacks, error: stacksError } = await supabase
                .from('habit_stacks')
                .select('id')
                .eq('user_id', userId);
                
            if (stacksError) throw stacksError;
            const stackIds = stacks?.map(stack => stack.id) || [];
            
            // Then get habit IDs for these stacks
            const { data: habits, error: habitsError } = await supabase
                .from('habits')
                .select('id')
                .in('stack_id', stackIds);
                
            if (habitsError) throw habitsError;
            const habitIds = habits?.map(habit => habit.id) || [];
            
            // Get all habits completed within the timeframe
            const { data: completedData, error: completedError } = await supabase
                .from('habit_verifications')
                .select('habit_id, verified_at')
                .eq('is_verified', true)
                .gt('verified_at', formattedStartDate)
                .in('habit_id', habitIds);
                
            if (completedError) throw completedError;
            
            // Calculate stats
            const habitsCompleted = completedData?.length || 0;
            const totalHabits = habitIds.length;
            const completionRate = totalHabits > 0 ? (habitsCompleted / totalHabits) * 100 : 0;
            
            // Calculate points earned in this timeframe (rough estimate - 5 points per habit)
            const pointsEarned = habitsCompleted * 5;
            
            // Update state based on timeframe
            const stats = {
                habitsCompleted,
                totalHabits,
                completionRate: Math.round(completionRate),
                pointsEarned,
                streakMaintained: habitsCompleted > 0
            };
            
            if (timeframe === 'day') {
                setDayStats(stats);
            } else if (timeframe === 'week') {
                setWeekStats(stats);
            } else if (timeframe === 'month') {
                setMonthStats(stats);
            }
            
        } catch (err) {
            console.error(`Error fetching ${timeframe} stats:`, err);
        }
    };
    
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

    // Generate achievements based on user data
    const generateAchievements = async (userId: string) => {
        try {
            // Fetch relevant data
            const pointsData = await getUserPointsData(userId);
            
            // Base achievements
            const baseAchievements: Achievement[] = [
                {
                    id: 'streak_3',
                    title: '3-Day Streak',
                    description: 'Maintained habits for 3 consecutive days',
                    icon: '🔥',
                    earned: (pointsData?.currentStreak || 0) >= 3
                },
                {
                    id: 'streak_7',
                    title: '7-Day Streak',
                    description: 'Maintained habits for a full week',
                    icon: '🏆',
                    earned: (pointsData?.currentStreak || 0) >= 7
                },
                {
                    id: 'streak_30',
                    title: 'Monthly Master',
                    description: 'Maintained habits for 30 consecutive days',
                    icon: '🌟',
                    earned: (pointsData?.currentStreak || 0) >= 30
                },
                {
                    id: 'points_100',
                    title: 'Century Club',
                    description: 'Earned 100 or more habit points',
                    icon: '💯',
                    earned: (pointsData?.totalPoints || 0) >= 100
                },
                {
                    id: 'points_500',
                    title: 'Habit Hero',
                    description: 'Earned 500 or more habit points',
                    icon: '👑',
                    earned: (pointsData?.totalPoints || 0) >= 500
                }
            ];
            
            // Get all habits marked as completed
            const { data: stacks, error: stacksError } = await supabase
                .from('habit_stacks')
                .select('id')
                .eq('user_id', userId);
                
            if (stacksError) throw stacksError;
            const stackIds = stacks?.map(stack => stack.id) || [];
            
            const { data: completedHabits, error: habitsError } = await supabase
                .from('habits')
                .select('id')
                .eq('completed', true)
                .in('stack_id', stackIds);
                
            if (habitsError) throw habitsError;
            
            // Add completion-based achievements
            const completionAchievements: Achievement[] = [
                {
                    id: 'habits_5',
                    title: 'Getting Started',
                    description: 'Completed 5 habits',
                    icon: '🌱',
                    earned: (completedHabits?.length || 0) >= 5
                },
                {
                    id: 'habits_20',
                    title: 'Consistency is Key',
                    description: 'Completed 20 habits',
                    icon: '🔑',
                    earned: (completedHabits?.length || 0) >= 20
                },
                {
                    id: 'habits_50',
                    title: 'Habit Master',
                    description: 'Completed 50 habits',
                    icon: '🎓',
                    earned: (completedHabits?.length || 0) >= 50
                }
            ];
            
            // Combine all achievements and set state
            setAchievements([...baseAchievements, ...completionAchievements]);
            
        } catch (err) {
            console.error('Error generating achievements:', err);
        }
    };
    
    // Get stats for the selected timeframe
    const getSelectedStats = () => {
        switch (selectedTimeframe) {
            case 'day':
                return dayStats;
            case 'week':
                return weekStats;
            case 'month':
                return monthStats;
            default:
                return dayStats;
        }
    };
    
    const currentStats = getSelectedStats();
    
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading your reports...</div>
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
                        <h3 className="text-lg font-medium mt-2">Error Loading Reports</h3>
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
                    <div>
                        <h1 className="text-2xl font-bold text-white">Your Progress Reports</h1>
                        <p className="text-gray-400">Track your habit journey and achievements</p>
                    </div>
                    <div className="bg-[#6C5B7B] px-4 py-2 rounded-lg">
                        <span className="text-white font-medium">Current Streak: {currentStreak} days</span>
                    </div>
                </div>

                {/* Timeframe selection */}
                <div className="mb-8 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                    <h2 className="text-xl font-semibold text-white mb-4">Select Timeframe</h2>
                    <div className="grid grid-cols-3 gap-4">
                        <button
                            onClick={() => setSelectedTimeframe('day')}
                            className={`py-2 px-4 rounded-md transition-colors ${
                                selectedTimeframe === 'day'
                                    ? 'bg-[#C06C84] text-white'
                                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                            }`}
                        >
                            Daily
                        </button>
                        <button
                            onClick={() => setSelectedTimeframe('week')}
                            className={`py-2 px-4 rounded-md transition-colors ${
                                selectedTimeframe === 'week'
                                    ? 'bg-[#C06C84] text-white'
                                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                            }`}
                        >
                            Weekly
                        </button>
                        <button
                            onClick={() => setSelectedTimeframe('month')}
                            className={`py-2 px-4 rounded-md transition-colors ${
                                selectedTimeframe === 'month'
                                    ? 'bg-[#C06C84] text-white'
                                    : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                            }`}
                        >
                            Monthly
                        </button>
                    </div>
                </div>

                {/* Statistics section */}
                <div className="mb-8 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                    <h2 className="text-xl font-semibold text-white mb-4">
                        {selectedTimeframe === 'day' && 'Today\'s Statistics'}
                        {selectedTimeframe === 'week' && 'This Week\'s Statistics'}
                        {selectedTimeframe === 'month' && 'This Month\'s Statistics'}
                    </h2>
                    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                        <div className="bg-slate-700 p-4 rounded-lg text-center">
                            <p className="text-3xl font-bold text-[#F67280]">{currentStats.habitsCompleted}</p>
                            <p className="text-gray-400 text-sm">Habits Completed</p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg text-center">
                            <p className="text-3xl font-bold text-[#F67280]">{currentStats.completionRate}%</p>
                            <p className="text-gray-400 text-sm">Completion Rate</p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg text-center">
                            <p className="text-3xl font-bold text-[#F67280]">{currentStats.pointsEarned}</p>
                            <p className="text-gray-400 text-sm">Points Earned</p>
                        </div>
                        <div className="bg-slate-700 p-4 rounded-lg text-center">
                            <p className="text-3xl font-bold text-[#F67280]">
                                {currentStats.streakMaintained ? '✓' : '✗'}
                            </p>
                            <p className="text-gray-400 text-sm">Streak Maintained</p>
                        </div>
                    </div>
                    
                    {/* Progress visualization */}
                    <div className="mt-6">
                        <h3 className="text-md font-medium text-white mb-2">Habit Completion</h3>
                        <div className="w-full bg-slate-700 rounded-full h-4">
                            <div 
                                className="bg-gradient-to-r from-[#355C7D] to-[#F67280] h-4 rounded-full" 
                                style={{ width: `${currentStats.completionRate}%` }}
                            ></div>
                        </div>
                        <p className="text-gray-400 text-sm mt-1">
                            {currentStats.habitsCompleted} of {currentStats.totalHabits} habits completed
                        </p>
                    </div>
                </div>

                {/* Achievements section */}
                <div className="mb-8 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                    <h2 className="text-xl font-semibold text-white mb-4">Your Achievements</h2>
                    
                    {achievements.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {achievements.map(achievement => (
                                <div 
                                    key={achievement.id} 
                                    className={`p-4 rounded-lg border ${
                                        achievement.earned 
                                            ? 'bg-gradient-to-br from-slate-700 to-slate-800 border-[#C06C84]' 
                                            : 'bg-slate-700/50 border-slate-600 opacity-60'
                                    }`}
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className="text-4xl">{achievement.icon}</div>
                                        <div>
                                            <h3 className="font-medium text-white">{achievement.title}</h3>
                                            <p className="text-sm text-gray-300">{achievement.description}</p>
                                            {achievement.earned ? (
                                                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-green-900 text-green-200">
                                                    Achieved
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center mt-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-gray-300">
                                                    Locked
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-gray-400">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            <p className="mb-2">No achievements yet</p>
                            <p className="text-sm">Complete habits consistently to earn achievements</p>
                        </div>
                    )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/')}
                        className="flex-1 bg-slate-700 hover:bg-slate-600 text-white py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L4.414 9H17a1 1 0 110 2H4.414l5.293 5.293a1 1 0 010 1.414z" clipRule="evenodd" />
                        </svg>
                        Back to Dashboard
                    </button>
                    <button
                        onClick={() => navigate('/manager')}
                        className="flex-1 bg-gradient-to-r from-[#355C7D] to-[#6C5B7B] hover:from-[#6C5B7B] hover:to-[#355C7D] text-white py-3 px-4 rounded-md transition-colors flex items-center justify-center"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                        Manage Habits
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Reports;
