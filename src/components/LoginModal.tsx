import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { UserAccount, UserRole } from '../types';
import { getAllUsers, saveUser, setCurrentUserSession } from '../utils/database';
import { playSound } from '../utils/audioUtils';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserAccount | null;
  onUserChange: (user: UserAccount | null) => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUserChange,
}) => {
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('Lead Researcher');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setError('Please enter your email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const allUsers = await getAllUsers();
      const existing = allUsers.find((u) => u.email.toLowerCase() === cleanEmail);

      if (existing) {
        playSound('click');
        setCurrentUserSession(existing);
        onUserChange(existing);
        setSuccess(`Signed in as ${existing.name}`);
        setTimeout(() => {
          setSuccess('');
          onClose();
        }, 350);
      } else {
        // Automatically create account if first time
        const initial = cleanEmail.charAt(0).toUpperCase();
        const autoName = cleanEmail.split('@')[0];
        const formattedName = autoName.charAt(0).toUpperCase() + autoName.slice(1);
        const newUser: UserAccount = {
          id: `usr-${Date.now()}`,
          email: cleanEmail,
          name: formattedName,
          role: 'Lead Researcher',
          institution: 'Department of Sociology',
          avatar: initial,
          createdAt: new Date().toISOString().split('T')[0],
        };
        await saveUser(newUser);
        setCurrentUserSession(newUser);
        onUserChange(newUser);
        playSound('click');
        setSuccess(`Account registered as ${newUser.name}`);
        setTimeout(() => {
          setSuccess('');
          onClose();
        }, 350);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanName || !cleanEmail || !cleanPassword) {
      setError('Please fill in all fields.');
      return;
    }

    setIsLoading(true);
    try {
      const allUsers = await getAllUsers();
      if (allUsers.some((u) => u.email.toLowerCase() === cleanEmail)) {
        setError('An account with this email already exists. Please sign in.');
        setIsLoading(false);
        return;
      }

      const initials = cleanName
        .split(' ')
        .map((p) => p[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);

      const newUser: UserAccount = {
        id: `usr-${Date.now()}`,
        email: cleanEmail,
        name: cleanName,
        role,
        institution: 'Department of Sociology',
        avatar: initials || 'U',
        createdAt: new Date().toISOString().split('T')[0],
      };

      await saveUser(newUser);
      setCurrentUserSession(newUser);
      onUserChange(newUser);
      playSound('click');
      setSuccess('Account created successfully');
      setTimeout(() => {
        setSuccess('');
        onClose();
      }, 350);
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    playSound('click');
    setCurrentUserSession(null);
    onUserChange(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-2xl p-6 space-y-5 animate-scaleIn">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 tracking-tight">
              {currentUser
                ? 'Account'
                : isRegisterMode
                ? 'Create Account'
                : 'Sign In'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* If Already Logged In: Show Clean Profile Details & Sign Out */}
        {currentUser ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                  {currentUser.avatar}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">{currentUser.name}</h4>
                  <p className="text-xs text-slate-500">{currentUser.email}</p>
                </div>
              </div>
              <p className="text-xs text-slate-600 font-medium pt-2">
                Role: <span className="text-slate-900">{currentUser.role}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="w-full py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        ) : (
          /* Sign In / Register Form */
          <div className="space-y-4">
            {error && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg font-medium">
                {error}
              </div>
            )}

            {success && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-lg font-medium flex items-center gap-1.5">
                <Check size={14} className="text-emerald-600 shrink-0" />
                <span>{success}</span>
              </div>
            )}

            <form
              onSubmit={isRegisterMode ? handleRegister : handleSignIn}
              className="space-y-3"
            >
              {isRegisterMode && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    required
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                  />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@institution.edu"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white"
                />
              </div>

              {isRegisterMode && (
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Role
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-900 focus:bg-white cursor-pointer"
                  >
                    
                    
                    
                    
                  </select>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer mt-1"
              >
                {isLoading ? 'Processing...' : isRegisterMode ? 'Create Account' : 'Sign In'}
              </button>
            </form>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setIsRegisterMode((prev) => !prev);
                  setError('');
                  setSuccess('');
                }}
                className="text-xs text-slate-500 hover:text-slate-900 font-medium transition-colors cursor-pointer"
              >
                {isRegisterMode
                  ? 'Already have an account? Sign in'
                  : "Don't have an account? Register"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
