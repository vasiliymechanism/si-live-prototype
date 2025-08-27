// js/State.js - State Management Module

const State = {
    // Application state
    appState: {
        isRunning: false,
        isPaused: false,
        newScholarshipsPaused: false,
        allProgressPaused: false,
        scholarships: [],
        actions: [],
        metrics: {
            matches: 0,
            potentialAwards: 0,
            applicationsStarted: 0,
            readyToApply: 0,
            nextDeadline: null,
            timeSaved: 0
        },
        quizAnswers: {},
        currentQuizQuestion: 0,
        userHasFreeTrial: false,
        completedActions: []
    },
    
    // Scholarship data pool
    scholarshipData: [
        { name: "National Merit Scholarship", amount: 2500, deadline: 7, quizUnlock: "gpa" },
        { name: "Gates Millennium Scholars Program", amount: 15000, deadline: 14, quizUnlock: "major" },
        { name: "Coca-Cola Scholars Foundation", amount: 20000, deadline: 21 },
        { name: "Dell Scholars Program", amount: 5000, deadline: 30, quizUnlock: "financialNeed" },
        { name: "Amazon Future Engineer Scholarship", amount: 40000, deadline: 45, quizUnlock: "major" },
        { name: "Google Lime Scholarship", amount: 10000, deadline: 10 },
        { name: "Microsoft Disability Scholarship", amount: 5000, deadline: 18 },
        { name: "Adobe Design Achievement Awards", amount: 8000, deadline: 25 },
        { name: "STEM Premier Scholarship", amount: 3000, deadline: 35, quizUnlock: "major" },
        { name: "Jack Kent Cooke Foundation", amount: 55000, deadline: 40, quizUnlock: "gpa" },
        { name: "Elks National Foundation", amount: 4000, deadline: 12 },
        { name: "Ron Brown Scholar Program", amount: 40000, deadline: 28, quizUnlock: "extracurriculars" },
        { name: "Horatio Alger Scholarship", amount: 25000, deadline: 50, quizUnlock: "financialNeed" },
        { name: "Burger King Scholars Program", amount: 1000, deadline: 8 },
        { name: "Davidson Fellows Scholarship", amount: 50000, deadline: 60 }
    ],
    
    // Action types configuration
    actionTypes: {
        updateProfile: {
            subtypes: [
                "Complete basic information",
                "Add academic history",
                "Update financial information",
                "Add extracurricular activities"
            ]
        },
        uploadDocument: {
            subtypes: [
                "Upload transcript (unofficial)",
                "Upload transcript (official)",
                "Upload recommendation letter",
                "Upload financial aid form",
                "Upload proof of enrollment"
            ]
        },
        confirmEligibility: {
            subtypes: [
                "Confirm GPA requirement",
                "Verify enrollment status",
                "Confirm major/field of study",
                "Verify citizenship status"
            ]
        }
    },
    
    // Initialize state
    init() {
        this.reset();
    },
    
    // Reset state to initial values
    reset() {
        this.appState = {
            isRunning: true,
            isPaused: false,
            newScholarshipsPaused: false,
            allProgressPaused: false,
            scholarships: [],
            actions: [],
            metrics: {
                matches: 0,
                potentialAwards: 0,
                applicationsStarted: 0,
                readyToApply: 0,
                nextDeadline: null,
                timeSaved: 0
            },
            quizAnswers: {},
            currentQuizQuestion: 0,
            userHasFreeTrial: false,
            completedActions: []
        };
    },
    
    // Add scholarship to state
    addScholarship(scholarship) {
        this.appState.scholarships.push(scholarship);
    },
    
    // Get scholarship by ID
    getScholarship(id) {
        return this.appState.scholarships.find(s => s.id === id);
    },
    
    // Update scholarship
    updateScholarship(id, updates) {
        const scholarship = this.getScholarship(id);
        if (scholarship) {
            Object.assign(scholarship, updates);
        }
    },
    
    // Add action to queue
    addAction(action) {
        // Check if action already exists
        const exists = this.appState.actions.find(a => 
            a.type === action.type && 
            a.scholarshipId === action.scholarshipId &&
            a.subtype === action.subtype
        );
        
        if (!exists) {
            this.appState.actions.push({
                ...action,
                id: Date.now() + Math.random(),
                timestamp: Date.now()
            });
            return true;
        }
        return false;
    },
    
    // Remove action from queue
    removeAction(actionId) {
        this.appState.actions = this.appState.actions.filter(a => a.id !== actionId);
    },
    
    // Mark action as completed
    completeAction(actionType, subtype) {
        this.appState.completedActions.push({
            type: actionType,
            subtype: subtype,
            timestamp: Date.now()
        });
    },
    
    // Check if action has been completed
    isActionCompleted(actionType, subtype) {
        return this.appState.completedActions.some(a => 
            a.type === actionType && a.subtype === subtype
        );
    },
    
    // Get random action subtype
    getRandomActionSubtype(actionType) {
        const subtypes = this.actionTypes[actionType]?.subtypes || [];
    
        // If subtypes is an array of objects, extract the title
        if (subtypes.length > 0) {
            const subtype = subtypes[Math.floor(Math.random() * subtypes.length)];
            
            // Handle both string array and object array
            if (typeof subtype === 'string') {
                return subtype;
            } else if (subtype && typeof subtype === 'object') {
                return subtype.title || subtype.id || 'Unknown action';
            }
        }
        
        return `${actionType} required`; // Fallback string
    },
    
    // Pause/resume scholarship generation
    pauseNewScholarships(pause) {
        this.appState.newScholarshipsPaused = pause;
    },
    
    // Pause/resume all progress
    pauseAllProgress(pause) {
        this.appState.allProgressPaused = pause;
    },
    
    // Add quiz answer
    addQuizAnswer(questionId, answer) {
        this.appState.quizAnswers[questionId] = answer;
    },
    
    // Check if quiz answer unlocks scholarship
    hasQuizUnlock(unlockKey) {
        return this.appState.quizAnswers.hasOwnProperty(unlockKey);
    },
    
    // Update metrics
    updateMetrics(metrics) {
        Object.assign(this.appState.metrics, metrics);
    },
    
    // Add time saved
    addTimeSaved(minutes) {
        this.appState.metrics.timeSaved += minutes;
    }
};