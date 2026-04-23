import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, ActivityIndicator, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { C } from '../../constants/colors';

function formatTime(t) {
  if (!t) return '--:--';
  const [h, m] = t.split(':');
  const hr = parseInt(h);
  return `${hr % 12 || 12}:${m} ${hr < 12 ? 'AM' : 'PM'}`;
}

function elapsed(clockIn) {
  if (!clockIn) return '';
  const [h, m] = clockIn.split(':').map(Number);
  const now = new Date();
  const start = new Date();
  start.setHours(h, m, 0, 0);
  const diff = Math.max(0, now - start);
  const hrs = Math.floor(diff / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hrs}h ${mins}m`;
}

export default function StaffPortal() {
  const { user, logout } = useAuth();
  const [status, setStatus] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [breakMinutes, setBreakMinutes] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const load = async () => {
    try {
      const [s, l] = await Promise.all([api.getClockStatus(), api.getMyLogs()]);
      setStatus(s);
      setLogs(l);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const handleClockIn = async () => {
    setActioning(true); setError(null);
    try {
      await api.clockIn({ notes: notes || '' });
      setNotes('');
      await load();
    } catch (e) { setError(e.message); }
    finally { setActioning(false); }
  };

  const handleClockOut = () => {
    Alert.alert('Clock Out', 'Enter break minutes (0 if none)', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clock Out', style: 'destructive', onPress: async () => {
          setActioning(true); setError(null);
          try {
            await api.clockOut({ break_minutes: parseInt(breakMinutes) || 0 });
            setBreakMinutes('');
            await load();
          } catch (e) { setError(e.message); }
          finally { setActioning(false); }
        },
      },
    ]);
  };

  const totalHours = logs.filter(l => l.total_hours != null).reduce((s, l) => s + (l.total_hours || 0), 0);
  const clockedIn = status?.clocked_in;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.bg }}>
        <ActivityIndicator size="large" color={C.restaurant.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Staff Portal</Text>
          <Text style={styles.headerSub}>{user?.display_name}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {error && <Text style={styles.errorText}>{error}</Text>}

        {/* Clock card */}
        <View style={[styles.clockCard, clockedIn && styles.clockCardActive]}>
          <Text style={styles.clockIcon}>{clockedIn ? '🟢' : '⚪'}</Text>
          <Text style={styles.clockStatus}>{clockedIn ? 'You are clocked in' : 'You are clocked out'}</Text>

          {clockedIn && (
            <View style={{ alignItems: 'center', marginTop: 8 }}>
              <Text style={styles.clockTime}>{formatTime(status.clock_in_time)}</Text>
              <Text style={styles.clockElapsed}>{elapsed(status.clock_in_time)} elapsed</Text>
              <Text style={styles.clockDate}>{status.clock_in_date}</Text>
            </View>
          )}

          <View style={{ marginTop: 20, width: '100%' }}>
            {clockedIn ? (
              <>
                <View style={styles.breakRow}>
                  <Text style={styles.breakLabel}>Break minutes:</Text>
                  <TextInput
                    style={styles.breakInput}
                    value={breakMinutes}
                    onChangeText={setBreakMinutes}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={C.gray[400]}
                  />
                </View>
                <TouchableOpacity style={styles.clockOutBtn} onPress={handleClockOut} disabled={actioning}>
                  {actioning ? <ActivityIndicator color="#fff" /> : <Text style={styles.clockBtnText}>Clock Out</Text>}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TextInput
                  style={[styles.breakInput, { width: '100%', marginBottom: 12, textAlign: 'left', paddingHorizontal: 14 }]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Notes (optional)"
                  placeholderTextColor={C.gray[400]}
                />
                <TouchableOpacity style={styles.clockInBtn} onPress={handleClockIn} disabled={actioning}>
                  {actioning ? <ActivityIndicator color="#fff" /> : <Text style={styles.clockBtnText}>Clock In</Text>}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{logs.length}</Text>
            <Text style={styles.statLbl}>Shifts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{totalHours.toFixed(1)}h</Text>
            <Text style={styles.statLbl}>Total Hrs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statVal}>{logs.filter(l => l.total_hours > 8).length}</Text>
            <Text style={styles.statLbl}>Overtime</Text>
          </View>
        </View>

        {/* History */}
        <Text style={styles.sectionTitle}>Shift History</Text>
        {logs.length === 0 && <Text style={styles.empty}>No shifts logged yet.</Text>}
        {logs.map(log => (
          <View key={log.id} style={[styles.logCard, log.is_open && styles.logCardOpen]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.logDate}>{log.date}</Text>
              <Text style={styles.logTimes}>
                {formatTime(log.clock_in)} → {log.is_open ? 'In progress' : formatTime(log.clock_out)}
              </Text>
              {log.break_minutes > 0 && <Text style={styles.logMeta}>{log.break_minutes}m break</Text>}
              {log.notes ? <Text style={styles.logNotes}>{log.notes}</Text> : null}
            </View>
            {log.is_open ? (
              <View style={styles.activeBadge}><Text style={styles.activeBadgeText}>Active</Text></View>
            ) : (
              <Text style={[styles.logHours, log.total_hours > 8 && { color: C.red }]}>
                {log.total_hours?.toFixed(1)}h
              </Text>
            )}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 16, paddingTop: 56 },
  headerTitle:     { fontSize: 22, fontWeight: '800', color: C.gray[900] },
  headerSub:       { fontSize: 13, color: C.gray[500], marginTop: 2 },
  logoutBtn:       { marginTop: 4 },
  logoutText:      { fontSize: 13, color: C.gray[400] },
  errorText:       { backgroundColor: '#fef2f2', borderRadius: 12, padding: 12, color: '#dc2626', fontSize: 13, marginBottom: 12 },
  clockCard:       { backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: C.gray[100], marginBottom: 16 },
  clockCardActive: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  clockIcon:       { fontSize: 40, marginBottom: 8 },
  clockStatus:     { fontSize: 18, fontWeight: '700', color: C.gray[800] },
  clockTime:       { fontSize: 36, fontWeight: '900', color: '#16a34a', marginTop: 4 },
  clockElapsed:    { fontSize: 13, color: '#22c55e', marginTop: 2 },
  clockDate:       { fontSize: 11, color: C.gray[400], marginTop: 4 },
  breakRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12, justifyContent: 'center' },
  breakLabel:      { fontSize: 14, color: C.gray[600] },
  breakInput:      { borderWidth: 1, borderColor: C.gray[200], borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: C.gray[50], width: 80, textAlign: 'center' },
  clockInBtn:      { backgroundColor: '#22c55e', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  clockOutBtn:     { backgroundColor: '#ef4444', borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  clockBtnText:    { color: '#fff', fontWeight: '800', fontSize: 18 },
  statsRow:        { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard:        { flex: 1, backgroundColor: '#fff', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: C.gray[100] },
  statVal:         { fontSize: 22, fontWeight: '800', color: C.restaurant.primary },
  statLbl:         { fontSize: 10, color: C.gray[500], marginTop: 2 },
  sectionTitle:    { fontSize: 15, fontWeight: '700', color: C.gray[800], marginBottom: 10 },
  empty:           { textAlign: 'center', color: C.gray[400], fontSize: 14, paddingVertical: 20 },
  logCard:         { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: C.gray[100] },
  logCardOpen:     { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  logDate:         { fontSize: 14, fontWeight: '700', color: C.gray[900] },
  logTimes:        { fontSize: 12, color: C.gray[500], marginTop: 2 },
  logMeta:         { fontSize: 11, color: C.gray[400], marginTop: 1 },
  logNotes:        { fontSize: 11, color: C.gray[500], marginTop: 2, fontStyle: 'italic' },
  logHours:        { fontSize: 18, fontWeight: '800', color: C.gray[900] },
  activeBadge:     { backgroundColor: '#dcfce7', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  activeBadgeText: { fontSize: 11, fontWeight: '700', color: '#16a34a' },
});
