'use client';

export function CardSkeleton() {
    return (
        <div
            style={{
                borderRadius: 16,
                overflow: 'hidden',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line)',
            }}
        >
            <div className="skeleton" style={{ width: '100%', height: 200, borderRadius: 0 }} />
            <div style={{ padding: '14px 16px 16px' }}>
                <div className="skeleton" style={{ width: '80%', height: 18, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '60%', height: 14, marginBottom: 10 }} />
                <div style={{ display: 'flex', gap: 12 }}>
                    <div className="skeleton" style={{ width: 70, height: 14 }} />
                    <div className="skeleton" style={{ width: 60, height: 14 }} />
                </div>
            </div>
        </div>
    );
}

export function DetailSkeleton() {
    return (
        <div className="fade-in">
            <div className="skeleton" style={{ width: '100%', height: 300, borderRadius: '0 0 24px 24px' }} />
            <div style={{ padding: '20px 16px' }}>
                <div className="skeleton" style={{ width: '70%', height: 24, marginBottom: 8 }} />
                <div className="skeleton" style={{ width: '50%', height: 16, marginBottom: 20 }} />
                <div className="skeleton" style={{ width: '100%', height: 80, marginBottom: 16 }} />
                <div className="skeleton" style={{ width: '100%', height: 60, marginBottom: 16 }} />
                <div className="skeleton" style={{ width: '100%', height: 100 }} />
            </div>
        </div>
    );
}

export function BookingCardSkeleton() {
    return (
        <div
            style={{
                borderRadius: 16,
                overflow: 'hidden',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-line)',
                padding: 16,
            }}
        >
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                <div className="skeleton" style={{ width: 60, height: 60, borderRadius: 12 }} />
                <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ width: '80%', height: 16, marginBottom: 6 }} />
                    <div className="skeleton" style={{ width: '50%', height: 14 }} />
                </div>
            </div>
            <div className="skeleton" style={{ width: '100%', height: 40, borderRadius: 10 }} />
        </div>
    );
}

export function ProfileSkeleton() {
    return (
        <div className="fade-in" style={{ padding: '40px 16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 32 }}>
                <div className="skeleton" style={{ width: 80, height: 80, borderRadius: '50%' }} />
                <div className="skeleton" style={{ width: 120, height: 20 }} />
                <div className="skeleton" style={{ width: 80, height: 14 }} />
            </div>
            <div className="skeleton" style={{ width: '100%', height: 60, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: '100%', height: 60, marginBottom: 12 }} />
            <div className="skeleton" style={{ width: '100%', height: 60 }} />
        </div>
    );
}
