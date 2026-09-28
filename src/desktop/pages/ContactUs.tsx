import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Phone, MapPin, Send, MessageSquare, Clock, HelpCircle, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ContactUs() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      toast.error('Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      toast.success('Your message has been received! Our support team will get back to you shortly.');
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gray-50/50 py-8 md:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-xl shadow-gray-100/50"
        >
          <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider mb-4">
            <MessageSquare className="w-4 h-4 text-emerald-600" />
            24/7 Dedicated Customer Support
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight mb-4">
            Contact Us & Order Help
          </h1>
          <p className="text-gray-600 text-sm sm:text-base leading-relaxed max-w-2xl font-medium">
            Have a question about an order, payment, delivery, or product? Get in touch with our team. We're here to help you 24/7!
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Contact Details Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-4"
          >
            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 flex items-start gap-4">
              <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shrink-0">
                <MapPin className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider mb-1">Corporate Address</h3>
                <p className="text-xs font-bold text-gray-600 leading-relaxed">
                  123 ViBa Tower, Jakkur, Bangalore, Karnataka, 560064, India
                </p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 flex items-start gap-4">
              <div className="p-3 bg-blue-50 rounded-2xl text-blue-600 shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider mb-1">Email Support</h3>
                <p className="text-xs font-bold text-gray-600">viba.mart@hotmail.com</p>
                <p className="text-[10px] text-gray-400 font-medium mt-1">24-hour response guarantee</p>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/50 flex items-start gap-4">
              <div className="p-3 bg-purple-50 rounded-2xl text-purple-600 shrink-0">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-black text-gray-900 text-sm uppercase tracking-wider mb-1">Phone & WhatsApp</h3>
                <p className="text-xs font-bold text-gray-600">+91 9905 52 3505</p>
                <p className="text-[10px] text-gray-400 font-medium mt-1">Mon - Sun: 8:00 AM - 10:00 PM</p>
              </div>
            </div>

            <div className="bg-emerald-900 text-white p-6 rounded-3xl shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-300">
                <Clock className="w-4 h-4" /> Live Support Available
              </div>
              <p className="text-xs leading-relaxed text-slate-200 font-medium">
                Need immediate order cancellation or tracking help? Open your order details page or send a message directly.
              </p>
            </div>
          </motion.div>

          {/* Contact Form Column */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-10 border border-gray-100 shadow-xl shadow-gray-100/50"
          >
            {submitted ? (
              <div className="py-12 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-black text-gray-900">Message Received!</h3>
                <p className="text-sm font-medium text-gray-500 max-w-md mx-auto">
                  Thank you for reaching out to ViBa Mart Customer Support. We have received your query and will reply via email shortly.
                </p>
                <button
                  onClick={() => { setSubmitted(false); setName(''); setEmail(''); setSubject(''); setMessage(''); }}
                  className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <h2 className="text-xl font-black text-gray-900">Send Us a Message</h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">
                      Your Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="First Last"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="vibamart@example.com"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">
                    Subject / Order ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Order VBM-84920 Delivery Query"
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase tracking-wider text-gray-500 block mb-2">
                    Message *
                  </label>
                  <textarea
                    rows={5}
                    required
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe your issue or query in detail..."
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:border-emerald-600 focus:bg-white transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {submitting ? 'Submitting...' : 'Submit Support Request'}
                </button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
