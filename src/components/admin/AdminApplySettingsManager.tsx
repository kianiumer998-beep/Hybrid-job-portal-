import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Save, 
  Plus, 
  Trash2, 
  CheckCircle, 
  RefreshCw, 
  HelpCircle, 
  ToggleLeft, 
  ToggleRight,
  Sparkles,
  ExternalLink,
  Lock
} from 'lucide-react';
import { api } from '../../services/api';

export interface CustomQuestion {
  id: string;
  question: string;
  type: 'text' | 'textarea' | 'select' | 'boolean';
  options?: string[];
  required: boolean;
}

export const AdminApplySettingsManager: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [settings, setSettings] = useState<any>({
    enableApplyButton: true,
    applyButtonText: 'Apply Now',
    applicationModalTitle: 'Submit Job Application',
    applicationInstructions: 'Complete the verified application details below. The hiring employer or department will review your credentials directly.',
    successMessage: 'Your application has been received successfully and forwarded to the hiring team!',
    loginRequiredMessage: 'Please sign in or register a free candidate account to track this application in your dashboard.',
    confirmationMessage: 'Are you sure you want to submit your verified application for this vacancy?',
    requireCv: true,
    requireCoverLetter: false,
    requirePhone: true,
    requireEmail: true,
    allowExternalApplication: true,
    externalApplicationWarning: 'Notice: You will be redirected to the official department/portal hiring page to submit your application directly.',
    expiredJobMessage: 'This employment opportunity has passed its application deadline and is no longer accepting new submissions.',
    customQuestions: []
  });

  const [newQuestionText, setNewQuestionText] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<'text' | 'textarea' | 'select' | 'boolean'>('text');
  const [newQuestionOptions, setNewQuestionOptions] = useState('');
  const [newQuestionRequired, setNewQuestionRequired] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await api.applySettings.get();
      if (data.success && data.settings) {
        setSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to load apply settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.applySettings.update(settings);
      if (res.success) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Failed to save apply settings:', err);
    } finally {
      setSaving(false);
    }
  };

  const addCustomQuestion = () => {
    if (!newQuestionText.trim()) return;

    const optionsArray = newQuestionType === 'select'
      ? newQuestionOptions.split(',').map(s => s.trim()).filter(Boolean)
      : undefined;

    const question: CustomQuestion = {
      id: `q-${Date.now()}`,
      question: newQuestionText.trim(),
      type: newQuestionType,
      options: optionsArray,
      required: newQuestionRequired
    };

    setSettings((prev: any) => ({
      ...prev,
      customQuestions: [...(prev.customQuestions || []), question]
    }));

    setNewQuestionText('');
    setNewQuestionOptions('');
    setNewQuestionRequired(false);
  };

  const removeQuestion = (id: string) => {
    setSettings((prev: any) => ({
      ...prev,
      customQuestions: (prev.customQuestions || []).filter((q: any) => q.id !== id)
    }));
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 flex items-center justify-center space-x-3">
        <RefreshCw className="w-5 h-5 animate-spin text-amber-500" />
        <span>Loading apply settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div>
          <div className="flex items-center space-x-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center border border-amber-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white">Application Flow & Form Customizer</h2>
              <p className="text-xs text-slate-400">Configure apply button text, requirements, confirmation notices, external redirects, and custom candidate questions.</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {saveSuccess && (
            <span className="flex items-center space-x-1.5 text-xs text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 rounded-xl">
              <CheckCircle className="w-4 h-4" />
              <span>Saved!</span>
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Settings</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Basic Texts & Messages */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Button & Modal Labels</span>
          </h3>

          <div className="space-y-4 text-sm">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Apply Button Text (Shown on Job Cards & Detail Modal)
              </label>
              <input
                type="text"
                value={settings.applyButtonText || ''}
                onChange={(e) => setSettings({ ...settings, applyButtonText: e.target.value })}
                placeholder="e.g. Apply Now, Submit Application, Quick Apply"
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Application Modal Title
              </label>
              <input
                type="text"
                value={settings.applicationModalTitle || ''}
                onChange={(e) => setSettings({ ...settings, applicationModalTitle: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Candidate Instructions
              </label>
              <textarea
                rows={2}
                value={settings.applicationInstructions || ''}
                onChange={(e) => setSettings({ ...settings, applicationInstructions: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Success Message on Submission
              </label>
              <input
                type="text"
                value={settings.successMessage || ''}
                onChange={(e) => setSettings({ ...settings, successMessage: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                External Application Redirect Notice
              </label>
              <textarea
                rows={2}
                value={settings.externalApplicationWarning || ''}
                onChange={(e) => setSettings({ ...settings, externalApplicationWarning: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Expired Job Notice
              </label>
              <input
                type="text"
                value={settings.expiredJobMessage || ''}
                onChange={(e) => setSettings({ ...settings, expiredJobMessage: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Requirements & Custom Questions */}
        <div className="space-y-6">
          {/* Required Fields */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3">
              Application Mandatory Fields
            </h3>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label className="flex items-center space-x-2.5 p-3 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireCv}
                  onChange={(e) => setSettings({ ...settings, requireCv: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 border-slate-700"
                />
                <span className="text-slate-300 text-xs font-semibold">Require CV / Resume</span>
              </label>

              <label className="flex items-center space-x-2.5 p-3 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requirePhone}
                  onChange={(e) => setSettings({ ...settings, requirePhone: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 border-slate-700"
                />
                <span className="text-slate-300 text-xs font-semibold">Require Phone Number</span>
              </label>

              <label className="flex items-center space-x-2.5 p-3 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireEmail}
                  onChange={(e) => setSettings({ ...settings, requireEmail: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 border-slate-700"
                />
                <span className="text-slate-300 text-xs font-semibold">Require Verified Email</span>
              </label>

              <label className="flex items-center space-x-2.5 p-3 bg-slate-950/60 rounded-xl border border-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.requireCoverLetter}
                  onChange={(e) => setSettings({ ...settings, requireCoverLetter: e.target.checked })}
                  className="w-4 h-4 rounded text-amber-500 border-slate-700"
                />
                <span className="text-slate-300 text-xs font-semibold">Require Cover Letter</span>
              </label>
            </div>
          </div>

          {/* Dynamic Application Questions */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-white text-base border-b border-slate-800 pb-3 flex items-center justify-between">
              <span>Custom Screening Questions ({settings.customQuestions?.length || 0})</span>
            </h3>

            {/* List of existing questions */}
            <div className="space-y-2.5">
              {(settings.customQuestions || []).map((q: CustomQuestion, idx: number) => (
                <div key={q.id} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="font-semibold text-white block">
                      {idx + 1}. {q.question}
                      {q.required && <span className="text-rose-400 ml-1 font-bold">*</span>}
                    </span>
                    <span className="text-slate-500 text-[10px]">Type: {q.type} {q.options ? `(${q.options.join(', ')})` : ''}</span>
                  </div>
                  <button
                    onClick={() => removeQuestion(q.id)}
                    className="p-1.5 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Add new question form */}
            <div className="pt-3 border-t border-slate-800 space-y-3">
              <span className="text-xs font-semibold text-slate-300 block">Add Screening Question</span>
              <input
                type="text"
                placeholder="Question text (e.g. Earliest joining date, notice period)"
                value={newQuestionText}
                onChange={(e) => setNewQuestionText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white text-xs"
              />

              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newQuestionType}
                  onChange={(e) => setNewQuestionType(e.target.value as any)}
                  className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                >
                  <option value="text">Short Text</option>
                  <option value="textarea">Paragraph</option>
                  <option value="select">Dropdown Options</option>
                  <option value="boolean">Yes / No</option>
                </select>

                <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newQuestionRequired}
                    onChange={(e) => setNewQuestionRequired(e.target.checked)}
                    className="w-3.5 h-3.5 rounded text-amber-500 border-slate-700"
                  />
                  <span>Mandatory</span>
                </label>
              </div>

              {newQuestionType === 'select' && (
                <input
                  type="text"
                  placeholder="Options separated by commas (e.g. Immediate, 15 Days, 30 Days)"
                  value={newQuestionOptions}
                  onChange={(e) => setNewQuestionOptions(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-white text-xs"
                />
              )}

              <button
                onClick={addCustomQuestion}
                disabled={!newQuestionText.trim()}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs active:scale-95 transition-all"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                <span>Add Question</span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
