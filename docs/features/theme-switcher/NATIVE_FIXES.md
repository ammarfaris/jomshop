# Native Theme Fixes - Flickering & System Mode

## 🐛 Issues Fixed

### Issue 1: Flickering when switching themes
**Symptom:** Light and Dark buttons work but UI flickers during transition

**Root Cause:** Two competing theme loaders:
1. `useThemeSync` in Provider (loading from the Supabase profile)
2. `useEffect` in `ThemeSelector.tsx` (also loading from the Supabase profile)

Both were trying to load and apply theme simultaneously, causing conflicts.

**Fix:** Removed duplicate loading logic from `ThemeSelector.tsx`

```typescript
// ❌ REMOVED: Duplicate loading causing flickering
useEffect(() => {
  const loadThemeFromProfile = async () => {
    if (!user) return
    const prefs = await getUserPrefs()
    const savedTheme = (prefs as any)?.theme as ThemeMode
    if (savedTheme && savedTheme !== currentThemeMode) {
      setThemeMode(savedTheme) // ← Conflict with useThemeSync!
    }
  }
  loadThemeFromProfile()
}, [user, currentThemeMode, setThemeMode])

// ✅ REPLACED WITH: Comment explaining single source of truth
// Note: Theme loading from the Supabase profile is handled by useThemeSync in Provider
// No need to load here to avoid conflicts and flickering
```

### Issue 2: System mode not working
**Symptom:** Clicking "System" button doesn't apply device theme

**Root Causes:**
1. **Stale dependencies in useEffect**: The Appearance listener wasn't re-running when needed
2. **Missing reactivity**: System theme changes weren't triggering NativeWind updates
3. **Dependency issues**: `useCallback` had incomplete dependencies

**Fixes:**

#### Fix 1: Separated system detection from application
```typescript
// ❌ BEFORE: Combined detection and application in one effect
useEffect(() => {
  const subscription = Appearance.addChangeListener(({ colorScheme }) => {
    const newScheme = colorScheme === 'dark' ? 'dark' : 'light'
    setSystemColorScheme(newScheme)
    
    // This only runs when effect re-runs, not when themeMode changes!
    if (themeMode === 'system') {
      nativeHook.setColorScheme(newScheme)
    }
  })
  return () => subscription.remove()
}, [themeMode, nativeHook.setColorScheme]) // ← Recreating listener unnecessarily
```

```typescript
// ✅ AFTER: Separated into two effects

// Effect 1: Listen to system changes (never recreates)
useEffect(() => {
  const subscription = Appearance.addChangeListener(({ colorScheme }) => {
    const newScheme = colorScheme === 'dark' ? 'dark' : 'light'
    console.log('[useColorScheme] System theme changed to:', newScheme)
    setSystemColorScheme(newScheme)
  })
  return () => subscription.remove()
}, []) // ← Only runs once

// Effect 2: Apply system theme when needed (reactive)
useEffect(() => {
  if (themeMode === 'system') {
    console.log('[useColorScheme] Theme mode is system, applying:', systemColorScheme)
    nativeHook.setColorScheme(systemColorScheme)
  }
}, [themeMode, systemColorScheme, nativeHook]) // ← Runs when any of these change
```

#### Fix 2: Fixed useCallback dependencies
```typescript
// ❌ BEFORE: Incomplete dependencies
const setThemeMode = useCallback(async (mode: ThemeMode) => {
  // ...
  if (mode === 'system') {
    nativeHook.setColorScheme(systemColorScheme)
  } else {
    nativeHook.setColorScheme(mode)
  }
}, [systemColorScheme, nativeHook.setColorScheme]) // ← Only function, not object
```

```typescript
// ✅ AFTER: Complete dependencies
const setThemeMode = useCallback(async (mode: ThemeMode) => {
  console.log('[useColorScheme] setThemeMode called with:', mode)
  // ...
  if (mode === 'system') {
    console.log('[useColorScheme] Applying system theme:', systemColorScheme)
    nativeHook.setColorScheme(systemColorScheme)
  } else {
    console.log('[useColorScheme] Applying theme:', mode)
    nativeHook.setColorScheme(mode)
  }
}, [systemColorScheme, nativeHook]) // ← Full object reference
```

#### Fix 3: Added default system theme on first load
```typescript
// ❌ BEFORE: No default if no saved preference
if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
  setThemeModeState(savedMode as ThemeMode)
  // Apply theme...
}
// If no savedMode, nothing happens! User sees wrong theme.
```

```typescript
// ✅ AFTER: Default to system theme
if (savedMode && ['light', 'dark', 'system'].includes(savedMode)) {
  setThemeModeState(savedMode as ThemeMode)
  // Apply theme...
} else {
  console.log('[useColorScheme] No saved theme, using system:', systemColorScheme)
  // Default to system theme
  nativeHook.setColorScheme(systemColorScheme)
}
```

#### Fix 4: Updated effect dependencies
```typescript
// ❌ BEFORE: Empty dependencies (only runs once)
useEffect(() => {
  const loadThemePreference = async () => {
    // ...
  }
  loadThemePreference()
}, []) // ← Never re-runs if systemColorScheme changes
```

```typescript
// ✅ AFTER: Proper dependencies
useEffect(() => {
  const loadThemePreference = async () => {
    // ...
  }
  loadThemePreference()
}, [systemColorScheme, nativeHook]) // ← Re-runs when system theme detected
```

## 📊 Before vs After

### Before
```
User clicks "System"
    ↓
setThemeMode('system') called
    ↓
Saves to AsyncStorage ✅
    ↓
Tries to apply system theme...
    ↓
❌ Uses stale systemColorScheme value
❌ Effect doesn't re-run when themeMode changes
❌ NativeWind never updates
    ↓
Result: Button highlights but theme doesn't change
```

### After
```
User clicks "System"
    ↓
setThemeMode('system') called
    ↓
Saves to AsyncStorage ✅
    ↓
setThemeModeState('system') updates state
    ↓
Effect detects themeMode === 'system' ✅
    ↓
Reads current systemColorScheme ✅
    ↓
Applies to NativeWind ✅
    ↓
Result: Theme changes immediately! 🎉
```

## 🧪 Testing

### Test 1: No More Flickering
1. Open app → Go to Profile
2. Click "Dark" → Should change smoothly ✅
3. Click "Light" → Should change smoothly ✅
4. No flickering or double-loading ✅

### Test 2: System Mode Works
1. Click "System" button
2. App should immediately match device theme ✅
3. Go to device Settings → Toggle Dark Mode
4. Return to app → Theme should update automatically ✅

### Test 3: Persistence
1. Select "System"
2. Close app
3. Reopen app
4. Should still be in system mode ✅
5. Should match current device theme ✅

### Test 4: Cross-Device (No Flickering)
1. Device A: Change to "Dark"
2. Device B: Open app
3. Should load dark theme smoothly (no flicker) ✅

## 🔍 Debug Logs

With the new console logs, you can trace the theme flow:

```
[useColorScheme] Loading theme from AsyncStorage: system
[useColorScheme] Applying system theme: dark
[useColorScheme] Theme mode is system, applying: dark
ThemeSelector render - currentThemeMode: system Platform: ios

// User clicks "Light"
handleThemeChange called: light current: system
Calling setThemeMode with: light
[useColorScheme] setThemeMode called with: light
[useColorScheme] Saved to AsyncStorage: light
[useColorScheme] Applying theme: light
setThemeMode called successfully
Saving to Supabase profile...
Saved to Supabase profile successfully

// User clicks "System"
handleThemeChange called: system current: light
Calling setThemeMode with: system
[useColorScheme] setThemeMode called with: system
[useColorScheme] Saved to AsyncStorage: system
[useColorScheme] Applying system theme: dark
[useColorScheme] Theme mode is system, applying: dark

// User toggles device dark mode
[useColorScheme] System theme changed to: light
[useColorScheme] Theme mode is system, applying: light
```

## 📁 Files Changed

### 1. `packages/app/features/profile/components/ThemeSelector.tsx`
- ❌ Removed duplicate Supabase profile loading logic
- ✅ Added comment explaining single source of truth
- Result: No more flickering

### 2. `packages/app/hooks/useColorScheme.tsx`
- ✅ Separated system detection from application (2 effects)
- ✅ Fixed useCallback dependencies
- ✅ Added default system theme on first load
- ✅ Updated effect dependencies
- ✅ Added comprehensive debug logging
- Result: System mode now works perfectly

## ✅ Success Criteria

All issues resolved:
- ✅ No flickering when switching themes
- ✅ System mode applies device theme immediately
- ✅ System mode updates when device theme changes
- ✅ Theme persists across app restarts
- ✅ Cross-device sync works smoothly
- ✅ Proper debug logging for troubleshooting

## 🎯 Key Learnings

### 1. Single Source of Truth
**Problem:** Multiple components loading from same source
**Solution:** One loader (`useThemeSync`), others just consume

### 2. Effect Dependencies Matter
**Problem:** Stale closures in effects
**Solution:** Include all used values in dependency array

### 3. Separate Concerns
**Problem:** One effect doing too much
**Solution:** Split into focused, reactive effects

### 4. Default Values
**Problem:** No fallback when no saved preference
**Solution:** Always provide sensible defaults

### 5. Debug Logging
**Problem:** Hard to trace theme flow
**Solution:** Strategic console.logs at key points

## 🚀 Next Steps (Optional)

Now that core functionality works, consider:
- [ ] Add theme transition animations
- [ ] Add haptic feedback on theme change
- [ ] Add theme preview before applying
- [ ] Optimize re-renders with useMemo
- [ ] Add theme change analytics

---

**Status:** ✅ All native theme issues resolved!
**Date:** November 17, 2025
**Version:** 3.3

