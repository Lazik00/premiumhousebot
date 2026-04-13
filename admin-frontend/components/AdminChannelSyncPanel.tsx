'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getPropertyChannelCalendars,
  rotatePropertyChannelCalendarToken,
  syncPropertyChannelCalendar,
  updatePropertyChannelCalendar,
} from '../lib/api';
import { formatDateTime } from '../lib/format';
import type { AdminChannelCalendarConfig } from '../lib/types';

const CHANNEL_LABELS: Record<string, string> = {
  airbnb: 'Airbnb',
  booking: 'Booking.com',
};

function safeChannelLabel(channel: string) {
  return CHANNEL_LABELS[channel] || channel;
}

export default function AdminChannelSyncPanel({ propertyId }: { propertyId: string }) {
  const [channels, setChannels] = useState<AdminChannelCalendarConfig[]>([]);
  const [draftUrls, setDraftUrls] = useState<Record<string, string>>({});
  const [draftEnabled, setDraftEnabled] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingChannel, setSavingChannel] = useState<string | null>(null);
  const [syncingChannel, setSyncingChannel] = useState<string | null>(null);
  const [rotatingChannel, setRotatingChannel] = useState<string | null>(null);
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);
  const [syncInfo, setSyncInfo] = useState<Record<string, string>>({});

  const sortedChannels = useMemo(
    () => [...channels].sort((a, b) => (a.channel > b.channel ? 1 : -1)),
    [channels],
  );

  const load = async () => {
    setLoading(true);
    try {
      const response = await getPropertyChannelCalendars(propertyId);
      setChannels(response.channels);
      setDraftUrls(
        Object.fromEntries(response.channels.map((item) => [item.channel, item.import_ical_url || ''])),
      );
      setDraftEnabled(
        Object.fromEntries(response.channels.map((item) => [item.channel, item.is_enabled])),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Channel sozlamalari yuklanmadi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [propertyId]);

  const handleSave = async (channel: string) => {
    setSavingChannel(channel);
    setError(null);
    try {
      await updatePropertyChannelCalendar(propertyId, channel, {
        import_ical_url: (draftUrls[channel] || '').trim() || null,
        is_enabled: Boolean(draftEnabled[channel]),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Channel sozlamasini saqlab bo‘lmadi');
    } finally {
      setSavingChannel(null);
    }
  };

  const handleSyncNow = async (channel: string) => {
    setSyncingChannel(channel);
    setError(null);
    try {
      const result = await syncPropertyChannelCalendar(propertyId, channel);
      setSyncInfo((prev) => ({
        ...prev,
        [channel]: `Imported: ${result.imported_count}, Updated: ${result.updated_count}, Deactivated: ${result.deactivated_count}, Status: ${result.status}`,
      }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Channel sync bajarilmadi');
    } finally {
      setSyncingChannel(null);
    }
  };

  const handleRotateToken = async (channel: string) => {
    setRotatingChannel(channel);
    setError(null);
    try {
      await rotatePropertyChannelCalendarToken(propertyId, channel);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tokenni aylantirib bo‘lmadi');
    } finally {
      setRotatingChannel(null);
    }
  };

  const copyExportUrl = async (channel: string, exportUrl: string) => {
    try {
      await navigator.clipboard.writeText(exportUrl);
      setCopiedChannel(channel);
      setTimeout(() => setCopiedChannel((current) => (current === channel ? null : current)), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export URL nusxalanmadi');
    }
  };

  return (
    <div className="admin-panel" style={{ padding: 20, marginBottom: 18 }}>
      <div className="admin-header-row" style={{ alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div className="admin-section-title">Channel calendar sync</div>
          <div className="admin-section-subtitle">Airbnb va Booking taqvimlarini import qiling, Premium House taqvimini esa export URL orqali ulab qo‘ying.</div>
        </div>
      </div>

      {error ? <div style={{ marginTop: 12, color: 'var(--color-danger)', fontSize: 13 }}>{error}</div> : null}

      {loading ? (
        <div style={{ marginTop: 14, color: 'var(--color-muted)' }}>Yuklanmoqda...</div>
      ) : (
        <div style={{ display: 'grid', gap: 14, marginTop: 14 }}>
          {sortedChannels.map((item) => {
            const channel = item.channel;
            const urlValue = draftUrls[channel] ?? '';
            const enabledValue = draftEnabled[channel] ?? item.is_enabled;
            const saveBusy = savingChannel === channel;
            const syncBusy = syncingChannel === channel;
            const rotateBusy = rotatingChannel === channel;

            return (
              <div
                key={channel}
                style={{
                  border: '1px solid var(--color-line)',
                  borderRadius: 16,
                  padding: 14,
                  background: 'rgba(255,247,232,0.03)',
                }}
              >
                <div className="admin-header-row" style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="admin-section-title" style={{ fontSize: 16 }}>{safeChannelLabel(channel)}</div>
                    <div className={`status-pill ${enabledValue ? 'success' : 'blocked'}`}>{enabledValue ? 'Enabled' : 'Disabled'}</div>
                    <div className="status-pill warning">{item.active_events} external event</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-text)' }}>
                    <input
                      type="checkbox"
                      checked={enabledValue}
                      onChange={(event) => setDraftEnabled((prev) => ({ ...prev, [channel]: event.target.checked }))}
                    />
                    Sync yoqilgan
                  </label>

                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--color-muted)' }}>
                      Import iCal URL ({safeChannelLabel(channel)} dan)
                    </label>
                    <input
                      value={urlValue}
                      onChange={(event) => setDraftUrls((prev) => ({ ...prev, [channel]: event.target.value }))}
                      placeholder="https://..."
                      style={{
                        width: '100%',
                        padding: '11px 12px',
                        borderRadius: 12,
                        border: '1px solid var(--color-line)',
                        background: 'rgba(255,247,232,0.02)',
                        color: 'var(--color-text)',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--color-muted)' }}>
                      Export iCal URL (Premium House dan {safeChannelLabel(channel)} ga)
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input
                        readOnly
                        value={item.export_ical_url}
                        style={{
                          flex: 1,
                          padding: '11px 12px',
                          borderRadius: 12,
                          border: '1px solid var(--color-line)',
                          background: 'rgba(255,247,232,0.02)',
                          color: 'var(--color-text)',
                        }}
                      />
                      <button type="button" className="admin-button secondary" onClick={() => copyExportUrl(channel, item.export_ical_url)}>
                        {copiedChannel === channel ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: 'var(--color-muted)' }}>
                    Oxirgi sync: {item.last_synced_at ? formatDateTime(item.last_synced_at) : 'hali yo‘q'} | Status: {item.last_sync_status || 'n/a'}
                  </div>
                  {item.last_sync_error ? (
                    <div style={{ fontSize: 12, color: 'var(--color-danger)' }}>Error: {item.last_sync_error}</div>
                  ) : null}
                  {syncInfo[channel] ? (
                    <div style={{ fontSize: 12, color: 'var(--color-brand-light)' }}>{syncInfo[channel]}</div>
                  ) : null}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <button type="button" className="admin-button" disabled={saveBusy} onClick={() => handleSave(channel)}>
                    {saveBusy ? 'Saqlanmoqda...' : 'Saqlash'}
                  </button>
                  <button type="button" className="admin-button secondary" disabled={syncBusy} onClick={() => handleSyncNow(channel)}>
                    {syncBusy ? 'Sync...' : 'Sync now'}
                  </button>
                  <button type="button" className="admin-button secondary" disabled={rotateBusy} onClick={() => handleRotateToken(channel)}>
                    {rotateBusy ? 'Aylanmoqda...' : 'Rotate token'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
