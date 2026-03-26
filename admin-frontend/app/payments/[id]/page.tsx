'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AdminShell from '../../../components/AdminShell';
import AdminStatusPill from '../../../components/AdminStatusPill';
import { useAdminAuth } from '../../../context/AdminAuthContext';
import { getPayment, refundPayment } from '../../../lib/api';
import { formatDateTime, formatMoney } from '../../../lib/format';
import type { AdminPaymentDetail } from '../../../lib/types';

export default function PaymentDetailPage() {
  const params = useParams();
  const paymentId = String(params.id || '');
  const { isAuthenticated, isLoading: authLoading } = useAdminAuth();
  const [payment, setPayment] = useState<AdminPaymentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refundError, setRefundError] = useState<string | null>(null);
  const [refundSuccess, setRefundSuccess] = useState<string | null>(null);
  const [submittingRefund, setSubmittingRefund] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setPayment(await getPayment(paymentId));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment detail yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated || !paymentId) return;
    void load();
  }, [authLoading, isAuthenticated, paymentId]);

  const refundedTotal = useMemo(
    () => (payment?.refunds || []).reduce((sum, item) => sum + item.amount, 0),
    [payment?.refunds],
  );
  const refundableAmount = Math.max((payment?.amount || 0) - refundedTotal, 0);
  const refundEnabled = payment?.provider === 'octo' && ['success', 'partial_refunded'].includes(payment.status);

  const handleRefund = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!payment) return;
    setSubmittingRefund(true);
    setRefundError(null);
    setRefundSuccess(null);
    try {
      const response = await refundPayment(payment.id, {
        amount: refundAmount ? Number(refundAmount) : undefined,
        reason: refundReason || undefined,
      });
      setRefundSuccess(`Refund yaratildi: ${response.status} (${formatMoney(response.amount)})`);
      setRefundAmount('');
      setRefundReason('');
      await load();
    } catch (err) {
      setRefundError(err instanceof Error ? err.message : 'Refund bajarilmadi');
    } finally {
      setSubmittingRefund(false);
    }
  };

  return (
    <AdminShell title={payment ? `Payment ${payment.provider}` : 'Payment detail'} subtitle="Provider javobi, callback loglari va refund boshqaruvi.">
      <div style={{ marginBottom: 18, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Link href="/payments" className="admin-button secondary" style={{ textDecoration: 'none' }}>To'lovlar ro'yxatiga qaytish</Link>
        {payment ? <Link href={`/bookings/${payment.booking_id}`} className="admin-button secondary" style={{ textDecoration: 'none' }}>Booking detail</Link> : null}
        {payment?.payment_url ? <a href={payment.payment_url} target="_blank" rel="noreferrer" className="admin-button" style={{ textDecoration: 'none' }}>Checkout ochish</a> : null}
      </div>

      {loading ? <div className="admin-panel" style={{ padding: 24 }}>Yuklanmoqda...</div> : null}
      {error ? <div className="admin-panel" style={{ padding: 24, color: 'var(--color-danger)' }}>{error}</div> : null}

      {payment ? (
        <div className="admin-grid">
          <div className="admin-metrics admin-metrics-4">
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Provider</div><div style={{ marginTop: 10 }}><AdminStatusPill value={payment.provider} /></div></div>
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Status</div><div style={{ marginTop: 10 }}><AdminStatusPill value={payment.status} /></div></div>
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Summa</div><div className="admin-stat-value">{formatMoney(payment.amount, payment.currency)}</div></div>
            <div className="admin-panel" style={{ padding: 18 }}><div className="admin-section-subtitle">Refundable</div><div className="admin-stat-value">{formatMoney(refundableAmount, payment.currency)}</div></div>
          </div>

          <div className="admin-subgrid">
            <div className="admin-panel" style={{ padding: 22 }}>
              <div className="admin-section-title">Payment overview</div>
              <div className="admin-kv-list" style={{ marginTop: 16 }}>
                <div className="admin-kv"><span>Booking</span><strong>#{payment.booking_code}</strong></div>
                <div className="admin-kv"><span>Property</span><strong>{payment.property_title}</strong></div>
                <div className="admin-kv"><span>Customer</span><strong>{payment.customer_name}</strong></div>
                <div className="admin-kv"><span>Email</span><strong>{payment.customer_email || 'Yo\'q'}</strong></div>
                <div className="admin-kv"><span>Provider payment ID</span><strong>{payment.provider_payment_id || 'Yo\'q'}</strong></div>
                <div className="admin-kv"><span>Yaratilgan</span><strong>{formatDateTime(payment.created_at)}</strong></div>
                <div className="admin-kv"><span>Paid at</span><strong>{formatDateTime(payment.paid_at)}</strong></div>
                <div className="admin-kv"><span>Failed at</span><strong>{formatDateTime(payment.failed_at)}</strong></div>
              </div>
            </div>

            <div className="admin-panel" style={{ padding: 22 }}>
              <div className="admin-header-row">
                <div>
                  <div className="admin-section-title">Refund action</div>
                  <div className="admin-section-subtitle">Hozircha faqat Octo successful payment'lar uchun faol.</div>
                </div>
                {!refundEnabled ? <AdminStatusPill value="refund locked" /> : null}
              </div>

              <form className="admin-stack" style={{ gap: 14, marginTop: 16 }} onSubmit={handleRefund}>
                <label className="admin-field">
                  <span>Refund amount</span>
                  <input type="number" min={0} step="0.01" max={refundableAmount || undefined} placeholder={`Bo'sh qoldirilsa to'liq: ${formatMoney(refundableAmount, payment.currency)}`} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} disabled={!refundEnabled || refundableAmount <= 0 || submittingRefund} />
                </label>
                <label className="admin-field">
                  <span>Reason</span>
                  <textarea rows={4} placeholder="Refund sababi" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} disabled={!refundEnabled || refundableAmount <= 0 || submittingRefund} />
                </label>
                {refundError ? <div className="admin-alert danger">{refundError}</div> : null}
                {refundSuccess ? <div className="admin-alert success">{refundSuccess}</div> : null}
                <button className="admin-button" type="submit" disabled={!refundEnabled || refundableAmount <= 0 || submittingRefund}>
                  {submittingRefund ? 'Refund yuborilmoqda...' : 'Refund bajarish'}
                </button>
              </form>
            </div>
          </div>

          <div className="admin-subgrid">
            <div className="admin-panel" style={{ padding: 22 }}>
              <div className="admin-section-title">Callback loglari</div>
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Event ID</th>
                      <th>Signature</th>
                      <th>Valid</th>
                      <th>Processed</th>
                      <th>Payload</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payment.callbacks.map((callback) => (
                      <tr key={callback.id}>
                        <td>{callback.provider_event_id}</td>
                        <td><code className="admin-code">{callback.signature}</code></td>
                        <td>{callback.is_valid ? <AdminStatusPill value="success" /> : <AdminStatusPill value="failed" />}</td>
                        <td>{formatDateTime(callback.processed_at || callback.created_at)}</td>
                        <td>
                          <details>
                            <summary style={{ cursor: 'pointer', color: 'var(--color-brand-light)' }}>Payload</summary>
                            <pre className="admin-pre" style={{ marginTop: 10 }}>{JSON.stringify(callback.payload, null, 2)}</pre>
                          </details>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="admin-panel" style={{ padding: 22 }}>
              <div className="admin-section-title">Refundlar</div>
              <div className="table-wrap" style={{ marginTop: 16 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Reason</th>
                      <th>Provider refund ID</th>
                      <th>Processed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payment.refunds.map((refund) => (
                      <tr key={refund.id}>
                        <td><AdminStatusPill value={refund.status} /></td>
                        <td>{formatMoney(refund.amount, payment.currency)}</td>
                        <td>{refund.reason || 'Yo\'q'}</td>
                        <td>{refund.provider_refund_id || 'Yo\'q'}</td>
                        <td>{formatDateTime(refund.processed_at || refund.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="admin-subgrid">
            <div className="admin-panel" style={{ padding: 22 }}>
              <div className="admin-section-title">Raw request</div>
              <pre className="admin-pre" style={{ marginTop: 16 }}>{JSON.stringify(payment.raw_request, null, 2)}</pre>
            </div>
            <div className="admin-panel" style={{ padding: 22 }}>
              <div className="admin-section-title">Raw response</div>
              <pre className="admin-pre" style={{ marginTop: 16 }}>{JSON.stringify(payment.raw_response, null, 2)}</pre>
            </div>
          </div>
        </div>
      ) : null}
    </AdminShell>
  );
}
