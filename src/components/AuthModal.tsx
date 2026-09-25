import React, { useState } from 'react';
import { UserAccount, UserRole, CustomFormField } from '../types/job';
import { User, Mail, Lock, Phone, X, CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { api } from '../services/api';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserAccount) => void;
  customFormFields: CustomFormField[];
  existingUsers?: UserAccount[];
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  customFormFields
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [role, setRole] = useState<UserRole>('Job Seeker');

  // Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [dynamicValues, setDynamicValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDynamicChange = (fieldId: string, val: string) => {
    setDynamicValues(prev => ({ ...prev, [fieldId]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMessage('Please provide both email address and password.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await api.auth.login({ email: cleanEmail, password: cleanPassword });
        if (res && res.success && res.user && res.token) {
          try {
            localStorage.setItem('hybrid_auth_token', res.token);
            localStorage.setItem('hybrid_current_user', JSON.stringify(res.user));
          } catch {}
          onLoginSuccess(res.user);
          onClose();
        } else {
          setErrorMessage(res?.message || 'Invalid email address or password.');
        }
      } else {
        if (!name.trim()) {
          setErrorMessage('Full name is required for registration.');
          setLoading(false);
          return;
        }

        if (cleanPassword.length < 6) {
          setErrorMessage('Password must be at least 6 characters.');
          setLoading(false);
          return;
        }

        const res = await api.auth.register({
          name: name.trim(),
          email: cleanEmail,
          password: cleanPassword,
          role,
          phone: phone.trim(),
          companyName: companyName.trim()
        });

        if (res && res.success && res.user && res.token) {
          try {
            localStorage.setItem('hybrid_auth_token', res.token);
            localStorage.setItem('hybrid_current_user', JSON.stringify(res.user));
          } catch {}
          onLoginSuccess(res.user);
          onClose();
        } else {
          setErrorMessage(res?.message || 'Failed to register account. Please check details.');
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Network error occurred while connecting to authentication service.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-md rounded-3xl p-6 shadow-2xl relative my-8 text-white">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-emerald-500/20">
            <User className="w-6 h-6 text-slate-950" />
          </div>
          <h2 className="text-2xl font-black">
            {mode === 'login' ? 'Welcome Back' : 'Create an Account'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Access remote job alerts, job posting tools, and two-way messaging.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => { setMode('register'); setErrorMessage(null); }}
            className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => { setMode('login'); setErrorMessage(null); }}
            className={`flex-1 py-2.5 rounded-xl transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Login
          </button>
        </div>

        {/* Unified Account Info Banner */}
        {mode === 'register' && (
          <div className="mb-4 p-3 bg-slate-950 border border-slate-800 rounded-2xl text-xs text-slate-300 flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>Single Registration: Your account gives you full access to build CVs, browse jobs, and post jobs.</span>
          </div>
        )}

        {errorMessage && (
          <div className="mb-4 p-3 bg-rose-950/50 border border-rose-800/80 rounded-2xl text-xs text-rose-300 flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => { setName(e.target.value); setErrorMessage(null); }}
                placeholder="Muhammad Ali"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => { setEmail(e.target.value); setErrorMessage(null); }}
                placeholder="ali@example.com"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrorMessage(null); }}
                placeholder="••••••••"
                className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setErrorMessage(null); }}
                    placeholder="+92 300 1234567"
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {role === 'Employer/Job Poster' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Company / Organization Name</label>
                  <input
                    type="text"
                    required
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Techlogix Pakistan"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {/* DYNAMIC FORM FIELDS CREATED BY ADMIN */}
              {customFormFields.filter(f => f.active).length > 0 && (
                <div className="pt-2 border-t border-slate-800 space-y-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-400">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Additional Required Information</span>
                  </div>

                  {customFormFields.filter(f => f.active).map((field) => (
                    <div key={field.id}>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {field.label} {field.required && <span className="text-rose-400">*</span>}
                      </label>
                      {field.type === 'select' ? (
                        <select
                          required={field.required}
                          value={dynamicValues[field.id] || ''}
                          onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          <option value="">Select an option</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt}>{opt}</option>
                          ))}
                        </select>
                      ) : field.type === 'textarea' ? (
                        <textarea
                          rows={2}
                          required={field.required}
                          value={dynamicValues[field.id] || ''}
                          onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      ) : (
                        <input
                          type={field.type === 'number' ? 'number' : 'text'}
                          required={field.required}
                          value={dynamicValues[field.id] || ''}
                          onChange={(e) => handleDynamicChange(field.id, e.target.value)}
                          placeholder={`Enter ${field.label}`}
                          className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4 flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>{mode === 'login' ? 'Login to Portal' : `Complete Registration as ${role}`}</span>
          </button>
        </form>

      </div>
    </div>
  );
};
