# Color Theme Testing Checklist

## Pre-Testing Setup

- [ ] Ensure you have a test account logged in
- [ ] Clear browser cache (for web testing)
- [ ] Restart app (for native testing)

## Theme Switching Tests

### Basic Functionality
- [ ] Navigate to Profile page
- [ ] Locate Color Theme selector (below Theme selector)
- [ ] Click/tap Green theme option
  - [ ] Green theme applies instantly
  - [ ] Green option shows as selected (border and background)
- [ ] Click/tap Blue theme option
  - [ ] Blue theme applies instantly
  - [ ] Blue option shows as selected (border and background)
- [ ] Switch back to Green
  - [ ] Green theme applies instantly

### Persistence Tests
- [ ] Select Blue theme
- [ ] Reload page/app
  - [ ] Blue theme is still active
- [ ] Select Green theme
- [ ] Close and reopen app
  - [ ] Green theme is still active
- [ ] Log out
- [ ] Log back in
  - [ ] Last selected theme is still active

## Visual Verification

### Interactive Elements - Inactive State
- [ ] Upvote button (not upvoted) - Gray
- [ ] Save button (not saved) - Gray
- [ ] Share button (not shared) - Gray

### Interactive Elements - Active State (Green Theme)
- [ ] Upvote button (upvoted) - Green
- [ ] Save button (saved) - Green
- [ ] Share button (just shared) - Green

### Interactive Elements - Active State (Blue Theme)
- [ ] Upvote button (upvoted) - Blue
- [ ] Save button (saved) - Blue
- [ ] Share button (just shared) - Blue

### Contest Detail Screen (Green Theme)
- [ ] "Ends in X days" badge - Green background
- [ ] "What is this?" button - Green background
- [ ] Terms & Conditions link - Green text
- [ ] FAQ link - Green text
- [ ] Social media card - Green-tinted background

### Contest Detail Screen (Blue Theme)
- [ ] "Ends in X days" badge - Blue background
- [ ] "What is this?" button - Blue background
- [ ] Terms & Conditions link - Blue text
- [ ] FAQ link - Blue text
- [ ] Social media card - Blue-tinted background

### Profile Screen (Green Theme)
- [ ] Theme selector active option - Green border/background
- [ ] Color Theme selector (Green selected) - Green border/background
- [ ] Text Scale selector active option - Green border/background

### Profile Screen (Blue Theme)
- [ ] Theme selector active option - Blue border/background
- [ ] Color Theme selector (Blue selected) - Blue border/background
- [ ] Text Scale selector active option - Blue border/background

### Receipt Manager (Green Theme)
- [ ] "Contests With Receipts" indicator - Green background
- [ ] Edit button on receipt thumbnail - Green background
- [ ] Receipt thumbnail hover state - Green border

### Receipt Manager (Blue Theme)
- [ ] "Contests With Receipts" indicator - Blue background
- [ ] Edit button on receipt thumbnail - Blue background
- [ ] Receipt thumbnail hover state - Blue border

### Markdown Links (Green Theme)
- [ ] Links in contest descriptions - Green text with underline

### Markdown Links (Blue Theme)
- [ ] Links in contest descriptions - Blue text with underline

## Dark Mode Tests

### Green Theme + Dark Mode
- [ ] All green elements are visible and properly contrasted
- [ ] Interactive elements (upvote, save, share) are readable
- [ ] Links are visible and accessible
- [ ] Badges and buttons have proper contrast

### Blue Theme + Dark Mode
- [ ] All blue elements are visible and properly contrasted
- [ ] Interactive elements (upvote, save, share) are readable
- [ ] Links are visible and accessible
- [ ] Badges and buttons have proper contrast

## Platform-Specific Tests

### Web (Next.js)
- [ ] Theme switches instantly without page reload
- [ ] No console errors when switching themes
- [ ] Theme persists across browser tabs
- [ ] Theme works in incognito/private mode (defaults to green)

### iOS (Expo)
- [ ] Theme switches smoothly
- [ ] No crashes when switching themes
- [ ] Theme persists after app backgrounding
- [ ] Theme works on different iOS versions

### Android (Expo)
- [ ] Theme switches smoothly
- [ ] No crashes when switching themes
- [ ] Theme persists after app backgrounding
- [ ] Theme works on different Android versions

## Edge Cases

### Not Logged In
- [ ] App defaults to Green theme
- [ ] Color Theme selector is visible in profile
- [ ] Selecting a theme prompts login or saves temporarily

### First Time User
- [ ] App defaults to Green theme
- [ ] User can select Blue theme
- [ ] Selection is saved to Appwrite preferences

### Network Issues
- [ ] Theme selection works offline (local state)
- [ ] Theme syncs to Appwrite when connection restored
- [ ] No errors shown to user during network issues

### Multiple Devices
- [ ] Select Blue on Device A
- [ ] Log in on Device B
  - [ ] Device B loads Blue theme
- [ ] Switch to Green on Device B
- [ ] Reload Device A
  - [ ] Device A now shows Green theme

## Performance Tests

- [ ] Theme switching is instant (< 100ms)
- [ ] No visible flicker or flash when switching
- [ ] No memory leaks after multiple theme switches
- [ ] App remains responsive during theme change

## Accessibility Tests

### Color Contrast
- [ ] Green theme meets WCAG AA contrast requirements
- [ ] Blue theme meets WCAG AA contrast requirements
- [ ] Both themes work with system accessibility settings

### Screen Readers
- [ ] Color Theme selector is properly labeled
- [ ] Theme options are announced correctly
- [ ] Current selection is indicated to screen readers

## Regression Tests

### Existing Features
- [ ] Light/Dark mode toggle still works
- [ ] Text scale selector still works
- [ ] Language switcher still works
- [ ] All other profile settings work correctly

### Contest Features
- [ ] Upvoting contests works
- [ ] Saving contests works
- [ ] Sharing contests works
- [ ] Viewing contest details works
- [ ] Receipt uploads work

## Bug Reporting Template

If you find an issue, report it with:

```
**Issue**: [Brief description]
**Theme**: Green / Blue
**Mode**: Light / Dark
**Platform**: Web / iOS / Android
**Steps to Reproduce**:
1. 
2. 
3. 

**Expected**: [What should happen]
**Actual**: [What actually happened]
**Screenshots**: [If applicable]
```

## Sign-Off

- [ ] All tests passed
- [ ] No critical issues found
- [ ] Ready for production deployment

**Tester Name**: _______________  
**Date**: _______________  
**Platform Tested**: _______________  
**Notes**: _______________

---

## Quick Test (5 minutes)

For a quick smoke test:

1. [ ] Switch to Blue theme in profile
2. [ ] Upvote a contest - should be blue
3. [ ] Save a contest - should be blue
4. [ ] Reload app - should still be blue
5. [ ] Switch to Green theme
6. [ ] Upvote/Save buttons should be green
7. [ ] Reload app - should still be green

If all above pass, the feature is working correctly!

