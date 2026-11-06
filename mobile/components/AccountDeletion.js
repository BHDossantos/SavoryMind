import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// The authenticated endpoint binds identity to the session and durably saves intake.
export default function AccountDeletion() {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async () => {
    setBusy(true);
    setMessage('');
    try {
      const result = await api.requestAccountDeletion({});
      setMessage(`Your verified deletion request is saved for review. Reference: ${result.request_id}. Your account has not been deleted yet.`);
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
