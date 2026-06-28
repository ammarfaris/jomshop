# Color Theme Feature

## Overview

The JomContest app now supports customizable color themes, allowing users to personalize their experience by choosing between different color schemes. This feature is inspired by [shadcn/ui themes](https://ui.shadcn.com/themes) and provides a seamless, cross-platform theming solution.

## Available Themes

### 🟢 Green (Default)
The original JomContest brand color - fresh, natural, and vibrant.
- Used in: BETA badge, welcome text, sign in/out buttons
- Perfect for: Users who prefer the classic JomContest look

### 🔵 Blue
A professional, cool alternative that's easy on the eyes.
- Used in: All interactive elements (upvote, save, share), links, badges
- Perfect for: Users who prefer a more corporate or professional aesthetic

## Where to Change Theme

1. Go to your **Profile** page
2. Scroll to the **Color Theme** section (below the Theme selector)
3. Tap/click on your preferred color (Green or Blue)
4. The theme applies instantly across the entire app!

## What Changes with Theme

When you switch themes, the following elements adapt to your chosen color:

### Interactive Elements
- ✅ **Upvote button** - When you've upvoted a contest
- ✅ **Save button** - When you've saved a contest
- ✅ **Share button** - After sharing a contest

### Contest Details
- ✅ **Time badges** - "Ends in X days" indicators
- ✅ **Links** - Terms & Conditions, FAQ, and other links
- ✅ **Social media card** - Background color for organizer's social links
- ✅ **Info buttons** - "What is this?" tooltips

### Profile & Settings
- ✅ **Theme selector** - Active theme indicator
- ✅ **Text scale selector** - Active size indicator
- ✅ **Receipt indicators** - Contest count displays
- ✅ **Edit buttons** - On receipt thumbnails

## Technical Details

For developers and technical users:

- **Implementation**: CSS variables with Tailwind CSS
- **Cross-platform**: Works on web (Next.js) and native (Expo/React Native)
- **Persistence**: Theme preference is saved to your Appwrite account
- **Performance**: Instant theme switching with no page reload required
- **Accessibility**: Both themes work in light and dark modes

## Documentation

- 📖 [Full Implementation Guide](./COLOR_THEME_IMPLEMENTATION.md) - Detailed technical documentation
- 🚀 [Quick Reference](./QUICK_REFERENCE.md) - Developer quick start guide

## Future Plans

We're considering adding more themes in the future:
- 🟣 Purple - Creative & Bold
- 🟠 Orange - Warm & Energetic
- 🔴 Red - Passionate & Dynamic
- 🎨 Custom - Create your own theme!

Have a theme color suggestion? Let us know through the feedback feature!

## Screenshots

### Green Theme (Default)
The classic JomContest look with vibrant green accents.

### Blue Theme
A professional alternative with cool blue accents.

---

**Note**: Theme preferences are tied to your account. If you're not logged in, the app will use the default Green theme.

