import React, { useState } from 'react';
import { supabase } from '../Utils/SupabaseClient'; // Correct path to Supabase client
import { useNavigate } from 'react-router-dom';

interface ProfileFormData {
    name: string;
    username: string;
    avatar_url: string;
}

const ProfileCreation: React.FC = () => {
    const [formData, setFormData] = useState<ProfileFormData>({
        name: '',
        username: '',
        avatar_url: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

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

        try {
            // Get current authenticated user
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                throw new Error('No user logged in');
            }

            // Insert into profiles table with UUID id
            const { error: supabaseError } = await supabase
                .from('profiles')
                .insert({
                    id: user.id, // This should work now with UUID type
                    name: formData.name,
                    username: formData.username,
                    avatar_url: formData.avatar_url || null, // Handle empty URL case
                });

            if (supabaseError) throw supabaseError;

            // Redirect to dashboard after successful profile creation
            navigate('/'); // Adjust destination as needed
        } catch (err: any) {
            console.error('Error creating profile:', err);
            setError(err.message || 'An error occurred during profile creation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-slate-800 p-8 rounded-lg shadow-md border border-slate-700">
                <div>
                    <h1 className="text-center text-3xl font-extrabold text-white mb-2">Complete Your Profile</h1>
                    <p className="text-center text-sm text-gray-300">
                        We need a few more details to set up your account
                    </p>
                </div>

                {error && (
                    <div className="bg-red-900/30 border border-red-500 text-red-200 px-4 py-3 rounded relative" role="alert">
                        <span className="block sm:inline">{error}</span>
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
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-[#C06C84] hover:bg-[#F67280] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#F67280] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                        >
                            {loading ? 'Creating Profile...' : 'Complete Profile'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfileCreation;
