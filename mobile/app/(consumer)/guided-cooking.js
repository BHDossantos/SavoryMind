import { useEffect, useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator,
  Modal, TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { C } from '../../constants/colors';
import { api } from '../../services/api';


// Mirror frontend/src/pages/consumer/guided-cooking.js — step-by-step
// recipe walkthrough with a per-step timer, an inline assistant for
// when something goes wrong, and a post-cook memory modal that writes
// to the food journal.
//
// Reached via expo-router /(consumer)/guided-cooking?id=<recipe_id>
// — typically pushed from the recipes screen.
function fmtTime(s) {
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${mm}:${String(ss).padStart(2, '0')}`;
}


function StepTimer() {
  const [duration, setDuration] = useState(0);
  const [running, setRunning]   = useState(false);
  const [remaining, setRemaining] = useState(0);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) { clearInterval(intervalRef.current); setRunning(false); return 0; }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const start = (secs) => { setDuration(secs); setRemaining(secs); setRunning(true); };
  const stop = () => { setRunning(false); clearInterval(intervalRef.current); };
  const reset = () => { stop(); setRemaining(0); setDuration(0); };

  const done = remaining === 0 && !running && duration > 0;

  return (
    <View style={styles.timerCard}>
      <Text style={styles.timerLabel}>⏱️ Step Timer</Text>
      {running || done ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text style={[
            styles.timerDisplay,
            done && { color: '#16a34a' },
            !done && remaining <= 10 && { color: C.red },
          ]}>
            {done ? 'Done! ✓' : fmtTime(remaining)}
          </Text>
          <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto' }}>
            {running && (
              <TouchableOpacity onPress={stop} style={styles.timerActionBtn}>
                <Text style={styles.timerActionBtnText}>Pause</Text>
              </TouchableOpacity>
            )}
            {!running && remaining > 0 && (
              <TouchableOpacity onPress={() => setRunning(true)} style={[styles.timerActionBtn, styles.timerActionBtnPrimary]}>
                <Text style={[styles.timerActionBtnText, { color: '#fff' }]}>Resume</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={reset} style={styles.timerActionBtn}>
              <Text style={styles.timerActionBtnText}>Reset</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[1, 2, 3, 5, 10, 15].map((m) => (
            <TouchableOpacity key={m} onPress={() => start(m * 60)} style={styles.timerPreset} testID={`timer-${m}min`}>
              <Text style={styles.timerPresetText}>{m} min</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}


function InlineAssistant() {
  const [open, setOpen]     = useState(false);
  const [query, setQuery]   = useState('');
  const [result, setResult] = useState(null);
  const [asking, setAsking] = useState(false);

  const ask = async () => {
    if (!query.trim() || asking) return;
    setAsking(true); setResult(null);
    try {
      const data = await api.askAssistant(query.trim());
      setResult(data);
    } catch {
      setResult({ title: 'Error', answer: "Couldn't reach the assistant — try again." });
    } finally {
      setAsking(false);
    }
  };

  if (!open) {
    return (
      <TouchableOpacity onPress={() => setOpen(true)} style={styles.helpToggle} testID="open-assistant">
        <Text style={styles.helpToggleText}>🆘 Something went wrong? Ask for help</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.assistantCard}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={styles.assistantHeader}>👨‍🍳 Culinary Assistant</Text>
        <TouchableOpacity onPress={() => { setOpen(false); setQuery(''); setResult(null); }}>
          <Text style={{ color: '#a16207', fontSize: 18 }}>✕</Text>
        </TouchableOpacity>
      </View>
      {result ? (
        <View>
          <Text style={styles.assistantResultTitle}>{result.title}</Text>
          <Text style={styles.assistantResultAnswer}>{result.answer}</Text>
          <TouchableOpacity onPress={() => { setQuery(''); setResult(null); }}>
            <Text style={styles.assistantLink}>Ask another →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="e.g. sauce is breaking, meat is tough…"
            placeholderTextColor="#a16207"
            style={styles.assistantInput}
          />
          <TouchableOpacity onPress={ask} disabled={!query.trim() || asking} style={[styles.assistantAskBtn, (!query.trim() || asking) && { opacity: 0.5 }]}>
            <Text style={styles.assistantAskBtnText}>{asking ? '…' : 'Ask'}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}


function MemoryModal({ recipe, onSave, onSkip }) {
  const [rating, setRating]   = useState(5);
  const [notes, setNotes]     = useState('');
  const [change, setChange]   = useState('');
  const [saving, setSaving]   = useState(false);

  const [error, setError] = useState(null);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.createMemory({
        dish_name: recipe.title,
        emoji: recipe.image_emoji || '🍽️',
        rating,
        notes: notes || null,
        what_id_change: change || null,
        cuisine: recipe.cuisine || null,
        recipe_id: recipe.id || null,
      });
      onSave();
    } catch (e) {
      // Surface the failure inline. Without this the modal would just
      // re-enable the Save button silently — user thinks the memory
      // was lost or that nothing happened. Inline error keeps the form
      // open with their notes intact so they can retry.
      setError(e?.message || "Couldn't save the memory. Try again in a moment.");
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="slide" visible onRequestClose={onSkip}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalSheet}>
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 38 }}>{recipe.image_emoji || '🍽️'}</Text>
            <Text style={styles.modalTitle}>How was it?</Text>
            <Text style={styles.modalSub}>Save this to your food journal</Text>
          </View>

          <Text style={styles.modalLabel}>Your rating</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            {[1, 2, 3, 4, 5].map((s) => (
              <TouchableOpacity key={s} onPress={() => setRating(s)} testID={`star-${s}`}>
                <Text style={{ fontSize: 26, opacity: s <= rating ? 1 : 0.3 }}>⭐</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.modalLabel}>How did it go? (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="It was delicious! The sauce came together perfectly…"
            placeholderTextColor={C.gray[400]}
            style={[styles.modalInput, { minHeight: 50 }]}
            multiline
          />

          <Text style={styles.modalLabel}>Anything you'd change?</Text>
          <TextInput
            value={change}
            onChangeText={setChange}
            placeholder="Less salt, more garlic…"
            placeholderTextColor={C.gray[400]}
            style={[styles.modalInput, { minHeight: 50, marginBottom: 16 }]}
            multiline
          />

          {error && (
            <Text testID="memory-save-error" style={styles.modalError}>{error}</Text>
          )}

          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity onPress={onSkip} style={[styles.modalSecondaryBtn, { flex: 1 }]}>
              <Text style={styles.modalSecondaryBtnText}>Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} disabled={saving} style={[styles.modalPrimaryBtn, { flex: 1 }, saving && { opacity: 0.5 }]} testID="save-memory">
              <Text style={styles.modalPrimaryBtnText}>{saving ? 'Saving…' : 'Save Memory'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}


export default function GuidedCookingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [recipe, setRecipe]           = useState(null);
  const [loading, setLoading]         = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [showMemory, setShowMemory]   = useState(false);
  const [done, setDone]               = useState(false);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    // cancelled flag prevents a stale getRecipe response from
    // overwriting a newer recipe if the user navigates id1 → id2 fast
    // enough that the first fetch hasn't returned yet. Without it,
    // racing fetches resolve in arbitrary order and the user can
    // briefly see the wrong recipe's ingredients/steps.
    let cancelled = false;
    setLoading(true);
    setRecipe(null);
    setCurrentStep(0);
    setDone(false);
    (async () => {
      try {
        const r = await api.getRecipe(Number(id));
        if (!cancelled) setRecipe(r);
      } catch {
        if (!cancelled) setRecipe(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.consumer.primary} />
      </View>
    );
  }

  if (!recipe) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 36, marginBottom: 8 }}>😕</Text>
        <Text style={{ fontSize: 14, color: C.gray[500], marginBottom: 16 }}>Recipe not found.</Text>
        <TouchableOpacity onPress={() => router.replace('/(consumer)/recipes')}>
          <Text style={{ color: C.consumer.primary, fontWeight: '700' }}>← Back to Recipes</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const steps       = Array.isArray(recipe.steps) ? recipe.steps : [];
  const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];
  const totalSteps  = steps.length;
  const isLast      = currentStep === totalSteps - 1;

  if (done) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 56, marginBottom: 12 }}>🎉</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: C.gray[900], marginBottom: 6 }}>You did it!</Text>
        <Text style={{ fontSize: 14, color: C.gray[500], marginBottom: 24, textAlign: 'center' }}>
          {recipe.title} is ready. Enjoy your meal!
        </Text>
        <View style={{ width: '100%', maxWidth: 280, gap: 10 }}>
          <TouchableOpacity onPress={() => setShowMemory(true)} style={styles.donePrimaryBtn} testID="open-memory-modal">
            <Text style={styles.donePrimaryBtnText}>📝 Save to my journal</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(consumer)/recipes')} style={styles.doneSecondaryBtn}>
            <Text style={styles.doneSecondaryBtnText}>Back to Recipes</Text>
          </TouchableOpacity>
        </View>

        {showMemory && (
          <MemoryModal
            recipe={recipe}
            onSave={() => router.replace('/(consumer)/journal')}
            onSkip={() => router.replace('/(consumer)/recipes')}
          />
        )}
      </View>
    );
  }

  const step = steps[currentStep];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.recipeTitle}>{recipe.image_emoji || '🍽️'} {recipe.title}</Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBarTrack}>
        <View style={[styles.progressBarFill, { width: `${totalSteps ? ((currentStep + 1) / totalSteps) * 100 : 0}%` }]} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {currentStep === 0 && ingredients.length > 0 && (
          <View style={styles.ingredientsCard} testID="ingredients-list">
            <Text style={styles.ingredientsHeader}>🛒 Ingredients</Text>
            {ingredients.map((ing, i) => (
              <Text key={i} style={styles.ingredientLine}>• {typeof ing === 'string' ? ing : ing?.name}</Text>
            ))}
          </View>
        )}

        <View style={styles.stepCard}>
          <Text style={styles.stepNumber}>Step {currentStep + 1} of {totalSteps}</Text>
          <Text style={styles.stepInstruction}>{step?.instruction || step?.text || step}</Text>
          {step?.tip && (
            <View style={styles.stepTipBox}>
              <Text style={styles.stepTipText}>💡 {step.tip}</Text>
            </View>
          )}

          <StepTimer />
          <InlineAssistant />
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
          <TouchableOpacity
            onPress={() => setCurrentStep((s) => Math.max(0, s - 1))}
            disabled={currentStep === 0}
            style={[styles.navBtn, styles.navBtnSecondary, currentStep === 0 && { opacity: 0.4 }]}
            testID="step-back"
          >
            <Text style={styles.navBtnSecondaryText}>← Previous</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => isLast ? setDone(true) : setCurrentStep((s) => s + 1)}
            style={[styles.navBtn, styles.navBtnPrimary]}
            testID="step-next"
          >
            <Text style={styles.navBtnPrimaryText}>{isLast ? '🎉 Finish' : 'Next →'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}


const styles = StyleSheet.create({
  center:           { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },

  topBar:           { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backText:         { fontSize: 13, color: C.consumer.primary, fontWeight: '700' },
  recipeTitle:      { fontSize: 16, fontWeight: '700', color: C.gray[900], flex: 1 },

  progressBarTrack: { height: 4, backgroundColor: C.consumer.light, marginHorizontal: 16, marginBottom: 12, borderRadius: 2 },
  progressBarFill:  { height: 4, backgroundColor: C.consumer.primary, borderRadius: 2 },

  ingredientsCard:  { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.consumer.border },
  ingredientsHeader:{ fontSize: 12, fontWeight: '800', color: C.gray[700], marginBottom: 8 },
  ingredientLine:   { fontSize: 13, color: C.gray[700], paddingVertical: 2 },

  stepCard:         { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: C.consumer.border },
  stepNumber:       { fontSize: 11, fontWeight: '700', color: C.consumer.primary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  stepInstruction:  { fontSize: 16, color: C.gray[900], lineHeight: 24 },
  stepTipBox:       { backgroundColor: '#fef9c3', borderRadius: 10, padding: 10, marginTop: 12 },
  stepTipText:      { fontSize: 12, color: '#854d0e', lineHeight: 17 },

  timerCard:        { backgroundColor: C.consumer.light, borderRadius: 12, padding: 12, marginTop: 12 },
  timerLabel:       { fontSize: 11, fontWeight: '700', color: C.consumer.primary, marginBottom: 8 },
  timerDisplay:     { fontSize: 26, fontWeight: '800', color: C.consumer.primary, fontVariant: ['tabular-nums'] },
  timerActionBtn:   { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.consumer.border, borderRadius: 8, backgroundColor: '#fff' },
  timerActionBtnPrimary: { backgroundColor: C.consumer.primary, borderColor: C.consumer.primary },
  timerActionBtnText: { fontSize: 11, fontWeight: '700', color: C.consumer.primary },
  timerPreset:      { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: C.consumer.border, borderRadius: 8, backgroundColor: '#fff' },
  timerPresetText:  { fontSize: 11, fontWeight: '700', color: C.consumer.primary },

  helpToggle:       { borderWidth: 1, borderStyle: 'dashed', borderColor: C.consumer.border, paddingVertical: 10, alignItems: 'center', borderRadius: 10, marginTop: 8 },
  helpToggleText:   { fontSize: 12, fontWeight: '700', color: C.consumer.primary },

  assistantCard:    { backgroundColor: '#fef9c3', borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: '#fde68a' },
  assistantHeader:  { fontSize: 12, fontWeight: '800', color: '#854d0e' },
  assistantResultTitle:  { fontSize: 11, fontWeight: '800', color: '#854d0e', marginBottom: 4 },
  assistantResultAnswer: { fontSize: 13, color: '#713f12', lineHeight: 19 },
  assistantLink:    { fontSize: 11, fontWeight: '700', color: '#a16207', marginTop: 6 },
  assistantInput:   { flex: 1, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#fde68a', paddingHorizontal: 10, paddingVertical: 8, fontSize: 12, color: '#713f12' },
  assistantAskBtn:  { backgroundColor: '#a16207', paddingHorizontal: 14, justifyContent: 'center', borderRadius: 10 },
  assistantAskBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  navBtn:           { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  navBtnSecondary:  { backgroundColor: '#fff', borderWidth: 1, borderColor: C.consumer.border },
  navBtnSecondaryText: { fontSize: 13, fontWeight: '700', color: C.gray[600] },
  navBtnPrimary:    { backgroundColor: C.consumer.primary },
  navBtnPrimaryText:{ fontSize: 13, fontWeight: '700', color: '#fff' },

  donePrimaryBtn:   { backgroundColor: C.consumer.primary, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  donePrimaryBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  doneSecondaryBtn: { borderWidth: 1, borderColor: C.consumer.border, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
  doneSecondaryBtnText: { color: C.consumer.primary, fontSize: 14, fontWeight: '700' },

  modalBackdrop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 16 },
  modalSheet:       { backgroundColor: '#fff', borderRadius: 20, padding: 20 },
  modalTitle:       { fontSize: 18, fontWeight: '800', color: C.gray[900], marginTop: 6 },
  modalSub:         { fontSize: 13, color: C.gray[500], marginTop: 2 },
  modalLabel:       { fontSize: 11, fontWeight: '800', color: C.gray[700], marginBottom: 6 },
  modalInput:       { borderWidth: 1, borderColor: C.gray[200], borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.gray[900], marginBottom: 12 },
  modalError:       { color: C.red, fontSize: 12, marginBottom: 12, lineHeight: 16 },
  modalPrimaryBtn:  { backgroundColor: C.consumer.primary, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalPrimaryBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  modalSecondaryBtn:{ borderWidth: 1, borderColor: C.gray[200], paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  modalSecondaryBtnText: { color: C.gray[600], fontSize: 13, fontWeight: '700' },
});
