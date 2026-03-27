/* Telegram WebApp SDK wrapper */

export interface TelegramWebApp {
    initData: string;
    initDataUnsafe: {
        user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            photo_url?: string;
            language_code?: string;
        };
        auth_date: number;
        hash: string;
    };
    version: string;
    platform: string;
    colorScheme: 'light' | 'dark';
    themeParams: {
        bg_color?: string;
        text_color?: string;
        hint_color?: string;
        link_color?: string;
        button_color?: string;
        button_text_color?: string;
        secondary_bg_color?: string;
        header_bg_color?: string;
        section_bg_color?: string;
        accent_text_color?: string;
        section_header_text_color?: string;
        subtitle_text_color?: string;
        destructive_text_color?: string;
    };
    isExpanded: boolean;
    isFullscreen?: boolean;
    viewportHeight: number;
    viewportStableHeight: number;
    MainButton: {
        text: string;
        color: string;
        textColor: string;
        isVisible: boolean;
        isActive: boolean;
        isProgressVisible: boolean;
        setText: (text: string) => void;
        onClick: (cb: () => void) => void;
        offClick: (cb: () => void) => void;
        show: () => void;
        hide: () => void;
        enable: () => void;
        disable: () => void;
        showProgress: (leaveActive?: boolean) => void;
        hideProgress: () => void;
        setParams: (params: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
    };
    BackButton: {
        isVisible: boolean;
        onClick: (cb: () => void) => void;
        offClick: (cb: () => void) => void;
        show: () => void;
        hide: () => void;
    };
    HapticFeedback: {
        impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
        notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
        selectionChanged: () => void;
    };
    ready: () => void;
    expand: () => void;
    requestFullscreen?: () => void;
    exitFullscreen?: () => void;
    close: () => void;
    setHeaderColor: (color: string) => void;
    setBackgroundColor: (color: string) => void;
    enableClosingConfirmation: () => void;
    disableClosingConfirmation: () => void;
    openLink: (url: string, options?: { try_instant_view?: boolean }) => void;
    openTelegramLink: (url: string) => void;
    enableVerticalSwipes?: () => void;
    disableVerticalSwipes?: () => void;
    onEvent?: (eventType: string, eventHandler: (...args: any[]) => void) => void;
    offEvent?: (eventType: string, eventHandler: (...args: any[]) => void) => void;
}

declare global {
    interface Window {
        Telegram?: {
            WebApp: TelegramWebApp;
        };
        TelegramWebviewProxy?: unknown;
        TelegramGameProxy?: unknown;
        TelegramGameProxy_receiveEvent?: unknown;
    }
}

export function getTelegramWebApp(): TelegramWebApp | null {
    if (typeof window !== 'undefined' && window.Telegram?.WebApp) {
        return window.Telegram.WebApp;
    }
    return null;
}

export function getInitData(): string {
    const tg = getTelegramWebApp();
    return tg?.initData ?? '';
}

export function getColorScheme(): 'light' | 'dark' {
    const tg = getTelegramWebApp();
    return tg?.colorScheme ?? 'light';
}

export function hasTelegramBridge(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(
        window.TelegramWebviewProxy ||
        window.TelegramGameProxy ||
        window.TelegramGameProxy_receiveEvent,
    );
}

function versionAtLeast(currentVersion: string | undefined, minimumVersion: string): boolean {
    if (!currentVersion) return false;

    const current = currentVersion.split('.').map((part) => Number(part) || 0);
    const minimum = minimumVersion.split('.').map((part) => Number(part) || 0);
    const length = Math.max(current.length, minimum.length);

    for (let index = 0; index < length; index += 1) {
        const currentPart = current[index] ?? 0;
        const minimumPart = minimum[index] ?? 0;
        if (currentPart > minimumPart) return true;
        if (currentPart < minimumPart) return false;
    }

    return true;
}

export function haptic(type: 'light' | 'medium' | 'heavy' = 'light') {
    const tg = getTelegramWebApp();
    if (!tg || !hasTelegramBridge() || !versionAtLeast(tg.version, '6.1')) {
        return;
    }
    tg.HapticFeedback?.impactOccurred(type);
}

export function initTelegramApp() {
    const tg = getTelegramWebApp();
    if (tg) {
        tg.ready();
        tg.expand();
        if (!hasTelegramBridge()) {
            return;
        }
        // Prevent swipe down from closing the app (useful for scrolling)
        try {
            if (versionAtLeast(tg.version, '8.0') && typeof tg.requestFullscreen === 'function' && !tg.isFullscreen) {
                tg.requestFullscreen();
            }
        } catch {
            // Ignore unsupported fullscreen requests and continue with expanded mode.
        }
        try {
            if (
                versionAtLeast(tg.version, '7.7') &&
                'disableVerticalSwipes' in tg &&
                typeof tg.disableVerticalSwipes === 'function'
            ) {
                tg.disableVerticalSwipes();
            }
        } catch (e) {
            console.warn('disableVerticalSwipes skipped:', e);
        }
        if (versionAtLeast(tg.version, '6.2') && typeof tg.enableClosingConfirmation === 'function') {
            tg.enableClosingConfirmation();
        }
        try {
            if (versionAtLeast(tg.version, '6.1')) {
                tg.setHeaderColor('#080603');
                tg.setBackgroundColor('#080603');
            }
        } catch { /* older SDK versions may not support */ }
    }
}
