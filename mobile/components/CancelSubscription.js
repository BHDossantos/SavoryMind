import { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../services/api';

export default function CancelSubscription({ status }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const submit = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await api.cancelSubscription();
      if (result.confirmed !== true) throw new Error('Cancellation was not confirmed');
      setConfirmed(true);
      setMessage(result.message);
    } catch {
      setMessage('Cancellation could not be confirmed. Please retry or use the cancellation help below.');
    } finally { setBusy(false); }
  };
  const confirm = () => Alert.alert('Cancel subscription?', 'Stop renewal at the end of the current billing period. This does not delete your account.', [
    { text: 'Keep subscription', style: 'cancel' },
    { text: 'Cancel renewal', style: 'destructive', onPress: submit },
  ]);
  return <View style={{ marginTop: 24 }}>
    {status?.cancel_at_period_end && <Text>Your subscription is scheduled to end after the current billing period.</Text>}
    {status?.can_cancel && !status.cancel_at_period_end && !confirmed && <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={confirm} style={{ paddingVertical: 12 }}>
      <Text>{busy ? 'Confirming cancellation…' : 'Cancel subscription renewal'}</Text>
    </TouchableOpacity>}
    {!!message && <Text accessibilityRole="alert">{message}</Text>}
  </View>;
}
