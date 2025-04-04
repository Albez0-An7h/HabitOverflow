import { supabase } from './SupabaseClient';

// Sign up with email and password
export async function signUpWithEmail(email: string, password: string) {
    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
        });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error signing up:', error);
        return { data: null, error };
    }
}

// Sign in with email and password
export async function signInWithEmail(email: string, password: string) {
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error signing in:', error);
        return { data: null, error };
    }
}

// Sign in with Google
export async function signInWithGoogle() {
    try {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: window.location.origin
            }
        });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error signing in with Google:', error);
        return { data: null, error };
    }
}

// Check if user is authenticated
export async function getCurrentUser() {
    try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        return { user: data?.session?.user || null, error: null };
    } catch (error) {
        console.error('Error getting current user:', error);
        return { user: null, error };
    }
}
