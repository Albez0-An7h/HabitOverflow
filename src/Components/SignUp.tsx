import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signUpWithEmail, signInWithGoogle } from '../Utils/auth';
import { FcGoogle } from 'react-icons/fc';

const SignUp = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const navigate = useNavigate();

    const handleEmailSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        // Form validation
        if (!email || !password) {
            setError('Email and password are required');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        setLoading(true);

        try {
            const { error } = await signUpWithEmail(email, password);

            if (error) {
                throw error;
            }

            setMessage('Sign-up successful! You will now be redirected to complete your profile.');
            setTimeout(() => {
                navigate('/profile');
            }, 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during sign up');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignUp = async () => {
        setError(null);
        setLoading(true);

        try {
            const { error } = await signInWithGoogle();

            if (error) {
                throw error;
            }
            // Google auth will handle redirect
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An error occurred during Google sign in');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-slate-800 p-8 rounded-lg shadow-md border border-slate-700">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-white">Create your account</h2>
                    <p className="mt-2 text-center text-sm text-gray-300">
                        Or{' '}
                        <Link to="/signin" className="font-medium text-[#F67280] hover:text-[#C06C84] transition-colors">
                            sign in if you already have an account
                        </Link>
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

                <form className="mt-8 space-y-6" onSubmit={handleEmailSignUp}>
                    <div className="rounded-md shadow-sm space-y-4">
                        <div>
                            <label htmlFor="email-address" className="sr-only">Email address</label>
                            <input
                                id="email-address"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="appearance-none relative block w-full px-3 py-2 bg-slate-700 border border-slate-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-[#C06C84] focus:border-[#C06C84] focus:z-10 sm:text-sm"
                                placeholder="Email address"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Password</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="new-password"
                                required
                                className="appearance-none relative block w-full px-3 py-2 bg-slate-700 border border-slate-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-[#C06C84] focus:border-[#C06C84] focus:z-10 sm:text-sm"
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label htmlFor="confirm-password" className="sr-only">Confirm password</label>
                            <input
                                id="confirm-password"
                                name="confirm-password"
                                type="password"
                                autoComplete="new-password"
                                required
                                className="appearance-none relative block w-full px-3 py-2 bg-slate-700 border border-slate-600 placeholder-gray-400 text-white rounded-md focus:outline-none focus:ring-[#C06C84] focus:border-[#C06C84] focus:z-10 sm:text-sm"
                                placeholder="Confirm password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
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
                            {loading ? 'Signing up...' : 'Sign up with Email'}
                        </button>
                    </div>
                </form>

                <div className="mt-6">
                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-slate-600"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-slate-800 text-gray-400">Or continue with</span>
                        </div>
                    </div>

                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={handleGoogleSignUp}
                            disabled={loading}
                            className="w-full flex justify-center items-center py-2 px-4 border border-[#6C5B7B] rounded-md shadow-sm text-sm font-medium text-white bg-[#355C7D] hover:bg-[#6C5B7B] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#6C5B7B] disabled:opacity-70 disabled:cursor-not-allowed transition-colors"
                        >
                            <FcGoogle className="text-2xl mr-2" />
                            Sign up with Google
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignUp;
