import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Reuse the public request flow; this does not claim that data is already deleted.
export default function AccountDeletion() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async () => {
    setBusy(true);
    setMessage('');
    try {
      await api.requestAccountDeletion({ email: user.email });
      setMessage('Your deletion request was sent for review. This is not confirmation of completed deletion. Your account has not been deleted yet.');
    } catch {
      setMessage('Your deletion request could not be sent. Please try again later.');
    } finally {
      setBusy(false);
    }
  };
  const confirm = () => Alert.alert('Delete account?', 'Request permanent deletion of your account and associated data. Our team may contact you to verify ownership. This does not cancel an active subscription.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Request deletion', style: 'destructive', onPress: submit },
  ]);
  return <View style={{ padding: 16 }}>
    <TouchableOpacity accessibilityRole="button" onPress={confirm} disabled={busy || !user?.email}>
      <Text style={{ color: '#b91c1c' }}>{busy ? 'Sending request…' : 'Delete account'}</Text>
    </TouchableOpacity>
    {!!message && <Text accessibilityRole="alert">{message}</Text>}
  </View>;
}
