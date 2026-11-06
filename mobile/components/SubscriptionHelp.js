import { useState } from 'react';
import { View, Text, TouchableOpacity, Linking } from 'react-native';

// The existing published support address. Opening a composer is not sending a
// request or cancelling a subscription; never imply either has happened.
export default function SubscriptionHelp() {
  const [error, setError] = useState(false);
  const openEmail = async () => {
    setError(false);
    try {
      await Linking.openURL('mailto:hello@savorymind.net?subject=Subscription%20cancellation%20help');
    } catch {
      setError(true);
    }
  };
  return <View style={{ marginTop: 24 }}>
    <Text style={{ fontWeight: '700' }}>Need to cancel an existing subscription?</Text>
    <Text>Check your original subscription receipt for cancellation instructions. For help, you can write to the support address below. Include your account email, but do not send passwords or card details.</Text>
    <Text selectable>hello@savorymind.net</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Email cancellation help" onPress={openEmail} style={{ paddingVertical: 12 }}>
      <Text>Email cancellation help</Text>
    </TouchableOpacity>
    <Text>Opens your email app. You must send the message yourself. Opening or sending an email does not confirm cancellation; check for cancellation confirmation separately.</Text>
    {error && <Text accessibilityRole="alert">Your email app could not be opened. You can write to hello@savorymind.net using another email app.</Text>}
  </View>;
}
