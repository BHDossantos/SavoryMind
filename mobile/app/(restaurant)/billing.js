import SubscriptionHelp from '../../components/SubscriptionHelp';
import { useCallback, useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { api } from '../../services/api';

// Digital purchases require a validated store-billing implementation. A browser
// checkout is not a universal exemption. Keep existing account status visible.
export default function MembershipStatus() {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    setError(false);
    api.getRestaurantBillingStatus().then(value => { if (active) setStatus(value); }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, []));
  return <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 60 }}>
    <Text style={{ fontSize: 24, fontWeight: '700' }}>Restaurant membership</Text>
    {error ? <Text accessibilityRole="alert">We could not load your membership. Please try again later.</Text> :
      <Text>{status ? (status.is_pro ? 'Your membership is active.' : 'No active paid membership.') : 'Loading membership…'}</Text>}
    <View style={{ marginTop: 20 }}>
      <Text>Purchases and plan changes are not available in this app.</Text>
      <Text>Existing subscriptions continue until cancelled. Account deletion does not cancel a subscription.</Text>
    </View>
    <SubscriptionHelp />
  </ScrollView>;
}
