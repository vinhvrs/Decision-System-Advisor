'use client';

import React, { useEffect, useState } from 'react';
import { Mail, Send } from 'lucide-react';
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

  return <div className="nt-info-page nt-contact-page">
    <header className="nt-info-intro">
      <span className="nt-label nt-info">DSA / Support</span>
      <h1>Contact</h1>
      <p>Questions about the research workspace or a data source? Send a message or email us directly.</p>
    </header>
    <div className="nt-contact-grid">
      <aside className="nt-info-panel">
        <Mail size={20} aria-hidden="true" />
        <h2>Email</h2>
        <a href={`mailto:${encodeURIComponent(displayEmail)}`}>{displayEmail}</a>
        <p>Include the route, symbol, and observation time when reporting a data issue.</p>
      </aside>
      <form className="nt-info-panel nt-contact-form" onSubmit={handleSubmit}>
        <div className="nt-panel-title"><strong>Send a message</strong><span>All fields required</span></div>
        {formError && <p className="nt-contact-error" role="alert">{formError}</p>}
        <div className="nt-contact-fields">
          <label>Full name<input required autoComplete="name" value={formData.name} onChange={e => setFormData({...formData, name:e.target.value})} /></label>
          <label>Email address<input required type="email" autoComplete="email" value={formData.email} onChange={e => setFormData({...formData, email:e.target.value})} /></label>
        </div>
        <label>Subject<input required value={formData.subject} onChange={e => setFormData({...formData, subject:e.target.value})} /></label>
        <label>Message<textarea rows={6} required value={formData.message} onChange={e => setFormData({...formData, message:e.target.value})} /></label>
        <button type="submit" disabled={isSending}>{isSending ? "Sending…" : "Send message"} <Send size={16} aria-hidden="true" /></button>
      </form>
    </div>
  </div>;
}
