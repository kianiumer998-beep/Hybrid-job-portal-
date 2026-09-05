import React, { useState } from 'react';
import { X, ShieldCheck, KeyRound, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess
}) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);

    try {
      // Call backend admin authentication endpoint
      const result = await api.auth.adminLogin(password);
      if (result.success) {
        setError(false);
        setPassword('');
        onLoginSuccess();
        onClose();
      } else {
        // Fallback check for exact demo passkey
        if (password === 'admin123') {
          localStorage.setItem('hybrid_admin_dev_passkey', 'admin123');
          setError(false);
          setPassword('');
          onLoginSuccess();
          onClose();
        } else {
          setError(true);
        }
      }
    } catch {
      if (password === 'admin123') {
        localStorage.setItem('hybrid_admin_dev_passkey', 'admin123');
        setError(false);
        setPassword('');
        onLoginSuccess();
        onClose();
      } else {
        setError(true);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="relative w-full max-w-sm bg-slate-900 border border-amber-500/40 rounded-3xl shadow-2xl p-6 text-white animate-in fade-in zoom-in duration-200">
        
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center space-y-3 mb-6">
          <div className="w-14 h-14 bg-amber-500/10 text-amber-400 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/30">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-black">Secret Portal Admin Panel</h3>
          <p className="text-xs text-slate-400">
            Enter administrative passkey to access system management.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">
              Admin Password
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="password"
                autoFocus
                required
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(false); }}
                placeholder="Enter password..."
                className="w-full pl-9 pr-3 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </div>
            {error && (
              <p className="text-xs text-rose-400 mt-1.5 flex items-center space-x-1 font-semibold">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>Incorrect password. Hint: default is 'admin123'</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all flex items-center justify-center space-x-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>Access Admin Dashboard</span>
          </button>
        </form>

      </div>
    </div>
  );
};
