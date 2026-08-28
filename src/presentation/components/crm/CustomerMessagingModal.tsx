import React, { useState } from 'react';
import { Customer, NotificationChannel } from '../../../domain/entities/customer';
import { Mail, MessageSquare, Send, Smartphone, Sparkles, X, CheckCircle, AlertCircle } from 'lucide-react';
import { CustomerRepositoryImpl } from '../../../data/repositories/CustomerRepositoryImpl';

interface CustomerMessagingModalProps {
  customer?: Customer;
  onClose: () => void;
  onSent?: () => void;
}

const repo = new CustomerRepositoryImpl();

export const CustomerMessagingModal: React.FC<CustomerMessagingModalProps> = ({
  customer,
  onClose,
  onSent
}) => {
  const [channel, setChannel] = useState<NotificationChannel>('sms');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState(customer ? (customer.phone || customer.email || '') : '');
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChannelChange = (newChannel: NotificationChannel) => {
    setChannel(newChannel);
    if (customer) {
      if (newChannel === 'email') setRecipient(customer.email || '');
      else setRecipient(customer.phone || '');
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('Message content cannot be empty');
      return;
    }
    if (!recipient.trim()) {
      setError('Recipient contact detail is required');
      return;
    }

    setSending(true);
    setError(null);

    try {
      await repo.sendCustomerNotification({
        customerId: customer?.id,
        channel,
        title: title || `${channel.toUpperCase()} Message`,
        message,
        recipient,
        sentBy: 'System Admin'
      });

      setSuccess(true);
      setTimeout(() => {
        if (onSent) onSent();
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to dispatch notification');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Send Customer Communication</h3>
              <p className="text-xs text-slate-400">
                {customer ? `Direct dispatch to ${customer.fullName}` : 'Broadcast to customer target list'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <h4 className="text-base font-bold text-white">Message Dispatched Successfully!</h4>
            <p className="text-xs text-slate-400">Recorded in customer communication logs.</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Channel Selection */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-2 block">Communication Channel</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: 'sms', label: 'SMS', icon: MessageSquare },
                  { id: 'whatsapp', label: 'WhatsApp', icon: Smartphone },
                  { id: 'email', label: 'Email', icon: Mail },
                  { id: 'push', label: 'Push App', icon: Sparkles }
                ].map((item) => {
                  const Icon = item.icon;
                  const selected = channel === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleChannelChange(item.id as NotificationChannel)}
                      className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        selected
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 font-bold'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="text-[11px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recipient */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Recipient Detail</label>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder={channel === 'email' ? 'customer@example.com' : '+252 61 XXX XXXX'}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Subject / Headline (Optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Your VIP Reward Code or Exclusive Weekend Offer"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="text-xs font-semibold text-slate-300 mb-1.5 block">Message Body</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Type your message here..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {sending ? 'Dispatching...' : 'Dispatch Message'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
