import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Lock, Clock } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../backend/firebase/firebase';
import { PrivacyConfig, DEFAULT_PRIVACY_CONFIG } from '../../shared/utilities/privacyUtils';

export default function PrivacyPolicy() {
  const [config, setConfig] = useState<PrivacyConfig>(DEFAULT_PRIVACY_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'privacy'), (snap) => {
      if (snap.exists()) {
        const data = snap.data() as PrivacyConfig;
        setConfig({
          ...DEFAULT_PRIVACY_CONFIG,
          ...data,
          sections: data.sections && data.sections.length > 0 ? data.sections : DEFAULT_PRIVACY_CONFIG.sections
        });
      } else {
        setConfig(DEFAULT_PRIVACY_CONFIG);
      }
      setLoading(false);
    }, (err) => {
      console.error('Error loading Privacy Policy:', err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50/50 py-8 md:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Header Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-xl shadow-gray-100/50 mb-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-6 mb-6">
            <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider">
              <Lock className="w-4 h-4 text-emerald-600" />
              Privacy & Data Protection Policy
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-50 px-3.5 py-1.5 rounded-full border border-gray-100">
              <Clock className="w-3.5 h-3.5 text-gray-400" />
              <span>Last Updated: {config.lastUpdated || 'September 28, 2026'}</span>
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">
            {config.title || 'Privacy Policy'}
          </h1>

          <div className="prose prose-emerald max-w-none text-gray-600 text-sm sm:text-base leading-relaxed space-y-4 font-medium">
            {(config.introParagraphs || []).map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
          </div>
        </motion.div>

        {/* Content Body */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-xl shadow-gray-100/50 space-y-10"
        >
          {(config.sections || []).map((section, idx) => (
            <React.Fragment key={section.id || idx}>
              {idx > 0 && <hr className="border-gray-100" />}
              <section className="space-y-4">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                  <span className="text-emerald-600 font-extrabold">{section.number}.</span> {section.title}
                </h2>
                
                {(section.paragraphs || []).map((p, pIdx) => (
                  <p key={pIdx} className="text-gray-600 text-sm sm:text-base leading-relaxed font-medium">
                    {p}
                  </p>
                ))}

                {section.subCategories && section.subCategories.length > 0 && (
                  <div className="space-y-4 pl-2 mt-3">
                    {section.subCategories.map((sub, sIdx) => (
                      <div key={sIdx} className="bg-gray-50/70 p-4 rounded-2xl border border-gray-100">
                        <h3 className="font-bold text-gray-900 text-sm mb-2">{sub.title}</h3>
                        <ul className="list-disc pl-5 space-y-1 text-gray-600 text-xs sm:text-sm font-medium">
                          {sub.bulletPoints.map((bp, bpIdx) => (
                            <li key={bpIdx}>{bp}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {section.bulletPoints && section.bulletPoints.length > 0 && (
                  <ul className="list-disc pl-6 space-y-1.5 text-gray-600 text-sm sm:text-base font-medium">
                    {section.bulletPoints.map((b, bIdx) => (
                      <li key={bIdx}>{b}</li>
                    ))}
                  </ul>
                )}
              </section>
            </React.Fragment>
          ))}

          {/* Footer Signature */}
          <div className="pt-6 border-t border-gray-200/80 bg-gray-50/80 p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="font-black text-gray-900 text-lg">ViBa Mart</p>
              <p className="text-xs font-bold text-gray-500">{config.title || 'Privacy Policy'}</p>
            </div>
            <div className="text-xs font-semibold text-gray-500 bg-white px-3.5 py-2 rounded-xl border border-gray-200">
              Last Updated: {config.lastUpdated || 'September 28, 2026'}
            </div>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
