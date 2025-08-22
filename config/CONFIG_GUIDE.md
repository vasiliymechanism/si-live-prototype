# Scholarship App Configuration Guide

This guide explains how to customize the scholarship tracking app through JSON configuration files.

## File Structure

```
project/
├── index.html
├── config/
│   ├── timing-config.json
│   ├── scholarship-states-config.json
│   ├── metrics-config.json
│   └── ui-flow-config.json
└── data/
    ├── feed.json
    └── tasks.json
```

## Configuration Files

### 1. timing-config.json
Controls all timing aspects of the app.

#### Onboarding Timing
```json
"onboarding": {
  "fadeOutDuration": 400,     // How long onboarding fades out (ms)
  "appRevealDelay": 600,      // Delay before showing app (ms)
  "feedSectionDelay": 600     // Delay before showing feed section (ms)
}
```

#### UI Reveal Timing
```json
"uiReveal": {
  "queueSectionDelay": 5600,    // When to show Action Required section (ms)
  "metricsAndNavDelay": 10600,  // When to show metrics and navigation (ms)
  "staggerDelay": 50            // Delay between UI element reveals (ms)
}
```

#### Simulation Speed
```json
"simulation": {
  "initialSearchDelay": 3000,      // Delay before first scholarship search
  "stateTransitionMin": 500,       // Min time between state changes
  "stateTransitionMax": 1500,      // Max time between state changes
  "searchingDurationMin": 2000,    // Min "searching" animation time
  "searchingDurationMax": 4000,    // Max "searching" animation time
  "terminalStateNextSearchMin": 1000,  // Min delay before next scholarship
  "terminalStateNextSearchMax": 2000,  // Max delay before next scholarship
  "simulationResetDelay": 10000    // Time before simulation restarts
}
```

### 2. scholarship-states-config.json
Defines scholarship processing states and transitions.

#### Adding New States
```json
"states": {
  "YOUR_NEW_STATE": {
    "progress": 50,                    // Progress percentage (0-100)
    "label": "Your custom message",    // Status text shown to user
    "type": "normal",                  // Visual style: normal|success|caution|failed
    "icon": "🎯",                     // Optional emoji icon
    "duration": { "min": 800, "max": 1200 }  // Optional duration range
  }
}
```

#### State Types
- **normal**: Blue progress bar, standard text color
- **success**: Green progress bar and text
- **caution**: Orange progress bar and text (action required)
- **failed**: Gray progress bar and text

#### Configuring State Transitions
```json
"transitions": {
  "CURRENT_STATE": {
    "NEXT_STATE_1": 0.7,    // 70% chance
    "NEXT_STATE_2": 0.3     // 30% chance
  }
}
```

#### Terminal States
States where scholarship processing stops:
```json
"terminalStates": ["SUBMITTED", "DEADLINE_PASSED", "NOT_ELIGIBLE"]
```

### 3. metrics-config.json
Defines how metrics are calculated from scholarship data.

#### Metric Configuration
```json
{
  "key": "uniqueIdentifier",        // Internal identifier
  "label": "displayed",             // Text shown under metric
  "format": "currency",             // How to format the value
  "calculation": {
    "type": "sum",                  // Calculation method
    "source": "scholarships",      // Data source
    "field": "amount",              // Field to calculate from
    "filter": {                     // Optional: only include matching items
      "currentState": ["SUBMITTED"]
    }
  }
}
```

#### Calculation Types
- **count**: Count matching items
- **sum**: Add up values from a field
- **average**: Calculate average of a field

#### Format Types
- **number**: Plain number (e.g., "37")
- **currency**: Dollar format (e.g., "$124,500") 
- **duration**: Time format (e.g., "3h 45m")

#### Filter Options
Filters support exact matches or arrays of acceptable values:
```json
"filter": {
  "currentState": ["SUBMITTED", "READY_TO_SUBMIT"],  // Array of states
  "amount": 5000                                     // Exact match
}
```

### 4. ui-flow-config.json
Controls the sequence of UI reveals and their dependencies.

#### Reveal Sequence
```json
"revealSequence": [
  {
    "step": "stepName",              // Unique identifier
    "delay": 5000,                   // Delay in milliseconds
    "dependencies": ["previousStep"], // Steps that must complete first
    "effects": ["showSomething"]     // Actions to perform
  }
]
```

#### Available Effects
- **showFeedSection**: Make feed section visible
- **startSimulation**: Begin scholarship simulation
- **showQueueSection**: Show Action Required section
- **addHasQueueClass**: Add queue-related CSS class
- **addWithNavClass**: Reserve space for navigation
- **showNavPlaceholder**: Show navigation placeholder
- **showMetricsBar**: Display metrics section
- **showNavigation**: Show actual navigation tabs
- **hideNavPlaceholder**: Hide navigation placeholder
- **addHasMetricsClass**: Add metrics-related CSS class

## Example Customizations

### Speed Up the Entire Experience
```json
// In timing-config.json
"uiReveal": {
  "queueSectionDelay": 2000,    // Show after 2 seconds instead of 5.6
  "metricsAndNavDelay": 4000    // Show after 4 seconds total instead of 10.6
}
```

### Add a GPA Verification State
```json
// In scholarship-states-config.json
"states": {
  "CHECKING_GPA": {
    "progress": 20,
    "label": "Verifying GPA requirements",
    "type": "normal",
    "icon": "🎓"
  }
}
```

### Create a Success Rate Metric
```json
// In metrics-config.json
{
  "key": "successRate",
  "label": "success rate",
  "format": "percentage",
  "calculation": {
    "type": "ratio",
    "numerator": {"filter": {"currentState": ["SUBMITTED"]}},
    "denominator": {"filter": {"currentState": ["NOT_ELIGIBLE", "DEADLINE_PASSED", "SUBMITTED"]}}
  }
}
```

### Make Metrics Appear Earlier
```json
// In ui-flow-config.json
"revealSequence": [
  {
    "step": "metricsAndNav",
    "delay": 2000,        // Reduced from 5000
    "dependencies": ["queueSection"]
  }
]
```

## Tips

1. **Test Incremental Changes**: Modify one config at a time to see the impact
2. **Use Browser DevTools**: Check console for config loading errors
3. **Backup Configs**: Keep working configurations before experimenting
4. **State Dependencies**: Ensure state transitions make logical sense
5. **Performance**: Very short delays (< 100ms) may cause visual glitches

## Fallback Behavior

If config files fail to load, the app uses sensible defaults to ensure it still functions. Check browser console for loading errors when testing new configurations.