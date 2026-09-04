import React, { useState } from 'react';
import { Globe, X, Copy, CheckCircle2, Search, ExternalLink, Code, Sparkles } from 'lucide-react';
import { Job } from '../../types/job';
import { generateJobSeoMetadata } from '../../utils/seoHelper';

interface JobSeoPreviewModalProps {
  job: Job | null;
  isOpen: boolean;
  onClose: () => void;
}

export const JobSeoPreviewModal: React.FC<JobSeoPreviewModalProps> = ({ job, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'google' | 'jsonld' | 'keywords'>('google');

  if (!isOpen || !job) return null;

  const seo = generateJobSeoMetadata(job);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 text-white animate-fadeIn">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-white flex items-center space-x-2">
                <span>Google Search SEO & Meta Preview</span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                  Google Top Rank Ready
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Automated meta tags, OpenGraph preview, and Schema.org JobPosting structured data for this live vacancy.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center space-x-2 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-bold">
          <button
            onClick={() => setActiveTab('google')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'google'
                ? 'bg-amber-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🔍 Google SERP Snippet
          </button>
          <button
            onClick={() => setActiveTab('keywords')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'keywords'
                ? 'bg-indigo-500 text-white'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            🏷️ Auto SEO Tags ({seo.keywords.length})
          </button>
          <button
            onClick={() => setActiveTab('jsonld')}
            className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeTab === 'jsonld'
                ? 'bg-emerald-500 text-slate-950'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            💻 Schema.org JSON-LD
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'google' && (
          <div className="space-y-4">
            {/* Google Search Result Mockup */}
            <div className="p-4 bg-white rounded-xl shadow-lg border border-slate-300 text-slate-800 space-y-1">
              <div className="flex items-center space-x-2 text-[11px] text-slate-500 truncate">
                <span className="font-semibold text-slate-700">pakjobsportal.com</span>
                <span>›</span>
                <span className="truncate">{seo.canonicalUrl.replace('https://pakjobsportal.com/', '')}</span>
              </div>
              <h4 className="text-blue-700 hover:underline text-base font-medium cursor-pointer leading-snug">
                {seo.metaTitle}
              </h4>
              <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                {seo.metaDescription}
              </p>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2">
              <div className="flex justify-between items-center text-slate-400">
                <span className="font-semibold">Canonical Index URL:</span>
                <button
                  onClick={() => handleCopy(seo.canonicalUrl)}
                  className="text-amber-400 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy URL</span>
                </button>
              </div>
              <p className="text-emerald-400 font-mono text-[11px] break-all">{seo.canonicalUrl}</p>
            </div>
          </div>
        )}

        {activeTab === 'keywords' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Automated High-Search-Volume Keywords:</span>
              <button
                onClick={() => handleCopy(seo.keywords.join(', '))}
                className="text-amber-400 hover:underline flex items-center space-x-1 cursor-pointer text-xs"
              >
                <Copy className="w-3 h-3" />
                <span>Copy All Tags</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800 max-h-48 overflow-y-auto">
              {seo.keywords.map((kw, i) => (
                <span
                  key={i}
                  className="text-xs bg-slate-900 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg"
                >
                  #{kw}
                </span>
              ))}
            </div>

            <p className="text-[11px] text-slate-400">
              💡 These keywords are automatically injected into the page metadata to target users searching Google for jobs in this city, department, and scale.
            </p>
          </div>
        )}

        {activeTab === 'jsonld' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Google Jobs Carousel Structured Schema:</span>
              <button
                onClick={() => handleCopy(JSON.stringify(seo.jsonLd, null, 2))}
                className="text-amber-400 hover:underline flex items-center space-x-1 cursor-pointer text-xs"
              >
                <Copy className="w-3 h-3" />
                <span>Copy JSON-LD</span>
              </button>
            </div>

            <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[11px] text-emerald-400 font-mono overflow-x-auto max-h-56">
              {JSON.stringify(seo.jsonLd, null, 2)}
            </pre>
          </div>
        )}

        {copied && (
          <div className="text-center text-xs text-emerald-400 font-bold flex items-center justify-center space-x-1">
            <CheckCircle2 className="w-4 h-4" />
            <span>Copied to clipboard!</span>
          </div>
        )}

        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl cursor-pointer"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};
