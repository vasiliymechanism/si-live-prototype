// Global configuration object - will be loaded from JSON files
let CONFIG = {
    maxVisibleScholarships: 10,
    enableSpotlight: true,
    enableDimming: true,
    pauseNewScholarshipsOnAction: false,
    pauseAllProgressOnAction: false,
    timings: {
        initialDelay: 2000,
        firstScholarshipDelay: 3000,
        spotlightDelay: 500,
        paywallDelay: 30000,
        stateTransitions: {
            scanning: { min: 2000, max: 4000, timeSaved: { min: 5, max: 10 } },
            checkingDeadline: { min: 1500, max: 3000, timeSaved: { min: 3, max: 6 } },
            checkingEligibility: { min: 3000, max: 5000, timeSaved: { min: 10, max: 20 } },
            matchFound: { min: 1000, max: 2000, timeSaved: { min: 2, max: 4 } },
            gettingRequirements: { min: 2000, max: 4000, timeSaved: { min: 8, max: 15 } },
//             preparingMaterials: { min: 4000, max: 6000, timeSaved: { min: 15, max: 30 } },
            writingEssay: { min: 5000, max: 8000, timeSaved: { min: 20, max: 40 } },
            finalizingApplication: { min: 3000, max: 5000, timeSaved: { min: 10, max: 20 } },
            readyToSubmit: { min: 1000, max: 2000, timeSaved: { min: 2, max: 5 } }
        },
        newScholarshipInterval: { min: 8000, max: 15000 }
    },
    stateProgression: {
        scanning: [
            { next: 'checkingDeadline', probability: 1.0 }
        ],
        checkingDeadline: [
            { next: 'deadlinePassed', probability: 0.1 },
            { next: 'checkingEligibility', probability: 0.9 }
        ],
        checkingEligibility: [
            { next: 'actionRequired:confirmEligibility', probability: 0.4 },
            { next: 'notEligible', probability: 0.1 },
            { next: 'matchFound', probability: 0.5 }
        ],
        matchFound: [
            { next: 'gettingRequirements', probability: 1.0 }
        ],
        gettingRequirements: [
            { next: 'preparingMaterials', probability: 1.0 }
        ],
        preparingMaterials: [
            { next: 'actionRequired:uploadDocument', probability: 0.3 },
            { next: 'writingEssay', probability: 0.7 }
        ],
        writingEssay: [
            { next: 'finalizingApplication', probability: 1.0 }
        ],
        finalizingApplication: [
            { next: 'actionRequired:updateProfile', probability: 0.2 },
            { next: 'readyToSubmit', probability: 0.8 }
        ],
        readyToSubmit: [
            { next: 'applicationSubmitted', probability: 1.0 }
        ]
    }
};

CONFIG.animations = {
    // Progress bar animations
    progressBarDuration: 500,           // Duration of progress bar width animation (ms)
    progressBarEasing: 'ease-out',      // CSS easing function for progress bar
    statusFadeTime: 200,                // Time for status text fade transition (ms)
    progressNumberDuration: 2000,       // How long to show progress percentage (ms)
    
    // Milestone animations
    milestonePulse: 'pulse',           // Animation name for milestone achievements
    completionPulse: 'completionGlow', // Animation for 100% completion
    milestoneThresholds: [50, 90, 100], // Progress points that trigger animations
    
    // Visual feedback
    amountUpdateScale: 1.1,            // Scale factor for amount updates
    urgencyFlashCount: 2,              // Number of flashes for urgent deadlines
    shimmerEffect: true,               // Enable shimmer on progress changes
    
    // Element update timings
    fadeInDuration: 400,
    slideUpDuration: 300,
    pulseInterval: 300,
    glowInterval: 2000,
    spinSpeed: 1000,
    scholarshipAppearDelay: 1000,
    metricUpdateAnimation: true
};

CONFIG.features = {
    ...CONFIG.features,
    showProgressNumbers: true,         // Show percentage on progress changes
    smoothProgressUpdates: true,       // Use smooth animations vs recreate
    milestoneEffects: true,           // Enable special effects at milestones
    urgencyAnimations: true           // Enable deadline urgency animations
};

// Load configuration from JSON files
async function loadConfigurations() {
    try {
        const [timing, states, metrics, uiFlow, feed, quiz, tasks] = await Promise.all([
            fetch('config/timing-config.json').then(r => r.json()),
            fetch('config/scholarship-states-config.json').then(r => r.json()),
            fetch('config/metrics-config.json').then(r => r.json()),
            fetch('config/ui-flow-config.json').then(r => r.json()),
            fetch('data/feed.json').then(r => r.json()),
            fetch('data/quiz.json').then(r => r.json()),
            fetch('data/tasks.json').then(r => r.json())
        ]);
        
        CONFIG = { ...CONFIG, ...timing, ...states, ...uiFlow };
        State.scholarshipData = feed.scholarships;
        Quiz.config = quiz;
        State.actionTypes = tasks.actionTypes;
        
        console.log('Configuration loaded successfully');
    } catch (error) {
        console.error('Error loading configuration:', error);
    }
}

// Initialize the application
async function initializeApp() {
    await loadConfigurations();
    
    // Initialize state
    State.init();
    
    // Set up event listeners
    document.getElementById('startButton').addEventListener('click', startApp);
    document.getElementById('liveFeedHeader').addEventListener('click', () => UI.toggleFeed('live'));
    document.getElementById('actionQueueHeader').addEventListener('click', () => UI.toggleFeed('action'));
    
    // Set up modal close listeners
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal && !modal.id.includes('quiz')) {
                UI.closeModal(modal.id);
            }
        });
    });
    
    // Prevent paywall form submission
    document.querySelectorAll('.plan-cta').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Demo ends here - no actual subscription');
        });
    });
}

// Start the application flow
function startApp() {
    // Reset state
    State.reset();
    
    // Hide landing, show main app
    document.getElementById('landingScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';
    
    // Start searching animation
    UI.startSearchingAnimation();
    
    // Begin onboarding flow
    setTimeout(() => {
        createFirstScholarship();
    }, CONFIG.timings.firstScholarshipDelay);
}

// Create the first scholarship with special behavior
function createFirstScholarship() {
    const firstScholarshipData = State.scholarshipData[0];
    const firstScholarship = Scholarship.create({
        ...firstScholarshipData,
        isFirst: true,
        forcePath: ['scanning', 'checkingDeadline', 'checkingEligibility', 'actionRequired:confirmEligibility']
    });
    
    State.addScholarship(firstScholarship);
    
    // Show the first scholarship in place of searching
    const searchingState = document.getElementById('searchingState');
    const scholarshipElement = UI.createScholarshipElement(firstScholarship);
    searchingState.innerHTML = '';
    searchingState.appendChild(scholarshipElement);
    
    // Start progressing this scholarship
    Scholarship.progress(firstScholarship);
    
    // Monitor for action required state
    const checkInterval = setInterval(() => {
        if (firstScholarship.state.includes('actionRequired')) {
            clearInterval(checkInterval);
            transitionToFullUI(firstScholarship);
        }
    }, 100);
}

// Transition from initial state to full UI
function transitionToFullUI(firstScholarship) {
    // Hide searching state
    document.getElementById('searchingState').style.display = 'none';
    
    // Show accordion container
    document.getElementById('accordionContainer').style.display = 'flex';
    
    // Add scholarship to live feed
    const liveFeedContent = document.getElementById('liveFeedContent');
    liveFeedContent.appendChild(UI.createScholarshipElement(firstScholarship));
    
    // Show metrics header
    document.getElementById('metricsHeader').classList.remove('hidden');
    Metrics.initialize();
    
    // Show footer
    document.getElementById('footerMenu').classList.remove('hidden');

    // Add first action with proper click handler binding
    setTimeout(() => {
        const action = {
            id: 'first-profile-action',
            type: 'updateProfile',
            title: 'Update profile to confirm matches',
            scholarshipCount: 1,
            priority: true,
            isFirst: true
        };
        
        // Define onclick separately to ensure it's bound correctly
        action.onclick = function() {
            console.log('Profile action clicked'); // Debug log
            if (CONFIG.enableSpotlight && CONFIG.enableDimming) {
                UI.removeSpotlight();
            }
            Quiz.open();
        };
        
        Event.addAction(action);
        
        // Apply spotlight after action is rendered
        if (CONFIG.enableSpotlight && CONFIG.enableDimming) {
            setTimeout(() => {
                UI.applySpotlight('updateProfileAction');
            }, 100); // Reduced delay to ensure element exists
        }
    }, 500);

    // // Add first action
    // setTimeout(() => {
    //     Event.addAction({
    //         type: 'updateProfile',
    //         title: 'Update profile to confirm matches',
    //         scholarshipCount: 1,
    //         priority: true,
    //         isFirst: true,
    //         onclick: () => {
    //             if (CONFIG.enableSpotlight && CONFIG.enableDimming) {
    //                 UI.removeSpotlight();
    //             }
    //             Quiz.open();
    //         }
    //     });
        
    //     // Apply spotlight effect if enabled
    //     if (CONFIG.enableSpotlight && CONFIG.enableDimming) {
    //         setTimeout(() => {
    //             UI.applySpotlight('updateProfileAction');
    //         }, CONFIG.timings.spotlightDelay);
    //     }
    // }, 500);
    
    // Start generating more scholarships
    setTimeout(() => {
        if (!State.appState.isPaused && !CONFIG.pauseNewScholarshipsOnAction) {
            Scholarship.startGeneration();
        }
    }, 5000);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);// js/main.js - Main Application Controller

