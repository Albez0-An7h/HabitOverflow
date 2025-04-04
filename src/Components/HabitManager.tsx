import React, { useState, useEffect } from 'react';
import { supabase } from '../Utils/SupabaseClient';
import { 
    awardHabitCompletionPoints, 
    awardStackCompletionPoints, 
    updateUserStreak, 
    getUserPointsData,
    getHabitVerificationStatus,
    updateHabitVerificationStatus,
    HabitVerificationStatus,
    POINTS
} from '../Utils/pointsystem';
import { verifyHabitWithImage } from '../Utils/GeminiClient';

// Interfaces for type safety
interface Habit {
    id: string;
    name: string;
    description?: string;
    completed: boolean;
    position: number;
    verification?: HabitVerificationStatus;
}

interface HabitStack {
    id: string;
    name: string;
    habits: Habit[];
}

const HabitManager: React.FC = () => {
    const [userId, setUserId] = useState<string | null>(null);
    const [habitStacks, setHabitStacks] = useState<HabitStack[]>([]);
    const [newStackName, setNewStackName] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [userPoints, setUserPoints] = useState(0);
    const [selectedStack, setSelectedStack] = useState<string | null>(null);
    const [newHabitData, setNewHabitData] = useState({
        name: '',
        description: ''
    });

    // New state for verification
    const [selectedHabitForVerification, setSelectedHabitForVerification] = useState<Habit | null>(null);
    const [selectedStackForVerification, setSelectedStackForVerification] = useState<string | null>(null);
    const [verificationImage, setVerificationImage] = useState<string | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verificationMessage, setVerificationMessage] = useState<string | null>(null);

    useEffect(() => {
        // Get authenticated user and fetch their habit stacks
        const fetchUserData = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) {
                    throw new Error('No authenticated user found');
                }
                
                setUserId(user.id);
                
                // Fetch user's points data
                const pointsData = await getUserPointsData(user.id);
                if (pointsData) {
                    setUserPoints(pointsData.totalPoints);
                }
                
                // Fetch habit stacks
                await fetchHabitStacks(user.id);
            } catch (err: any) {
                setError(err.message || 'Failed to load user data');
            } finally {
                setLoading(false);
            }
        };

        fetchUserData();
    }, []);

    const fetchHabitStacks = async (uid: string) => {
        try {
            // Get all habit stacks for the user
            const { data: stacksData, error: stacksError } = await supabase
                .from('habit_stacks')
                .select('*')
                .eq('user_id', uid)
                .order('created_at', { ascending: true });
                
            if (stacksError) throw stacksError;
            
            // For each stack, get the habits
            const stacksWithHabits: HabitStack[] = [];
            
            for (const stack of stacksData || []) {
                const { data: habitsData, error: habitsError } = await supabase
                    .from('habits')
                    .select('*')
                    .eq('stack_id', stack.id)
                    .order('position', { ascending: true });
                    
                if (habitsError) throw habitsError;
                
                // Initialize habits array
                const habitsWithVerification: Habit[] = [];
                
                // For each habit, get its verification status
                for (const habit of habitsData || []) {
                    const verificationStatus = await getHabitVerificationStatus(habit.id);
                    
                    habitsWithVerification.push({
                        id: habit.id,
                        name: habit.name,
                        description: habit.description,
                        completed: habit.completed,
                        position: habit.position,
                        verification: verificationStatus || undefined
                    });
                }
                
                stacksWithHabits.push({
                    id: stack.id,
                    name: stack.name,
                    habits: habitsWithVerification
                });
            }
            
            setHabitStacks(stacksWithHabits);
        } catch (err: any) {
            setError(err.message || 'Failed to load habit stacks');
        }
    };

    const createHabitStack = async () => {
        if (!userId || !newStackName.trim()) return;
        
        try {
            const { data, error } = await supabase
                .from('habit_stacks')
                .insert([{
                    user_id: userId,
                    name: newStackName.trim()
                }])
                .select();
                
            if (error) throw error;
            
            if (data && data[0]) {
                setHabitStacks([...habitStacks, {
                    id: data[0].id,
                    name: data[0].name,
                    habits: []
                }]);
                setNewStackName('');
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create habit stack');
        }
    };

    const addHabitToStack = async () => {
        if (!userId || !selectedStack || !newHabitData.name.trim()) return;
        
        try {
            // Find the selected stack and determine the next position
            const stack = habitStacks.find(s => s.id === selectedStack);
            if (!stack) return;
            
            const nextPosition = stack.habits.length > 0 
                ? Math.max(...stack.habits.map(h => h.position)) + 1 
                : 0;
                
            const { data, error } = await supabase
                .from('habits')
                .insert([{
                    stack_id: selectedStack,
                    name: newHabitData.name.trim(),
                    description: newHabitData.description.trim() || null,
                    position: nextPosition,
                    completed: false
                }])
                .select();
                
            if (error) throw error;
            
            if (data && data[0]) {
                // Update the stack with the new habit
                setHabitStacks(habitStacks.map(s => {
                    if (s.id === selectedStack) {
                        return {
                            ...s,
                            habits: [...s.habits, {
                                id: data[0].id,
                                name: data[0].name,
                                description: data[0].description,
                                position: data[0].position,
                                completed: false,
                                verification: {
                                    habitId: data[0].id,
                                    isVerified: false,
                                    pendingVerification: false
                                }
                            }]
                        };
                    }
                    return s;
                }));
                
                // Reset form
                setNewHabitData({ name: '', description: '' });
            }
        } catch (err: any) {
            setError(err.message || 'Failed to add habit');
        }
    };

    // Updated function that marks a habit as complete but awaits verification
    const markHabitAsPendingVerification = async (stackId: string, habitId: string) => {
        if (!userId) return;
        
        try {
            const stack = habitStacks.find(s => s.id === stackId);
            if (!stack) return;
            
            const habit = stack.habits.find(h => h.id === habitId);
            if (!habit) return;
            
            // Set the habit for verification modal
            setSelectedHabitForVerification(habit);
            setSelectedStackForVerification(stackId);
            
        } catch (err: any) {
            setError(err.message || 'Failed to mark habit for verification');
        }
    };

    // Handle image selection for verification
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            
            reader.onload = (event) => {
                if (event.target && typeof event.target.result === 'string') {
                    setVerificationImage(event.target.result);
                }
            };
            
            reader.readAsDataURL(file);
        }
    };

    // Process verification with Gemini AI
    const processVerification = async () => {
        if (!selectedHabitForVerification || !verificationImage || !selectedStackForVerification || !userId) {
            setVerificationMessage('Missing required information for verification');
            return;
        }
        
        setIsVerifying(true);
        setVerificationMessage('Verifying your habit... please wait');
        
        try {
            // Upload the image to Supabase storage
            const imageName = `verification_${selectedHabitForVerification.id}_${Date.now()}.jpg`;
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('habit_verifications')
                .upload(imageName, verificationImage);
                
            if (uploadError) throw uploadError;
            
            // Get the public URL
            const { data: { publicUrl } } = supabase.storage
                .from('habit_verifications')
                .getPublicUrl(imageName);
            
            // Mark the habit as pending verification
            await updateHabitVerificationStatus(
                selectedHabitForVerification.id,
                false,
                true,
                publicUrl
            );
            
            // Call Gemini AI for verification
            const verificationResult = await verifyHabitWithImage(
                selectedHabitForVerification.name,
                selectedHabitForVerification.description,
                verificationImage
            );
            
            // Update verification status based on results
            await updateHabitVerificationStatus(
                selectedHabitForVerification.id,
                verificationResult.isVerified,
                false,
                publicUrl
            );
            
            // Update habit as completed in database if verified
            if (verificationResult.isVerified) {
                const { error: habitUpdateError } = await supabase
                    .from('habits')
                    .update({ completed: true })
                    .eq('id', selectedHabitForVerification.id);
                    
                if (habitUpdateError) throw habitUpdateError;
                
                // Award points
                const newPoints = await awardHabitCompletionPoints(userId, selectedHabitForVerification.id);
                setUserPoints(newPoints);
                
                // Update streak
                await updateUserStreak(userId);
                
                // Check if the entire stack is completed and verified
                const stack = habitStacks.find(s => s.id === selectedStackForVerification);
                if (stack) {
                    const allOtherHabitsCompleted = stack.habits
                        .filter(h => h.id !== selectedHabitForVerification.id)
                        .every(h => h.completed && h.verification?.isVerified);
                        
                    if (allOtherHabitsCompleted) {
                        // Award bonus points for completing the entire stack
                        const stackPoints = await awardStackCompletionPoints(userId, selectedStackForVerification);
                        setUserPoints(stackPoints);
                    }
                }
                
                setVerificationMessage(`Verification successful! You earned ${POINTS.HABIT_COMPLETION} points.`);
            } else {
                setVerificationMessage(`Verification failed: ${verificationResult.explanation}`);
            }
            
            // Refresh habit stacks to show updated state
            await fetchHabitStacks(userId);
            
        } catch (err: any) {
            setVerificationMessage(err.message || 'Verification failed due to a technical error');
            console.error('Verification error:', err);
        } finally {
            setIsVerifying(false);
        }
    };

    // Close verification modal and reset state
    const closeVerificationModal = () => {
        setSelectedHabitForVerification(null);
        setSelectedStackForVerification(null);
        setVerificationImage(null);
        setVerificationMessage(null);
    };

    const resetHabitStack = async (stackId: string) => {
        if (!userId) return;
        
        try {
            // Get all habits in the stack
            const { error } = await supabase
                .from('habits')
                .update({ completed: false })
                .eq('stack_id', stackId);
                
            if (error) throw error;
            
            // Also reset verification status for all habits in stack
            const stack = habitStacks.find(s => s.id === stackId);
            if (stack) {
                for (const habit of stack.habits) {
                    await updateHabitVerificationStatus(habit.id, false, false);
                }
            }
            
            // Update the UI
            setHabitStacks(habitStacks.map(s => {
                if (s.id === stackId) {
                    return {
                        ...s,
                        habits: s.habits.map(h => ({ 
                            ...h, 
                            completed: false,
                            verification: {
                                ...h.verification,
                                isVerified: false,
                                pendingVerification: false
                            }
                        }))
                    };
                }
                return s;
            }));
        } catch (err: any) {
            setError(err.message || 'Failed to reset habit stack');
        }
    };

    // Render verification status badge
    const renderVerificationBadge = (habit: Habit) => {
        if (!habit.verification) return null;
        
        if (habit.verification.isVerified) {
            return (
                <span className="ml-2 px-2 py-1 bg-green-800 text-green-200 text-xs rounded-full">
                    Verified
                </span>
            );
        }
        
        if (habit.verification.pendingVerification) {
            return (
                <span className="ml-2 px-2 py-1 bg-yellow-800 text-yellow-200 text-xs rounded-full">
                    Pending Verification
                </span>
            );
        }
        
        return null;
    };

    // Verification Modal
    const renderVerificationModal = () => {
        if (!selectedHabitForVerification) return null;
        
        return (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
                <div className="bg-slate-800 rounded-lg shadow-lg max-w-lg w-full p-6 border border-slate-700">
                    <h3 className="text-xl font-semibold text-white mb-4">
                        Verify Habit: {selectedHabitForVerification.name}
                    </h3>
                    
                    {selectedHabitForVerification.description && (
                        <p className="text-gray-300 mb-4">
                            {selectedHabitForVerification.description}
                        </p>
                    )}
                    
                    {verificationMessage && (
                        <div className={`p-3 rounded-md mb-4 ${
                            verificationMessage.includes('failed') || verificationMessage.includes('Missing') 
                                ? 'bg-red-900/30 text-red-200 border border-red-500'
                                : verificationMessage.includes('successful') 
                                    ? 'bg-green-900/30 text-green-200 border border-green-500'
                                    : 'bg-blue-900/30 text-blue-200 border border-blue-500'
                        }`}>
                            {verificationMessage}
                        </div>
                    )}
                    
                    {!verificationImage ? (
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Upload a photo showing you completed this habit
                            </label>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    disabled={isVerifying}
                                    id="file-upload"
                                />
                                <label 
                                    htmlFor="file-upload"
                                    className="flex items-center justify-center w-full px-4 py-2 bg-gradient-to-r from-[#355C7D] to-[#6C5B7B] hover:from-[#6C5B7B] hover:to-[#355C7D] text-white rounded-md transition-colors cursor-pointer disabled:opacity-50"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                    Choose Image
                                </label>
                                <p className="text-xs text-gray-400 mt-2 text-center">
                                    Select a clear photo that shows you completed the habit
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="mb-4">
                            <img 
                                src={verificationImage} 
                                alt="Verification" 
                                className="w-full h-48 object-contain bg-slate-900 rounded-md" 
                            />
                            <button
                                onClick={() => setVerificationImage(null)}
                                className="mt-2 text-sm bg-slate-700 hover:bg-slate-600 text-white py-1 px-3 rounded-md transition-colors flex items-center mx-auto"
                                disabled={isVerifying}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                                Change image
                            </button>
                        </div>
                    )}
                    
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={closeVerificationModal}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors"
                            disabled={isVerifying}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={processVerification}
                            disabled={!verificationImage || isVerifying}
                            className="px-4 py-2 bg-[#C06C84] hover:bg-[#F67280] text-white rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isVerifying ? 'Verifying...' : 'Verify Habit'}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-white text-xl">Loading your habits...</div>
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
                        <h3 className="text-lg font-medium mt-2">Error Loading Habits</h3>
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
            {renderVerificationModal()}
            
            <div className="max-w-6xl mx-auto">
                {/* Header with points */}
                <div className="mb-8 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-white">Your Habit Stacks</h1>
                        <div className="bg-[#6C5B7B] px-4 py-2 rounded-lg">
                            <span className="text-white font-medium">Points: {userPoints}</span>
                        </div>
                    </div>
                </div>

                {/* Create new stack section */}
                <div className="mb-8 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                    <h2 className="text-xl font-semibold text-white mb-4">Create New Habit Stack</h2>
                    <div className="flex space-x-4">
                        <input
                            type="text"
                            value={newStackName}
                            onChange={(e) => setNewStackName(e.target.value)}
                            placeholder="Stack name (e.g. Morning Routine)"
                            className="flex-grow px-3 py-2 bg-slate-700 border border-slate-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-[#C06C84] focus:border-[#C06C84]"
                        />
                        <button
                            onClick={createHabitStack}
                            disabled={!newStackName.trim()}
                            className="bg-gradient-to-r from-[#355C7D] to-[#6C5B7B] hover:from-[#6C5B7B] hover:to-[#355C7D] text-white py-2 px-6 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create Stack
                        </button>
                    </div>
                </div>

                {/* Add habit to stack section */}
                <div className="mb-8 bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                    <h2 className="text-xl font-semibold text-white mb-4">Add Habit to Stack</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Select Stack</label>
                            <select
                                value={selectedStack || ''}
                                onChange={(e) => setSelectedStack(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-md focus:outline-none focus:ring-[#C06C84] focus:border-[#C06C84]"
                            >
                                <option value="">Select a stack</option>
                                {habitStacks.map(stack => (
                                    <option key={stack.id} value={stack.id}>{stack.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Habit Name</label>
                            <input
                                type="text"
                                value={newHabitData.name}
                                onChange={(e) => setNewHabitData({...newHabitData, name: e.target.value})}
                                placeholder="Habit name (e.g. Brush teeth)"
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-[#C06C84] focus:border-[#C06C84]"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-1">Description (Optional)</label>
                            <input
                                type="text"
                                value={newHabitData.description}
                                onChange={(e) => setNewHabitData({...newHabitData, description: e.target.value})}
                                placeholder="Brief description"
                                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-[#C06C84] focus:border-[#C06C84]"
                            />
                        </div>
                        <button
                            onClick={addHabitToStack}
                            disabled={!selectedStack || !newHabitData.name.trim()}
                            className="w-full bg-[#C06C84] hover:bg-[#F67280] text-white py-2 px-4 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Habit
                        </button>
                    </div>
                </div>

                {/* Display habit stacks */}
                {habitStacks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {habitStacks.map(stack => (
                            <div key={stack.id} className="bg-slate-800 p-6 rounded-lg shadow-md border border-slate-700">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-xl font-semibold text-white">{stack.name}</h2>
                                    <button
                                        onClick={() => resetHabitStack(stack.id)}
                                        className="text-sm bg-slate-700 hover:bg-slate-600 text-white px-3 py-1 rounded transition-colors"
                                    >
                                        Reset
                                    </button>
                                </div>
                                
                                {stack.habits.length > 0 ? (
                                    <ul className="space-y-3">
                                        {stack.habits.map((habit, index) => (
                                            <li key={habit.id} className="bg-slate-700 rounded-lg p-4">
                                                <div className="flex items-center space-x-3">
                                                    <div 
                                                        onClick={() => markHabitAsPendingVerification(stack.id, habit.id)}
                                                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 cursor-pointer ${
                                                            habit.completed && habit.verification?.isVerified 
                                                                ? 'bg-green-500 border-green-600' 
                                                                : habit.verification?.pendingVerification
                                                                ? 'bg-yellow-500 border-yellow-600'
                                                                : 'border-gray-400'
                                                        } flex items-center justify-center`}
                                                    >
                                                        {habit.completed && habit.verification?.isVerified && (
                                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                    <div className="flex-grow">
                                                        <div className="flex items-center">
                                                            <p className={`font-medium ${
                                                                habit.completed && habit.verification?.isVerified 
                                                                    ? 'line-through text-gray-400' 
                                                                    : 'text-white'
                                                            }`}>
                                                                {index + 1}. {habit.name}
                                                            </p>
                                                            {renderVerificationBadge(habit)}
                                                        </div>
                                                        {habit.description && (
                                                            <p className="text-sm text-gray-400 mt-1">{habit.description}</p>
                                                        )}
                                                    </div>
                                                    
                                                    {/* Add verify button */}
                                                    <button
                                                        onClick={() => markHabitAsPendingVerification(stack.id, habit.id)}
                                                        className="px-3 py-1 bg-blue-700 hover:bg-blue-600 text-white text-sm rounded"
                                                        disabled={habit.completed && habit.verification?.isVerified}
                                                    >
                                                        {habit.verification?.pendingVerification 
                                                            ? 'Verifying...' 
                                                            : habit.verification?.isVerified 
                                                            ? 'Verified' 
                                                            : 'Verify'}
                                                    </button>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <div className="text-center py-8 text-gray-400">
                                        <p>No habits in this stack yet.</p>
                                        <p className="text-sm mt-2">Add your first habit using the form above.</p>
                                    </div>
                                )}
                                
                                {stack.habits.length > 0 && stack.habits.every(h => h.completed && h.verification?.isVerified) && (
                                    <div className="mt-4 bg-green-900/30 border border-green-600 rounded-lg p-3 text-green-200 text-center">
                                        <p>Great job! All habits in this stack completed and verified!</p>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="bg-slate-800 p-8 rounded-lg shadow-md border border-slate-700 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <h3 className="text-lg font-medium text-white mb-2">No Habit Stacks Yet</h3>
                        <p className="text-gray-400 mb-6">Create your first habit stack to get started.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default HabitManager;
