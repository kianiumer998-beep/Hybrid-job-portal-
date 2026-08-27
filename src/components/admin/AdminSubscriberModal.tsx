import React, { useState } from 'react';
import { Subscriber } from '../../types/job';
import { X, Save, UserPlus, Phone, Mail, DollarSign, Calendar, MessageSquare, CheckCircle2 } from 'lucide-react';

interface AdminSubscriberModalProps {
  subscriber: Subscriber | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (subscriber: Subscriber) => void;
}

export const AdminSubscriberModal: React.FC<AdminSubscriberModalProps> = ({
  subscriber,
  isOpen,
  onClose,
  onSave
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = useState<Subscriber>(() => {
    if (subscriber) return { ...subscriber };
    return {
      id: 'sub-' + Date.now(),
      name: '',
      email: '',
      phone: '+92 300 1234567',
      plan: 'Pro Alerts',
      paymentMethod: 'Easypaisa',
      amountPaid: 1500,
      currency: 'PKR',
      status: 'Active',
      subscribedAt: new Date().toISOString().split('T')[0],
      whatsappEnabled: true
    };
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden text-white animate-in fade-in zoom-in duration-200">
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                {subscriber ? 'Edit WhatsApp Subscriber' : 'Add New WhatsApp Alert Subscriber'}
              </h3>
              <p className="text-xs text-slate-400">Configure alert preferences and subscription payment records.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-300">Subscriber Full Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Muhammad Ali"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-bold focus:border-emerald-400 outline-none"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-bold text-slate-300">WhatsApp Phone Number *</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))}
                placeholder="+92 300 1234567"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-400 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">Email Address</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))}
                placeholder="subscriber@gmail.com"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-mono focus:border-emerald-400 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">Subscription Tier</label>
              <select
                value={formData.plan}
                onChange={(e) => setFormData(p => ({ ...p, plan: e.target.value as any }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-emerald-400 outline-none"
              >
                <option value="Basic">Basic Alerts</option>
                <option value="Pro Alerts">Pro Alerts (SMS + WhatsApp)</option>
                <option value="VIP Jobseeker">VIP Jobseeker (Priority)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData(p => ({ ...p, status: e.target.value as any }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-emerald-400 outline-none"
              >
                <option value="Active">Active Paid</option>
                <option value="Pending">Pending Verification</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">Amount Paid (PKR)</label>
              <input
                type="number"
                value={formData.amountPaid}
                onChange={(e) => setFormData(p => ({ ...p, amountPaid: Number(e.target.value) }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-emerald-400 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-300">Payment Gateway</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData(p => ({ ...p, paymentMethod: e.target.value as any }))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold focus:border-emerald-400 outline-none"
              >
                <option value="Easypaisa">Easypaisa</option>
                <option value="JazzCash">JazzCash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Card">Debit / Credit Card</option>
              </select>
            </div>
          </div>

          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.whatsappEnabled}
                onChange={(e) => setFormData(p => ({ ...p, whatsappEnabled: e.target.checked }))}
                className="w-4 h-4 rounded text-emerald-500"
              />
              <span className="font-bold text-slate-200 flex items-center space-x-1">
                <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
                <span>Enable Instant Automated WhatsApp Job Broadcasts</span>
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center space-x-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Save Subscriber</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
