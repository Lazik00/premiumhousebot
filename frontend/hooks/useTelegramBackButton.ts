'use client';

import { useEffect, useState } from 'react';
import { getTelegramWebApp, haptic, hasTelegramBridge } from '../lib/telegram';

export default function useTelegramBackButton(onBack: () => void, enabled = true) {
    const [isNativeBackVisible, setIsNativeBackVisible] = useState(false);

    useEffect(() => {
        const tg = getTelegramWebApp();
        if (!enabled || !tg?.BackButton || !hasTelegramBridge()) {
            setIsNativeBackVisible(false);
            return;
        }

        const handleBack = () => {
            haptic('light');
            onBack();
        };

        tg.BackButton.show();
        tg.BackButton.onClick(handleBack);
        setIsNativeBackVisible(true);

        return () => {
            tg.BackButton.offClick(handleBack);
            tg.BackButton.hide();
            setIsNativeBackVisible(false);
        };
    }, [enabled, onBack]);

    return isNativeBackVisible;
}
