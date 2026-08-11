import React, { useState } from 'react';
import { UserAccount, UserRole, CustomFormField } from '../types/job';
import { User, Building2, Mail, Lock, Phone, X, CheckCircle, ShieldCheck, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: UserAccount) => void;
  customFormFields: CustomFormField[];
  existingUsers: UserAccount[];
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  customFormFields,
  existingUsers
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

  if (!isOpen) return null;

  const handleDynamicChange = (fieldId: string, val: string) => {
    setDynamicValues(prev => ({ ...prev, [fieldId]: val }));
  };

  const DEMO_QWER_USER: UserAccount = {
    id: 'user-demo-qwer-unified',
    name: 'Qwer Member',
    email: 'qwer@jobportal.com',
    username: 'qwer',
    password: '123456',
    role: 'Unified Member',
    companyName: 'Qwer Solutions',
    phone: '+92 300 1234567',
    plan: 'Premium',
    activationDate: '2026-07-25 09:00',
    expiryDate: '2026-08-24 09:00',
    renewalCount: 2,
    autoRenew: true,
    transactions: [
      {
        id: 'tx-demo-1',
        dateTime: '2026-07-25 09:00',
        amount: 300,
        currency: 'PKR',
        type: 'Subscription',
        status: 'Success',
        paymentMethod: 'JazzCash'
      },
      {
        id: 'tx-demo-2',
        dateTime: '2026-07-25 09:30',
        amount: 1000,
        currency: 'PKR',
        type: 'Job Posting Fee',
        status: 'Success',
        paymentMethod: 'Easypaisa',
        jobTitleRef: 'Remote Senior React Developer'
      }
    ],
    createdAt: new Date().toISOString()
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === 'login') {
      const query = email.trim().toLowerCase();

      // Check for exact demo account first
      if (query === 'qwer' || query === 'qwer@jobportal.com' || query === 'qwer@jobseeker.com' || query === 'qwer@employer.com') {
        onLoginSuccess(DEMO_QWER_USER);
        alert('Logged in as Unified Demo Account (qwer)!');
        onClose();
        return;
      }

      const found = (existingUsers || []).find(
        u => u && ((u.email && u.email.toLowerCase() === query) || (u.username && u.username.toLowerCase() === query))
      );

      if (found) {
        onLoginSuccess(found);
        onClose();
      } else {
        // Create unified demo account automatically
        const actDate = '2026-07-25 09:00';
        const expDate = '2026-08-24 09:00';
        const newAccount: UserAccount = {
          id: 'user-' + Date.now(),
          name: email.split('@')[0] || email || 'Member',
          email: email.includes('@') ? email : `${email}@jobportal.com`,
          username: email,
          role: 'Unified Member',
          phone: phone || '+92 300 0000000',
          companyName: companyName || undefined,
          plan: 'Premium',
          activationDate: actDate,
          expiryDate: expDate,
          renewalCount: 1,
          autoRenew: true,
          transactions: [
            {
              id: 'tx-' + Date.now(),
              dateTime: actDate,
              amount: 300,
              currency: 'PKR',
              type: 'Subscription',
              status: 'Success',
              paymentMethod: 'JazzCash'
            }
          ],
          createdAt: new Date().toISOString()
        };
        onLoginSuccess(newAccount);
        onClose();
      }
    } else {
      if (!name || !email) {
        alert('Please fill out all required fields.');
        return;
      }

      const actDate = '2026-07-25 09:00';
      const expDate = '2026-08-24 09:00';
      const newAccount: UserAccount = {
        id: 'user-' + Date.now(),
        name,
        email,
        username: email.split('@')[0],
        role: 'Unified Member',
        phone: phone || '+92 300 0000000',
        companyName: companyName || undefined,
        plan: 'Premium',
        activationDate: actDate,
        expiryDate: expDate,
        renewalCount: 1,
        autoRenew: true,
        transactions: [
          {
            id: 'tx-' + Date.now(),
            dateTime: actDate,
            amount: 300,
            currency: 'PKR',
            type: 'Subscription',
            status: 'Success',
            paymentMethod: 'Easypaisa'
          }
        ],
        customFieldsData: dynamicValues,
        createdAt: new Date().toISOString()
      };

      onLoginSuccess(newAccount);
      alert(`Unified Account created successfully! Welcome, ${name}. You can build CVs, browse jobs, and post new jobs from your dashboard.`);
      onClose();
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

        {/* Quick Demo Credentials Banner */}
        <div className="mb-5 p-3.5 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-xs space-y-2">
          <div className="flex items-center justify-between text-emerald-400 font-bold">
            <span className="flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
              <span>Demo Account Credentials</span>
            </span>
            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] px-2 py-0.5 rounded font-mono">
              qwer / 123456
            </span>
          </div>
          <p className="text-[11px] text-slate-300">
            Username: <strong className="text-white font-mono">qwer</strong> | Password: <strong className="text-white font-mono">123456</strong>
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                onLoginSuccess(DEMO_QWER_USER);
                alert('Logged in as Unified Demo Account (qwer)!');
                onClose();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-xs text-center transition-all cursor-pointer"
            >
              ⚡ 1-Click Unified Demo Login (qwer)
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6 text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-emerald-500 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Register
          </button>
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`flex-1 py-2.5 rounded-xl transition-all ${
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

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Muhammad Ali"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {mode === 'login' ? 'Username or Email Address' : 'Email Address'}
            </label>
            <input
              type={mode === 'login' ? 'text' : 'email'}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={mode === 'login' ? 'Enter qwer or email' : 'ali@example.com'}
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp Phone Number</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+92 300 1234567"
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
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
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all mt-4"
          >
            {mode === 'login' ? 'Login to Portal' : `Complete Registration as ${role}`}
          </button>
        </form>

      </div>
    </div>
  );
};
