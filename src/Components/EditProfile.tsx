import React, { useState, useEffect } from 'react';
import { supabase } from '../Utils/SupabaseClient';
import { useNavigate } from 'react-router-dom';

interface ProfileFormData {
    name: string;
    username: string;
    avatar_url: string;
}

const EditProfile: React.FC = () => {
    const [formData, setFormData] = useState<ProfileFormData>({
        name: '',
        username: '',
        avatar_url: '',
    });
    const [originalUsername, setOriginalUsername] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // Fetch current user profile data
        const fetchProfile = async () => {
            try {
                // Get current authenticated user
                const { data: { user } } = await supabase.auth.getUser();

                if (!user) {
                    navigate('/signin');
                    return;
                }

                // Get user profile from database
                const { data, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profileError) {
                    throw profileError;
                }

                if (data) {
                    setFormData({
                        name: data.name || '',
                        username: data.username || '',
                        avatar_url: data.avatar_url || '',
                    });
                    // Store original username to check if it changed (for uniqueness validation)
                    setOriginalUsername(data.username);
                } else {
                    // If no profile exists, redirect to profile creation
                    navigate('/profile');
                }
            } catch (err: any) {
                console.error('Error fetching profile:', err);
                setError(err.message || 'Failed to load profile data');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [navigate]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setMessage(null);

        try {
            // Get current authenticated user
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('No user logged in');
            }

            // If username was changed, check if it's unique
            if (formData.username !== originalUsername) {
                const { data: usernameCheck, error: usernameError } = await supabase
                    .from('profiles')
                    .select('username')
                    .eq('username', formData.username)
                    .neq('id', user.id)
                    .single();

                if (usernameCheck) {
                    throw new Error('Username already taken. Please choose another one.');
                }

                if (usernameError && usernameError.code !== 'PGRST116') { // PGRST116 is "no rows returned" which is what we want
                    throw usernameError;
                }
            }

            // Update profile in database
            const { error: updateError } = await supabase
                .from('profiles')
                .update({
                    name: formData.name,
                    username: formData.username,
                    avatar_url: formData.avatar_url || null, // Handle empty URL case
                })
                .eq('id', user.id);

            if (updateError) throw updateError;

            setMessage('Profile updated successfully!');
            setTimeout(() => {
                navigate('/');
            }, 2000);
        } catch (err: any) {
            console.error('Error updating profile:', err);
            setError(err.message || 'An error occurred while updating your profile');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !formData.name) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
                <div className="text-white text-xl">Loading your profile...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-slate-800 p-8 rounded-lg shadow-md border border-slate-700">
                <div>
                    <h1 className="text-center text-3xl font-extrabold text-white mb-2">Edit Your Profile</h1>
                    <p className="text-center text-sm text-gray-300">
                        Update your profile information
                    </p>
                </div>

                {error && (
                    <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded relative" role="alert">
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}

                {message && (
                    <div className="bg-green-900/30 border border-green-500 text-green-200 px-4 py-3 rounded relative" role="alert">
                        <span className="block sm:inline">{message}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    <div className="rounded-md shadow-sm space-y-4">
                        <div>
                            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Full Name</label>
                            <input
                                type="text"
                                id="name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="appearance-none relative block w-full px-3 py-2 bg-slate-700 border border-slate-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-[#C06C84] focus:border-[#C06C84] focus:z-10 sm:text-sm"
                                placeholder="Enter your full name"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">Username</label>
                            <input
                                type="text"
                                id="username"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                className="appearance-none relative block w-full px-3 py-2 bg-slate-700 border border-slate-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-[#C06C84] focus:border-[#C06C84] focus:z-10 sm:text-sm"
                                placeholder="Choose a unique username"
                                disabled={loading}
                            />
                        </div>

                        <div>
                            <label htmlFor="avatar_url" className="block text-sm font-medium text-gray-300 mb-1">Profile Picture URL</label>
                            <input
                                type="url"
                                id="avatar_url"
                                name="avatar_url"
                                value={formData.avatar_url}
                                onChange={handleChange}
                                className="appearance-none relative block w-full px-3 py-2 bg-slate-700 border border-slate-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-[#C06C84] focus:border-[#C06C84] focus:z-10 sm:text-sm"
                                placeholder="https://example.com/your-image.jpg (optional)"
                                disabled={loading}
                            />
                            {formData.avatar_url && (
                                <div className="mt-2 flex justify-center">
                                    <img 
                                        src={formData.avatar_url} 
                                        alt="Profile preview" 
                                        className="h-20 w-20 rounded-full object-cover border-2 border-slate-600" 
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150?text=Invalid+URL';
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-between space-x-4">
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="group relative flex-1 flex justify-center py-2 px-4 border border-slate-600 text-sm font-medium rounded-md text-white bg-slate-700 hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative flex-1 flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#C06C84] hover:bg-[#F67280] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F67280] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Updating...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditProfile;
