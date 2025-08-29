# Scholarship Institute - Demo Platform

A single-page web application prototype for demonstrating scholarship matching and application automation. Designed for usability testing on iPhone SE.

## Quick Start

1. **Deploy to GitHub Pages:**
   - Create a new GitHub repository
   - Upload all files maintaining the directory structure
   - Go to Settings > Pages
   - Select "Deploy from a branch" and choose main/root
   - Your demo will be available at `https://[username].github.io/[repo-name]`

2. **Local Testing:**
   - Open `index.html` directly in a browser
   - Or use a local server: `python -m http.server 8000`

## Directory Structure

```
scholarship-institute/
├── index.html              # Main HTML file
├── css/
│   └── style.css          # All styles
├── js/
│   ├── main.js            # Main application controller
│   ├── State.js           # State management
│   ├── UI.js              # UI interactions
│   ├── Scholarship.js     # Scholarship progression logic
│   ├── Metrics.js         # Metrics calculations
│   ├── Event.js           # Event handling
│   └── Quiz.js            # Quiz system
├── data/                  # JSON data files (optional)
│   ├── feed.json          # Scholarship data
│   ├── tasks.json         # Action configurations
│   └── quiz.json          # Quiz questions
├── config/                # Configuration files (optional)
│   ├── timing-config.json # Timing settings
│   ├── scholarship-states-config.json
│   ├── metrics-config.json
│   └── ui-flow-config.json
└── README.md              # This file
```

## Configuration Guide

All configuration is currently embedded in the JavaScript files for simplicity. To modify settings, edit the following:

### 1. Timing Configuration (js/main.js)

```javascript
CONFIG.timings = {
    initialDelay: 2000,              // Delay before app starts (ms)
    firstScholarshipDelay: 3000,     // Delay before first scholarship (ms)
    spotlightDelay: 500,            // Delay before spotlight effect (ms)
    paywallDelay: 30000,            // Delay before paywall appears (ms)
    
    stateTransitions: {
        scanning: { 
            min: 2000,               // Minimum time in state (ms)
            max: 4000,               // Maximum time in state (ms)
            timeSaved: { 
                min: 5,              // Min time saved (minutes)
                max: 10              // Max time saved (minutes)
            }
        },
        // ... other states
    },
    
    newScholarshipInterval: { 
        min: 8000,                   // Min time between new scholarships
        max: 15000                   // Max time between new scholarships
    }
}
```

### 2. State Progression Probabilities (js/main.js)

```javascript
CONFIG.stateProgression = {
    checkingEligibility: [
        { next: 'actionRequired:confirmEligibility', probability: 0.4 },
        { next: 'notEligible', probability: 0.1 },
        { next: 'matchFound', probability: 0.5 }
    ],
    // ... other states
}
```

### 3. UI Features (js/main.js)

```javascript
CONFIG.enableSpotlight = true;           // Enable/disable spotlight effect
CONFIG.enableDimming = true;             // Enable/disable UI dimming
CONFIG.pauseNewScholarshipsOnAction = false;  // Pause new scholarships
CONFIG.pauseAllProgressOnAction = false;      // Pause all progress
CONFIG.maxVisibleScholarships = 10;      // Max scholarships in feed
```

### 4. Scholarship Data (js/State.js)

```javascript
scholarshipData: [
    { 
        name: "National Merit Scholarship",
        amount: 2500,                    // Award amount in dollars
        deadline: 7,                     // Days until deadline
        quizUnlock: "gpa"               // Quiz question that unlocks it
    },
    // ... add more scholarships
]
```

### 5. Quiz Questions (js/Quiz.js)

```javascript
config: {
    questions: [
        {
            id: 'gpa',
            type: 'single-select',       // Question type
            title: 'What is your GPA?',
            description: 'Select your range',
            options: [
                { value: '4.0+', label: '4.0 or above' },
                // ... more options
            ],
            next: 'major'                // Next question ID or function
        },
        // ... more questions
    ]
}
```

## Customization Tips

### Adding New Scholarships
1. Edit `js/State.js`
2. Add to the `scholarshipData` array
3. Include `quizUnlock` field to link to specific quiz questions

### Modifying Quiz Flow
1. Edit `js/Quiz.js`
2. Add new questions to the `config.questions` array
3. Use branching logic by making `next` a function:
```javascript
next: (answers) => {
    if (answers.gpa === '4.0+') {
        return 'honors';
    }
    return 'major';
}
```

### Adjusting Timing
1. Edit `CONFIG.timings` in `js/main.js`
2. All times are in milliseconds
3. Time saved values are in minutes

### Changing Visual Appearance
1. Edit `css/style.css`
2. Key color variables:
   - Background: `#0a0a0a`
   - Primary blue: `#3b82f6`
   - Success green: `#4ade80`
   - Warning orange: `#f59e0b`
   - Error red: `#ef4444`

## Features

- **Onboarding Flow**: Landing page → Searching → First scholarship → Full UI
- **Scholarship States**: Automatic progression through realistic states
- **Action Queue**: Required user actions with priority sorting
- **Quiz System**: Branching quiz with multiple question types
- **Spotlight Effect**: Configurable UI dimming to highlight CTAs
- **Metrics Dashboard**: Real-time tracking of matches, awards, and progress
- **Paywall Modal**: Triggered when ready to submit applications

## Question Types Supported

- **Interstitial**: Information screens with continue button
- **Single-select**: Radio button style selection
- **Multi-select**: Checkbox style multiple selection
- **Text input**: Free text entry
- **Date selector**: Date of birth input
- **File upload**: Document upload with drag & drop
- **Checkbox**: Terms acceptance

## Testing Notes

- Refresh the page to reset the demo
- The paywall CTAs don't process actual payments
- File uploads are simulated (no actual upload)
- All progression continues visibly in the background

## Browser Compatibility

- Optimized for iPhone SE (375px width)
- Works on all modern browsers
- Best tested in Chrome/Safari mobile view

## Troubleshooting

**Scholarships not appearing:**
- Check console for errors
- Verify `CONFIG.timings.newScholarshipInterval` values
- Ensure `State.appState.isRunning` is true

**Quiz not unlocking scholarships:**
- Verify `quizUnlock` field matches quiz question ID
- Check `State.appState.quizAnswers` contains the answer

**Spotlight not working:**
- Ensure `CONFIG.enableSpotlight` is true
- Check z-index values in CSS

## Support

For modifications beyond configuration, edit the relevant JavaScript module:
- `main.js` - Application flow
- `State.js` - Data management
- `UI.js` - Visual updates
- `Scholarship.js` - Progression logic
- `Quiz.js` - Quiz behavior
- `Event.js` - User interactions
- `Metrics.js` - Statistics calculations