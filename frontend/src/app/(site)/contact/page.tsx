/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Mail, Phone, MapPin, Send, MessageSquare } from 'lucide-react';
import api from '@/src/libs/api';

const DEFAULT_PUBLIC_EMAIL = 'ITITIU21345@hcmiu.edu.vn';

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSending, setIsSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [supportPublicEmail, setSupportPublicEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/contact/mail-display');
        const body = res.data as { data?: { support_public_email?: string | null } };
        const em = body.data?.support_public_email?.trim();
        if (!cancelled && em) setSupportPublicEmail(em);
      } catch {
        /* keep default */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayEmail = (supportPublicEmail && supportPublicEmail.length > 0 ? supportPublicEmail : DEFAULT_PUBLIC_EMAIL).trim();

  const contactInfo = useMemo(
    () => [
      {
        icon: <Mail className="text-indigo-500" size={24} />,
        label: 'Email Address',
        value: displayEmail,
        href: `mailto:${encodeURIComponent(displayEmail)}`,
      },
      {
        icon: <Phone className="text-indigo-500" size={24} />,
        label: 'Phone Number',
        value: '+84 (0) 123 456 789',
        href: 'tel:+84123456789',
      },
      {
        icon: <MapPin className="text-indigo-500" size={24} />,
        label: 'Office Location',
        value: 'Quarter 6, Linh Trung Ward, Thu Duc City, HCMC',
        href: 'https://maps.google.com',
      },
    ],
    [displayEmail],
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSending(true);
    try {
      await api.post('/contact', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        subject: formData.subject.trim(),
        message: formData.message.trim(),
      });
      setFormData({ name: '', email: '', subject: '', message: '' });
      alert('Thank you! We received your message and will get back to you soon.');
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
      const raw =
        ax.response?.data?.message ||
        (ax.response?.data?.errors && Object.values(ax.response.data.errors).flat().join(' ')) ||
        (err instanceof Error ? err.message : '');
      const looksLikeServerLeak =
        typeof raw === 'string' &&
        (raw.includes('SQLSTATE') || raw.includes("doesn't exist") || raw.includes('Connection:'));
      const msg = looksLikeServerLeak
        ? 'We could not save your message right now. Please try again in a few minutes or email us directly.'
        : raw || 'Could not send your message. Please try again later.';
      setFormError(msg);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0e14] text-gray-200 py-20 px-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Get in Touch</h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Have questions about our market analysis or need technical support? 
            We&apos;re here to help you navigate the financial world.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Contact Details (Flat Data) */}
          <div className="space-y-8">
            {contactInfo.map((info, index) => (
              <a
                key={index}
                href={info.href}
                className="flex items-start gap-5 p-6 rounded-2xl bg-[#161a21] border border-gray-800/50 hover:border-indigo-500/50 transition-all group"
              >
                <div className="p-3 rounded-xl bg-indigo-500/10 group-hover:bg-indigo-500/20 transition-colors">
                  {info.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-400 mb-1">{info.label}</p>
                  <p className="text-lg font-semibold text-white">{info.value}</p>
                </div>
              </a>
            ))}

            {/* Support Box */}
            <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl shadow-indigo-500/10">
              <MessageSquare size={40} className="mb-4 opacity-80" />
              <h3 className="text-xl font-bold mb-2">Live Support</h3>
              <p className="text-indigo-100 text-sm leading-relaxed">
                Our team typically responds within 24 hours during business days.
              </p>
            </div>
          </div>

          {/* Contact Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="bg-[#161a21] p-8 md:p-10 rounded-3xl border border-gray-800/50 shadow-2xl">
              {formError ? (
                <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {formError}
                </div>
              ) : null}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Full Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    className="w-full bg-[#0b0e14] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                    placeholder="example@gmail.com"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-400 mb-2">Subject</label>
                <input
                  type="text"
                  required
                  value={formData.subject}
                  onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  className="w-full bg-[#0b0e14] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  placeholder="How can we help?"
                />
              </div>

              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-400 mb-2">Message</label>
                <textarea
                  rows={5}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  className="w-full bg-[#0b0e14] border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all resize-none"
                  placeholder="Type your message here..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isSending}
                className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold py-4 px-10 rounded-xl transition-all shadow-lg shadow-indigo-500/20"
              >
                {isSending ? 'Sending...' : 'Send Message'}
                {!isSending && <Send size={18} />}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}