import { supabase } from './SupabaseClient';

// Point values for different actions
const POINTS = {
    HABIT_COMPLETION: 5,
    STACK_COMPLETION: 10,
    STREAK_BONUS: {
        3: 5,   // 3 day streak: +5 points
        7: 15,  // 7 day streak: +15 points
        14: 30, // 14 day streak: +30 points
        30: 50, // 30 day streak: +50 points
    }
};

// Interfaces for type safety
export interface PointsData {
    userId: string;
    totalPoints: number;
    currentStreak: number;
    lastActivityDate: string | null;
}

export interface HabitVerificationStatus {
    habitId: string;
    isVerified: boolean;
    pendingVerification: boolean;
    imageUrl?: string;
    verifiedAt?: string;
}

// Award points for completing a habit
export const awardHabitCompletionPoints = async (userId: string, habitId?: string): Promise<number> => {
    return await addPointsToUser(userId, POINTS.HABIT_COMPLETION);
};

// Award points for completing a full stack
export const awardStackCompletionPoints = async (userId: string): Promise<number> => {
    return await addPointsToUser(userId, POINTS.STACK_COMPLETION);
};

// Get the verification status for a habit
export const getHabitVerificationStatus = async (habitId: string): Promise<HabitVerificationStatus | null> => {
    try {
        const { data: verificationData, error } = await supabase
            .from('habit_verifications')
            .select('*')
            .eq('habit_id', habitId)
            .single();
            
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error fetching verification status:', error);
            return null;
        }
        
        if (!verificationData) {
            // Create a default verification status if none exists
            return {
                habitId,
                isVerified: false,
                pendingVerification: false
            };
        }
        
        return {
            habitId: verificationData.habit_id,
            isVerified: verificationData.is_verified,
            pendingVerification: verificationData.pending_verification,
            imageUrl: verificationData.image_url,
            verifiedAt: verificationData.verified_at
        };
    } catch (error) {
        console.error('Error getting habit verification status:', error);
        return null;
    }
};

// Update verification status for a habit
export const updateHabitVerificationStatus = async (
    habitId: string, 
    isVerified: boolean, 
    pendingVerification: boolean,
    imageUrl?: string
): Promise<boolean> => {
    try {
        // Check if verification record exists
        const { data, error } = await supabase
            .from('habit_verifications')
            .select('*')
            .eq('habit_id', habitId)
            .single();
            
        const verificationData = {
            habit_id: habitId,
            is_verified: isVerified,
            pending_verification: pendingVerification,
            image_url: imageUrl || null,
            verified_at: isVerified ? new Date().toISOString() : null
        };
            
        if (error && error.code === 'PGRST116') {
            // No record exists, create new one
            const { error: insertError } = await supabase
                .from('habit_verifications')
                .insert([verificationData]);
                
            if (insertError) {
                console.error('Error inserting verification status:', insertError);
                return false;
            }
        } else if (error) {
            // Other error occurred
            console.error('Error checking verification status:', error);
            return false;
        } else {
            // Record exists, update it
            const { error: updateError } = await supabase
                .from('habit_verifications')
                .update(verificationData)
                .eq('habit_id', habitId);
                
            if (updateError) {
                console.error('Error updating verification status:', updateError);
                return false;
            }
        }
        
        return true;
    } catch (error) {
        console.error('Error updating habit verification status:', error);
        return false;
    }
};

// Award streak bonus if applicable
export const checkAndAwardStreakBonus = async (userId: string, streak: number): Promise<number> => {
    // Check if the streak qualifies for a bonus
    const streakLevels = Object.keys(POINTS.STREAK_BONUS)
        .map(Number)
        .sort((a, b) => a - b);
    
    let bonusPoints = 0;
    for (const level of streakLevels) {
        if (streak === level) {
            bonusPoints = POINTS.STREAK_BONUS[level as keyof typeof POINTS.STREAK_BONUS];
            break;
        }
    }
    
    if (bonusPoints > 0) {
        return await addPointsToUser(userId, bonusPoints);
    }
    
    return 0;
};

// Get the current user's points data
export const getUserPointsData = async (userId: string): Promise<PointsData | null> => {
    try {
        const { data, error } = await supabase
            .from('user_points')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (error) {
            console.error('Error fetching user points:', error);
            return null;
        }
        
        if (!data) return null;
        
        return {
            userId: data.user_id,
            totalPoints: data.total_points,
            currentStreak: data.current_streak,
            lastActivityDate: data.last_activity_date
        };
    } catch (error) {
        console.error('Error getting user points data:', error);
        return null;
    }
};

// Update streak information based on habit completion
export const updateUserStreak = async (userId: string): Promise<number> => {
    try {
        // Get current user points data
        const { data, error } = await supabase
            .from('user_points')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (error) {
            console.error('Error fetching user streak:', error);
            return 0;
        }
        
        if (!data) return 0;
        
        const lastActivityDate = data.last_activity_date ? new Date(data.last_activity_date) : null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let newStreak = data.current_streak;
        
        // If the last activity was yesterday, increment streak
        if (lastActivityDate) {
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);
            
            if (lastActivityDate.getTime() === yesterday.getTime()) {
                newStreak += 1;
            } else if (lastActivityDate.getTime() < yesterday.getTime()) {
                // Streak broken if last activity was before yesterday
                newStreak = 1;
            }
            // If last activity was today, don't change streak
        } else {
            // First activity ever
            newStreak = 1;
        }
        
        // Update the streak in the database
        const { error: updateError } = await supabase
            .from('user_points')
            .update({ 
                current_streak: newStreak,
                last_activity_date: today.toISOString().split('T')[0]
            })
            .eq('user_id', userId);
            
        if (updateError) {
            console.error('Error updating streak:', updateError);
            return 0;
        }
        
        return newStreak;
    } catch (error) {
        console.error('Error updating streak:', error);
        return 0;
    }
};

// Helper function to add points to a user
const addPointsToUser = async (userId: string, points: number): Promise<number> => {
    try {
        // First, check if the user has a points record
        const { data: existingData, error } = await supabase
            .from('user_points')
            .select('total_points')
            .eq('user_id', userId)
            .single();
            
        if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
            console.error('Error checking points record:', error);
            return 0;
        }
        
        if (!existingData) {
            // Create new points record for the user
            const { error: insertError } = await supabase
                .from('user_points')
                .insert([{
                    user_id: userId,
                    total_points: points,
                    current_streak: 0,
                    last_activity_date: null
                }]);
                
            if (insertError) {
                console.error('Error creating points record:', insertError);
                return 0;
            }
            
            return points;
        } else {
            // Update existing record
            const newTotal = existingData.total_points + points;
            const { error: updateError } = await supabase
                .from('user_points')
                .update({ total_points: newTotal })
                .eq('user_id', userId);
                
            if (updateError) {
                console.error('Error updating points:', updateError);
                return 0;
            }
            
            return newTotal;
        }
    } catch (error) {
        console.error('Error adding points:', error);
        return 0;
    }
};

// Export POINTS constant for use in other components
export { POINTS };
