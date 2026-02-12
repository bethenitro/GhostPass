import React, { useState } from 'react';
import { Building2, Mail, Lock, User, ArrowLeft, CheckCircle } from 'lucide-react';
import { authApi } from '@/lib/api';

interface VenueAdminSignupProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const VenueAdminSignup: React.FC<VenueAdminSignupProps> = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    try {
      setLoading(true);
      setError(null);

      await authApi.signUpVenueAdmin({
        email: formData.email,
        password: formData.password,
        venue_id: 'default_venue', // Default venue ID
        venue_name: 'My Venue', // Default venue name
        contact_name: formData.email.split('@')[0] // Use email prefix as contact name
      });

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 2000);
    } catch (err: any) {
      console.error('Venue admin signup error:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-sm border border-emerald-500/20 rounded-lg p-8 text-center">
          <CheckCircle className="mx-auto text-emerald-400 mb-4" size={64} />
          <h2 className="text-2xl font-bold text-emerald-400 mb-2">Account Created!</h2>
          <p className="text-slate-300 mb-4">
            Your venue admin account has been successfully created.
          </p>
          <p className="text-slate-400 text-sm">
            Redirecting to command center...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-purple-500/20 border border-purple-500 rounded-full mb-4">
            <Building2 className="text-purple-400" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-purple-400 mb-2">Venue Admin Registration</h1>
          <p className="text-slate-400">Create your venue administrator account</p>
        </div>

        {/* Form */}
        <div className="bg-slate-900/50 backdrop-blur-sm border border-purple-500/20 rounded-lg p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Account Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-400 flex items-center space-x-2">
                <User size={20} />
                <span>Account Information</span>
              </h3>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="admin@venue.com"
                    required
                    className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-base"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-base"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Confirm Password <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                      type="password"
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm password"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-white focus:border-purple-500 focus:outline-none text-base"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <p className="text-purple-400 text-sm">
                  After registration, you can configure your venue details in the command center.
                </p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-6">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-6 py-3 bg-slate-700 border border-slate-600 text-slate-300 rounded-lg font-medium hover:bg-slate-600 transition-colors touch-manipulation min-h-[44px] active:scale-95"
              >
                <ArrowLeft className="inline mr-2" size={18} />
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-3 bg-purple-500/20 border border-purple-500 text-purple-400 rounded-lg font-medium hover:bg-purple-500/30 transition-colors touch-manipulation min-h-[44px] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center mt-6">
          <p className="text-slate-400 text-sm">
            Already have an account?{' '}
            <button
              onClick={onCancel}
              className="text-purple-400 hover:text-purple-300 font-medium"
            >
              Sign in instead
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VenueAdminSignup;
