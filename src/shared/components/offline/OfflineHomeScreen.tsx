import React from 'react';
import NoInternetScreen from './NoInternetScreen';

interface OfflineHomeScreenProps {
  onRetrySuccess?: () => void;
  className?: string;
}

export default function OfflineHomeScreen({ onRetrySuccess, className = '' }: OfflineHomeScreenProps) {
  return <NoInternetScreen onRetrySuccess={onRetrySuccess} className={className} />;
}
